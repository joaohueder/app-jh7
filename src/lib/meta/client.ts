/**
 * Cliente mínimo da Graph API da Meta (fase de conexão).
 *
 * Escopo atual: validar o token e listar as contas de anúncios acessíveis.
 * Campanhas, conjuntos e anúncios entram no módulo Campanhas.
 */

const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export type MetaError = {
  message: string;
  type?: string;
  code?: number;
  subcode?: number;
};

export type MetaApiError = { error: MetaError };

export type MetaAdAccount = {
  id: string;
  name: string;
  currency?: string;
  account_status?: number;
};

export type MetaAdAccountBilling = {
  balance?: string | number;
  currency?: string;
  funding_source_details?: {
    type?: number | string;
    display_string?: string;
  } | null;
  funding_source?: string;
};

export type MetaDebugToken = {
  app_id?: string;
  application?: string;
  type?: string;
  expires_at?: number | null;
  scopes?: string[];
  is_valid?: boolean;
};

export type TestConnectionResult =
  | { ok: true; user: string; accounts: MetaAdAccount[]; token: MetaDebugToken }
  | { ok: false; message: string };

export class MetaApiException extends Error {
  readonly code?: number;
  readonly subcode?: number;

  constructor(message: string, code?: number, subcode?: number) {
    super(message);
    this.name = "MetaApiException";
    this.code = code;
    this.subcode = subcode;
  }
}

/** Códigos em que a Meta pede para esperar e tentar de novo. */
const CODIGOS_DE_LIMITE = new Set([4, 17, 32, 613]);

const espera = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * GET na Graph API com retentativa nos códigos de limite. A geração do
 * relatório dispara muitas chamadas em paralelo; sem isso, o erro virava
 * estrutura vazia (campanha listada sem conjuntos nem anúncios).
 */
async function buscarComRetentativa<T>(url: URL): Promise<T> {
  const pausas = [2000, 6000, 15000, 30000];
  for (let tentativa = 0; ; tentativa++) {
    let response: Response;
    try {
      response = await fetch(url, { cache: "no-store" });
    } catch {
      throw new MetaApiException(
        "Não foi possível conectar à Meta. Verifique a internet do servidor.",
      );
    }

    const body = (await response.json().catch(() => null)) as
      | (T & Partial<MetaApiError>)
      | null;

    if (!response.ok || body?.error) {
      const err = body?.error;
      if (CODIGOS_DE_LIMITE.has(err?.code ?? 0) && tentativa < pausas.length) {
        await espera(pausas[tentativa]);
        continue;
      }
      throw new MetaApiException(
        err?.message ?? `A Meta respondeu com status ${response.status}.`,
        err?.code,
        err?.subcode,
      );
    }

    return body as T;
  }
}

/** Chama a Graph API e converte erros no formato da Meta em exceção. */
export async function metaGet<T>(
  path: string,
  params: Record<string, string> = {},
  accessToken: string,
): Promise<T> {
  const url = new URL(`${GRAPH_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("access_token", accessToken);
  return buscarComRetentativa<T>(url);
}

/** Busca o perfil vinculado ao token (id + nome). */
export function getMe(accessToken: string) {
  return metaGet<{ id: string; name: string }>("/me", { fields: "id,name" }, accessToken);
}

type MetaPaging = { next?: string; cursors?: { after?: string } };
type MetaList<T> = { data: T[]; paging?: MetaPaging };

/**
 * Percorre todas as páginas de uma listagem da Graph API.
 * A Meta devolve `paging.next` com a URL completa, inclusive o token.
 */
export async function metaGetAll<T>(
  path: string,
  params: Record<string, string>,
  accessToken: string,
  maxPages = 12,
): Promise<T[]> {
  const coletados: T[] = [];
  let pagina: MetaList<T> | null = await metaGet<MetaList<T>>(path, params, accessToken);
  let paginas = 0;

  while (pagina) {
    coletados.push(...(pagina.data ?? []));
    paginas += 1;
    const proxima: string | undefined = pagina.paging?.next;
    if (!proxima || paginas >= maxPages) break;

    try {
      pagina = await buscarComRetentativa<MetaList<T>>(new URL(proxima));
    } catch {
      // Já temos dados suficientes; uma página com erro não invalida o total.
      break;
    }
  }

  return coletados;
}

/* ------------------------------------------------------------------ */
/* Estrutura de anúncios                                               */
/* ------------------------------------------------------------------ */

export type MetaCampaign = {
  id: string;
  name: string;
  objective?: string;
  status?: string;
  effective_status?: string;
  daily_budget?: string;
};

export type MetaAdSet = {
  id: string;
  name: string;
  status?: string;
  effective_status?: string;
  destination_type?: string;
  optimization_goal?: string;
};

export type MetaAd = {
  id: string;
  name: string;
  status?: string;
  effective_status?: string;
};

/** Campanhas de uma conta de anúncios. */
export function getCampaigns(adAccountId: string, accessToken: string) {
  return metaGetAll<MetaCampaign>(
    `/${normalizarContaId(adAccountId)}/campaigns`,
    {
      // `destination_type` só existe no conjunto; pedir na campanha é erro.
      fields: "id,name,objective,status,effective_status,daily_budget",
      limit: "200",
    },
    accessToken,
  );
}

/**
 * Destino de conversão por campanha, derivado dos conjuntos. A campanha em si
 * não expõe `destination_type`, mas é dele que sai o "Mensagens no WhatsApp" /
 * "Visitas ao perfil do Instagram" do Gerenciador.
 */
export async function getDestinosPorCampanha(
  adAccountId: string,
  accessToken: string,
): Promise<Map<string, string>> {
  const conjuntos = await metaGetAll<MetaAdSet & { campaign_id?: string }>(
    `/${normalizarContaId(adAccountId)}/adsets`,
    {
      fields: "id,name,campaign_id,status,destination_type,optimization_goal",
      limit: "500",
    },
    accessToken,
  );

  const mapa = new Map<string, string>();
  for (const conjunto of conjuntos) {
    const campanha = conjunto.campaign_id;
    if (!campanha || !conjunto.destination_type) continue;
    // O primeiro destino encontrado representa a campanha.
    if (!mapa.has(campanha)) mapa.set(campanha, conjunto.destination_type);
  }
  return mapa;
}

/** Conjuntos de uma campanha. */
export function getAdSets(campaignId: string, accessToken: string) {
  return metaGetAll<MetaAdSet>(
    `/${campaignId}/adsets`,
    {
      fields: "id,name,status,effective_status,destination_type,optimization_goal",
      limit: "200",
    },
    accessToken,
  );
}

/** Anúncios de um conjunto. */
export function getAds(adSetId: string, accessToken: string) {
  return metaGetAll<MetaAd>(
    `/${adSetId}/ads`,
    { fields: "id,name,status,effective_status", limit: "200" },
    accessToken,
  );
}

/**
 * Insights no nível pedido. `objectId` é a conta (nível campaign), a campanha
 * (nível adset) ou o conjunto (nível ad). Não normalizamos o id aqui: IDs de
 * campanha/conjunto não levam o prefixo `act_`.
 */
export function getInsights(
  objectId: string,
  level: "account" | "campaign" | "adset" | "ad",
  datePreset: string,
  accessToken: string,
  /** Quando informado, usa esta janela (since/until) em vez do `datePreset`. */
  intervalo?: { since: string; until: string },
  /** `1` quebra a série por dia; cada linha traz `date_start`/`date_stop`. */
  timeIncrement?: number,
  /** Quebra por dimensão, ex.: `"gender,age"` (demografia das ações). */
  breakdowns?: string,
) {
  const fields = [
    "date_start",
    "date_stop",
    "campaign_id",
    "campaign_name",
    "adset_id",
    "adset_name",
    "ad_id",
    "ad_name",
    "objective",
    "spend",
    "impressions",
    "frequency",
    "reach",
    "inline_link_clicks",
    "inline_link_click_ctr",
    "actions",
    "action_values",
    "cost_per_action_type",
    "ctr",
    "cpm",
    // Campos próprios de Instagram, expostos no Gerenciador de Negócios.
    // (Não vêm em `actions`; precisam ser pedidos pelo nome.)
    "instagram_profile_visits",
    // Novos seguidores no Instagram atribuídos aos anúncios no período
    // (o mesmo número da coluna "Seguidores no Instagram" do Gerenciador).
    "instagram_profile_follow",
    // `results` e `cost_per_result` trazem o resultado oficial da Meta para o
    // objetivo configurado (o mesmo número que o Gerenciador mostra).
    "results",
    "cost_per_result",
  ].join(",");

  const janela: Record<string, string> = intervalo
    ? {
        time_range: JSON.stringify({
          since: intervalo.since,
          until: intervalo.until,
        }),
      }
    // "custom" não é um date_preset da Meta; sem intervalo, não se envia nada.
    : datePreset === "custom"
      ? {}
      : { date_preset: datePreset };

  return metaGetAll<Record<string, unknown>>(
    `/${objectId}/insights`,
    {
      level,
      fields,
      ...janela,
      limit: "500",
      ...(timeIncrement ? { time_increment: String(timeIncrement) } : {}),
      ...(breakdowns ? { breakdowns } : {}),
    },
    accessToken,
  );
}

/** IDs de conta aceitam com e sem o prefixo `act_`. */
export function normalizarContaId(id: string): string {
  return id.startsWith("act_") ? id : `act_${id}`;
}

/** Lista todas as contas de anúncios acessíveis pelo token (segue a paginação). */
export function getAdAccounts(accessToken: string, limit = 500) {
  return metaGetAll<MetaAdAccount>(
    "/me/adaccounts",
    { fields: "id,name,currency,account_status", limit: String(limit) },
    accessToken,
  ).then((data) => ({ data }));
}

/** Saldo e origem de cobrança de uma conta de anúncios. */
export async function getAdAccountBilling(
  accountId: string,
  accessToken: string,
): Promise<MetaAdAccountBilling> {
  const path = `/${normalizarContaId(accountId)}`;
  // Balance is broadly available; do not combine it with billing fields that
  // may be permission/version restricted, or one rejected field hides balance.
  const billing = await metaGet<MetaAdAccountBilling>(
    path,
    { fields: "balance,currency" },
    accessToken,
  );

  try {
    const funding = await metaGet<MetaAdAccountBilling>(
      path,
      { fields: "funding_source_details" },
      accessToken,
    );
    return { ...billing, ...funding };
  } catch {
    return billing;
  }
}

/** Inspeciona o token: validade, escopos e expiração. */
export function debugToken(accessToken: string, appAccessToken: string) {
  return metaGet<{ data: MetaDebugToken }>(
    "/debug_token",
    { input_token: accessToken },
    appAccessToken,
  );
}

/** Testa token + acesso a contas, com mensagens úteis por tipo de falha. */
export async function testConnection(accessToken: string): Promise<TestConnectionResult> {
  try {
    const me = await getMe(accessToken);

    let accounts: MetaAdAccount[] = [];
    try {
      const res = await getAdAccounts(accessToken);
      accounts = res.data ?? [];
    } catch {
      // Token válido, mas sem a permissão ads_management — seguimos com lista vazia.
    }

    return { ok: true, user: me.name, accounts, token: {} };
  } catch (error) {
    if (error instanceof MetaApiException) {
      let message = error.message;
      if (error.code === 190) {
        message =
          "Token inválido ou revogado. Gere um novo token na Meta e cole aqui novamente.";
      } else if (error.code === 4 || error.code === 17) {
        message = "Limite de requisições da Meta atingido. Aguarde alguns minutos.";
      }
      return { ok: false, message };
    }
    return {
      ok: false,
      message: "Falha inesperada ao testar a conexão. Tente novamente.",
    };
  }
}
