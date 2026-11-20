import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ComponentType } from "react";
import {
  CreditCard,
  Eye,
  MessageCircle,
  MousePointerClick,
  PlayCircle,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { db } from "@/lib/db";
import { clients, reports } from "@/lib/db/schema";
import { getSettings } from "@/lib/settings";
import { formatDateIso } from "@/lib/format/masks";
import {
  lerSnapshot,
  type Bloco,
  type RelatorioSnapshot,
  type ResumoRelatorio,
} from "@/lib/meta/relatorio";
import { tendencia } from "@/lib/meta/insights";
import { eq } from "drizzle-orm";
import { BotaoTopo } from "./topo";
import { FunilCompra } from "./funil-compra";
import { GraficoCompra } from "./grafico-compra";
import { BarrasIdade, PizzaSexo } from "./demografia";
import { GraficoMensagens } from "./grafico-mensagens";
import { GraficoInstagram } from "./grafico-instagram";
import { GraficoViews } from "./grafico-views";
import { GraficoDiario } from "./grafico-diario";
import { GraficoConta } from "./grafico-conta";
import { GraficoPostsInstagram } from "./grafico-posts-instagram";
import { TabelaCampanhas } from "./tabela-campanhas";
import { FiltroCampanhas } from "./filtro-campanhas";

export const metadata: Metadata = {
  title: "Relatório de desempenho",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

function dinheiro(valor: number | null): string {
  if (valor === null) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function inteiro(valor: number | null): string {
  if (valor === null) return "—";
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function decimal(valor: number | null, casas = 2): string {
  if (valor === null) return "—";
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

/** Δ% em relação ao período anterior; null quando não há base comparável. */
function variacao(atual: number | null, anterior: number | null | undefined): string | null {
  if (atual === null || anterior == null || anterior === 0) return null;
  const pct = ((atual - anterior) / Math.abs(anterior)) * 100;
  return `${pct > 0 ? "+" : ""}${pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% vs período anterior`;
}

function Kpi({
  rotulo,
  valor,
  atual,
  anterior,
  formatar,
  icone: Icone,
  menorMelhor = false,
}: {
  rotulo: string;
  valor: string;
  atual: number | null;
  anterior?: number | null;
  formatar: (valor: number | null) => string;
  icone: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  menorMelhor?: boolean;
}) {
  const delta = variacao(atual, anterior);
  const direcao = tendencia(atual, anterior, menorMelhor);
  const cor =
    direcao === "melhor" ? "text-jade" : direcao === "pior" ? "text-destructive" : "text-dim";

  return (
    <div className="rounded-xl border border-line bg-surface-2/40 p-3 sm:p-4">
      <p className="flex items-center gap-1.5 text-xs text-dim">
        <Icone className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">{rotulo}</span>
      </p>
      <p className="mt-1.5 text-lg font-semibold text-white sm:text-xl">{valor}</p>
      {anterior != null ? (
        <p className="mt-0.5 text-[0.7rem] text-dim">Anterior: {formatar(anterior)}</p>
      ) : null}
      {delta ? <p className={`mt-0.5 text-[0.7rem] ${cor}`}>{delta}</p> : null}
    </div>
  );
}

function resumoKpis(atual: ResumoRelatorio, anterior: ResumoRelatorio | null) {
  return [
    { chave: "investido", rotulo: "Investimento", valor: dinheiro(atual.investido), atual: atual.investido, anterior: anterior?.investido, formatar: dinheiro, icone: Wallet },
    { chave: "impressoes", rotulo: "Impressões", valor: inteiro(atual.impressoes), atual: atual.impressoes, anterior: anterior?.impressoes, formatar: inteiro, icone: Eye },
    { chave: "alcance", rotulo: "Alcance", valor: inteiro(atual.alcance), atual: atual.alcance, anterior: anterior?.alcance, formatar: inteiro, icone: Users },
    { chave: "frequencia", rotulo: "Frequência", valor: decimal(atual.frequencia), atual: atual.frequencia, anterior: anterior?.frequencia, formatar: (v: number | null) => decimal(v), icone: TrendingUp, menorMelhor: true },
    { chave: "cliques", rotulo: "Cliques no link", valor: inteiro(atual.cliquesLink), atual: atual.cliquesLink, anterior: anterior?.cliquesLink, formatar: inteiro, icone: MousePointerClick },
    { chave: "mensagens", rotulo: "Mensagens recebidas", valor: inteiro(atual.mensagens), atual: atual.mensagens, anterior: anterior?.mensagens, formatar: inteiro, icone: MessageCircle },
    ...(atual.compras !== null
      ? [{ chave: "compras", rotulo: "Compras", valor: inteiro(atual.compras), atual: atual.compras, anterior: anterior?.compras, formatar: inteiro, icone: Target }]
      : []),
    ...(atual.compras !== null
      ? [{ chave: "faturamento", rotulo: "Faturamento", valor: dinheiro(atual.faturamento), atual: atual.faturamento, anterior: anterior?.faturamento, formatar: dinheiro, icone: CreditCard }]
      : []),
    ...(atual.viewsInstagram !== null
      ? [{ chave: "viewsInstagram", rotulo: "Visualizações no Instagram", valor: inteiro(atual.viewsInstagram), atual: atual.viewsInstagram, anterior: anterior?.viewsInstagram, formatar: inteiro, icone: PlayCircle }]
      : []),
  ];
}

export default async function RelatorioPublicoPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ c?: string; a?: string }>;
}) {
  const [{ token }, busca] = await Promise.all([params, searchParams]);

  const [relatorio] = await db
    .select({
      inicio: reports.startDate,
      fim: reports.endDate,
      data: reports.data,
      criadoEm: reports.createdAt,
      cliente: clients.businessName,
    })
    .from(reports)
    .innerJoin(clients, eq(clients.id, reports.clientId))
    .where(eq(reports.token, token));

  if (!relatorio) notFound();

  const { systemName, logoPath } = await getSettings();
  const periodo = `${formatDateIso(relatorio.inicio)} a ${formatDateIso(relatorio.fim)}`;
  const snapshot: RelatorioSnapshot | null = lerSnapshot(relatorio.data);

  // Filtro do cabeçalho: escolhe o bloco do snapshot; se não existir mais
  // (campanha excluída), cai no total em vez de quebrar.
  const campanhaFiltro = busca.c ?? "";
  const conjuntoFiltro = busca.a ?? "";
  const chaveEscopo = conjuntoFiltro
    ? `a:${conjuntoFiltro}`
    : campanhaFiltro
      ? `c:${campanhaFiltro}`
      : "";
  const bloco: Bloco | null = snapshot
    ? (chaveEscopo ? snapshot.escopos[chaveEscopo] : undefined) ?? snapshot.total
    : null;
  const kpis = bloco ? resumoKpis(bloco.resumo, bloco.anterior) : [];

  const arvoreFiltrada = (() => {
    const arvore = snapshot?.arvore ?? [];
    if (conjuntoFiltro) {
      return arvore
        .map((c) => ({ ...c, filhos: (c.filhos ?? []).filter((s) => s.id === conjuntoFiltro) }))
        .filter((c) => (c.filhos ?? []).length > 0);
    }
    if (campanhaFiltro) return arvore.filter((c) => c.id === campanhaFiltro);
    return arvore;
  })();

  return (
    <div className="min-h-dvh bg-ink pb-16">
      {/* Cabeçalho fixo */}
      <header className="sticky top-0 z-40 border-b border-line/80 bg-ink/85 backdrop-blur-md">
        {/* Mobile: marca em cima, filtros na linha de baixo (largura cheia). */}
        <div className="container-app flex flex-wrap items-center gap-x-3 gap-y-2 py-2 sm:h-16 sm:flex-nowrap sm:py-0">
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:flex-none">
            {logoPath ? (
              <Logo src={logoPath} alt={systemName} className="h-6 shrink-0 sm:h-7" priority />
            ) : (
              <span className="text-sm font-semibold text-white">{systemName}</span>
            )}
            <div className="hidden min-w-0 border-l border-line pl-3 sm:block">
              <p className="truncate text-sm font-medium text-white">{relatorio.cliente}</p>
              <p className="truncate text-xs text-dim">Relatório de desempenho</p>
            </div>
          </div>
          <div className="order-last flex w-full min-w-0 items-center gap-2 sm:order-none sm:w-auto">
            {snapshot?.arvore?.length ? (
              <FiltroCampanhas
                arvore={snapshot.arvore}
                campanha={campanhaFiltro}
                conjunto={conjuntoFiltro}
              />
            ) : null}
            <p className="hidden shrink-0 rounded-full border border-line bg-surface-2 px-3 py-1 text-xs font-medium text-dim lg:block">
              {periodo}
            </p>
          </div>
        </div>
      </header>

      <main className="container-app space-y-4 py-5 sm:space-y-6 sm:py-8">
        <div className="rounded-xl border border-line bg-surface p-4 sm:p-8">
          <p className="text-xs font-medium tracking-wide text-ember uppercase">
            Relatório de desempenho
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {relatorio.cliente}
          </h1>
          <p className="mt-1 text-sm text-dim">Período: {periodo}</p>
        </div>

        {bloco ? (
          <>
            <section className="space-y-4 rounded-xl border border-line bg-surface p-4 sm:p-6">
              <div>
                <h2 className="text-base font-semibold text-white">Resumo do período</h2>
                <p className="mt-1 text-sm text-dim">
                  Indicadores do período comparados com a janela anterior de mesma duração.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {kpis.map((kpi) => (
                  <Kpi
                    key={kpi.chave}
                    rotulo={kpi.rotulo}
                    valor={kpi.valor}
                    atual={kpi.atual}
                    anterior={kpi.anterior}
                    formatar={kpi.formatar}
                    icone={kpi.icone}
                    menorMelhor={kpi.menorMelhor}
                  />
                ))}
              </div>
            </section>

            {/* Leilão da conta inteira: fica logo abaixo do resumo, fora dos
                grupos de campanha, porque não pertence a nenhum deles. */}
            {bloco?.conta ? (
              <section className="rounded-xl border border-line bg-surface p-4 sm:p-6">
                <h2 className="text-base font-semibold text-white">
                  Leilão da conta e atratividade da campanha
                </h2>
                <p className="mt-1 text-sm text-dim">
                  CPM e CTR de todas as campanhas juntas, por dia.
                </p>
                <div className="mt-5 space-y-6">
                  <div>
                    <p className="mb-2 text-sm font-medium text-white">CPM por dia</p>
                    <GraficoConta
                      diario={bloco.conta.diario}
                      anterior={bloco.conta.anterior}
                      metrica="cpm"
                    />
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium text-white">CTR no link por dia</p>
                    <GraficoConta
                      diario={bloco.conta.diario}
                      anterior={bloco.conta.anterior}
                      metrica="ctr"
                    />
                  </div>
                </div>
              </section>
            ) : null}

            {bloco?.compra || bloco?.demografiaCompra ? (
              <section className="rounded-xl border border-line bg-surface p-4 sm:p-6">
                <h2 className="text-base font-semibold text-white">Pedidos realizados</h2>
                <p className="mt-1 text-sm text-dim">
                  Do clique à compra: o funil, o faturamento por dia e quem comprou.
                </p>
                {bloco?.compra ? (
                  <div className="mt-5 grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
                    <FunilCompra funil={bloco.compra.funil} />
                    <div>
                      <p className="mb-2 text-sm font-medium text-white">Faturamento e compras por dia</p>
                      <GraficoCompra diario={bloco.compra.diario} />
                    </div>
                  </div>
                ) : null}
                {bloco?.demografiaCompra ? (
                  <div className="mt-6 grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
                    <div>
                      <p className="mb-2 text-sm font-medium text-white">Compras por sexo</p>
                      <PizzaSexo dados={bloco.demografiaCompra.sexo} />
                    </div>
                    <div>
                      <p className="mb-2 text-sm font-medium text-white">Compras por idade</p>
                      <BarrasIdade
                        dados={bloco.demografiaCompra.idade}
                        rotulo="Compras por faixa de idade"
                        gasto={bloco.demografiaCompra.gastoIdade}
                        rotuloBarras="compras"
                      />
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}

            {bloco?.mensagens || bloco?.demografiaMensagens ? (
              <section className="rounded-xl border border-line bg-surface p-4 sm:p-6">
                <h2 className="text-base font-semibold text-white">Mensagens</h2>
                <p className="mt-1 text-sm text-dim">
                  Conversas iniciadas no período, quanto custou cada uma e quem iniciou.
                </p>
                {bloco?.mensagens ? (
                  <div className="mt-5">
                    <p className="mb-2 text-sm font-medium text-white">Mensagens e custo por mensagem</p>
                    <GraficoMensagens diario={bloco.mensagens.diario} serie="combinado" />
                  </div>
                ) : null}
                {bloco?.demografiaMensagens ? (
                  <div className="mt-6 grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
                    <div>
                      <p className="mb-2 text-sm font-medium text-white">Mensagens por sexo</p>
                      <PizzaSexo dados={bloco.demografiaMensagens.sexo} />
                    </div>
                    <div>
                      <p className="mb-2 text-sm font-medium text-white">Mensagens por idade</p>
                      <BarrasIdade
                        dados={bloco.demografiaMensagens.idade}
                        rotulo="Mensagens por faixa de idade"
                        gasto={bloco.demografiaMensagens.gastoIdade}
                      />
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}

            {bloco?.trafegoInstagram ? (
              <section className="rounded-xl border border-line bg-surface p-4 sm:p-6">
                <h2 className="text-base font-semibold text-white">
                  Tráfego para o perfil do Instagram
                </h2>
                <p className="mt-1 text-sm text-dim">
                  Seguidores ganhos com as campanhas de tráfego para o perfil, por dia e
                  por público.
                </p>
                <div className="mt-5">
                  <p className="mb-2 text-sm font-medium text-white">
                    Seguidores e custo por seguidor
                  </p>
                  <GraficoDiario
                    serie="combinado"
                    rotuloValor="Seguidores"
                    rotuloCusto="Custo por seguidor"
                    pontos={bloco.trafegoInstagram.diario.map((d) => ({
                      data: d.data,
                      valor: d.seguidores,
                      custo: d.custo,
                      cpm: d.cpm,
                    }))}
                  />
                </div>
                <div className="mt-6 grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
                  <div>
                    <p className="mb-2 text-sm font-medium text-white">Seguidores por sexo</p>
                    <PizzaSexo dados={bloco.trafegoInstagram.demografia.sexo} />
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium text-white">Seguidores por idade</p>
                    <BarrasIdade
                      dados={bloco.trafegoInstagram.demografia.idade}
                      rotulo="Seguidores por faixa de idade"
                      rotuloBarras="seguidores"
                      gasto={bloco.trafegoInstagram.demografia.gastoIdade}
                    />
                  </div>
                </div>
              </section>
            ) : null}

            {bloco?.instagram ? (
              <section className="rounded-xl border border-line bg-surface p-4 sm:p-6">
                <h2 className="text-base font-semibold text-white">Instagram</h2>
                <p className="mt-1 text-sm text-dim">
                  Visualizações, visitas ao perfil e seguidores do perfil, por dia.
                  Quando o perfil do Instagram está acessível, as visitas vêm
                  dele; as do tráfego pago aparecem ao lado para comparação.
                </p>
                <div className="mt-5">
                  <p className="mb-2 text-sm font-medium text-white">
                    Visualizações do perfil
                  </p>
                  <GraficoViews diario={bloco.instagram.diario} anterior={bloco.instagram.viewsAnterior} />
                </div>
                <div className="mt-6 grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
                  <div>
                    <p className="mb-2 text-sm font-medium text-white">Visitas e seguidores</p>
                    <GraficoInstagram diario={bloco.instagram.diario} />
                  </div>
                </div>
                <div className="mt-6">
                  <p className="mb-2 text-sm font-medium text-white">
                    Postagens no perfil (feed e Reels)
                  </p>
                  <GraficoPostsInstagram diario={bloco.instagram.diario} />
                </div>
              </section>
            ) : null}

            <section className="rounded-xl border border-line bg-surface p-4 sm:p-6">
              <h2 className="text-base font-semibold text-white">Campanhas</h2>
              <p className="mt-1 text-sm text-dim">
                Campanhas que tiveram gasto no período, com conjuntos e anúncios.
              </p>
              <div className="mt-5">
                <TabelaCampanhas arvore={arvoreFiltrada} />
              </div>
            </section>
          </>
        ) : (
          <section className="rounded-xl border border-line bg-surface p-4 sm:p-6">
            <p className="text-sm text-dim">
              Este relatório foi gerado antes do snapshot de dados. Gere novamente para
              ver os indicadores.
            </p>
          </section>
        )}

        <p className="text-center text-xs text-dim">
          {systemName} · gerado em {relatorio.criadoEm.toLocaleDateString("pt-BR")}
        </p>
      </main>

      <BotaoTopo />
    </div>
  );
}