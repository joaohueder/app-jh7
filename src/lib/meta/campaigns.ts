/**
 * Monta a estrutura cliente → campanha → conjunto → anúncio com métricas.
 *
 * Os dados ficam guardados no banco (`src/lib/meta/cache.ts`): a tela mostra o
 * que já foi consultado e só fala com a Meta quando o usuário pede, pelo botão
 * "Atualizar dados". Uma combinação nunca consultada é buscada na hora.
 */

import { gravarCache, lerCache } from "./cache";
import {
  getAdAccountBilling,
  getAds,
  getAdSets,
  getCampaigns,
  getDestinosPorCampanha,
  getInsights,
  MetaApiException,
  normalizarContaId,
} from "./client";
import {
  conversaoDoConjunto,
  mapearMetricas,
  objetivoDoConjunto,
  objetivoLegivel,
  periodoAnterior,
  type FiltroStatus,
  type MetricasLinha,
  type PeriodoCampanha,
} from "./insights";

export type EstadoMeta =
  | { estado: "sem-token" }
  | { estado: "erro"; mensagem: string }
  | { estado: "ok" };

/**
 * Lê do banco o que já foi consultado; só vai à Meta quando não há nada
 * guardado ou quando `forcar` é pedido (botão "Atualizar dados").
 */
async function comCache<T>(
  chave: string,
  buscar: () => Promise<T>,
  forcar = false,
): Promise<T> {
  if (!forcar) {
    const guardado = await lerCache<T>(chave);
    if (guardado) return guardado.valor;
  }

  const valor = await buscar();
  await gravarCache(chave, valor);
  return valor;
}

/** Ids das contas, no formato que as chaves de cache usam. */
export function idsParaCache(contas: { id: string }[]): string[] {
  return contas.map((conta) => conta.id);
}

/** Converte erros da Meta em algo que a tela sabe exibir. */
export function estadoDeErro(erro: unknown): EstadoMeta {
  if (erro instanceof MetaApiException) {
    if (erro.code === 190) {
      return {
        estado: "erro",
        mensagem:
          "O token da Meta expirou ou foi revogado. Gere um novo em Configurações → Meta Ads.",
      };
    }
    if (erro.code === 4 || erro.code === 17) {
      return {
        estado: "erro",
        mensagem:
          "A Meta limitou as requisições. Aguarde alguns minutos e tente novamente.",
      };
    }
    if (erro.code === 200 || erro.code === 10) {
      return {
        estado: "erro",
        mensagem:
          "Sem permissão para ler os anúncios desta conta. Confira o acesso do token à conta de anúncios.",
      };
    }
    return { estado: "erro", mensagem: erro.message };
  }
  return { estado: "erro", mensagem: "Não foi possível consultar a Meta agora." };
}

/* ------------------------------------------------------------------ */
/* Linhas                                                              */
/* ------------------------------------------------------------------ */

export type LinhaMetricas = MetricasLinha & {
  id: string;
  nome: string;
  status: string;
  ativo: boolean;
  /** Objetivo em português. */
  objetivo: string;
  /** Tipo de conversão/destino configurado no conjunto. */
  conversao: string;
  /** Código original, usado para refinar o resultado. */
  objetivoCodigo?: string;
  destino?: string | null;
  contaId: string;
  contaNome: string;
  /** Nível filho para onde navegar (campanha → conjunto → anúncio). */
  proximoNivel: "campanha" | "conjunto" | "anuncio" | null;
};

/**
 * Busca as linhas do período atual e do anterior em paralelo e costura as
 * métricas antigas em `anterior` (casadas pelo id). Período sem janela
 * anterior ("Desde o início") ou falha na busca antiga só deixam o campo nulo.
 */
async function comComparacao<T extends LinhaMetricas>(
  periodo: PeriodoCampanha,
  construir: (chave: string, intervalo?: { since: string; until: string }) => Promise<T[]>,
  personalizado?: { since: string; until: string } | null,
): Promise<T[]> {
  const janela = periodoAnterior(periodo, personalizado);
  const [atual, resultadoAnterior] = await Promise.all([
    construir("atual", periodo === "custom" ? personalizado ?? undefined : undefined),
    janela
      ? construir("anterior", janela)
          .then((linhas) => ({ linhas, falhou: false }))
          .catch(() => ({ linhas: [] as T[], falhou: true }))
      : Promise.resolve({ linhas: [] as T[], falhou: false }),
  ]);
  const porId = new Map(resultadoAnterior.linhas.map((l) => [l.id, l]));
  return atual.map((linha) => ({
    ...linha,
    anterior: !janela || resultadoAnterior.falhou
      ? null
      : porId.get(linha.id) ?? {
          investido: 0,
          faturamento: null,
          impressoes: 0,
          frequencia: null,
          alcance: 0,
          cliquesLink: 0,
          visitasPerfil: 0,
          seguidores: 0,
          mensagensIniciadas: 0,
          visitasPaginaDestino: 0,
          adicoesCarrinho: 0,
          finalizacoesCompra: 0,
          resultadoValor: 0,
          custoPorResultado: null,
          ctr: null,
          cpm: null,
        },
  }));
}

/** Métricas somadas de um conjunto de linhas (para os cards de topo). */
export function somarMetricas(linhas: LinhaMetricas[]): MetricasLinha {
  const soma = (extrair: (l: LinhaMetricas) => number | null) => {
    const valores = linhas.map(extrair).filter((v): v is number => v !== null);
    return valores.length ? valores.reduce((a, b) => a + b, 0) : null;
  };

  const investido = linhas.reduce((total, l) => total + l.investido, 0);
  const resultadoValor = soma((l) => l.resultadoValor);
  const rotulo =
    linhas.find((l) => l.resultadoValor !== null)?.resultadoRotulo ??
    linhas[0]?.resultadoRotulo ??
    "Resultados";

  // Somas do período anterior, nas mesmas chaves do período atual.
  const anteriores = linhas.map((l) => l.anterior);
  const temComparacao = anteriores.some((a) => a !== null && a !== undefined);
  const somaAntes = (extrair: (a: Partial<MetricasLinha>) => number | null | undefined) => {
    const valores = anteriores
      .filter((a): a is NonNullable<typeof a> => a !== null && a !== undefined)
      .map(extrair)
      .filter((v): v is number => typeof v === "number");
    return valores.length ? valores.reduce((a, b) => a + b, 0) : null;
  };
  const investidoAntes = temComparacao
    ? anteriores.reduce((total, a) => total + (a?.investido ?? 0), 0)
    : null;
  const resultadoAntes = somaAntes((a) => a.resultadoValor);
  const anterior: MetricasLinha["anterior"] = temComparacao
    ? {
        investido: investidoAntes ?? 0,
        faturamento: somaAntes((a) => a.faturamento),
        impressoes: somaAntes((a) => a.impressoes),
        frequencia: null,
        alcance: null,
        cliquesLink: somaAntes((a) => a.cliquesLink),
        visitasPerfil: somaAntes((a) => a.visitasPerfil),
        seguidores: somaAntes((a) => a.seguidores),
        mensagensIniciadas: somaAntes((a) => a.mensagensIniciadas),
        visitasPaginaDestino: somaAntes((a) => a.visitasPaginaDestino),
        adicoesCarrinho: somaAntes((a) => a.adicoesCarrinho),
        finalizacoesCompra: somaAntes((a) => a.finalizacoesCompra),
        resultadoValor: resultadoAntes,
        custoPorResultado:
          resultadoAntes && resultadoAntes > 0
            ? (investidoAntes ?? 0) / resultadoAntes
            : null,
        ctr: null,
        cpm: null,
      }
    : null;

  return {
    investido,
    faturamento: soma((l) => l.faturamento),
    anterior,
    impressoes: soma((l) => l.impressoes),
    frequencia: null, // média de frequência não soma; fica por linha
    alcance: null, // alcance somado duplicaria pessoas entre campanhas
    cliquesLink: soma((l) => l.cliquesLink),
    visitasPerfil: soma((l) => l.visitasPerfil),
    seguidores: soma((l) => l.seguidores),
    mensagensIniciadas: soma((l) => l.mensagensIniciadas),
    temFunilCompra: linhas.some((l) => l.temFunilCompra),
    visitasPaginaDestino: soma((l) => l.visitasPaginaDestino),
    adicoesCarrinho: soma((l) => l.adicoesCarrinho),
    finalizacoesCompra: soma((l) => l.finalizacoesCompra),
    resultadoRotulo: rotulo,
    resultadoValor,
    custoPorResultado:
      resultadoValor && resultadoValor > 0 ? investido / resultadoValor : null,
    ctr: null,
    cpm: null,
  };
}

function ehAtivo(status?: string | null): boolean {
  const valor = (status ?? "").toUpperCase();
  return valor === "ACTIVE" || valor === "IN_PROCESS" || valor === "PENDING_REVIEW";
}

/**
 * Filtro de status da lista.
 * - "all": tudo, independente do status.
 * - "spent": ativas e inativas que tiveram investimento no período — o filtro
 *   mais útil no dia a dia, porque esconde campanhas antigas sem entrega.
 */
function passaStatus(linha: LinhaMetricas, filtro: FiltroStatus): boolean {
  if (filtro === "all") return true;
  if (filtro === "spent") return linha.investido > 0;
  return filtro === "active" ? linha.ativo : !linha.ativo;
}

function ordenar(linhas: LinhaMetricas[]): LinhaMetricas[] {
  return [...linhas].sort((a, b) => {
    if (a.resultadoValor === null && b.resultadoValor !== null) return 1;
    if (b.resultadoValor === null && a.resultadoValor !== null) return -1;
    if (a.resultadoValor !== null && b.resultadoValor !== null) {
      const porResultado = b.resultadoValor - a.resultadoValor;
      if (porResultado !== 0) return porResultado;
    }
    return b.investido - a.investido;
  });
}

/* ------------------------------------------------------------------ */
/* Contas de anúncio do cliente                                        */
/* ------------------------------------------------------------------ */

export type ContaDoCliente = {
  id: string;
  nome: string;
  moeda: string | null;
  contrato: string;
};

/** Saldo/origem de cobrança de uma conta, para o card do cliente. */
export type SaldoConta = {
  /** Saldo disponível (pré-pago). `null` quando a conta não tem saldo. */
  saldo: number | null;
  moeda: string | null;
  /** "PÓS PAGO" quando paga por cartão/limite. */
  pagamento: string | null;
};

/**
 * Saldo da conta de anúncio. Cartão (credit_card ou fonte de financiamento
 * dedicada) significa pós-pago — a Meta não mantém saldo nesses casos.
 * Falha da consulta não derruba a lista: o card mostra sem saldo.
 */
export async function saldoDaConta(
  contaId: string,
  token: string,
  forcar = false,
): Promise<SaldoConta> {
  return comCache(`saldo:${contaId}:atual`, () => buscarSaldo(contaId, token), forcar);
}

async function buscarSaldo(contaId: string, token: string): Promise<SaldoConta> {
  try {
    const billing = await getAdAccountBilling(contaId, token);
    const detalhes = billing.funding_source_details;
    const tipoFonte = String(detalhes?.type ?? "").toUpperCase();

    // Na Graph API, type=1 identifica cartão; type=20 é saldo pré-pago.
    const cartao =
      tipoFonte === "1" ||
      tipoFonte === "CREDIT_CARD" ||
      (billing.funding_source ?? "").toUpperCase().includes("CREDIT_CARD");

    if (cartao) {
      return { saldo: null, moeda: billing.currency ?? null, pagamento: "PÓS PAGO" };
    }

    // A Meta fornece o saldo utilizável no display_string
    // (ex.: "Saldo disponível (R$192,40 BRL)"); `balance` é outro contador.
    const display = detalhes?.display_string ?? "";
    const match = display.match(/\((?:R\$\s*)?([\d.]+(?:,\d+)?)\s*([A-Z]{3})\)/);
    const saldo = match ? Number(match[1].replace(/\./g, "").replace(",", ".")) : null;

    return {
      saldo: saldo !== null && Number.isFinite(saldo) ? saldo : null,
      moeda: match?.[2] ?? billing.currency ?? null,
      pagamento: null,
    };
  } catch {
    return { saldo: null, moeda: null, pagamento: null };
  }
}

/** Contas de anúncio vinculadas aos contratos do cliente (sem duplicar). */
export async function contasDoCliente(
  contratos: { name: string; accounts: { adAccountId: string; name: string; currency: string | null }[] }[],
): Promise<ContaDoCliente[]> {
  const mapa = new Map<string, ContaDoCliente>();
  for (const contrato of contratos) {
    for (const conta of contrato.accounts) {
      const id = normalizarContaId(conta.adAccountId);
      if (!mapa.has(id)) {
        mapa.set(id, {
          id,
          nome: conta.name,
          moeda: conta.currency,
          contrato: contrato.name,
        });
      }
    }
  }
  return [...mapa.values()];
}

/* ------------------------------------------------------------------ */
/* Níveis                                                              */
/* ------------------------------------------------------------------ */

export type ResultadoCampanhas = {
  estado: EstadoMeta;
  linhas: LinhaMetricas[];
  contas: ContaDoCliente[];
};

/** Campanhas de todas as contas do cliente, com métricas do período. */
export async function campanhasDoCliente(
  contas: ContaDoCliente[],
  periodo: PeriodoCampanha,
  filtro: FiltroStatus,
  token: string,
  personalizado?: { since: string; until: string } | null,
  forcar = false,
): Promise<ResultadoCampanhas> {
  try {
    const linhas = await comComparacao(periodo, (chave, intervalo) =>
        Promise.all(
          contas.map((conta) =>
            comCache(
              `campanhas:${conta.id}:${chave}:${intervalo ? `${intervalo.since}:${intervalo.until}` : periodo}`,
              async () => {
                const [estrutura, insights, destinos] = await Promise.all([
                  getCampaigns(conta.id, token),
                  getInsights(conta.id, "campaign", periodo, token, intervalo),
                  // O destino da conversão vive no conjunto; buscamos por campanha.
                  getDestinosPorCampanha(conta.id, token).catch(() => new Map<string, string>()),
                ]);
                const porId = new Map(insights.map((i) => [String(i.campaign_id), i]));

                return estrutura.map<LinhaMetricas>((campanha) => {
                  const insight = porId.get(campanha.id) ?? {};
                  const ativo = ehAtivo(campanha.effective_status ?? campanha.status);
                  const destino = destinos.get(campanha.id) ?? null;
                  return {
                    id: campanha.id,
                    nome: campanha.name,
                    status: campanha.effective_status ?? campanha.status ?? "",
                    ativo,
                    objetivo: objetivoLegivel(campanha.objective),
                    conversao: conversaoDoConjunto(campanha.objective, destino),
                    destino,
                    objetivoCodigo: campanha.objective,
                    contaId: conta.id,
                    contaNome: conta.nome,
                    proximoNivel: "campanha",
                    ...mapearMetricas(insight, campanha.objective),
                  };
                });
              },
              forcar,
            ),
          ),
        ).then((listas) => listas.flat()),
      personalizado,
    );

    return {
      estado: { estado: "ok" },
      linhas: ordenar(linhas.filter((l) => passaStatus(l, filtro))),
      contas,
    };
  } catch (erro) {
    return { estado: estadoDeErro(erro), linhas: [], contas };
  }
}

/** Conjuntos de uma campanha. */
export async function conjuntosDaCampanha(
  campanhaId: string,
  contaId: string | null,
  objetivoCodigo: string | null,
  periodo: PeriodoCampanha,
  filtro: FiltroStatus,
  token: string,
  personalizado?: { since: string; until: string } | null,
  forcar = false,
): Promise<{ estado: EstadoMeta; linhas: LinhaMetricas[] }> {
  try {
    const conta = normalizarContaId(contaId ?? "");
    const linhas = await comComparacao(periodo, (chave, intervalo) =>
      comCache(
        `conjuntos:${campanhaId}:${conta}:${chave}:${filtro}:${intervalo ? `${intervalo.since}:${intervalo.until}` : periodo}`,
        async () => {
          const [estrutura, insights] = await Promise.all([
            getAdSets(campanhaId, token),
            getInsights(campanhaId, "adset", periodo, token, intervalo),
          ]);
          const porId = new Map(insights.map((i) => [String(i.adset_id), i]));

          return estrutura.map<LinhaMetricas>((conjunto) => {
            const insight = porId.get(conjunto.id) ?? {};
            const ativo = ehAtivo(conjunto.effective_status ?? conjunto.status);
            return {
              id: conjunto.id,
              nome: conjunto.name,
              status: conjunto.effective_status ?? conjunto.status ?? "",
              ativo,
              objetivo: objetivoDoConjunto(objetivoCodigo, conjunto.destination_type),
              conversao: conversaoDoConjunto(objetivoCodigo, conjunto.destination_type),
              objetivoCodigo: objetivoCodigo ?? undefined,
              destino: conjunto.destination_type ?? null,
              contaId: conta,
              contaNome: "",
              proximoNivel: "conjunto",
              ...mapearMetricas(insight, objetivoCodigo, conjunto.destination_type),
            };
          });
        },
        forcar,
      ),
      personalizado,
    );

    return {
      estado: { estado: "ok" },
      linhas: ordenar(linhas.filter((l) => passaStatus(l, filtro))),
    };
  } catch (erro) {
    return { estado: estadoDeErro(erro), linhas: [] };
  }
}

/** Anúncios de um conjunto. */
export async function anunciosDoConjunto(
  conjuntoId: string,
  contaId: string | null,
  objetivoCodigo: string | null,
  periodo: PeriodoCampanha,
  filtro: FiltroStatus,
  token: string,
  destino?: string | null,
  personalizado?: { since: string; until: string } | null,
  forcar = false,
): Promise<{ estado: EstadoMeta; linhas: LinhaMetricas[] }> {
  try {
    const conta = normalizarContaId(contaId ?? "");
    const linhas = await comComparacao(periodo, (chave, intervalo) =>
      comCache(
        `anuncios:${conjuntoId}:${conta}:${chave}:${filtro}:${destino ?? ""}:${intervalo ? `${intervalo.since}:${intervalo.until}` : periodo}`,
        async () => {
          const [estrutura, insights] = await Promise.all([
            getAds(conjuntoId, token),
            getInsights(conjuntoId, "ad", periodo, token, intervalo),
          ]);
          const porId = new Map(insights.map((i) => [String(i.ad_id), i]));

          return estrutura.map<LinhaMetricas>((anuncio) => {
            const insight = porId.get(anuncio.id) ?? {};
            const ativo = ehAtivo(anuncio.effective_status ?? anuncio.status);
            return {
              id: anuncio.id,
              nome: anuncio.name,
              status: anuncio.effective_status ?? anuncio.status ?? "",
              ativo,
              objetivo: objetivoDoConjunto(objetivoCodigo, destino),
              conversao: conversaoDoConjunto(objetivoCodigo, destino),
              objetivoCodigo: objetivoCodigo ?? undefined,
              contaId: conta,
              contaNome: "",
              proximoNivel: null,
              ...mapearMetricas(insight, objetivoCodigo, destino),
            };
          });
        },
        forcar,
      ),
      personalizado,
    );

    return {
      estado: { estado: "ok" },
      linhas: ordenar(linhas.filter((l) => passaStatus(l, filtro))),
    };
  } catch (erro) {
    return { estado: estadoDeErro(erro), linhas: [] };
  }
}
