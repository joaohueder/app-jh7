"use server";

import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/permissions";
import { testConnection } from "@/lib/meta/client";
import { testarConexaoIa, listarModelosIa } from "@/lib/ia/client";
import { getIaConfig, getMetaToken, SETTING_KEYS, setSetting } from "@/lib/settings";

export type SettingsState = {
  ok?: boolean;
  error?: string;
};

export type MetaTestState = {
  ok?: boolean;
  message?: string;
  user?: string;
  accounts?: { id: string; name: string; currency?: string }[];
  testedAt?: string;
};

export type IaTestState = {
  ok?: boolean;
  message?: string;
  reply?: string;
  latencyMs?: number;
};

export type IaModelsState = {
  ok?: boolean;
  message?: string;
  models?: string[];
};

const LIMITE_BYTES = 2 * 1024 * 1024; // 2 MB
import { UPLOAD_DIR } from "@/lib/paths";

const EXT_POR_TIPO: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

const nomeSchema = z
  .string()
  .trim()
  .min(2, "O nome do sistema precisa ter pelo menos 2 caracteres.")
  .max(60, "O nome do sistema pode ter no máximo 60 caracteres.");

function revalidarTudo() {
  revalidatePath("/painel");
  revalidatePath("/configuracoes");
  revalidatePath("/login");
}

/* ------------------------------------------------------------------ */
/* Aba Sistema                                                          */
/* ------------------------------------------------------------------ */

export async function saveSettingsAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requirePermission("configuracoes", "edit");

  const nome = nomeSchema.safeParse(formData.get("systemName"));
  if (!nome.success) {
    return { error: nome.error.issues[0]?.message ?? "Nome inválido." };
  }

  setSetting(SETTING_KEYS.systemName, nome.data);

  const arquivo = formData.get("logo");

  if (arquivo instanceof File && arquivo.size > 0) {
    if (arquivo.size > LIMITE_BYTES) {
      return { error: "O logotipo deve ter no máximo 2 MB." };
    }

    const ext = EXT_POR_TIPO[arquivo.type];
    if (!ext) {
      return { error: "Formato inválido. Envie PNG, JPG, WEBP ou SVG." };
    }

    const bytes = Buffer.from(await arquivo.arrayBuffer());

    mkdirSync(UPLOAD_DIR, { recursive: true });
    // Remove versões antigas para não servir um formato obsoleto.
    for (const antigo of readdirSync(UPLOAD_DIR)) {
      if (antigo.startsWith("logo.")) {
        rmSync(path.join(UPLOAD_DIR, antigo), { force: true });
      }
    }
    writeFileSync(path.join(UPLOAD_DIR, `logo.${ext}`), bytes);
    setSetting(SETTING_KEYS.logoPath, `uploads/logo.${ext}`);
  }

  revalidarTudo();
  return { ok: true };
}

export async function removeLogoAction(): Promise<void> {
  await requirePermission("configuracoes", "edit");

  if (existsUploadsDir()) {
    for (const arquivo of readdirSync(UPLOAD_DIR)) {
      if (arquivo.startsWith("logo.")) {
        rmSync(path.join(UPLOAD_DIR, arquivo), { force: true });
      }
    }
  }

  setSetting(SETTING_KEYS.logoPath, "");
  revalidarTudo();
}

/* ------------------------------------------------------------------ */
/* Aba Meta Ads                                                         */
/* ------------------------------------------------------------------ */

const tokenSchema = z
  .string()
  .trim()
  .min(20, "O token parece incompleto. Cole o token completo gerado na Meta.")
  .max(512, "Token muito longo. Verifique se copiou o campo certo.");

export async function saveMetaTokenAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requirePermission("configuracoes", "edit");

  const token = tokenSchema.safeParse(formData.get("metaToken"));
  if (!token.success) {
    return { error: token.error.issues[0]?.message ?? "Token inválido." };
  }

  setSetting(SETTING_KEYS.metaToken, token.data);
  revalidarTudo();
  return { ok: true };
}

export async function removeMetaTokenAction(): Promise<void> {
  await requirePermission("configuracoes", "edit");
  setSetting(SETTING_KEYS.metaToken, "");
  revalidarTudo();
}

/** Testa a conexão com a Graph API usando o token salvo (ou o digitado). */
export async function testMetaConnectionAction(
  _prev: MetaTestState,
  formData: FormData,
): Promise<MetaTestState> {
  await requirePermission("configuracoes", "edit");

  const digitado = String(formData.get("metaToken") ?? "").trim();
  const token = digitado || (await getMetaToken());

  if (!token) {
    return {
      ok: false,
      message: "Cole o token acima para testar a conexão.",
    };
  }

  const resultado = await testConnection(token);

  if (!resultado.ok) {
    return { ok: false, message: resultado.message };
  }

  return {
    ok: true,
    message: "Conexão estabelecida com a Meta.",
    user: resultado.user,
    accounts: resultado.accounts.map((conta) => ({
      id: conta.id,
      name: conta.name,
      currency: conta.currency,
    })),
    testedAt: new Date().toLocaleString("pt-BR"),
  };
}

/* ------------------------------------------------------------------ */
/* Aba IA                                                              */
/* ------------------------------------------------------------------ */

const iaSchema = z.object({
  baseUrl: z
    .string()
    .trim()
    .url("Informe uma URL válida, incluindo https:// ou http://")
    .max(500, "URL muito longa."),
  model: z
    .string()
    .trim()
    .min(1, "Informe o nome/ID do modelo.")
    .max(200, "Nome de modelo muito longo."),
  apiKey: z.string().trim().max(1000, "Chave muito longa.").optional(),
});

export async function saveIaSettingsAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requirePermission("configuracoes", "edit");

  const parsed = iaSchema.safeParse({
    baseUrl: formData.get("baseUrl"),
    model: formData.get("model"),
    apiKey: formData.get("apiKey"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Configuração inválida." };
  }

  setSetting(SETTING_KEYS.iaBaseUrl, new URL(parsed.data.baseUrl).toString().replace(/\/$/, ""));
  setSetting(SETTING_KEYS.iaModel, parsed.data.model);
  // Campo vazio significa manter a chave existente; substituir só quando
  // o usuário digitar uma nova chave. Remoção é uma ação separada.
  if (parsed.data.apiKey) {
    setSetting(SETTING_KEYS.iaApiKey, parsed.data.apiKey);
  }

  revalidarTudo();
  return { ok: true };
}

export async function removeIaApiKeyAction(): Promise<void> {
  await requirePermission("configuracoes", "edit");
  setSetting(SETTING_KEYS.iaApiKey, "");
  revalidarTudo();
}

export async function testIaConnectionAction(
  _prev: IaTestState,
  formData: FormData,
): Promise<IaTestState> {
  await requirePermission("configuracoes", "edit");

  const baseUrl = String(formData.get("baseUrl") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const digitada = String(formData.get("apiKey") ?? "").trim();
  const salva = await getIaConfig();

  const config = {
    baseUrl: baseUrl || salva?.baseUrl || "",
    model: model || salva?.model || "",
    apiKey: digitada || salva?.apiKey || "",
  };

  if (!config.baseUrl || !config.model) {
    return {
      ok: false,
      message: "Informe a URL do endpoint e o nome do modelo para testar.",
    };
  }

  const parsed = iaSchema.safeParse(config);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "URL ou modelo inválido.",
    };
  }

  const resultado = await testarConexaoIa(parsed.data);
  if (!resultado.ok) {
    return { ok: false, message: resultado.message };
  }

  return {
    ok: true,
    message: `Conexão funcionando — resposta recebida em ${resultado.latencyMs} ms.`,
    reply: resultado.reply,
    latencyMs: resultado.latencyMs,
  };
}

/** Lista os modelos do endpoint (usa a chave salva quando o campo está vazio). */
export async function listarModelosIaAction(
  _prev: IaModelsState,
  formData: FormData,
): Promise<IaModelsState> {
  await requirePermission("configuracoes", "edit");

  const baseUrl = String(formData.get("baseUrl") ?? "").trim();
  const digitada = String(formData.get("apiKey") ?? "").trim();
  const salva = await getIaConfig();
  const apiKey = digitada || salva?.apiKey || "";

  if (!baseUrl) {
    return { ok: false, message: "Informe a URL do endpoint antes de listar os modelos." };
  }

  try {
    new URL(baseUrl);
  } catch {
    return { ok: false, message: "URL do endpoint inválida. Inclua https:// ou http://" };
  }

  const resultado = await listarModelosIa(baseUrl, apiKey || undefined);
  if (!resultado.ok) {
    return { ok: false, message: resultado.message };
  }

  return { ok: true, message: `${resultado.models.length} modelos disponíveis.`, models: resultado.models };
}

function existsUploadsDir(): boolean {
  try {
    readdirSync(UPLOAD_DIR);
    return true;
  } catch {
    return false;
  }
}
