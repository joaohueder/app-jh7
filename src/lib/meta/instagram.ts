/**
 * Postagens do Instagram (feed e Reels) por dia.
 *
 * A Graph API não expõe isso por conta de anúncio: é preciso a conta
 * profissional do Instagram, ligada a uma página. Como o contrato nem sempre
 * tem a URL do perfil preenchida, resolvemos a conta pelo token, casando o
 * nome da página com o nome do cliente. Sem correspondência, o bloco fica
 * nulo e o relatório mostra só o que veio da Meta Ads.
 */

const GRAPH = "https://graph.facebook.com/v21.0";

type ContaInstagram = { id: string; username?: string };

type Pagina = {
  name?: string;
  /**
   * A Meta expõe o Instagram da página por dois campos: o `business` (conta
   * profissional ligada no Gerenciador) e o `connected` (perfil conectado).
   * Clientes variam — Lukar só tem o segundo —, então os dois são pedidos e a
   * busca usa o que existir.
   */
  instagram_business_account?: ContaInstagram;
  connected_instagram_account?: ContaInstagram;
};

/** O Instagram da página, venha ele do campo business ou do connected. */
function instagramDaPagina(p: Pagina): ContaInstagram | undefined {
  return p.instagram_business_account ?? p.connected_instagram_account;
}

type Midia = {
  media_product_type?: string;
  media_type?: string;
  timestamp?: string;
};

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Palavras que não identificam ninguém ("Pizzaria **do** Dirceu"). */
const VAZIAS = new Set(["do", "da", "de", "dos", "das", "e", "a", "o", "as", "os"]);

/** Palavras significativas do nome: "Pizzaria do Dirceu" → pizzaria, dirceu. */
function palavras(nome: string): string[] {
  return normalizar(nome)
    .split(" ")
    .filter((p) => p.length >= 2 && !VAZIAS.has(p));
}

/** Quantas palavras significativas do cliente aparecem no texto comparado. */
function quantasCasam(nomeCliente: string, texto: string): number {
  const alvo = normalizar(texto);
  return palavras(nomeCliente).filter((p) => alvo.includes(p)).length;
}

/** Todas as páginas do token, seguindo a paginação. */
async function paginasDoToken(token: string): Promise<Pagina[]> {
  const paginas: Pagina[] = [];
  let url: string | null =
    `${GRAPH}/me/accounts?fields=id,name,instagram_business_account{id,username},connected_instagram_account{id,username}&limit=100`;

  while (url) {
    const resposta = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!resposta.ok) break;
    const json = (await resposta.json()) as { data?: Pagina[]; paging?: { next?: string } };
    paginas.push(...(json.data ?? []));
    url = json.paging?.next ?? null;
  }
  return paginas;
}

/**
 * Conta profissional do Instagram do cliente. Tenta pelo `@` do contrato e,
 * sem ele, casa o nome do cliente com o nome da página e/ou o `@` do perfil.
 *
 * O mesmo cliente costuma ter duas páginas — uma com o nome completo sem
 * Instagram ligado e outra curta com o perfil (WR Automóveis / WR). Por isso
 * só entram na busca as páginas que têm Instagram, e o nome do perfil também
 * é comparado: `wrautomoveis.inoa` casa com "WR Automóveis" pelo prefixo.
 */
async function contaDoCliente(
  token: string,
  nomeCliente: string,
  instagramUrl: string | null,
): Promise<{ id: string } | null> {
  const paginas = await paginasDoToken(token);
  const comInstagram = paginas.filter((p) => instagramDaPagina(p)?.id);

  const usuario = instagramUrl
    ?.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/[/?#].*$/, "")
    .replace(/^@/, "")
    .trim()
    .toLowerCase();
  if (usuario) {
    const porUsuario = comInstagram.find(
      (p) => (instagramDaPagina(p)?.username ?? "").toLowerCase() === usuario,
    );
    const achado = porUsuario ? instagramDaPagina(porUsuario) : undefined;
    if (achado) return { id: achado.id };
  }

  const alvo = normalizar(nomeCliente);
  if (!alvo) return null;

  // Nome da página e @ do perfil, ambos normalizados: "wrautomoveis.inoa"
  // vira "wrautomoveis inoa".
  const nomes = (p: Pagina) => [
    normalizar(p.name ?? ""),
    normalizar(instagramDaPagina(p)?.username ?? ""),
  ];

  const exato = comInstagram.find((p) => nomes(p).includes(alvo));
  const porIgualdade = exato ? instagramDaPagina(exato) : undefined;
  if (porIgualdade) return { id: porIgualdade.id };

  // Sem igualdade: o nome do cliente contido no nome da página ou no @.
  const porNome = comInstagram.find((p) =>
    nomes(p).some((n) => n.includes(alvo) || alvo.includes(n.replace(/\s+/g, ""))),
  );
  const porContido = porNome ? instagramDaPagina(porNome) : undefined;
  if (porContido) return { id: porContido.id };

  /*
   * Último recurso: casar por palavras.
   *
   * A regra antiga olhava só a primeira palavra do @ ("pizzaria...") e por
   * isso "Pizzaria do Dirceu" virou o perfil de outra pizzaria — o relatório
   * mostrava as visitas do concorrente. Agora o candidato precisa conter a
   * palavra que menos se repete no nome (o "Dirceu"), e dois clientes disputando
   * o mesmo perfil cancelam a escolha: sem match confiável, é melhor não
   * mostrar número nenhum do que mostrar o de outro.
   */
  const minhas = palavras(nomeCliente);
  if (minhas.length === 0) return null;

  // A palavra mais rara no nome é a mais distintiva ("dirceu" e não "pizzaria").
  const melhorPalavra = [...minhas].sort((a, b) => a.length - b.length).at(-1)!;

  const candidatos = comInstagram.filter((p) =>
    nomes(p).some((n) => n.includes(melhorPalavra)),
  );
  const pontuados = candidatos
    .map((p) => ({
      pagina: p,
      pontos: Math.max(...nomes(p).map((n) => quantasCasam(nomeCliente, n))),
    }))
    .sort((a, b) => b.pontos - a.pontos);

  if (pontuados.length === 0) return null;
  // Precisa casar pelo menos metade das palavras do cliente.
  const minimo = Math.max(1, Math.ceil(minhas.length / 2));
  if (pontuados[0].pontos < minimo) return null;
  // Empate na primeira posição = duas páginas igualmente parecidas: ambíguo.
  if (pontuados[1] && pontuados[1].pontos === pontuados[0].pontos) return null;

  const achado = instagramDaPagina(pontuados[0].pagina);
  return achado ? { id: achado.id } : null;
}

export type PostsPorDia = {
  /** YYYY-MM-DD → quantidade, por tipo de publicação. */
  feed: Record<string, number>;
  reels: Record<string, number>;
};

/** YYYY-MM-DD → seguidores ganhos no perfil naquele dia (todos, não só os do anúncio). */
export type SeguidoresPorDia = Record<string, number>;

type InsightInstagram = {
  name?: string;
  values?: { value: number; end_time?: string }[];
};

/**
 * Seguidores ganhos por dia no perfil inteiro, direto de `/insights`.
 * É o total do perfil (pago + orgânico); o que vem da campanha é menor e é
 * subtraído em `relatorio.ts`.
 *
 * `end_time` vem com o fuso da conta (08:00 UTC no Brasil), então o dia é
 * lido da parte UTC — o dia local é o mesmo.
 */
async function seguidoresDoPerfil(
  contaId: string,
  token: string,
  since: string,
  until: string,
): Promise<SeguidoresPorDia | null> {
  const url =
    `${GRAPH}/${contaId}/insights?metric=follower_count&period=day` +
    `&since=${since}&until=${until}`;
  try {
    const resposta = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!resposta.ok) return null;
    const json = (await resposta.json()) as { data?: InsightInstagram[] };
    const serie = json.data?.find((m) => m.name === "follower_count");
    if (!serie?.values) return null;

    const porDia: SeguidoresPorDia = {};
    for (const ponto of serie.values) {
      const dia = ponto.end_time?.slice(0, 10);
      if (dia) porDia[dia] = (porDia[dia] ?? 0) + (Number(ponto.value) || 0);
    }
    return porDia;
  } catch {
    return null;
  }
}

/** YYYY-MM-DD → total de uma métrica no dia. */
export type ViewsPorDia = Record<string, number>;

/**
 * Série diária de uma métrica agregada do perfil.
 *
 * `views` e `profile_views` só aceitam `metric_type=total_value`, ignoram
 * `time_range` e devolvem um único número para o intervalo — não existe versão
 * diária. A série sai por diferença: `m(a..b) - m(a..b-1)` é o que o dia `b`
 * somou. Uma chamada por dia, dentro de um período curto (dias, não meses).
 *
 * Dia sem dado (conta sem a métrica) não entra no mapa; quem consome decide
 * entre `null` e zero.
 */
async function serieAgregada(
  contaId: string,
  token: string,
  metricaNome: string,
  since: string,
  until: string,
): Promise<ViewsPorDia | null> {
  // Nunca além do último dia fechado. O período do relatório pode terminar no
  // futuro, e a API devolve o balde do dia em andamento com a data seguinte —
  // era o que colocava "visitas em 20/11" num relatório gerado em 19/11.
  //
  // Cada balde fecha às 05:00 no horário de Brasília (08:00 UTC); então o dia
  // de hoje só entra depois disso. Antes, o último dia completo é ontem.
  const agora = new Date();
  const ultimoFechado = new Date(agora);
  if (agora.getHours() < 5) ultimoFechado.setDate(ultimoFechado.getDate() - 1);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const limite = iso(ultimoFechado);
  const fim = until > limite ? limite : until;
  if (fim < since) return null;

  // Janela de referência começa dois dias antes: a Meta não responde um
  // intervalo de um dia só, então é preciso pelo menos dois dias de base para
  // que a diferença do primeiro dia do relatório tenha de onde sair.
  const ancora = new Date(`${since}T00:00:00Z`);
  ancora.setUTCDate(ancora.getUTCDate() - 2);
  const inicioAcumulado = ancora.toISOString().slice(0, 10);

  const acumulado = async (dia: string): Promise<number | null> => {
    const url =
      `${GRAPH}/${contaId}/insights?metric=${metricaNome}&period=day&metric_type=total_value` +
      `&since=${inicioAcumulado}&until=${dia}`;
    try {
      const resposta = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!resposta.ok) return null;
      const json = (await resposta.json()) as {
        data?: { name?: string; total_value?: { value?: number } }[];
      };
      const metrica = json.data?.find((m) => m.name === metricaNome);
      if (!metrica?.total_value) return null;
      return Number(metrica.total_value.value) || 0;
    } catch {
      return null;
    }
  };

  // Percorre desde a âncora: a diferença do primeiro dia do relatório precisa
  // do acumulado do dia anterior a ele.
  const porDia: ViewsPorDia = {};
  let anterior: number | null = null;
  for (
    let cursor = new Date(`${inicioAcumulado}T00:00:00Z`);
    cursor.toISOString().slice(0, 10) <= fim;
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    const dia = cursor.toISOString().slice(0, 10);
    const total = await acumulado(dia);
    if (total === null) continue;
    // Sem leitura anterior a diferença seria o acumulado inteiro; só grava o
    // dia quando há base para subtrair.
    if (anterior !== null && dia >= since) {
      porDia[dia] = Math.max(0, total - anterior);
    }
    anterior = total;
  }

  // Sem nenhum dia derivado, não há série: mostra "sem acesso" em vez de zeros.
  return Object.keys(porDia).length ? porDia : null;
}

export type PerfilInstagram = {
  posts: PostsPorDia;
  /** null quando a conta não expõe a métrica de seguidores. */
  seguidores: SeguidoresPorDia | null;
  /** null quando a conta não expõe a métrica de visualizações. */
  views: ViewsPorDia | null;
  /** Visitas ao perfil por dia (métrica do próprio Instagram). */
  visitas: ViewsPorDia | null;
};

/** Postagens, seguidores e visualizações por dia do perfil; `null` se não achou. */
export async function perfilInstagramPorDia(
  token: string,
  nomeCliente: string,
  instagramUrl: string | null,
  since: string,
  until: string,
): Promise<PerfilInstagram | null> {
  const conta = await contaDoCliente(token, nomeCliente, instagramUrl).catch(() => null);
  if (!conta) return null;

  const [midias, seguidores, views, visitas] = await Promise.all([
    midiasDoEdge(conta.id, "media", token, since).catch(() => [] as Midia[]),
    seguidoresDoPerfil(conta.id, token, since, until).catch(() => null),
    serieAgregada(conta.id, token, "views", since, until).catch(() => null),
    serieAgregada(conta.id, token, "profile_views", since, until).catch(() => null),
  ]);

  // Só feed e Reels: a Graph API só devolve story nas 24h em que ele existe e
  // não há como pedir os arquivados, então contar do edge `stories` deixava o
  // gráfico com story só no dia da geração.
  const posts: PostsPorDia = { feed: {}, reels: {} };
  for (const midia of midias) {
    const dia = midia.timestamp?.slice(0, 10);
    if (!dia || dia < since || dia > until) continue;

    const tipo = (midia.media_product_type ?? "").toUpperCase();
    const grupo = tipo === "REELS" ? "reels" : "feed";
    posts[grupo][dia] = (posts[grupo][dia] ?? 0) + 1;
  }

  return { posts, seguidores, views, visitas };
}

/**
 * Mídias do edge `media` do perfil (feed e Reels), paginando até passar do
 * início do período.
 */
async function midiasDoEdge(
  contaId: string,
  edge: "media",
  token: string,
  since: string,
): Promise<Midia[]> {
  const midias: Midia[] = [];
  let url: string | null = `${GRAPH}/${contaId}/${edge}?fields=id,media_product_type,media_type,timestamp&limit=100`;

  while (url) {
    const resposta = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!resposta.ok) break;
    const json = (await resposta.json()) as { data?: Midia[]; paging?: { next?: string } };
    midias.push(...(json.data ?? []));
    url = json.paging?.next ?? null;

    // A API devolve do mais recente para o mais antigo: passou do início,
    // não precisa continuar paginando.
    const maisAntigo = midias[midias.length - 1]?.timestamp?.slice(0, 10);
    if (maisAntigo && maisAntigo < since) break;
  }
  return midias;
}
