"use client";

import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  CalendarDays,
  ChevronRight,
  CircleCheck,
  CircleOff,
  CreditCard,
  Eye,
  Heart,
  Loader2,
  MessageCircle,
  MousePointerClick,
  PauseCircle,
  ShoppingCart,
  Sparkles,
  Target,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";

import { formatMoney } from "@/lib/format/masks";
import type { LinhaMetricas } from "@/lib/meta/campaigns";
import { tendencia, variacao } from "@/lib/meta/insights";

/** Número inteiro com separador brasileiro; "—" quando não houve entrega. */
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

function percentual(valor: number | null): string {
  return valor === null ? "—" : `${decimal(valor)}%`;
}

function dinheiro(valor: number | null): string {
  return valor === null ? "—" : formatMoney(Math.round(valor * 100));
}

/** Rótulo do status vindo da Meta. */
const STATUS_META: Record<string, string> = {
  ACTIVE: "Ativo",
  PAUSED: "Pausado",
  IN_PROCESS: "Em análise",
  PENDING_REVIEW: "Em análise",
  WITH_ISSUES: "Com problemas",
  DISAPPROVED: "Reprovado",
  ARCHIVED: "Arquivado",
  DELETED: "Excluído",
  CAMPAIGN_PAUSED: "Campanha pausada",
  ADSET_PAUSED: "Conjunto pausado",
};

function BadgeStatus({ status, ativo }: { status: string; ativo: boolean }) {
  const rotulo = STATUS_META[status] ?? status ?? "—";

  if (ativo) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-jade/40 bg-jade/10 px-2 py-0.5 text-[0.65rem] font-medium text-jade">
        <CircleCheck className="size-3" aria-hidden="true" />
        {rotulo}
      </span>
    );
  }

  const analise = status === "IN_PROCESS" || status === "PENDING_REVIEW";
  if (analise) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-ember/40 bg-ember/10 px-2 py-0.5 text-[0.65rem] font-medium text-ember">
        <PauseCircle className="size-3" aria-hidden="true" />
        {rotulo}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[0.65rem] font-medium text-dim">
      <CircleOff className="size-3" aria-hidden="true" />
      {rotulo}
    </span>
  );
}

/** Métrica de destaque com ícone, usada nas colunas do card. */
function Metrica({
  rotulo,
  valor,
  atual,
  anterior,
  icone: Icone,
  formatoAnterior,
  menorMelhor = false,
}: {
  rotulo: string;
  valor: string;
  atual: number | null;
  anterior?: number | null;
  icone: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  formatoAnterior: (valor: number | null) => string;
  menorMelhor?: boolean;
}) {
  const delta = variacao(atual, anterior);
  const direcao = tendencia(atual, anterior, menorMelhor);
  const cor = direcao === "melhor" ? "text-jade" : direcao === "pior" ? "text-destructive" : "text-dim";
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 truncate text-[0.7rem] text-dim">
        <Icone className="size-3 shrink-0" aria-hidden />
        {rotulo}
      </dt>
      <dd className="truncate text-sm font-medium text-white">{valor}</dd>
      {anterior != null ? (
        <dd className="truncate text-[0.65rem] text-dim">Anterior: {formatoAnterior(anterior)}</dd>
      ) : null}
      {delta ? <dd className={`truncate text-[0.65rem] ${cor}`}>{delta}</dd> : null}
    </div>
  );
}

function roas(faturamento: number | null, investido: number): string | null {
  if (faturamento === null || investido <= 0) return null;
  return `ROAS ${decimal(faturamento / investido, 2)}x`;
}

function Variacao({
  atual,
  anterior,
  prefixo = "",
  menorMelhor = false,
}: {
  atual: number | null;
  anterior?: number | null;
  prefixo?: string;
  menorMelhor?: boolean;
}) {
  const delta = variacao(atual, anterior);
  if (!delta) return null;
  const direcao = tendencia(atual, anterior, menorMelhor);
  const cor = direcao === "melhor" ? "text-jade" : direcao === "pior" ? "text-destructive" : "text-dim";
  return <p className={`truncate text-[0.65rem] ${cor}`}>{prefixo}{delta}</p>;
}

type Props = {
  linhas: LinhaMetricas[];
  /**
   * Prefixo do próximo nível. O link de cada linha é `${hrefBase}/${linha.id}${query}`.
   * Precisa ser string: funções não atravessam a fronteira server → client.
   */
  hrefBase?: string;
  query?: string;
  vazio: string;
  /** Mostra a conta de anúncio no rodapé do card (cliente com várias contas). */
  mostrarConta?: boolean;
  /** Texto do botão que desce um nível (ex.: "Ver conjuntos", "Ver anúncios"). */
  labelAbrir?: string;
  /** Análise da IA por id de anúncio, exibida dentro do card. */
  analises?: Record<string, string>;
  /** Mostra "Analisando…" nos cards enquanto a IA responde. */
  analisando?: boolean;
};

/**
 * Lista de campanhas/conjuntos/anúncios em **cards** — nunca tabela.
 * Cada card destaca investido e resultado e distribui as demais métricas
 * numa grade que se adapta de 1 coluna (375px) a 4 colunas no desktop.
 */
export function MetricasLista({
  linhas,
  hrefBase,
  query = "",
  vazio,
  mostrarConta,
  labelAbrir = "Ver conjuntos",
  analises,
  analisando = false,
}: Props) {
  if (linhas.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-surface px-6 py-14 text-center">
        <TrendingUp className="size-8 text-dim/50" aria-hidden="true" />
        <p className="text-sm text-dim">{vazio}</p>
      </div>
    );
  }

  return (
    <ul className="grid gap-3 xl:grid-cols-2">
      {linhas.map((linha) => {
        const href = hrefBase ? `${hrefBase}/${linha.id}${query}` : null;
        const analise = analises?.[linha.id];

        return (
          <li
            key={linha.id}
            className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-line/80 sm:p-5"
          >
            {/* Cabeçalho: nome, status e objetivo */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 flex-1 text-sm font-semibold text-white">
                  {linha.nome}
                </p>
                <BadgeStatus status={linha.status} ativo={linha.ativo} />
              </div>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-dim">
                <span className="inline-flex min-w-0 items-center gap-1">
                  <Target className="size-3 shrink-0" aria-hidden="true" />
                  <span>{linha.objetivo}</span>
                </span>
                {/* Mostra o objetivo completo e seu destino nos níveis descendentes. */}
                {linha.conversao && linha.conversao !== linha.objetivo ? (
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <ArrowRight className="size-3 shrink-0" aria-hidden="true" />
                    <span>{linha.conversao}</span>
                  </span>
                ) : null}
                {mostrarConta ? (
                  <span className="truncate">· {linha.contaNome}</span>
                ) : null}
              </p>
            </div>

            {/* Investido e resultado em destaque (faturamento, quando Compras) */}
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-line/70 bg-surface-2/40 p-3">
              <Metrica
                rotulo="Investido"
                valor={dinheiro(linha.investido)}
                atual={linha.investido}
                anterior={linha.anterior?.investido}
                formatoAnterior={dinheiro}
                icone={TrendingUp}
              />
              <div className="min-w-0">
                <p className="truncate text-[0.7rem] text-dim">{linha.resultadoRotulo}</p>
                <p className="truncate text-base font-semibold text-white">{inteiro(linha.resultadoValor)}</p>
                <p className="truncate text-[0.7rem] text-dim">{dinheiro(linha.custoPorResultado)} por resultado</p>
                {linha.anterior?.resultadoValor != null ? (
                  <p className="truncate text-[0.65rem] text-dim">
                    Anterior: {inteiro(linha.anterior.resultadoValor)}
                  </p>
                ) : null}
                <Variacao
                  atual={linha.resultadoValor}
                  anterior={linha.anterior?.resultadoValor}
                />
                <Variacao
                  atual={linha.custoPorResultado}
                  anterior={linha.anterior?.custoPorResultado}
                  prefixo="Custo "
                  menorMelhor
                />
              </div>
              {/* Faturamento só faz sentido quando a conversão é Compras. */}
              {linha.temFunilCompra ? (
                <div className="col-span-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-line/70 pt-2.5">
                  <p className="flex items-center gap-1 text-[0.7rem] text-dim">
                    <Banknote className="size-3 shrink-0" aria-hidden="true" />
                    Faturamento
                  </p>
                  <div className="text-right">
                    <p className="text-base font-semibold text-jade">
                      {dinheiro(linha.faturamento)}
                    </p>
                    {linha.anterior?.faturamento != null ? (
                      <p className="text-[0.65rem] text-dim">
                        Anterior: {dinheiro(linha.anterior.faturamento)}
                      </p>
                    ) : null}
                    <Variacao atual={linha.faturamento} anterior={linha.anterior?.faturamento} />
                    {roas(linha.faturamento, linha.investido) ? (
                      <p className="text-[0.65rem] text-dim">
                        {roas(linha.faturamento, linha.investido)}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Demais métricas */}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              <Metrica rotulo="Impressões" valor={inteiro(linha.impressoes)} atual={linha.impressoes} anterior={linha.anterior?.impressoes} formatoAnterior={inteiro} icone={Eye} />
              <Metrica rotulo="Alcance" valor={inteiro(linha.alcance)} atual={linha.alcance} anterior={linha.anterior?.alcance} formatoAnterior={inteiro} icone={Users} />
              <Metrica rotulo="Frequência" valor={decimal(linha.frequencia)} atual={linha.frequencia} anterior={linha.anterior?.frequencia} formatoAnterior={(n) => decimal(n)} menorMelhor icone={CalendarDays} />
              <Metrica
                rotulo="Cliques no link"
                valor={inteiro(linha.cliquesLink)}
                atual={linha.cliquesLink}
                anterior={linha.anterior?.cliquesLink}
                formatoAnterior={inteiro}
                icone={MousePointerClick}
              />
              <Metrica
                rotulo="Visitas ao perfil"
                valor={inteiro(linha.visitasPerfil)}
                atual={linha.visitasPerfil}
                anterior={linha.anterior?.visitasPerfil}
                formatoAnterior={inteiro}
                icone={Eye}
              />
              <Metrica
                rotulo="Seguidores no Instagram"
                valor={inteiro(linha.seguidores)}
                atual={linha.seguidores}
                anterior={linha.anterior?.seguidores}
                formatoAnterior={inteiro}
                icone={UserPlus}
              />
              <Metrica
                rotulo="Msgs iniciadas"
                valor={inteiro(linha.mensagensIniciadas)}
                atual={linha.mensagensIniciadas}
                anterior={linha.anterior?.mensagensIniciadas}
                formatoAnterior={inteiro}
                icone={MessageCircle}
              />
              <Metrica rotulo="CTR" valor={percentual(linha.ctr)} atual={linha.ctr} anterior={linha.anterior?.ctr} formatoAnterior={percentual} icone={Heart} />
              <Metrica rotulo="CPM" valor={dinheiro(linha.cpm)} atual={linha.cpm} anterior={linha.anterior?.cpm} formatoAnterior={dinheiro} menorMelhor icone={TrendingUp} />
              {linha.temFunilCompra ? (
                <>
                  <Metrica
                    rotulo="Visitas à página"
                    valor={inteiro(linha.visitasPaginaDestino)}
                    atual={linha.visitasPaginaDestino}
                    anterior={linha.anterior?.visitasPaginaDestino}
                    formatoAnterior={inteiro}
                    icone={Eye}
                  />
                  <Metrica
                    rotulo="Adições ao carrinho"
                    valor={inteiro(linha.adicoesCarrinho)}
                    atual={linha.adicoesCarrinho}
                    anterior={linha.anterior?.adicoesCarrinho}
                    formatoAnterior={inteiro}
                    icone={ShoppingCart}
                  />
                  <Metrica
                    rotulo="Finalizações de compra"
                    valor={inteiro(linha.finalizacoesCompra)}
                    atual={linha.finalizacoesCompra}
                    anterior={linha.anterior?.finalizacoesCompra}
                    formatoAnterior={inteiro}
                    icone={CreditCard}
                  />
                </>
              ) : null}
            </dl>

            {analise ? (
              <div className="rounded-lg border border-ember/30 bg-ember/5 p-3">
                <p className="mb-1 flex items-center gap-1 text-[0.7rem] font-medium text-ember">
                  <Sparkles className="size-3 shrink-0" aria-hidden="true" />
                  Análise da IA
                </p>
                <p className="text-sm leading-relaxed text-white">{analise}</p>
              </div>
            ) : analisando ? (
              <p className="flex items-center gap-2 text-xs text-dim">
                <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                Analisando…
              </p>
            ) : null}

            {href ? (
              <Link
                href={href}
                className="mt-auto inline-flex items-center justify-center gap-1 rounded-lg border border-line px-3 py-2 text-sm font-medium text-ember transition-colors hover:bg-surface-2"
              >
                {labelAbrir}
                <ChevronRight className="size-4" aria-hidden="true" />
              </Link>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
