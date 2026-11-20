"use server";

import { z } from "zod";

import { currentUserHasPermission } from "@/lib/auth/permissions";
import { chatAi } from "@/lib/ia/client";
import { getIaConfig } from "@/lib/settings";

const numeroOpcional = z.number().finite().nonnegative().nullable();
const anuncioSchema = z.object({
  id: z.string().min(1).max(100),
  nome: z.string().trim().min(1).max(200),
  status: z.string().max(60),
  objetivo: z.string().max(100),
  conversao: z.string().max(100),
  investido: z.number().finite().nonnegative(),
  impressoes: numeroOpcional,
  alcance: numeroOpcional,
  frequencia: numeroOpcional,
  cliquesLink: numeroOpcional,
  visitasPerfil: numeroOpcional,
  seguidores: numeroOpcional,
  mensagensIniciadas: numeroOpcional,
  visitasPaginaDestino: numeroOpcional,
  adicoesCarrinho: numeroOpcional,
  finalizacoesCompra: numeroOpcional,
  resultadoRotulo: z.string().max(100),
  resultadoValor: numeroOpcional,
  custoPorResultado: numeroOpcional,
  ctr: numeroOpcional,
  cpm: numeroOpcional,
});

const entradaSchema = z.object({
  anuncios: z.array(anuncioSchema).min(1, "Não há anúncios para analisar.").max(100),
  periodo: z.string().max(30),
}).strict();

export type AnaliseIaState = {
  ok: boolean;
  message: string;
  /** Análise curta por id de anúncio. */
  analises?: Record<string, string>;
  /** Texto corrido quando o modelo não devolveu o JSON por anúncio. */
  analise?: string;
};

/** Lê o primeiro objeto JSON do texto (o modelo pode vir com ```json). */
function extrairAnalises(texto: string, ids: Set<string>): Record<string, string> | null {
  const inicio = texto.indexOf("{");
  const fim = texto.lastIndexOf("}");
  if (inicio < 0 || fim <= inicio) return null;
  try {
    const bruto = JSON.parse(texto.slice(inicio, fim + 1)) as Record<string, unknown>;
    const analises: Record<string, string> = {};
    for (const [id, valor] of Object.entries(bruto)) {
      if (ids.has(id) && typeof valor === "string" && valor.trim()) {
        analises[id] = valor.trim();
      }
    }
    return Object.keys(analises).length ? analises : null;
  } catch {
    return null;
  }
}

export async function analisarAnunciosAction(
  input: unknown,
): Promise<AnaliseIaState> {
  if (!(await currentUserHasPermission("campanhas", "view"))) {
    return { ok: false, message: "Você não tem permissão para analisar campanhas." };
  }

  const parsed = entradaSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Os dados dos anúncios são inválidos.",
    };
  }

  const config = getIaConfig();
  if (!config) {
    return {
      ok: false,
      message: "Configure o endpoint e o modelo de IA em Configurações → IA antes de analisar.",
    };
  }

  const prompt = [
    "Você é analista de mídia paga da agência JH7 Marketing. Analise cada anúncio abaixo no período informado.",
    "Responda SOMENTE com um objeto JSON, sem markdown e sem texto fora dele, no formato:",
    '{"<id do anúncio>": "<análise>", ...}',
    "Cada análise: no máximo 2 frases curtas, diretas e objetivas, em português brasileiro. Diga o que os números indicam e uma ação concreta. Se houver pouca entrega, diga que falta amostra. Compare custo e volume sem afirmar causalidade. Nunca invente dados.",
    `Período analisado: ${parsed.data.periodo}.`,
    "Dados dos anúncios (JSON):",
    JSON.stringify(parsed.data.anuncios),
  ].join("\n\n");

  const resposta = await chatAi(config, prompt);
  if (!resposta.ok) return { ok: false, message: resposta.message };

  const analises = extrairAnalises(
    resposta.reply,
    new Set(parsed.data.anuncios.map((a) => a.id)),
  );
  if (!analises) return { ok: true, message: "Análise concluída.", analise: resposta.reply };
  return { ok: true, message: "Análise concluída.", analises };
}
