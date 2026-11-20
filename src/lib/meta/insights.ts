/**
 * Tradução dos dados de insights da Meta para o formato usado nas telas de
 * campanhas: objetivos em português, métricas numéricas e a ação que conta
 * como "resultado" conforme o objetivo (mensagens, seguidores, compras...).
 *
 * Regra importante: quando a Meta não devolve uma métrica (ex.: visitas ao
 * perfil do Instagram numa campanha de tráfego), o valor fica `null` e a tela
 * mostra "—" — nunca zero, para não sugerir que houve entrega e nenhum evento.
 */

export type PeriodoCampanha =
  | "today"
  | "yesterday"
  | "last_7d"
  | "last_14d"
  | "last_21d"
  | "last_30d"
  | "maximum"
  | "custom";

export const PERIODO_LABELS: Record<PeriodoCampanha, string> = {
  today: "Hoje",
  yesterday: "Ontem",
  last_7d: "7 dias",
  last_14d: "14 dias",
  last_21d: "21 dias",
  last_30d: "30 dias",
  maximum: "Desde o início",
  custom: "Personalizado",
};

export const PERIODOS = Object.keys(PERIODO_LABELS) as PeriodoCampanha[];
export const PERIODO_PADRAO: PeriodoCampanha = "today";

export type FiltroStatus = "active" | "inactive" | "all" | "spent";

export const STATUS_LABELS: Record<FiltroStatus, string> = {
  active: "Ativas",
  inactive: "Inativas",
  all: "Todas",
  spent: "Todas com gastos",
};

export const STATUS_VALORES = Object.keys(STATUS_LABELS) as FiltroStatus[];
export const STATUS_PADRAO: FiltroStatus = "spent";

export function normalizarPeriodo(valor?: string | null): PeriodoCampanha {
  return PERIODOS.includes(valor as PeriodoCampanha)
    ? (valor as PeriodoCampanha)
    : PERIODO_PADRAO;
}

/** Aceita datas personalizadas válidas e ordenadas no formato ISO. */
export function intervaloPersonalizado(
  since?: string | null,
  until?: string | null,
): { since: string; until: string } | null {
  if (!since || !until || !/^\d{4}-\d{2}-\d{2}$/.test(since) || !/^\d{4}-\d{2}-\d{2}$/.test(until)) {
    return null;
  }
  const inicio = new Date(`${since}T00:00:00Z`);
  const fim = new Date(`${until}T00:00:00Z`);
  if (
    Number.isNaN(inicio.getTime()) ||
    Number.isNaN(fim.getTime()) ||
    inicio.toISOString().slice(0, 10) !== since ||
    fim.toISOString().slice(0, 10) !== until ||
    since > until
  ) return null;
  return { since, until };
}

/** Delta percentual em relação ao período anterior; sem base comparável, omite. */
export function variacao(atual: number | null, anterior: number | null | undefined): string | null {
  if (atual === null || anterior == null || anterior === 0) return null;
  const percentual = ((atual - anterior) / Math.abs(anterior)) * 100;
  return `${percentual > 0 ? "+" : ""}${percentual.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% vs período anterior`;
}

/** Direção da variação para colorir a métrica na tela. */
export type Tendencia = "melhor" | "pior" | "neutro";

/**
 * Se o movimento da métrica é bom ou ruim. Em métricas de custo (`menorMelhor`
 * — custo por resultado, CPM, frequência) subir é pior; nas de volume, subir é
 * melhor. Sem base anterior (ou sem mudança) fica neutro.
 */
export function tendencia(
  atual: number | null,
  anterior: number | null | undefined,
  menorMelhor = false,
): Tendencia {
  if (atual === null || anterior == null || anterior === 0 || atual === anterior) {
    return "neutro";
  }
  const subiu = atual > anterior;
  return subiu !== menorMelhor ? "melhor" : "pior";
}

/** Dias cobertos por cada período; `maximum` não tem janela fixa. */
const DIAS_DO_PERIODO: Partial<Record<PeriodoCampanha, number>> = {
  today: 1,
  yesterday: 1,
  last_7d: 7,
  last_14d: 14,
  last_21d: 21,
  last_30d: 30,
};

/**
 * Soma dias a uma data e devolve YYYY-MM-DD.
 *
 * Tudo em UTC: as datas de período chegam como `YYYY-MM-DDT00:00:00Z`, e ler
 * os campos locais (UTC−3 no Brasil) devolvia o dia anterior — a janela de
 * comparação recuava um dia e deixava de fora o gasto do último dia dela.
 * Quem passa uma data "de hoje" em horário local deve normalizá-la para UTC
 * antes (ver `periodoAnterior`).
 */
function deslocar(data: Date, dias: number): string {
  const d = new Date(
    Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate() + dias),
  );
  return d.toISOString().slice(0, 10);
}

/**
 * Janela imediatamente anterior à do período escolhido, para a comparação
 * "vs período anterior". Mesma duração, terminando no dia antes da atual.
 * `maximum` não tem anterior — devolve null.
 *
 * ponytail: usa o calendário do servidor, não o da conta de anúncio; no Brasil
 * a diferença só apareceria perto da meia-noite. Trocar por `timezone_name` da
 * conta se isso incomodar.
 */
export function periodoAnterior(
  periodo: PeriodoCampanha,
  personalizado?: { since: string; until: string } | null,
): { since: string; until: string } | null {
  if (periodo === "custom" && personalizado) {
    // Termina no dia anterior ao início e dura o mesmo número de dias.
    const inicio = new Date(`${personalizado.since}T00:00:00Z`);
    const fim = new Date(`${personalizado.until}T00:00:00Z`);
    const dias = Math.round((fim.getTime() - inicio.getTime()) / 86_400_000) + 1;
    return {
      since: deslocar(inicio, -dias),
      until: deslocar(inicio, -1),
    };
  }
  const dias = DIAS_DO_PERIODO[periodo];
  if (!dias) return null;

  // "Hoje" no calendário local, ancorado em UTC para não voltar um dia.
  const agora = new Date();
  const hoje = new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()));
  const ultimoDiaAtual = periodo === "yesterday" ? -1 : 0;
  return {
    since: deslocar(hoje, ultimoDiaAtual - 2 * dias + 1),
    until: deslocar(hoje, ultimoDiaAtual - dias),
  };
}

export function normalizarStatus(valor?: string | null): FiltroStatus {
  return STATUS_VALORES.includes(valor as FiltroStatus)
    ? (valor as FiltroStatus)
    : STATUS_PADRAO;
}

/* ------------------------------------------------------------------ */
/* Objetivos                                                           */
/* ------------------------------------------------------------------ */

const OBJETIVOS: Record<string, string> = {
  OUTCOME_ENGAGEMENT: "Engajamento",
  OUTCOME_TRAFFIC: "Tráfego",
  OUTCOME_AWARENESS: "Reconhecimento",
  OUTCOME_SALES: "Vendas",
  OUTCOME_LEADS: "Cadastros",
  OUTCOME_APP_PROMOTION: "Instalações do app",
  OUTCOME_MESSAGES: "Mensagens",
  MESSAGES: "Mensagens",
  CONVERSATIONS: "Mensagens",
  LINK_CLICKS: "Tráfego",
  REACH: "Reconhecimento",
  IMPRESSIONS: "Reconhecimento",
  POST_ENGAGEMENT: "Engajamento",
  PAGE_LIKES: "Curtidas da página",
  VIDEO_VIEWS: "Visualizações de vídeo",
  CONVERSIONS: "Vendas",
  PRODUCT_CATALOG_SALES: "Vendas",
  LEAD_GENERATION: "Cadastros",
  APP_INSTALLS: "Instalações do app",
};

/** Destinos possíveis de um conjunto. */
const DESTINOS: Record<string, string> = {
  WHATSAPP: "Mensagens no WhatsApp",
  MESSENGER: "Mensagens no Messenger",
  INSTAGRAM_DIRECT: "Mensagens no Instagram",
  INSTAGRAM_PROFILE: "Visitas ao perfil do Instagram",
  ON_POST: "Publicação do Instagram",
  WEBSITE: "Tráfego para o site",
  APP: "App",
  SHOP_AUTOMATIC: "Compras na loja",
  ON_AD: "No anúncio",
  ON_PAGE: "Na página",
};

/** Alguns objetivos de campanha mudam de nome conforme o destino do conjunto. */
const REFINO_POR_DESTINO: Record<string, Record<string, string>> = {
  OUTCOME_ENGAGEMENT: {
    WHATSAPP: "Mensagens no WhatsApp",
    MESSENGER: "Mensagens no Messenger",
    INSTAGRAM_DIRECT: "Mensagens no Instagram",
    INSTAGRAM_PROFILE: "Visitas ao perfil do Instagram",
    ON_PAGE: "Engajamento na página",
  },
  OUTCOME_TRAFFIC: {
    WHATSAPP: "Mensagens no WhatsApp",
    MESSENGER: "Mensagens no Messenger",
    INSTAGRAM_DIRECT: "Mensagens no Instagram",
    INSTAGRAM_PROFILE: "Visitas ao perfil do Instagram",
    WEBSITE: "Tráfego para o site",
  },
  OUTCOME_SALES: {
    WHATSAPP: "Mensagens no WhatsApp",
    WEBSITE: "Vendas no site",
  },
};

/** Objetivo legível para campanhas/anúncios. */
export function objetivoLegivel(objetivo?: string | null): string {
  if (!objetivo) return "—";
  return OBJETIVOS[objetivo] ?? tituloDeCodigo(objetivo);
}

/** Objetivo legível de um conjunto, considerando o destino da conversão. */
export function objetivoDoConjunto(
  objetivo?: string | null,
  destino?: string | null,
): string {
  if (destino) {
    const refino = objetivo ? REFINO_POR_DESTINO[objetivo]?.[destino] : undefined;
    if (refino) return refino;
    const nomeDestino = DESTINOS[destino];
    if (nomeDestino) return nomeDestino;
  }
  return objetivoLegivel(objetivo);
}

/** Onde a conversão acontece — o que o Gerenciador chama de tipo de conversão. */
const CONVERSOES: Record<string, string> = {
  WHATSAPP: "Mensagens no WhatsApp",
  MESSENGER: "Mensagens no Messenger",
  INSTAGRAM_DIRECT: "Mensagens no Instagram",
  INSTAGRAM_PROFILE: "Perfil do Instagram",
  ON_POST: "Publicação",
  ON_AD: "No anúncio",
  ON_PAGE: "Na página",
  WEBSITE: "No site",
  APP: "No app",
  SHOP_AUTOMATIC: "Na loja",
};

const CONVERSAO_POR_OBJETIVO: Record<string, string> = {
  OUTCOME_AWARENESS: "Alcance e impressões",
  OUTCOME_TRAFFIC: "Cliques no link",
  OUTCOME_ENGAGEMENT: "Engajamento com a publicação",
  OUTCOME_SALES: "Compras",
  OUTCOME_LEADS: "Cadastros",
  OUTCOME_APP_PROMOTION: "Instalações do app",
  OUTCOME_MESSAGES: "Conversas iniciadas",
  MESSAGES: "Conversas iniciadas",
};

/**
 * Tipo de conversão do conjunto: o destino quando existe (WhatsApp, perfil do
 * Instagram...), senão o que o objetivo otimiza.
 */
export function conversaoDoConjunto(
  objetivo?: string | null,
  destino?: string | null,
): string {
  if (destino && CONVERSOES[destino]) return CONVERSOES[destino];
  if (objetivo && CONVERSAO_POR_OBJETIVO[objetivo]) {
    return CONVERSAO_POR_OBJETIVO[objetivo];
  }
  return objetivoLegivel(objetivo);
}

/** OUTCOME_APP_PROMOTION → "App promotion" (fallback de códigos desconhecidos). */
function tituloDeCodigo(codigo: string): string {
  return codigo
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

/* ------------------------------------------------------------------ */
/* Métricas                                                            */
/* ------------------------------------------------------------------ */

type AcaoMeta = { action_type: string; value: string };

export type MetricasLinha = {
  /** Investimento em reais. */
  investido: number;
  /** Faturamento atribuído a compras (null quando a Meta não retorna valores). */
  faturamento: number | null;
  /** Valores equivalentes no período anterior; ausente quando não há janela. */
  anterior?: Partial<Omit<MetricasLinha, "anterior">> | null;
  impressoes: number | null;
  frequencia: number | null;
  alcance: number | null;
  cliquesLink: number | null;
  /** Visitas ao perfil do Instagram (null quando o objetivo não entrega isso). */
  visitasPerfil: number | null;
  /** Seguidores ganhos no Instagram. */
  seguidores: number | null;
  /** Conversas iniciadas (WhatsApp/Messenger/Instagram). */
  mensagensIniciadas: number | null;
  /** Funil de compra (só exibido quando o tipo de conversão é Compras). */
  visitasPaginaDestino: number | null;
  adicoesCarrinho: number | null;
  finalizacoesCompra: number | null;
  /** True quando o tipo de conversão é "Compras" — habilita o funil acima. */
  temFunilCompra: boolean;
  /** Nome do resultado conforme o objetivo ("Mensagens iniciadas", "Compras"...). */
  resultadoRotulo: string;
  resultadoValor: number | null;
  custoPorResultado: number | null;
  ctr: number | null;
  cpm: number | null;
};

export const METRICAS_VAZIAS: MetricasLinha = {
  investido: 0,
  faturamento: null,
  impressoes: null,
  frequencia: null,
  alcance: null,
  cliquesLink: null,
  visitasPerfil: null,
  seguidores: null,
  mensagensIniciadas: null,
  visitasPaginaDestino: null,
  adicoesCarrinho: null,
  finalizacoesCompra: null,
  temFunilCompra: false,
  resultadoRotulo: "Resultados",
  resultadoValor: null,
  custoPorResultado: null,
  ctr: null,
  cpm: null,
};

/** Ações que representam conversas iniciadas, por ordem de preferência. */
const ACOES_MENSAGEM = [
  "onsite_conversion.messaging_conversation_started_7d",
  "onsite_conversion.total_messaging_connection",
  "onsite_conversion.messaging_first_reply",
];

const ACOES_PERFIL = [
  "onsite_conversion.ig_profile_visit",
  "instagram_profile_visit",
  "onsite_conversion.instagram_profile_visit",
];

const ACOES_SEGUIDOR = [
  "instagram_follows",
  "onsite_conversion.ig_follow",
  "instagram_follow",
  "onsite_conversion.instagram_follow",
  "follow",
];

const ACOES_COMPRA = [
  "purchase",
  "offsite_conversion.fb_pixel_purchase",
  "omni_purchase",
];

const ACOES_CADASTRO = [
  "lead",
  "offsite_conversion.fb_pixel_lead",
  "onsite_conversion.lead_grouped",
];

const ACOES_TRANSACAO = [
  "omni_initiated_checkout",
  "offsite_conversion.fb_pixel_initiate_checkout",
  "onsite_web_initiate_checkout",
  "add_to_cart",
  "offsite_conversion.fb_pixel_add_to_cart",
  "onsite_web_add_to_cart",
];

/** Funil de compra, mostrado só quando o tipo de conversão é Compras. */
const ACOES_VISITA_PAGINA = [
  "landing_page_view",
  "omni_landing_page_view",
  "offsite_conversion.fb_pixel_landing_page_view",
];

const ACOES_CARRINHO = [
  "add_to_cart",
  "omni_add_to_cart",
  "offsite_conversion.fb_pixel_add_to_cart",
  "onsite_web_add_to_cart",
];

const ACOES_FINALIZACAO = [
  "initiate_checkout",
  "omni_initiated_checkout",
  "offsite_conversion.fb_pixel_initiate_checkout",
  "onsite_web_initiate_checkout",
];

function numero(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function mapaAcoes(lista: unknown): Map<string, number> {
  const mapa = new Map<string, number>();
  if (!Array.isArray(lista)) return mapa;
  for (const item of lista as AcaoMeta[]) {
    if (!item?.action_type) continue;
    const valor = numero(item.value);
    if (valor !== null) mapa.set(item.action_type, valor);
  }
  return mapa;
}

/**
 * Valor monetário atribuído às compras (`action_values`). A Meta repete a
 * mesma compra em vários `action_type`, então somar duplicaria — vale o
 * primeiro tipo com valor, como no resultado.
 */
function valorDasAcoes(lista: unknown, tipos: string[]): number | null {
  if (!Array.isArray(lista)) return null;
  const porTipo = new Map<string, number>();
  for (const item of lista as AcaoMeta[]) {
    if (!item?.action_type) continue;
    const valor = numero(item.value);
    if (valor !== null) porTipo.set(item.action_type, valor);
  }
  return primeiroComValor(porTipo, tipos);
}

/** Primeiro tipo de ação presente na lista com valor > 0. */
function primeiroComValor(
  mapa: Map<string, number>,
  tipos: string[],
): number | null {
  for (const tipo of tipos) {
    const valor = mapa.get(tipo);
    if (typeof valor === "number" && valor > 0) return valor;
  }
  return null;
}

/** Primeiro tipo de ação presente na lista, aceitando zero (funil). */
function valorDaAcao(
  mapa: Map<string, number>,
  tipos: string[],
): number | null {
  for (const tipo of tipos) {
    const valor = mapa.get(tipo);
    if (typeof valor === "number") return valor;
  }
  return null;
}

/** Ações de compra na linha (para quebras demográficas, sem `results`). */
export function comprasDaAcao(row: Record<string, unknown>): number | null {
  return valorDasAcoes(row.actions, ACOES_COMPRA);
}

/** Conversas iniciadas na linha (para quebras demográficas). */
export function mensagensDaAcao(row: Record<string, unknown>): number | null {
  return valorDasAcoes(row.actions, ACOES_MENSAGEM);
}

/** Novos seguidores do Instagram atribuídos à linha (quebras demográficas). */
export function seguidoresDaAcao(row: Record<string, unknown>): number | null {
  return (
    numero(row.instagram_profile_follow) ?? valorDasAcoes(row.actions, ACOES_SEGUIDOR)
  );
}

export type TipoResultado =
  | "mensagens"
  | "seguidores"
  | "perfil"
  | "vendas"
  | "cadastros"
  | "trafego"
  | "engajamento";

export type DefinicaoResultado = {
  rotulo: string;
  tipos: string[];
  /** Tipos usados no campo cost_per_action_type. */
  tiposCusto: string[];
};

/**
 * Qual ação conta como resultado, a partir do objetivo da campanha e do
 * destino do conjunto. A ordem importa: mensagens antes de engajamento, etc.
 */
export function definirResultado(
  objetivo?: string | null,
  destino?: string | null,
): DefinicaoResultado {
  if (destino === "WHATSAPP" || destino === "MESSENGER" || destino === "INSTAGRAM_DIRECT") {
    return {
      rotulo: "Mensagens iniciadas",
      tipos: ACOES_MENSAGEM,
      tiposCusto: ACOES_MENSAGEM,
    };
  }
  if (destino === "INSTAGRAM_PROFILE") {
    return {
      rotulo: "Visitas ao perfil",
      tipos: ACOES_PERFIL,
      tiposCusto: ACOES_PERFIL,
    };
  }

  switch (objetivo) {
    case "OUTCOME_MESSAGES":
    case "MESSAGES":
    case "CONVERSATIONS":
      return {
        rotulo: "Mensagens iniciadas",
        tipos: ACOES_MENSAGEM,
        tiposCusto: ACOES_MENSAGEM,
      };
    case "OUTCOME_SALES":
    case "CONVERSIONS":
    case "PRODUCT_CATALOG_SALES":
    case "CATALOG_SALES":
      return {
        rotulo: "Compras",
        tipos: ACOES_COMPRA,
        tiposCusto: ACOES_COMPRA,
      };
    case "OUTCOME_LEADS":
    case "LEAD_GENERATION":
      return {
        rotulo: "Cadastros",
        tipos: ACOES_CADASTRO,
        tiposCusto: ACOES_CADASTRO,
      };
    case "OUTCOME_TRAFFIC":
    case "LINK_CLICKS":
      return {
        rotulo: "Cliques no link",
        tipos: ["link_click", "inline_link_click"],
        tiposCusto: ["link_click"],
      };
    case "OUTCOME_ENGAGEMENT":
    case "POST_ENGAGEMENT":
    case "PAGE_LIKES":
      // Para campanhas de engajamento da agência, a conversão configurada é
      // conversa iniciada no WhatsApp. Só cai para engajamento se a Meta não
      // devolver nenhuma conversa no período.
      return {
        rotulo: "Resultados",
        tipos: [...ACOES_MENSAGEM, "post_engagement", "page_engagement"],
        tiposCusto: [...ACOES_MENSAGEM, "post_engagement", "page_engagement"],
      };
    default:
      return {
        rotulo: "Resultados",
        tipos: ACOES_TRANSACAO,
        tiposCusto: ACOES_TRANSACAO,
      };
  }
}

type ResultadoMeta = {
  indicator?: string;
  values?: { value?: string; attribution_windows?: string[] }[];
};

/** Nome amigável do indicador de resultado que a Meta devolveu. */
const INDICADORES: Record<string, string> = {
  "actions:onsite_conversion.messaging_conversation_started_7d":
    "Mensagens iniciadas",
  "actions:onsite_conversion.messaging_first_reply": "Primeiras respostas",
  "actions:onsite_conversion.messaging_conversation_replied_7d":
    "Mensagens respondidas",
  profile_visit_view: "Visitas ao perfil",
  reach: "Alcance",
  "actions:offsite_conversion.fb_pixel_purchase": "Compras",
  "actions:offsite_conversion.fb_pixel_complete_registration": "Cadastros",
  "actions:offsite_conversion.fb_pixel_lead": "Cadastros",
  "actions:omni_landing_page_view": "Visitas à página",
  "actions:link_click": "Cliques no link",
  video_thruplay_watched_actions: "ThruPlays",
  video_continuous_2_sec_watched_actions: "Visualizações de 2s",
  "actions:onsite_conversion.ig_follow": "Seguidores no Instagram",
};

function nomeIndicador(indicador?: string): string | null {
  if (!indicador) return null;
  if (INDICADORES[indicador]) return INDICADORES[indicador];
  // actions:xxx → xxx
  const limpo = indicador.replace(/^actions:/, "");
  return OBJETIVOS[limpo] ?? null;
}

/**
 * Extrai o resultado oficial da Meta (`results` + `cost_per_result`).
 * É o mesmo número que o Gerenciador de Anúncios exibe na coluna Resultados.
 */
function resultadoOficial(row: Record<string, unknown>): {
  valor: number | null;
  rotulo: string | null;
  custo: number | null;
} {
  const listaResultados = row.results as ResultadoMeta[] | undefined;
  const listaCustos = row.cost_per_result as ResultadoMeta[] | undefined;

  const primeiro = listaResultados?.[0];
  const valor = numero(primeiro?.values?.[0]?.value);
  if (valor === null) return { valor: null, rotulo: null, custo: null };

  // O custo vem no mesmo indicador; se não vier, calculamos investido ÷ resultado.
  const indicador = primeiro?.indicator;
  const doMesmoTipo = listaCustos?.find((c) => c.indicator === indicador);
  const custo = numero(doMesmoTipo?.values?.[0]?.value);

  return { valor, rotulo: nomeIndicador(indicador), custo };
}

/**
 * Converte uma linha de insights (`level` campaign/adset/ad) nas métricas
 * exibidas. `objetivo` e `destino` vêm da estrutura da campanha/conjunto.
 *
 * Regras de negócio:
 * - O resultado é sempre a ação do objetivo — nunca engajamento genérico.
 * - Custo por resultado = investimento ÷ resultados do período.
 * - CTR é a taxa de clique no link (`inline_link_click_ctr`), não o CTR geral.
 * - Visitas ao perfil e novos seguidores atribuídos vêm dos campos próprios
 *   do Instagram (`instagram_profile_visits` e `instagram_profile_follow`).
 */
export function mapearMetricas(
  row: Record<string, unknown>,
  objetivo?: string | null,
  destino?: string | null,
): MetricasLinha {
  const acoes = mapaAcoes(row.actions);

  const mensagens = primeiroComValor(acoes, ACOES_MENSAGEM);
  const seguidores =
    numero(row.instagram_profile_follow) ?? primeiroComValor(acoes, ACOES_SEGUIDOR);
  const perfil =
    numero(row.instagram_profile_visits) ?? primeiroComValor(acoes, ACOES_PERFIL);

  const definicao = definirResultado(objetivo, destino);
  const investido = numero(row.spend) ?? 0;
  const temFunilCompra = definicao.rotulo === "Compras";

  // 1) Preferimos o resultado oficial da Meta (coluna "Resultados" do
  //    Gerenciador), que já vem com o indicador da conversão configurada.
  const oficial = resultadoOficial(row);
  let resultadoValor = oficial.valor;
  let resultadoRotulo = oficial.rotulo ?? definicao.rotulo;

  // 2) Sem resultado oficial, usa a ação do objetivo.
  if (resultadoValor === null) {
    resultadoValor = primeiroComValor(acoes, definicao.tipos);
  }

  // Métricas de Instagram não aparecem em `actions`; quando o objetivo é esse,
  // o resultado vem do campo próprio.
  if (resultadoValor === null && definicao.rotulo === "Visitas ao perfil" && perfil !== null) {
    resultadoValor = perfil;
  }

  // 3) Último recurso: conversas iniciadas, a conversão mais comum da agência.
  if (resultadoValor === null && mensagens !== null) {
    resultadoValor = mensagens;
    resultadoRotulo = "Mensagens iniciadas";
  }

  // Custo por resultado = investimento ÷ resultados (regra do painel).
  // O valor da Meta é usado quando existe, por incluir a mesma atribuição.
  const custoPorResultado =
    oficial.custo ??
    (resultadoValor !== null && resultadoValor > 0 ? investido / resultadoValor : null);

  const valoresCompra = valorDasAcoes(row.action_values, ACOES_COMPRA);

  return {
    investido,
    faturamento: temFunilCompra ? valoresCompra : null,
    impressoes: numero(row.impressions),
    frequencia: numero(row.frequency),
    alcance: numero(row.reach),
    cliquesLink:
      numero(row.inline_link_clicks) ?? acoes.get("link_click") ?? null,
    visitasPerfil: perfil,
    seguidores,
    mensagensIniciadas: mensagens,
    temFunilCompra,
    visitasPaginaDestino: temFunilCompra
      ? (primeiroComValor(acoes, ACOES_VISITA_PAGINA) ??
        valorDaAcao(acoes, ACOES_VISITA_PAGINA))
      : null,
    adicoesCarrinho: temFunilCompra
      ? (primeiroComValor(acoes, ACOES_CARRINHO) ??
        valorDaAcao(acoes, ACOES_CARRINHO))
      : null,
    finalizacoesCompra: temFunilCompra
      ? (primeiroComValor(acoes, ACOES_FINALIZACAO) ??
        valorDaAcao(acoes, ACOES_FINALIZACAO))
      : null,
    resultadoRotulo,
    resultadoValor,
    custoPorResultado,
    // Taxa de clique no link (não o CTR geral da Meta).
    ctr: numero(row.inline_link_click_ctr) ?? numero(row.ctr),
    cpm: numero(row.cpm),
  };
}
