/**
 * Snapshot do relatório: consulta a Meta **uma vez** na geração e guarda os
 * números no banco. A página pública nunca fala com a Graph API.
 *
 * O snapshot guarda um bloco por escopo (relatório inteiro, cada campanha e
 * cada conjunto) para que o filtro do cabeçalho recalcule tudo — resumo,
 * funil, mensagens, demografia — sem nova consulta.
 */

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { clients, contractAdAccounts, contracts } from "@/lib/db/schema";
import { getMetaToken } from "@/lib/settings";
import { getInsights } from "./client";
import {
  perfilInstagramPorDia,
  type PostsPorDia,
  type SeguidoresPorDia,
  type ViewsPorDia,
} from "./instagram";
import {
  comprasDaAcao,
  mapearMetricas,
  mensagensDaAcao,
  seguidoresDaAcao,
} from "./insights";
import {
  campanhasDoCliente,
  contasDoCliente,
  type ContaDoCliente,
  type LinhaMetricas,
} from "./campaigns";

export type ResumoRelatorio = {
  investido: number;
  impressoes: number | null;
  alcance: number | null;
  /** Impressões ÷ alcance (média calculada, não soma). */
  frequencia: number | null;
  cliquesLink: number | null;
  mensagens: number | null;
  /** Só existe quando há campanha de conversão de compra no período. */
  compras: number | null;
  faturamento: number | null;
  /** Só no bloco total: visualizações do perfil do Instagram no período. */
  viewsInstagram: number | null;
};

export type FunilCompra = {
  cliquesLink: number | null;
  visitasPagina: number | null;
  adicoesCarrinho: number | null;
  finalizacoesCompra: number | null;
  compras: number | null;
};

export type DiaCompra = {
  /** ISO (YYYY-MM-DD). */
  data: string;
  faturamento: number;
  compras: number;
};

export type DiaMensagem = {
  data: string;
  mensagens: number;
  /** Investimento ÷ mensagens do dia. */
  custo: number | null;
  /** CPM do dia: investimento ÷ impressões × 1000. */
  cpm: number | null;
};

/** Série diária de Instagram: visitas, seguidores e postagens do perfil. */
export type DiaInstagram = {
  data: string;
  /**
   * Visitas ao perfil mostradas no gráfico. Vem do perfil do Instagram quando
   * ele foi localizado; sem perfil, cai nas visitas atribuídas aos anúncios.
   */
  visitas: number;
  /**
   * Visitas atribuídas às campanhas (`instagram_profile_visits`) no dia.
   * Sempre preenchido, mesmo quando o gráfico usa o número do perfil — é o
   * que o Gerenciador de Negócios mostra na coluna de visitas.
   */
  visitasAnuncios: number;
  /** true = `visitas` vieram do perfil inteiro, não dos anúncios. */
  visitasDoPerfil: boolean;
  /**
   * Seguidores ganhos pelas campanhas de **tráfego para o perfil** — a mesma
   * fonte do bloco de tráfego. Outras campanhas também registram
   * `instagram_profile_follow`; somá-las aqui fazia os dois grupos discordarem
   * (o cliente via 4 num e 8 no outro).
   */
  seguidores: number;
  /**
   * Seguidores ganhos no perfil inteiro no dia (pago + orgânico), quando o
   * perfil expõe a métrica. `null` = perfil não localizado ou sem acesso.
   */
  seguidoresTotal: number | null;
  /** Total − pago. `null` quando não há total para comparar. */
  seguidoresOrganicos: number | null;
  /** Visualizações do conteúdo no perfil naquele dia. `null` = sem acesso. */
  views: number | null;
  /** Posts de feed e Reels publicados no perfil naquele dia. */
  posts: number | null;
  /** Mesmos posts abertos por tipo; `null` quando o perfil não foi achado. */
  postsFeed: number | null;
  postsReels: number | null;
};

/** Dia de uma campanha de tráfego para o Instagram. */
export type DiaSeguidor = {
  data: string;
  seguidores: number;
  /** Investimento ÷ seguidores do dia. */
  custo: number | null;
  /** CPM do dia: investimento ÷ impressões × 1000. */
  cpm: number | null;
};

/** Métricas de leilão da conta inteira (todas as campanhas), por dia. */
export type DiaConta = {
  data: string;
  /** Custo por mil impressões. */
  cpm: number | null;
  /** CTR no link (%): cliques no link ÷ impressões. */
  ctr: number | null;
};

export type BlocoCompra = { funil: FunilCompra; diario: DiaCompra[] };
export type BlocoMensagens = { diario: DiaMensagem[] };
export type BlocoInstagram = {
  diario: DiaInstagram[];
  /** Visualizações por dia na janela anterior, para o gráfico comparativo. */
  viewsAnterior: { data: string; valor: number }[];
};
/**
 * Só existe quando há campanha de tráfego para o perfil do Instagram no
 * período — é o bloco de seguidores.
 */
export type BlocoTrafegoInstagram = {
  diario: DiaSeguidor[];
  demografia: Demografia;
};

/**
 * Leilão da conta inteira: CPM e CTR por dia, independentes das campanhas.
 * `anterior` é a mesma série na janela anterior, para comparação.
 */
export type BlocoConta = { diario: DiaConta[]; anterior: DiaConta[] };

export type Segmento = { chave: string; valor: number };
/** Demografia das conversões (não das impressões). */
export type Demografia = {
  sexo: Segmento[];
  idade: Segmento[];
  /** Investimento por faixa de idade, na mesma ordem de `idade`. */
  gastoIdade?: Segmento[];
};

/** Um recorte completo do relatório (total, campanha ou conjunto). */
export type Bloco = {
  resumo: ResumoRelatorio;
  anterior: ResumoRelatorio | null;
  compra: BlocoCompra | null;
  mensagens: BlocoMensagens | null;
  instagram: BlocoInstagram | null;
  /** Presente só quando há campanha de tráfego para o Instagram. */
  trafegoInstagram: BlocoTrafegoInstagram | null;
  /** CPM/CTR da conta inteira (só no bloco total). */
  conta: BlocoConta | null;
  demografiaCompra: Demografia | null;
  demografiaMensagens: Demografia | null;
};

/** Item da tabela de campanhas → conjuntos → anúncios. */
export type LinhaArvore = {
  id: string;
  nome: string;
  nivel: "campanha" | "conjunto" | "anuncio";
  investido: number;
  impressoes: number | null;
  alcance: number | null;
  frequencia: number | null;
  cliquesLink: number | null;
  resultadoValor: number | null;
  resultadoRotulo: string;
  custoPorResultado: number | null;
  ctr: number | null;
  cpm: number | null;
  filhos?: LinhaArvore[];
};

export type RelatorioSnapshot = {
  /** v2: blocos por escopo. v1 tinha um único bloco no topo. */
  versao: 2;
  geradoEm: string;
  periodo: { since: string; until: string };
  anteriorPeriodo: { since: string; until: string } | null;
  total: Bloco;
  /** Chaves "c:<campanhaId>" e "a:<conjuntoId>". */
  escopos: Record<string, Bloco>;
  arvore: LinhaArvore[];
};

/* ------------------------------------------------------------------ */
/* Somas                                                               */
/* ------------------------------------------------------------------ */

function soma(
  linhas: Partial<LinhaMetricas>[],
  extrair: (linha: Partial<LinhaMetricas>) => number | null | undefined,
): number | null {
  const valores = linhas
    .map(extrair)
    .filter((v): v is number => typeof v === "number");
  return valores.length ? valores.reduce((a, b) => a + b, 0) : null;
}

/**
 * Totais de um conjunto de linhas de campanha.
 *
 * ponytail: alcance é somado por campanha — duas campanhas podem alcançar a
 * mesma pessoa e inflar o número. Se isso incomodar, buscar alcance no nível
 * de conta (`level=account`) em vez de somar as campanhas.
 *
 * A série diária de compras pode somar mais que o KPI do período: a Meta
 * atribui a mesma compra em dias diferentes ao quebrar por dia. O gráfico
 * serve para tendência; o número oficial é o KPI.
 */
export function agregarResumo(
  linhas: LinhaMetricas[],
  /**
   * Alcance deduplicado no nível de conta. Somar o alcance das campanhas conta
   * duas vezes quem foi alcançado por mais de uma; a Meta deduplica na conta.
   * Anúncios/impressões seguem somados normalmente.
   */
  alcanceConta?: number | null,
  /** Visualizações do perfil do Instagram no período (só no bloco total). */
  viewsInstagram?: number | null,
): ResumoRelatorio {
  const impressoes = soma(linhas, (l) => l.impressoes);
  const alcance = alcanceConta ?? soma(linhas, (l) => l.alcance);

  const deCompra = linhas.filter(
    (l) => l.temFunilCompra && l.resultadoRotulo === "Compras",
  );

  return {
    investido: linhas.reduce((total, l) => total + l.investido, 0),
    impressoes,
    alcance,
    frequencia:
      impressoes !== null && alcance !== null && alcance > 0
        ? impressoes / alcance
        : null,
    cliquesLink: soma(linhas, (l) => l.cliquesLink),
    mensagens: soma(linhas, (l) => l.mensagensIniciadas),
    compras: deCompra.length ? soma(deCompra, (l) => l.resultadoValor) : null,
    faturamento: soma(linhas, (l) => l.faturamento),
    viewsInstagram: viewsInstagram ?? null,
  };
}

/** Mesmos totais, lidos do período anterior costurado em cada linha. */
function agregarAnterior(
  linhas: LinhaMetricas[],
  alcanceConta?: number | null,
  /** Visualizações do perfil no período anterior (só no bloco total). */
  viewsInstagram?: number | null,
): ResumoRelatorio | null {
  const anteriores = linhas
    .map((l) => l.anterior)
    .filter((a): a is NonNullable<LinhaMetricas["anterior"]> => a != null);
  if (!anteriores.length) return null;

  const impressoes = soma(anteriores, (a) => a.impressoes);
  const alcance = alcanceConta ?? soma(anteriores, (a) => a.alcance);

  // Quais campanhas eram de compra continua sendo o que a linha atual diz.
  const idsDeCompra = new Set(
    linhas
      .filter((l) => l.temFunilCompra && l.resultadoRotulo === "Compras")
      .map((l) => l.id),
  );
  const anterioresDeCompra = linhas
    .filter((l) => idsDeCompra.has(l.id))
    .map((l) => l.anterior)
    .filter((a): a is NonNullable<LinhaMetricas["anterior"]> => a != null);

  return {
    investido: anteriores.reduce((total, a) => total + (a.investido ?? 0), 0),
    impressoes,
    alcance,
    frequencia:
      impressoes !== null && alcance !== null && alcance > 0
        ? impressoes / alcance
        : null,
    cliquesLink: soma(anteriores, (a) => a.cliquesLink),
    mensagens: soma(anteriores, (a) => a.mensagensIniciadas),
    compras: anterioresDeCompra.length
      ? soma(anterioresDeCompra, (a) => a.resultadoValor)
      : null,
    faturamento: soma(anteriores, (a) => a.faturamento),
    viewsInstagram: viewsInstagram ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Acumuladores por campanha/conjunto (série diária e demografia)       */
/* ------------------------------------------------------------------ */

const SEXO_LABELS: Record<string, string> = {
  male: "Homens",
  female: "Mulheres",
  unknown: "Não informado",
};

const ORDEM_IDADE = ["13-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+", "unknown"];

type Acumulador = {
  compraDia: Map<string, { faturamento: number; compras: number }>;
  msgDia: Map<string, { mensagens: number; investido: number; impressoes: number }>;
  /**
   * Série do gráfico de Instagram. `seguidores` soma tudo que a Meta atribui;
   * `seguidoresTrafego` só as campanhas de tráfego para o perfil — é o que o
   * gráfico desenha, para bater com o bloco de tráfego.
   */
  igDia: Map<string, { visitas: number; seguidores: number; seguidoresTrafego: number }>;
  /** Série diária das campanhas de tráfego para o Instagram. */
  seguidorDia: Map<string, { seguidores: number; investido: number; impressoes: number }>;
  sexoCompra: Map<string, number>;
  idadeCompra: Map<string, number>;
  sexoMsg: Map<string, number>;
  idadeMsg: Map<string, number>;
  /** Seguidores por sexo/idade, só das campanhas de tráfego p/ Instagram. */
  sexoSeguidor: Map<string, number>;
  idadeSeguidor: Map<string, number>;
  /** Investimento por faixa de idade (linha do gráfico de mensagens). */
  gastoIdade: Map<string, number>;
};

function novoAcumulador(): Acumulador {
  return {
    compraDia: new Map(),
    msgDia: new Map(),
    igDia: new Map(),
    seguidorDia: new Map(),
    sexoCompra: new Map(),
    idadeCompra: new Map(),
    sexoMsg: new Map(),
    idadeMsg: new Map(),
    sexoSeguidor: new Map(),
    idadeSeguidor: new Map(),
    gastoIdade: new Map(),
  };
}

function acumular(mapa: Map<string, number>, chave: string, valor: number) {
  if (valor <= 0) return;
  mapa.set(chave, (mapa.get(chave) ?? 0) + valor);
}

/** Soma dois acumuladores (usado ao juntar campanhas num escopo). */
function somarAcumuladores(alvos: Acumulador[]): Acumulador {
  const total = novoAcumulador();
  for (const alvo of alvos) {
    for (const [data, valor] of alvo.compraDia) {
      const atual = total.compraDia.get(data) ?? { faturamento: 0, compras: 0 };
      atual.faturamento += valor.faturamento;
      atual.compras += valor.compras;
      total.compraDia.set(data, atual);
    }
    for (const [data, valor] of alvo.msgDia) {
      const atual = total.msgDia.get(data) ?? {
        mensagens: 0,
        investido: 0,
        impressoes: 0,
      };
      atual.mensagens += valor.mensagens;
      atual.investido += valor.investido;
      atual.impressoes += valor.impressoes;
      total.msgDia.set(data, atual);
    }
    for (const [data, valor] of alvo.igDia) {
      const atual = total.igDia.get(data) ?? {
        visitas: 0,
        seguidores: 0,
        seguidoresTrafego: 0,
      };
      atual.visitas += valor.visitas;
      atual.seguidores += valor.seguidores;
      atual.seguidoresTrafego += valor.seguidoresTrafego;
      total.igDia.set(data, atual);
    }
    for (const [data, valor] of alvo.seguidorDia) {
      const atual = total.seguidorDia.get(data) ?? {
        seguidores: 0,
        investido: 0,
        impressoes: 0,
      };
      atual.seguidores += valor.seguidores;
      atual.investido += valor.investido;
      atual.impressoes += valor.impressoes;
      total.seguidorDia.set(data, atual);
    }
    for (const mapa of [
      [alvo.sexoCompra, total.sexoCompra],
      [alvo.idadeCompra, total.idadeCompra],
      [alvo.sexoMsg, total.sexoMsg],
      [alvo.idadeMsg, total.idadeMsg],
      [alvo.sexoSeguidor, total.sexoSeguidor],
      [alvo.idadeSeguidor, total.idadeSeguidor],
      [alvo.gastoIdade, total.gastoIdade],
    ] as const) {
      for (const [chave, valor] of mapa[0]) acumular(mapa[1], chave, valor);
    }
  }
  return total;
}

/** Datas do período, em ordem — dias sem entrega entram zerados. */
function diasDoPeriodo(since: string, until: string): string[] {
  const dias: string[] = [];
  const inicio = new Date(`${since}T00:00:00Z`);
  const fim = new Date(`${until}T00:00:00Z`);
  for (let d = new Date(inicio); d <= fim; d.setUTCDate(d.getUTCDate() + 1)) {
    dias.push(d.toISOString().slice(0, 10));
  }
  return dias;
}

function segmentos(mapa: Map<string, number>, ordem?: string[]): Segmento[] {
  const lista = [...mapa.entries()].map(([chave, valor]) => ({ chave, valor }));
  if (!ordem) return lista.sort((a, b) => b.valor - a.valor);
  return lista.sort((a, b) => {
    const ia = ordem.indexOf(a.chave);
    const ib = ordem.indexOf(b.chave);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
}

/** Monta o bloco de um escopo a partir das linhas e dos acumuladores. */
function montarBloco(
  linhas: LinhaMetricas[],
  acumuladores: Acumulador[],
  since: string,
  until: string,
  /** Alcance deduplicado no nível de conta (só no bloco total). */
  alcanceConta?: { atual: number | null; anterior: number | null },
  /** Postagens do perfil por dia (só no bloco total; null = perfil não achado). */
  postsPorDia?: PostsPorDia | null,
  /** Seguidores do perfil inteiro por dia (só no bloco total). */
  seguidoresTotalPorDia?: SeguidoresPorDia | null,
  /** Visualizações do perfil por dia (só no bloco total). */
  viewsPorDia?: ViewsPorDia | null,
  /** Visualizações por dia na janela anterior (só no bloco total). */
  viewsAnt?: ViewsPorDia | null,
  /** Visitas ao perfil por dia, do próprio Instagram (só no bloco total). */
  visitasPorDia?: ViewsPorDia | null,
  /** Série de CPM/CTR da janela anterior (só no bloco total). */
  contaAnterior?: DiaConta[],
  /** Série de CPM/CTR do período atual, no nível de conta. */
  contaAtual?: DiaConta[],
): Bloco {
  const acumulado = somarAcumuladores(acumuladores);
  const deCompra = linhas.filter(
    (l) => l.temFunilCompra && l.resultadoRotulo === "Compras",
  );

  const compra: BlocoCompra | null = deCompra.length
    ? {
        funil: {
          cliquesLink: soma(deCompra, (l) => l.cliquesLink),
          visitasPagina: soma(deCompra, (l) => l.visitasPaginaDestino),
          adicoesCarrinho: soma(deCompra, (l) => l.adicoesCarrinho),
          finalizacoesCompra: soma(deCompra, (l) => l.finalizacoesCompra),
          compras: soma(deCompra, (l) => l.resultadoValor),
        },
        diario: diasDoPeriodo(since, until).map((data) => {
          const dia = acumulado.compraDia.get(data);
          return { data, faturamento: dia?.faturamento ?? 0, compras: dia?.compras ?? 0 };
        }),
      }
    : null;

  const deMensagem = linhas.filter(
    (l) => l.resultadoRotulo === "Mensagens iniciadas" || (l.mensagensIniciadas ?? 0) > 0,
  );

  const mensagens: BlocoMensagens | null = deMensagem.length
    ? {
        diario: diasDoPeriodo(since, until).map((data) => {
          const dia = acumulado.msgDia.get(data);
          return {
            data,
            mensagens: dia?.mensagens ?? 0,
            custo: dia && dia.mensagens > 0 ? dia.investido / dia.mensagens : null,
            cpm:
              dia && dia.impressoes > 0
                ? (dia.investido / dia.impressoes) * 1000
                : null,
          };
        }),
      }
    : null;

  // Só aparece quando alguma campanha entregou visita ao perfil ou seguidores.
  const temInstagram = linhas.some(
    (l) => (l.visitasPerfil ?? 0) > 0 || (l.seguidores ?? 0) > 0,
  );

  // O bloco existe se a Meta entregou visitas/seguidores ou se o perfil tem
  // postagens no período (o gráfico da direita usa as duas coisas).
  const temPosts = postsPorDia
    ? Object.keys(postsPorDia.feed).length > 0 ||
      Object.keys(postsPorDia.reels).length > 0
    : false;

  // Bloco de seguidores: só existe quando alguma linha é campanha/conjunto de
  // tráfego para o perfil do Instagram.
  const temTrafegoInstagram = linhas.some(
    (l) =>
      (l.objetivoCodigo === "OUTCOME_TRAFFIC" && l.destino === "INSTAGRAM_PROFILE") ||
      ((l.seguidores ?? 0) > 0 && l.resultadoRotulo === "Seguidores"),
  );

  const instagram: BlocoInstagram | null =
    temInstagram || temPosts || seguidoresTotalPorDia || viewsPorDia || visitasPorDia
      ? {
          diario: diasDoPeriodo(since, until).map((data) => {
            const dia = acumulado.igDia.get(data);
            // Com campanha de tráfego para o perfil, mostra só ela — é o
            // mesmo número do bloco de tráfego, e o cliente comparava os dois
            // e via diferença. Sem esse tipo de campanha, os seguidores vêm de
            // outros anúncios (venda, mensagem...) e mostrar zero seria pior:
            // nesse caso entra tudo que a Meta atribui.
            const pago = temTrafegoInstagram
              ? (dia?.seguidoresTrafego ?? 0)
              : (dia?.seguidores ?? 0);
            // `follower_count` fecha o dia com atraso e às vezes devolve 0
            // antes de consolidar. Um total menor que o pago é dado furado:
            // sem separação confiável, a barra volta a ser o total do pago.
            const bruto = seguidoresTotalPorDia?.[data] ?? null;
            const total = bruto !== null && bruto >= pago ? bruto : null;
            return {
              data,
              // Visitas ao perfil vêm do Instagram quando ele está acessível:
              // é o número do perfil inteiro, não só o que os anúncios
              // atribuíram. Sem o perfil, cai no que a Meta Ads reporta.
              visitas: visitasPorDia?.[data] ?? dia?.visitas ?? 0,
              visitasAnuncios: dia?.visitas ?? 0,
              visitasDoPerfil: visitasPorDia?.[data] !== undefined,
              seguidores: pago,
              seguidoresTotal: total,
              seguidoresOrganicos: total === null ? null : total - pago,
              views: viewsPorDia?.[data] ?? null,
              // null = perfil do Instagram não localizado pelo token.
              posts: postsPorDia
                ? (postsPorDia.feed[data] ?? 0) + (postsPorDia.reels[data] ?? 0)
                : null,
              postsFeed: postsPorDia ? (postsPorDia.feed[data] ?? 0) : null,
              postsReels: postsPorDia ? (postsPorDia.reels[data] ?? 0) : null,
            };
          }),
          // Série anterior alinhada por índice de dia (1º dia com 1º dia),
          // que é como o gráfico compara as duas linhas.
          viewsAnterior: viewsAnt
            ? diasDoPeriodo(since, until)
                .map((_, indice) => {
                  const chave = Object.keys(viewsAnt).sort()[indice];
                  return chave === undefined
                    ? null
                    : { data: chave, valor: viewsAnt[chave] };
                })
                .filter((p): p is { data: string; valor: number } => p !== null)
            : [],
        }
      : null;

  const trafegoInstagram: BlocoTrafegoInstagram | null = temTrafegoInstagram
    ? {
        diario: diasDoPeriodo(since, until).map((data) => {
          const dia = acumulado.seguidorDia.get(data);
          return {
            data,
            seguidores: dia?.seguidores ?? 0,
            custo: dia && dia.seguidores > 0 ? dia.investido / dia.seguidores : null,
            cpm:
              dia && dia.impressoes > 0
                ? (dia.investido / dia.impressoes) * 1000
                : null,
          };
        }),
        demografia: {
          sexo: segmentos(acumulado.sexoSeguidor),
          idade: segmentos(acumulado.idadeSeguidor, ORDEM_IDADE),
          gastoIdade: segmentos(acumulado.gastoIdade, ORDEM_IDADE),
        },
      }
    : null;

  // Leilão da conta inteira: só no bloco total. Um escopo de campanha não tem
// CPM próprio "de conta", e o acumulador aqui carrega a conta toda — exibir
// isso dentro do filtro de uma campanha daria um número que não é dela.
  const conta: BlocoConta | null = contaAtual?.length
    ? { diario: contaAtual, anterior: contaAnterior ?? [] }
    : null;

  return {
    resumo: agregarResumo(
      linhas,
      alcanceConta?.atual,
      // Só o total recebe a série do perfil; o numerador de um escopo não teria
      // sentido (visualizações do perfil não pertencem a uma campanha).
      viewsPorDia
        ? Object.values(viewsPorDia).reduce((a, b) => a + b, 0)
        : null,
    ),
    anterior: agregarAnterior(
      linhas,
      alcanceConta?.anterior,
      viewsAnt ? Object.values(viewsAnt).reduce((a, b) => a + b, 0) : null,
    ),
    compra,
    mensagens,
    instagram,
    trafegoInstagram,
    conta,
    demografiaCompra:
      acumulado.sexoCompra.size || acumulado.idadeCompra.size
        ? {
            sexo: segmentos(acumulado.sexoCompra),
            idade: segmentos(acumulado.idadeCompra, ORDEM_IDADE),
            gastoIdade: segmentos(acumulado.gastoIdade, ORDEM_IDADE),
          }
        : null,
    demografiaMensagens:
      acumulado.sexoMsg.size || acumulado.idadeMsg.size
        ? {
            sexo: segmentos(acumulado.sexoMsg),
            idade: segmentos(acumulado.idadeMsg, ORDEM_IDADE),
            // Mesmas faixas da série de mensagens, na mesma ordem.
            gastoIdade: segmentos(acumulado.gastoIdade, ORDEM_IDADE),
          }
        : null,
  };
}

/* ------------------------------------------------------------------ */
/* Consultas à Meta                                                    */
/* ------------------------------------------------------------------ */

/**
 * Preenche os acumuladores com a série diária e a demografia, no nível de
 * conjunto — assim cada linha serve tanto ao escopo da campanha quanto ao do
 * conjunto. Falha na Meta só deixa o bloco vazio, sem derrubar o relatório.
 *
 * ponytail: 2 chamadas por conta. Se o cliente tiver muitas contas e o tempo
 * de geração incomodar, dá para paralelizar por conta (já é Promise.all) e
 * reduzir com cache entre gerações.
 */
async function coletarDetalhes(
  contas: ContaDoCliente[],
  token: string,
  since: string,
  until: string,
  /** Campanha de tráfego p/ o perfil do Instagram → objetivo/destino dela. */
  trafegoInstagram: Map<string, { objetivo: string | null; destino: string | null }>,
  /**
   * Ids das campanhas cujo objetivo é conversão de compra. A Meta devolve
   * `omni_purchase` nas quebras demográficas de qualquer campanha (o pixel
   * registra compra mesmo num anúncio de mensagem), então sem este filtro um
   * relatório de WhatsApp ganhava um bloco de "Pedidos realizados".
   */
  campanhasDeCompra: Set<string>,
): Promise<Map<string, Acumulador>> {
  const porEscopo = new Map<string, Acumulador>();
  const obter = (chave: string) => {
    const atual = porEscopo.get(chave) ?? novoAcumulador();
    porEscopo.set(chave, atual);
    return atual;
  };

  await Promise.all(
    contas.map(async (conta) => {
      const [diarias, demografia] = await Promise.all([
        getInsights(conta.id, "adset", "custom", token, { since, until }, 1).catch(
          () => [] as Record<string, unknown>[],
        ),
        getInsights(
          conta.id,
          "adset",
          "custom",
          token,
          { since, until },
          undefined,
          "gender,age",
        ).catch(() => [] as Record<string, unknown>[]),
      ]);

      const chavesDa = (row: Record<string, unknown>) =>
        [
          row.campaign_id ? `c:${row.campaign_id}` : null,
          row.adset_id ? `a:${row.adset_id}` : null,
        ].filter((c): c is string => Boolean(c));

      for (const row of diarias) {
        const data = String(row.date_start ?? "");
        if (!data) continue;

        const objetivoLinha = String(row.objective ?? "") || null;
        // O destino vem do cadastro do conjunto (o endpoint de insights não
        // aceita `destination_type`); a campanha de tráfego p/ perfil já está
        // resolvida em `trafegoInstagram`.
        const ehTrafegoInstagram = trafegoInstagram.has(String(row.campaign_id ?? ""));
        // `null` no destino mantém o resultado histórico (compras, mensagens…);
        // o destino só decide aqui se a linha alimenta o bloco de seguidores.
        const metricas = mapearMetricas(row, objetivoLinha, null);
        const mensagens = mensagensDaAcao(row) ?? 0;
        const investido = Number(row.spend ?? 0) || 0;

        for (const chave of chavesDa(row)) {
          const acumulado = obter(chave);

          const c = acumulado.compraDia.get(data) ?? { faturamento: 0, compras: 0 };
          c.faturamento += metricas.faturamento ?? 0;
          c.compras += metricas.resultadoValor ?? 0;
          acumulado.compraDia.set(data, c);

          const m = acumulado.msgDia.get(data) ?? {
            mensagens: 0,
            investido: 0,
            impressoes: 0,
          };
          m.mensagens += mensagens;
          m.investido += investido;
          m.impressoes += metricas.impressoes ?? 0;
          acumulado.msgDia.set(data, m);

          const ig = acumulado.igDia.get(data) ?? {
            visitas: 0,
            seguidores: 0,
            seguidoresTrafego: 0,
          };
          ig.visitas += metricas.visitasPerfil ?? 0;
          ig.seguidores += metricas.seguidores ?? 0;
          if (ehTrafegoInstagram) ig.seguidoresTrafego += metricas.seguidores ?? 0;
          acumulado.igDia.set(data, ig);

          if (!ehTrafegoInstagram) continue;
          const seg = acumulado.seguidorDia.get(data) ?? {
            seguidores: 0,
            investido: 0,
            impressoes: 0,
          };
          seg.seguidores += metricas.seguidores ?? 0;
          seg.investido += investido;
          seg.impressoes += metricas.impressoes ?? 0;
          acumulado.seguidorDia.set(data, seg);
        }
      }

      for (const row of demografia) {
        const daCampanhaDeCompra = campanhasDeCompra.has(String(row.campaign_id ?? ""));
        // Compra só entra se a campanha for de compra; mensagens e gasto
        // valem em qualquer campanha.
        const compras = daCampanhaDeCompra ? (comprasDaAcao(row) ?? 0) : 0;
        const mensagens = mensagensDaAcao(row) ?? 0;
        const gasto = Number(row.spend ?? 0) || 0;
        const seguidores = seguidoresDaAcao(row) ?? 0;
        if (!compras && !mensagens && !gasto && !seguidores) continue;

        const sexo = SEXO_LABELS[String(row.gender ?? "").toLowerCase()] ?? "Não informado";
        const idade = String(row.age ?? "unknown");
        const idadeChave = idade === "unknown" ? "Não informado" : idade;
        const ehTrafegoInstagram = trafegoInstagram.has(String(row.campaign_id ?? ""));

        for (const chave of chavesDa(row)) {
          const acumulado = obter(chave);
          acumular(acumulado.sexoCompra, sexo, compras);
          acumular(acumulado.idadeCompra, idadeChave, compras);
          acumular(acumulado.sexoMsg, sexo, mensagens);
          acumular(acumulado.idadeMsg, idadeChave, mensagens);
          acumular(acumulado.gastoIdade, idadeChave, gasto);
          // Demografia de seguidores: só as campanhas de tráfego p/ Instagram.
          if (ehTrafegoInstagram) {
            acumular(acumulado.sexoSeguidor, sexo, seguidores);
            acumular(acumulado.idadeSeguidor, idadeChave, seguidores);
          }
        }
      }
    }),
  );

  return porEscopo;
}

/**
 * CPM/CTR diários da conta inteira. Vem do nível de conta para não depender
 * de quais campanhas entraram na árvore (o número é da conta, não de uma
 * campanha). Falha na Meta deixa a série vazia.
 */
async function serieDaConta(
  contas: ContaDoCliente[],
  token: string,
  since: string,
  until: string,
): Promise<DiaConta[]> {
  const porDia = new Map<string, { investido: number; impressoes: number; cliques: number }>();

  await Promise.all(
    contas.map(async (conta) => {
      const linhas = await getInsights(conta.id, "account", "custom", token, { since, until }, 1).catch(
        () => [] as Record<string, unknown>[],
      );
      for (const linha of linhas) {
        const data = String(linha.date_start ?? "");
        if (!data) continue;
        const atual = porDia.get(data) ?? { investido: 0, impressoes: 0, cliques: 0 };
        atual.investido += Number(linha.spend ?? 0) || 0;
        atual.impressoes += Number(linha.impressions ?? 0) || 0;
        atual.cliques += Number(linha.inline_link_clicks ?? 0) || 0;
        porDia.set(data, atual);
      }
    }),
  );

  return diasDoPeriodo(since, until).map((data) => {
    const dia = porDia.get(data);
    return {
      data,
      cpm: dia && dia.impressoes > 0 ? (dia.investido / dia.impressoes) * 1000 : null,
      ctr: dia && dia.impressoes > 0 ? (dia.cliques / dia.impressoes) * 100 : null,
    };
  });
}

/**
 * Alcance único do conjunto de contas: a Meta deduplica pessoas na consulta
 * de nível de conta, então este é o número que bate com o Gerenciador —
 * somar o alcance de cada campanha conta duas vezes quem viu mais de uma.
 * Falha na Meta devolve `null` e o total volta a somar as campanhas.
 */
async function alcanceDasContas(
  contas: ContaDoCliente[],
  token: string,
  intervalo: { since: string; until: string },
): Promise<number | null> {
  const porConta = await Promise.all(
    contas.map((conta) =>
      getInsights(conta.id, "account", "custom", token, intervalo)
        .then((linhas) => {
          // `level=account` devolve uma linha por conta; alcance vem somado
          // entre contas diferentes porque são públicos diferentes.
          const total = linhas.reduce(
            (acc, row) => acc + (Number(row.reach ?? 0) || 0),
            0,
          );
          return linhas.length ? total : null;
        })
        .catch(() => null),
    ),
  );
  const valores = porConta.filter((v): v is number => v !== null);
  return valores.length ? valores.reduce((a, b) => a + b, 0) : null;
}

/* ------------------------------------------------------------------ */
/* Árvore campanha → conjunto → anúncio                                */
/* ------------------------------------------------------------------ */

export type NoCampanha = { linha: LinhaMetricas; conjuntos: NoConjunto[] };
export type NoConjunto = { linha: LinhaMetricas; anuncios: LinhaMetricas[] };

function resumoArvore(
  linha: LinhaMetricas | LinhaArvore,
  nivel: LinhaArvore["nivel"],
  filhos?: LinhaArvore[],
): LinhaArvore {
  return {
    id: linha.id,
    nome: linha.nome,
    nivel,
    investido: linha.investido,
    impressoes: linha.impressoes,
    alcance: linha.alcance,
    frequencia: linha.frequencia,
    cliquesLink: linha.cliquesLink,
    resultadoValor: linha.resultadoValor,
    resultadoRotulo: linha.resultadoRotulo,
    custoPorResultado: linha.custoPorResultado,
    ctr: linha.ctr,
    cpm: linha.cpm,
    filhos,
  };
}

/** Só entra no relatório o que teve gasto no período. */
function relevante(linha: LinhaMetricas): boolean {
  return linha.investido > 0;
}

/** Monta a linha da árvore a partir de uma linha de insights de conjunto/anúncio. */
function linhaDoInsight(
  row: Record<string, unknown>,
  nivel: "adset" | "ad",
  campanha: LinhaMetricas,
): LinhaMetricas {
  const id = String(nivel === "adset" ? row.adset_id : row.ad_id);
  return {
    id,
    nome: String((nivel === "adset" ? row.adset_name : row.ad_name) ?? id),
    status: "",
    ativo: true,
    objetivo: campanha.objetivo,
    conversao: campanha.conversao,
    objetivoCodigo: campanha.objetivoCodigo,
    destino: campanha.destino ?? null,
    contaId: campanha.contaId,
    contaNome: campanha.contaNome,
    proximoNivel: nivel === "adset" ? "conjunto" : null,
    ...mapearMetricas(row, campanha.objetivoCodigo ?? null, null),
  };
}

/**
 * Campanhas → conjuntos → anúncios (só o que teve gasto).
 *
 * Duas chamadas por conta (nível conjunto e nível anúncio) em vez de uma
 * consulta por campanha e por conjunto: cada chamada conta contra o limite da
 * conta de anúncios, e a árvore completa estourava a cota (code 17) com
 * facilidade. Os insights já trazem `campaign_name`, `adset_name` e `ad_name`,
 * então não é preciso listar a estrutura.
 *
 * Falha na Meta aborta a geração: um snapshot pela metade (campanha listada,
 * anúncios sumidos) chega ao cliente como se fosse o dado real.
 */
async function carregarEstrutura(
  contas: ContaDoCliente[],
  campanhas: LinhaMetricas[],
  token: string,
  since: string,
  until: string,
): Promise<NoCampanha[]> {
  const porCampanha = new Map(campanhas.filter(relevante).map((c) => [c.id, c]));

  // Em série entre contas: o limite é por conta de anúncios, e paralelizar
  // contas do mesmo cliente não ajuda quando a conta já está no teto.
  const conjuntosPorId = new Map<string, LinhaMetricas[]>();
  const anunciosPorId = new Map<string, LinhaMetricas[]>();

  for (const conta of contas) {
    const [linhasConjunto, linhasAnuncio] = await Promise.all([
      getInsights(conta.id, "adset", "custom", token, { since, until }),
      getInsights(conta.id, "ad", "custom", token, { since, until }),
    ]);

    for (const row of linhasConjunto) {
      const campanha = porCampanha.get(String(row.campaign_id));
      if (!campanha) continue;
      const linha = linhaDoInsight(row, "adset", campanha);
      if (!relevante(linha)) continue;
      const lista = conjuntosPorId.get(campanha.id) ?? [];
      lista.push(linha);
      conjuntosPorId.set(campanha.id, lista);
    }

    for (const row of linhasAnuncio) {
      const campanha = porCampanha.get(String(row.campaign_id));
      if (!campanha) continue;
      const linha = linhaDoInsight(row, "ad", campanha);
      if (!relevante(linha)) continue;
      const chave = String(row.adset_id);
      const lista = anunciosPorId.get(chave) ?? [];
      lista.push(linha);
      anunciosPorId.set(chave, lista);
    }
  }

  return [...porCampanha.values()].map((campanha) => ({
    linha: campanha,
    conjuntos: (conjuntosPorId.get(campanha.id) ?? [])
      .sort((a, b) => b.investido - a.investido)
      .map((conjunto) => ({
        linha: conjunto,
        anuncios: (anunciosPorId.get(conjunto.id) ?? []).sort(
          (a, b) => b.investido - a.investido,
        ),
      })),
  }));
}

/* ------------------------------------------------------------------ */
/* Contas do cliente                                                   */
/* ------------------------------------------------------------------ */

/** URL do Instagram do contrato, usada para achar a conta profissional. */
async function instagramDoCliente(clientId: number): Promise<string | null> {
  const linhas = await db
    .select({ url: contracts.instagramUrl })
    .from(contracts)
    .where(eq(contracts.clientId, clientId));
  return linhas.find((c) => c.url?.trim())?.url?.trim() ?? null;
}

/** Contas de anúncio dos contratos do cliente (as mesmas do módulo Campanhas). */
async function contasDoRelatorio(clientId: number): Promise<ContaDoCliente[]> {
  const lista = await db
    .select({ id: contracts.id, name: contracts.name })
    .from(contracts)
    .where(eq(contracts.clientId, clientId));

  const todasContas = await db.select().from(contractAdAccounts);

  return contasDoCliente(
    lista.map((contrato) => ({
      name: contrato.name,
      accounts: todasContas.filter((a) => a.contractId === contrato.id),
    })),
  );
}

/**
 * Consulta a Meta para o período e monta o snapshot com um bloco por escopo.
 * O período anterior é a janela de mesma duração imediatamente antes.
 */
export async function gerarSnapshotRelatorio(
  clientId: number,
  since: string,
  until: string,
): Promise<{ ok: true; snapshot: RelatorioSnapshot } | { ok: false; message: string }> {
  const [cliente] = await db
    .select({ id: clients.id, nome: clients.businessName })
    .from(clients)
    .where(eq(clients.id, clientId));
  if (!cliente) return { ok: false, message: "Cliente não encontrado." };

  const token = await getMetaToken();
  if (!token) {
    return {
      ok: false,
      message: "Configure o token da Meta em Configurações → Meta Ads antes de gerar o relatório.",
    };
  }

  const contas = await contasDoRelatorio(clientId);
  if (!contas.length) {
    return {
      ok: false,
      message: "Este cliente não tem conta de anúncio vinculada a um contrato.",
    };
  }

  const resultado = await campanhasDoCliente(contas, "custom", "all", token, {
    since,
    until,
  });
  if (resultado.estado.estado === "erro") {
    return { ok: false, message: resultado.estado.mensagem };
  }

  const anteriorPeriodo = janelaAnterior(since, until);
  const instagram = await instagramDoCliente(clientId);

  // Campanhas de tráfego para o perfil do Instagram, pelo objetivo + destino
  // que vieram na própria consulta de campanhas. Chave: id da campanha.
  const trafegoInstagram = new Map<string, { objetivo: string | null; destino: string | null }>();
  for (const linha of resultado.linhas) {
    if (linha.objetivoCodigo === "OUTCOME_TRAFFIC" && linha.destino === "INSTAGRAM_PROFILE") {
      trafegoInstagram.set(linha.id, {
        objetivo: linha.objetivoCodigo,
        destino: linha.destino,
      });
    }
  }

  // Campanhas de compra: as mesmas que montam o funil e o faturamento. Usadas
  // para descartar `omni_purchase` que a Meta atribui em campanha de outro
  // objetivo (mensagem, engajamento) na quebra por sexo/idade.
  const campanhasDeCompra = new Set(
    resultado.linhas
      .filter((l) => l.temFunilCompra && l.resultadoRotulo === "Compras")
      .map((l) => l.id),
  );

  let estrutura: NoCampanha[];
  let acumuladores: Map<string, Acumulador>;
  let alcanceAtual: number | null;
  let alcanceAnterior: number | null;
  let postsPorDia: PostsPorDia | null;
  let seguidoresTotalPorDia: SeguidoresPorDia | null;
  let viewsPorDia: ViewsPorDia | null;
  let viewsAnterior: ViewsPorDia | null;
  let visitasPorDia: ViewsPorDia | null;
  let serieConta: DiaConta[];
  let serieContaAnterior: DiaConta[];
  try {
    // O perfil é consultado uma vez por janela: postagens do período atual,
    // visualizações de ambas (o gráfico compara as duas séries).
    const [perfil, perfilAnterior, contaAtualSerie, contaAnteriorSerie] =
      await Promise.all([
        perfilInstagramPorDia(token, cliente.nome, instagram, since, until),
        perfilInstagramPorDia(
          token,
          cliente.nome,
          instagram,
          anteriorPeriodo.since,
          anteriorPeriodo.until,
        ),
        serieDaConta(contas, token, since, until),
        serieDaConta(contas, token, anteriorPeriodo.since, anteriorPeriodo.until),
      ]);
    postsPorDia = perfil?.posts ?? null;
    seguidoresTotalPorDia = perfil?.seguidores ?? null;
    viewsPorDia = perfil?.views ?? null;
    viewsAnterior = perfilAnterior?.views ?? null;
    visitasPorDia = perfil?.visitas ?? null;
    serieConta = contaAtualSerie;
    serieContaAnterior = contaAnteriorSerie;

    [estrutura, acumuladores, alcanceAtual, alcanceAnterior] = await Promise.all([
      carregarEstrutura(contas, resultado.linhas, token, since, until),
      coletarDetalhes(contas, token, since, until, trafegoInstagram, campanhasDeCompra),
      alcanceDasContas(contas, token, { since, until }),
      alcanceDasContas(contas, token, anteriorPeriodo),
    ]);
  } catch (erro) {
    return {
      ok: false,
      message:
        erro instanceof Error
          ? erro.message
          : "Falha ao consultar a estrutura de anúncios na Meta.",
    };
  }

  const acumuladorDe = (chave: string) => acumuladores.get(chave) ?? novoAcumulador();

  const escopos: Record<string, Bloco> = {};
  for (const campanha of estrutura) {
    escopos[`c:${campanha.linha.id}`] = montarBloco(
      [campanha.linha],
      [acumuladorDe(`c:${campanha.linha.id}`)],
      since,
      until,
    );
    for (const conjunto of campanha.conjuntos) {
      escopos[`a:${conjunto.linha.id}`] = montarBloco(
        [conjunto.linha],
        [acumuladorDe(`a:${conjunto.linha.id}`)],
        since,
        until,
      );
    }
  }

  const todasAsCampanhas = estrutura.map((c) => c.linha);
  const todasAsChaves = estrutura.flatMap((c) => [
    `c:${c.linha.id}`,
    ...c.conjuntos.map((s) => `a:${s.linha.id}`),
  ]);

  return {
    ok: true,
    snapshot: {
      versao: 2,
      geradoEm: new Date().toISOString(),
      periodo: { since, until },
      anteriorPeriodo,
      // O total soma as campanhas (e não os conjuntos) para não contar duas
      // vezes; o alcance vem da conta, onde a Meta deduplica as pessoas.
      total: montarBloco(
        todasAsCampanhas,
        todasAsChaves.filter((k) => k.startsWith("c:")).map(acumuladorDe),
        since,
        until,
        { atual: alcanceAtual, anterior: alcanceAnterior },
        postsPorDia,
        seguidoresTotalPorDia,
        viewsPorDia,
        viewsAnterior,
        visitasPorDia,
        serieContaAnterior,
        serieConta,
      ),
      escopos,
      arvore: estrutura.map((campanha) =>
        resumoArvore(
          campanha.linha,
          "campanha",
          campanha.conjuntos.map((conjunto) =>
            resumoArvore(
              conjunto.linha,
              "conjunto",
              conjunto.anuncios.map((a) => resumoArvore(a, "anuncio")),
            ),
          ),
        ),
      ),
    },
  };
}

/** Janela anterior de mesma duração, para exibir na tela. */
function janelaAnterior(since: string, until: string): { since: string; until: string } {
  const inicio = new Date(`${since}T00:00:00Z`);
  const fim = new Date(`${until}T00:00:00Z`);
  const dias = Math.round((fim.getTime() - inicio.getTime()) / 86_400_000) + 1;
  const deslocar = (deslocamento: number) => {
    const d = new Date(inicio);
    d.setUTCDate(d.getUTCDate() + deslocamento);
    return d.toISOString().slice(0, 10);
  };
  return { since: deslocar(-dias), until: deslocar(-1) };
}

/** Lê o campo JSON; relatórios no formato antigo (v1) pedem nova geração. */
export function lerSnapshot(data: string): RelatorioSnapshot | null {
  try {
    const parsed = JSON.parse(data) as RelatorioSnapshot;
    return parsed?.versao === 2 ? parsed : null;
  } catch {
    return null;
  }
}