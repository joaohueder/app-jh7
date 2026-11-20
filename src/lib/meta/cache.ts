/**
 * Cache persistente do que veio da Meta no módulo Campanhas.
 *
 * Fica no banco (tabela `meta_cache`) e não expira sozinho: a tela mostra os
 * números guardados e só reconsulta a Meta quando o usuário clica em
 * "Atualizar dados". A exceção é a primeira leitura de uma combinação ainda
 * não guardada (período/status novo), que busca e grava na hora — sem isso a
 * tela abriria vazia.
 *
 * Toda chave carrega o id da conta de anúncio (`...:<conta>:...`), então
 * limpar e medir a idade dos dados de um cliente é filtrar por essas contas.
 * A comparação é por texto (`instr`), não `LIKE`: ids de conta têm `_`, que o
 * LIKE trataria como curinga.
 */

import { sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { metaCache } from "@/lib/db/schema";
import { periodoAnterior, type PeriodoCampanha } from "./insights";

export type CacheLido<T> = { valor: T; atualizadoEm: number };

/** Valor guardado para a chave, ou `null` se ela nunca foi consultada. */
export function lerCache<T>(chave: string): CacheLido<T> | null {
  const linha = db
    .select()
    .from(metaCache)
    .where(sql`${metaCache.key} = ${chave}`)
    .get();
  if (!linha) return null;

  try {
    return { valor: JSON.parse(linha.data) as T, atualizadoEm: linha.updatedAt };
  } catch {
    // Linha corrompida não pode derrubar a tela: trata como ausente.
    return null;
  }
}

/** Grava o valor da chave com o momento da consulta à Meta. */
export function gravarCache(chave: string, valor: unknown): void {
  const agora = Date.now();
  const data = JSON.stringify(valor);
  db.insert(metaCache)
    .values({ key: chave, data, updatedAt: agora })
    .onConflictDoUpdate({ target: metaCache.key, set: { data, updatedAt: agora } })
    .run();
}

/** Condição "a chave é de alguma destas contas". */
function dasContas(contas: string[]) {
  const ids = contas.filter((id) => id.length > 0);
  if (!ids.length) return null;
  return ids
    .map((id) => sql`instr(${metaCache.key}, ${`:${id}:`}) > 0`)
    .reduce((a, b) => sql`${a} or ${b}`);
}

/** Apaga tudo que foi guardado para as contas informadas. */
export function limparCacheDasContas(contas: string[]): void {
  const condicao = dasContas(contas);
  if (!condicao) return;
  db.delete(metaCache).where(condicao).run();
}

/**
 * Momento em que o dado **em tela** foi consultado.
 *
 * É o mais antigo entre as chaves do filtro atual, não o mais recente: se uma
 * conta foi atualizada hoje e outra há três dias, o que o usuário está vendo
 * é o dado de três dias — é essa idade que o aviso precisa mostrar. Com
 * `max`, uma atualização parcial pintava dado velho de fresco.
 *
 * `chaves` são as chaves exatas do nível que está aberto (campanhas,
 * conjuntos ou anúncios). Nenhuma delas guardada = nunca atualizado.
 */
export function atualizacaoDeChaves(chaves: string[]): number | null {
  const validas = chaves.filter((chave) => chave.length > 0);
  if (!validas.length) return null;

  const condicao = validas
    .map((chave) => sql`${metaCache.key} = ${chave}`)
    .reduce((a, b) => sql`${a} or ${b}`);

  const linha = db
    .select({ updatedAt: sql<number | null>`min(${metaCache.updatedAt})` })
    .from(metaCache)
    .where(condicao)
    .get();
  return linha?.updatedAt ?? null;
}

/**
 * Chaves do nível de campanhas para as contas, no período em tela.
 *
 * São exatamente as chaves que `campanhasDoCliente` grava — a janela anterior
 * entra junto porque as variações "% vs período anterior" também aparecem na
 * tela. Se a geração das chaves divergir de `campaigns.ts`, o aviso passa a
 * dizer "nunca atualizado"; é o preço de medir só o que está visível.
 */
export function chavesDeCampanhas(
  contas: string[],
  periodo: PeriodoCampanha,
  personalizado?: { since: string; until: string } | null,
): string[] {
  const { atual, anterior } = janelas(periodo, personalizado);
  const chaves: string[] = [];
  for (const conta of contas) {
    chaves.push(`campanhas:${conta}:atual:${atual}`);
    if (anterior) chaves.push(`campanhas:${conta}:anterior:${anterior}`);
  }
  return chaves;
}

/** Janela exibida e a anterior, no formato das chaves de cache. */
function janelas(periodo: PeriodoCampanha, personalizado?: { since: string; until: string } | null) {
  const intervalo = periodo === "custom" ? personalizado ?? null : null;
  const anterior = periodoAnterior(periodo, personalizado);
  return {
    atual: intervalo ? `${intervalo.since}:${intervalo.until}` : periodo,
    anterior: anterior ? `${anterior.since}:${anterior.until}` : null,
  };
}

/** Chaves do nível de conjuntos de uma campanha, no filtro em tela. */
export function chavesDeConjuntos(
  contas: string[],
  campanhaId: string,
  filtro: string,
  periodo: PeriodoCampanha,
  personalizado?: { since: string; until: string } | null,
): string[] {
  const { atual, anterior } = janelas(periodo, personalizado);
  const chaves: string[] = [];
  for (const conta of contas) {
    chaves.push(`conjuntos:${campanhaId}:${conta}:atual:${filtro}:${atual}`);
    if (anterior) {
      chaves.push(`conjuntos:${campanhaId}:${conta}:anterior:${filtro}:${anterior}`);
    }
  }
  return chaves;
}

/** Chaves do nível de anúncios de um conjunto, no filtro em tela. */
export function chavesDeAnuncios(
  conta: string,
  conjuntoId: string,
  filtro: string,
  destino: string | null,
  periodo: PeriodoCampanha,
  personalizado?: { since: string; until: string } | null,
): string[] {
  const { atual, anterior } = janelas(periodo, personalizado);
  const chaves = [`anuncios:${conjuntoId}:${conta}:atual:${filtro}:${destino ?? ""}:${atual}`];
  if (anterior) {
    chaves.push(`anuncios:${conjuntoId}:${conta}:anterior:${filtro}:${destino ?? ""}:${anterior}`);
  }
  return chaves;
}