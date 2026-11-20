import Link from "next/link";
import {
  ArrowUpRight,
  CalendarClock,
  CircleAlert,
  CircleCheck,
  CircleDollarSign,
  ClipboardList,
  TrendingDown,
  Users,
  Wallet,
} from "lucide-react";

import { formatDateIso } from "@/lib/format/masks";
import { GerarParcela } from "./gerar-parcela";
import { GerarTodas } from "./gerar-todas";
import { formatarBRL, type Kpi, type PainelFinanceiro } from "./dados";

const TONS: Record<NonNullable<Kpi["tom"]>, string> = {
  bom: "text-jade",
  ruim: "text-destructive",
  neutro: "text-white",
};

/** Altura máxima das barras do gráfico, em pixels. */
const ALTURA = 120;

export function Dashboard({
  dados,
  podeGerarCobranca,
}: {
  dados: PainelFinanceiro;
  podeGerarCobranca: boolean;
}) {
  const maiorMes = Math.max(
    1,
    ...dados.serie.flatMap((m) => [m.recebido, m.despesaPaga, m.emAberto]),
  );

  const geradasPct =
    dados.parcelasEsperadas === 0
      ? 100
      : Math.round((dados.parcelasGeradas / dados.parcelasEsperadas) * 100);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <section aria-labelledby="kpis-titulo" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="kpis-titulo" className="text-base font-semibold text-white">
              Indicadores de {dados.mesLabel.toLowerCase()}
            </h2>
            <p className="text-sm text-dim">
              Financeiro e carteira, lidos do sistema — sem depender da Meta.
            </p>
          </div>
          <Link
            href="/financeiro"
            className="inline-flex items-center gap-1 text-sm font-medium text-ember hover:underline"
          >
            Abrir financeiro
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {dados.kpis.map((kpi) => (
            <li
              key={kpi.titulo}
              className="rounded-xl border border-line bg-surface p-4"
            >
              <p className="text-xs text-dim">{kpi.titulo}</p>
              <p className={`mt-1 text-xl font-semibold ${TONS[kpi.tom ?? "neutro"]}`}>
                {kpi.valor}
              </p>
              {kpi.detalhe ? (
                <p className="mt-0.5 text-xs text-dim">{kpi.detalhe}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {/* Parcelas não geradas */}
      <section
        aria-labelledby="parcelas-titulo"
        className="rounded-xl border border-line bg-surface p-5"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2
              id="parcelas-titulo"
              className="flex items-center gap-2 text-base font-semibold text-white"
            >
              {dados.parcelasPendentes.length > 0 ? (
                <CircleAlert className="size-4 text-destructive" aria-hidden="true" />
              ) : (
                <CircleCheck className="size-4 text-jade" aria-hidden="true" />
              )}
              Parcelas do mês
            </h2>
            <p className="mt-1 text-sm text-dim">
              {dados.parcelasPendentes.length > 0
                ? `${dados.parcelasPendentes.length} ${dados.parcelasPendentes.length === 1 ? "contrato ainda não teve" : "contratos ainda não tiveram"} a mensalidade gerada em ${dados.mesLabel.toLowerCase()}.`
                : `Todas as ${dados.parcelasEsperadas} mensalidades ativas de ${dados.mesLabel.toLowerCase()} já foram geradas.`}
              {dados.contratosSemVencimento > 0 ? (
                <span className="mt-1 block text-ember">
                  {dados.contratosSemVencimento}{" "}
                  {dados.contratosSemVencimento === 1
                    ? "contrato ativo está"
                    : "contratos ativos estão"}{" "}
                  sem dia de vencimento e fora da cobrança. Defina em Clientes →
                  Contratos.
                </span>
              ) : null}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <Anel percentual={geradasPct} />
            <div>
              <p className="text-sm font-semibold text-white">
                {dados.parcelasGeradas} de {dados.parcelasEsperadas}
              </p>
              <p className="text-xs text-dim">contratos com cobrança</p>
              {podeGerarCobranca && dados.parcelasPendentes.length > 0 ? (
                <span className="mt-1 inline-block">
                  <GerarTodas mes={dados.mes} />
                </span>
              ) : (
                <Link
                  href="/financeiro"
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-ember hover:underline"
                >
                  Abrir financeiro
                  <ArrowUpRight className="size-3" aria-hidden="true" />
                </Link>
              )}
            </div>
          </div>
        </div>

        {dados.parcelasPendentes.length > 0 ? (
          <ul className="mt-4 divide-y divide-line/70 rounded-lg border border-line bg-surface-2/30">
            {dados.parcelasPendentes.map((p) => (
              <li
                key={p.contratoId}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-white">
                    {p.cliente}
                  </span>
                  <span className="block truncate text-xs text-dim">
                    {p.contrato} · vence dia {p.diaVencimento}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-semibold text-white">
                    {formatarBRL(p.valor)}
                  </span>
                  <GerarParcela
                    contratoId={p.contratoId}
                    mes={dados.mes}
                    cliente={p.cliente}
                    podeGerar={podeGerarCobranca}
                  />
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {/* Carteira inteira com dia de vencimento — paga, gerada ou pendente */}
        <div className="mt-5 border-t border-line pt-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            <CalendarClock className="size-4 text-ember" aria-hidden="true" />
            Contratos com dia de vencimento
          </h3>
          <p className="mt-1 text-xs text-dim">
            {dados.contratosComVencimento.length} contratos em cobrança ·{" "}
            {dados.contratosComVencimento.filter((c) => c.situacao === "paga").length} pagos
            ·{" "}
            {dados.contratosComVencimento.filter((c) => c.situacao === "gerada").length}{" "}
            gerados e em aberto
          </p>

          {dados.contratosComVencimento.length === 0 ? (
            <p className="mt-3 rounded-lg border border-line bg-surface-2/40 px-3 py-6 text-center text-sm text-dim">
              Nenhum contrato ativo com dia de vencimento definido.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-dim">
                    <th scope="col" className="py-2 pr-3 font-medium">Venc.</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Cliente</th>
                    <th scope="col" className="hidden py-2 pr-3 font-medium sm:table-cell">
                      Contrato
                    </th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">Valor</th>
                    <th scope="col" className="py-2 text-right font-medium">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {dados.contratosComVencimento.map((c) => (
                    <tr key={c.contratoId}>
                      <td className="py-2 pr-3 text-dim tabular-nums">
                        dia {c.diaVencimento}
                      </td>
                      <td className="max-w-0 truncate py-2 pr-3 text-white">
                        {c.cliente}
                      </td>
                      <td className="hidden max-w-0 truncate py-2 pr-3 text-dim sm:table-cell">
                        {c.contrato}
                      </td>
                      <td className="py-2 pr-3 text-right font-semibold whitespace-nowrap text-white">
                        {formatarBRL(c.valor)}
                      </td>
                      <td className="py-2 text-right">
                        <SituacaoBadge situacao={c.situacao} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {dados.contratosSemDia.length > 0 ? (
            <div className="mt-4 rounded-lg border border-ember/40 bg-ember/5 p-3">
              <p className="text-xs font-medium text-ember">
                Sem dia de vencimento ({dados.contratosSemDia.length}) — fora da cobrança:
              </p>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {dados.contratosSemDia.map((c) => (
                  <li
                    key={c.contratoId}
                    className="rounded-md border border-line bg-surface px-2 py-1 text-xs text-dim"
                  >
                    {c.cliente} · {c.contrato}
                  </li>
                ))}
              </ul>
              <Link
                href="/clientes"
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-ember hover:underline"
              >
                Definir vencimento nos contratos
                <ArrowUpRight className="size-3" aria-hidden="true" />
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      {/* Gráfico de 6 meses */}
      <section
        aria-labelledby="serie-titulo"
        className="rounded-xl border border-line bg-surface p-5"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="serie-titulo" className="text-base font-semibold text-white">
              Últimos 6 meses
            </h2>
            <p className="text-sm text-dim">
              Recebido, despesas pagas e o que ficou em aberto em cada mês.
            </p>
          </div>
          <ul className="flex flex-wrap items-center gap-3 text-xs text-dim">
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-jade" aria-hidden="true" />
              Recebido
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-ember" aria-hidden="true" />
              Despesas pagas
            </li>
            <li className="flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-sm border border-dim bg-transparent"
                aria-hidden="true"
              />
              Em aberto
            </li>
          </ul>
        </div>

        <div className="mt-5 flex items-end justify-between gap-2 sm:gap-6">
          {dados.serie.map((m) => (
            <div key={m.mes} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="flex h-[136px] w-full items-end justify-center gap-1">
                <Barra
                  valor={m.recebido}
                  maior={maiorMes}
                  classe="bg-jade"
                  rotulo={`${m.rotulo}: recebido ${formatarBRL(m.recebido)}`}
                />
                <Barra
                  valor={m.despesaPaga}
                  maior={maiorMes}
                  classe="bg-ember"
                  rotulo={`${m.rotulo}: despesas pagas ${formatarBRL(m.despesaPaga)}`}
                />
                <Barra
                  valor={m.emAberto}
                  maior={maiorMes}
                  classe="border border-dim/70 bg-transparent"
                  rotulo={`${m.rotulo}: em aberto ${formatarBRL(m.emAberto)}`}
                />
              </div>
              <span className="truncate text-[0.68rem] text-dim uppercase">
                {m.rotulo}
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Clientes em aberto */}
        <section
          aria-labelledby="devedores-titulo"
          className="rounded-xl border border-line bg-surface p-5"
        >
          <h2
            id="devedores-titulo"
            className="flex items-center gap-2 text-base font-semibold text-white"
          >
            <TrendingDown className="size-4 text-destructive" aria-hidden="true" />
            Clientes com valores em aberto
          </h2>
          <p className="mt-1 text-sm text-dim">
            Inclui parcelas vencidas e as que ainda vão vencer.
          </p>

          {dados.clientesEmAberto.length === 0 ? (
            <p className="mt-4 rounded-lg border border-line bg-surface-2/40 px-3 py-6 text-center text-sm text-dim">
              Nenhum cliente com valor em aberto.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-dim">
                    <th scope="col" className="py-2 pr-3 font-medium">Cliente</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">
                      Parcelas
                    </th>
                    <th scope="col" className="py-2 text-right font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {dados.clientesEmAberto.map((c) => (
                    <tr key={c.clientId}>
                      <td className="max-w-0 truncate py-2 pr-3 text-white">
                        {c.cliente}
                      </td>
                      <td className="py-2 pr-3 text-right text-dim">
                        {c.quantidade}
                      </td>
                      <td className="py-2 text-right font-semibold text-white">
                        {formatarBRL(c.valor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Próximos vencimentos */}
        <section
          aria-labelledby="vencimentos-titulo"
          className="rounded-xl border border-line bg-surface p-5"
        >
          <h2
            id="vencimentos-titulo"
            className="flex items-center gap-2 text-base font-semibold text-white"
          >
            <CalendarClock className="size-4 text-ember" aria-hidden="true" />
            Próximos 7 dias
          </h2>
          <p className="mt-1 text-sm text-dim">
            Receitas em aberto, por ordem de data. Quem já pagou não aparece.
          </p>

          {dados.proximosVencimentos.length === 0 ? (
            <p className="mt-4 rounded-lg border border-line bg-surface-2/40 px-3 py-6 text-center text-sm text-dim">
              Nada vence nos próximos 7 dias.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-line/60">
              {dados.proximosVencimentos.map((v) => (
                <li
                  key={v.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-white">
                      {v.cliente ?? v.descricao}
                    </span>
                    <span className="block truncate text-xs text-dim">
                      {formatDateIso(v.vencimento)} ·{" "}
                      {v.dias === 0
                        ? "vence hoje"
                        : `em ${v.dias} ${v.dias === 1 ? "dia" : "dias"}`}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-semibold text-white">
                      {formatarBRL(v.valor)}
                    </span>
                    {v.valor !== v.valorTotal ? (
                      <span className="block text-[0.65rem] text-dim">
                        de {formatarBRL(v.valorTotal)}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Carteira por nicho */}
        <section
          aria-labelledby="nichos-titulo"
          className="rounded-xl border border-line bg-surface p-5"
        >
          <h2
            id="nichos-titulo"
            className="flex items-center gap-2 text-base font-semibold text-white"
          >
            <Users className="size-4 text-ember" aria-hidden="true" />
            Carteira por nicho
          </h2>
          <p className="mt-1 text-sm text-dim">
            {dados.clientesAtivos} clientes ativos em {dados.nichos.length}{" "}
            {dados.nichos.length === 1 ? "nicho" : "nichos"}.
          </p>

          {dados.nichos.length === 0 ? (
            <p className="mt-4 rounded-lg border border-line bg-surface-2/40 px-3 py-6 text-center text-sm text-dim">
              Nenhum cliente com nicho definido.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {dados.nichos.map((n) => {
                const maior = Math.max(...dados.nichos.map((x) => x.clientes));
                return (
                  <li key={n.nome} className="space-y-1">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate text-white">{n.nome}</span>
                      <span className="shrink-0 text-dim">{n.clientes}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full bg-ember/80"
                        style={{ width: `${Math.max(4, (n.clientes / maior) * 100)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Fechamento do mês */}
        <section
          aria-labelledby="fechamento-titulo"
          className="rounded-xl border border-line bg-surface p-5"
        >
          <h2
            id="fechamento-titulo"
            className="flex items-center gap-2 text-base font-semibold text-white"
          >
            <Wallet className="size-4 text-jade" aria-hidden="true" />
            Fechamento de {dados.mesLabel.toLowerCase()}
          </h2>
          <p className="mt-1 text-sm text-dim">
            Receitas e despesas com vencimento neste mês.
          </p>

          <dl className="mt-4 divide-y divide-line/60 text-sm">
            <Linha
              rotulo="Recebido"
              valor={formatarBRL(dados.totalRecebido)}
              tom="text-jade"
            />
            <Linha
              rotulo="A receber"
              valor={formatarBRL(dados.totalEmAberto)}
              tom="text-white"
            />
            <Linha
              rotulo="Vencido (todas as competências)"
              valor={formatarBRL(dados.totalVencido)}
              tom={dados.totalVencido > 0 ? "text-destructive" : "text-white"}
            />
            <Linha
              rotulo="Despesas do mês"
              valor={formatarBRL(dados.totalDespesas)}
              tom="text-white"
            />
            <Linha
              rotulo="Despesas pagas"
              valor={formatarBRL(dados.totalDespesasPagas)}
              tom="text-dim"
            />
            <Linha
              rotulo="Saldo (recebido − despesas pagas)"
              valor={formatarBRL(dados.totalRecebido - dados.totalDespesasPagas)}
              tom={
                dados.totalRecebido - dados.totalDespesasPagas < 0
                  ? "text-destructive"
                  : "text-jade"
              }
              destaque
            />
          </dl>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <MiniConta
              icone={<CircleDollarSign className="size-3.5 text-ember" aria-hidden="true" />}
              rotulo="Receita recorrente"
              valor={formatarBRL(dados.mrr)}
            />
            <MiniConta
              icone={<ClipboardList className="size-3.5 text-ember" aria-hidden="true" />}
              rotulo="Contratos ativos"
              valor={String(dados.contratosAtivos)}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function Barra({
  valor,
  maior,
  classe,
  rotulo,
}: {
  valor: number;
  maior: number;
  classe: string;
  rotulo: string;
}) {
  // Altura mínima visível para o mês zerado não sumir do gráfico.
  const altura = valor === 0 ? 2 : Math.max(4, Math.round((valor / maior) * ALTURA));
  return (
    <div
      role="img"
      aria-label={rotulo}
      title={rotulo}
      className={`w-3 rounded-t-sm transition-colors sm:w-4 ${classe}`}
      style={{ height: `${altura}px` }}
    />
  );
}

const SITUACOES = {
  paga: { rotulo: "Pago", classe: "border-jade/40 bg-jade/10 text-jade" },
  gerada: { rotulo: "Em aberto", classe: "border-ember/40 bg-ember/10 text-ember" },
  pendente: { rotulo: "Não gerada", classe: "border-destructive/40 bg-destructive/10 text-destructive" },
} as const;

function SituacaoBadge({
  situacao,
}: {
  situacao: "paga" | "gerada" | "pendente";
}) {
  const { rotulo, classe } = SITUACOES[situacao];
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[0.65rem] font-medium ${classe}`}
    >
      {rotulo}
    </span>
  );
}

function Anel({ percentual }: { percentual: number }) {
  const raio = 18;
  const circunferencia = 2 * Math.PI * raio;
  const cheio = (Math.min(100, Math.max(0, percentual)) / 100) * circunferencia;

  return (
    <div className="relative grid size-12 place-items-center">
      <svg viewBox="0 0 44 44" className="size-12 -rotate-90" aria-hidden="true">
        <circle cx="22" cy="22" r={raio} fill="none" strokeWidth="4" className="stroke-line" />
        <circle
          cx="22"
          cy="22"
          r={raio}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${cheio} ${circunferencia}`}
          className={percentual >= 100 ? "stroke-jade" : "stroke-ember"}
        />
      </svg>
      <span className="absolute text-[0.65rem] font-semibold text-white">
        {percentual}%
      </span>
    </div>
  );
}

function Linha({
  rotulo,
  valor,
  tom,
  destaque = false,
}: {
  rotulo: string;
  valor: string;
  tom: string;
  destaque?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <dt className={destaque ? "font-medium text-white" : "text-dim"}>{rotulo}</dt>
      <dd className={`shrink-0 font-semibold ${tom}`}>{valor}</dd>
    </div>
  );
}

function MiniConta({
  icone,
  rotulo,
  valor,
}: {
  icone: React.ReactNode;
  rotulo: string;
  valor: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface-2/40 px-3 py-2">
      <p className="flex items-center gap-1.5 text-[0.68rem] text-dim">
        {icone}
        {rotulo}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-white">{valor}</p>
    </div>
  );
}