import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { UPLOAD_DIR } from "@/lib/paths";
import { settings } from "@/lib/db/schema";

export const DEFAULT_SYSTEM_NAME = "JH7 Marketing";
export const DEFAULT_LOGO = "/brand/logo.png";

const EXTENSOES = ["png", "jpg", "webp", "svg"] as const;

/** Chaves conhecidas da tabela settings. */
export const SETTING_KEYS = {
  systemName: "system_name",
  logoPath: "logo_path",
  metaToken: "meta_ads_token",
  iaBaseUrl: "ia_base_url",
  iaApiKey: "ia_api_key",
  iaModel: "ia_model",
} as const;

export type AppSettings = {
  systemName: string;
  logoPath: string;
  hasUploadedLogo: boolean;
};

export type MetaSettings = {
  hasToken: boolean;
  /** Últimos 4 caracteres, para exibir qual token está salvo. */
  tokenHint: string | null;
  updatedAt: Date | null;
};

export type IaSettings = {
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
  /** Últimos 4 caracteres, nunca a chave completa. */
  apiKeyHint: string | null;
  updatedAt: Date | null;
};

/** Caminho do logotipo enviado, com versão para evitar cache antigo. */
function logoEnviado(): string | null {
  for (const ext of EXTENSOES) {
    const arquivo = path.join(UPLOAD_DIR, `logo.${ext}`);
    if (!existsSync(arquivo)) continue;
    const versao = Math.floor(statSync(arquivo).mtimeMs);
    return `/api/brand/logo?v=${versao}`;
  }
  return null;
}

export function getSettings(): AppSettings {
  const rows = db
    .select()
    .from(settings)
    .where(inArray(settings.key, [SETTING_KEYS.systemName]))
    .all();

  const nome = rows.find((row) => row.key === SETTING_KEYS.systemName)?.value?.trim();
  const enviado = logoEnviado();

  return {
    systemName: nome || DEFAULT_SYSTEM_NAME,
    logoPath: enviado ?? DEFAULT_LOGO,
    hasUploadedLogo: Boolean(enviado),
  };
}

/** Lê o estado do token da Meta sem nunca expor o valor completo à UI. */
export function getMetaSettings(): MetaSettings {
  const row = db
    .select()
    .from(settings)
    .where(inArray(settings.key, [SETTING_KEYS.metaToken]))
    .get();

  if (!row || !row.value.trim()) {
    return { hasToken: false, tokenHint: null, updatedAt: null };
  }

  const token = row.value.trim();
  return {
    hasToken: true,
    tokenHint: token.length > 8 ? `••••${token.slice(-4)}` : "••••",
    updatedAt: row.updatedAt,
  };
}

/** Valor bruto (servidor apenas — usado pelas chamadas à API da Meta). */
export function getMetaToken(): string | null {
  const row = db
    .select()
    .from(settings)
    .where(inArray(settings.key, [SETTING_KEYS.metaToken]))
    .get();
  const value = row?.value?.trim();
  return value ? value : null;
}

/** Retorna a configuração de IA sem expor a chave secreta completa. */
export function getIaSettings(): IaSettings {
  const rows = db
    .select()
    .from(settings)
    .where(
      inArray(settings.key, [
        SETTING_KEYS.iaBaseUrl,
        SETTING_KEYS.iaApiKey,
        SETTING_KEYS.iaModel,
      ]),
    )
    .all();

  const map = new Map(rows.map((row) => [row.key, row]));
  const apiKey = map.get(SETTING_KEYS.iaApiKey)?.value?.trim() ?? "";
  const keyRow = map.get(SETTING_KEYS.iaApiKey);

  return {
    baseUrl: map.get(SETTING_KEYS.iaBaseUrl)?.value ?? "",
    model: map.get(SETTING_KEYS.iaModel)?.value ?? "",
    hasApiKey: Boolean(apiKey),
    apiKeyHint: apiKey
      ? apiKey.length > 8
        ? `••••${apiKey.slice(-4)}`
        : "••••"
      : null,
    updatedAt: keyRow?.updatedAt ?? null,
  };
}

/** Configuração completa só para chamadas server-side da IA. */
export function getIaConfig() {
  const rows = db
    .select()
    .from(settings)
    .where(
      inArray(settings.key, [
        SETTING_KEYS.iaBaseUrl,
        SETTING_KEYS.iaApiKey,
        SETTING_KEYS.iaModel,
      ]),
    )
    .all();

  const map = new Map(rows.map((row) => [row.key, row.value]));
  const baseUrl = map.get(SETTING_KEYS.iaBaseUrl)?.trim() ?? "";
  const model = map.get(SETTING_KEYS.iaModel)?.trim() ?? "";
  const apiKey = map.get(SETTING_KEYS.iaApiKey)?.trim() ?? "";

  if (!baseUrl || !model) return null;
  return { baseUrl, model, apiKey };
}

export function setSetting(key: string, value: string): void {
  db.insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: new Date() },
    })
    .run();
}
