import type { Metadata } from "next";
import Link from "next/link";
import { Megaphone } from "lucide-react";

import { requirePermission } from "@/lib/auth/permissions";
import { hojeIso } from "@/lib/format/masks";
import { clientesBloqueados } from "@/lib/financeiro/bloqueio";
import { nomeDoMes } from "../financeiro/comum";
import { getMetaToken } from "@/lib/settings";
import {
  campanhasDoCliente,
  contasDoCliente,
  idsParaCache,
  somarMetricas,
  saldoDaConta,
  type ContaDoCliente,
  type SaldoConta,
} from "@/lib/meta/campaigns";
import { atualizacaoDeChaves, chavesDeCampanhas } from "@/lib/meta/cache";
import { intervaloPersonalizado, normalizarPeriodo, normalizarStatus, tendencia, variacao } from "@/lib/meta/insights";
import { formatMoney } from "@/lib/format/masks";
import { listClientsWithContracts, type ClientComContratos } from "../clientes/actions";
import { ListaClientes } from "../clientes/lista-clientes";
import { listNiches } from "../configuracoes/nichos-actions";
import { agoraDoServidor } from "./formato";
import { AvisoMeta } from "./aviso-meta";
import { SaldoContaResumo } from "./saldo-resumo";
import { CabecalhoCampanhas } from "./cabecalho";
import { FiltrosCampanhas } from "./filtros";
import { AvisoPeriodoPersonalizado } from "./aviso-periodo";

export const metadata: Metadata = { title: "Campanhas" };
export const dynamic = "force-dynamic";

/** Contas de anúncio de todos os contratos do cliente, com saldo de cada uma. */
async function contasDe(
  cliente: ClientComContratos,
  token: string,
): Promise<(ContaDoCliente & { saldoInfo: SaldoConta })[]> {
  const contas = await contasDoCliente(cliente.contracts);
  return Promise.all(
    contas.map(async (conta) => ({
      ...conta,
      saldoInfo: await saldoDaConta(conta.id, token),
    })),
  );
}

type ResumoSaldo = {
  texto: string;
  /** `null` quando não há saldo numérico (pós-pago ou sem dado). */
  saldo: number | null;
  moeda: string;
};

/** Resumo do saldo das contas do cliente: PÓS PAGO ou soma dos saldos pré-pagos. */
function resumoSaldo(
  contas: (ContaDoCliente & { saldoInfo: SaldoConta })[],
): ResumoSaldo | null {
  if (contas.length === 0) return null;

  const posPago = contas.some((c) => c.saldoInfo.pagamento);
  if (posPago) return { texto: "PÓS PAGO", saldo: null, moeda: "BRL" };

  const saldos = contas
    .map((c) => c.saldoInfo.saldo)
    .filter((s): s is number => s !== null);
  if (saldos.length === 0) return null;

  const moeda = contas[0]?.saldoInfo.moeda ?? "BRL";
  const total = saldos.reduce((a, b) => a + b, 0);
  const formatado = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: moeda === "BRL" ? "BRL" : moeda,
  }).format(total);
  return { texto: `Saldo: ${formatado}`, saldo: total, moeda };
}

export default async function CampanhasPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; status?: string; de?: string; ate?: string }>;
}) {
  await requirePermission("campanhas", "view");
  const params = await searchParams;
  const periodo = normalizarPeriodo(params.periodo);
  const status = normalizarStatus(params.status);
  const personalizado =
    periodo === "custom"
      ? intervaloPersonalizado(params.de, params.ate)
      : null;
  const token = getMetaToken();

  const clientes = await listClientsWithContracts();
  const { nichos } = await listNiches();
  const mesAtual = hojeIso().slice(0, 7);
  const bloqueados = clientesBloqueados(
    clientes.map((c) => c.id),
    mesAtual,
  );

  if (!token) {
    return (
      <div className="space-y-6">
        <CabecalhoCampanhas
          migalhas={[{ label: "Campanhas" }]}
          titulo="Campanhas"
          descricao="Acompanhe a performance dos clientes na Meta Ads."
        />
        <AvisoMeta estado={{ estado: "sem-token" }} />
      </div>
    );
  }

  // Um resumo por cliente: só entra na lista quem tem campanha no filtro atual.
  const resumos = await Promise.all(
    clientes.map(async (cliente) => {
      const contasComSaldo = await contasDe(cliente, token);
      const contas = contasComSaldo;
      const resultado = await campanhasDoCliente(contas, periodo, status, token, personalizado);
      const metricas = somarMetricas(resultado.linhas);
      return {
        cliente,
        contas,
        saldo: resumoSaldo(contasComSaldo),
        estado: resultado.estado,
        linhas: resultado.linhas,
        metricas,
        ativas: resultado.linhas.filter((l) => l.ativo).length,
      };
    }),
  );

  const comCampanhas = resumos.filter(
    (r) => r.estado.estado === "ok" && r.linhas.length > 0,
  );

  // Idade do dado em tela: o carimbo mais antigo entre as contas, no período
  // exibido. Atualização parcial não pode fazer dado velho parecer novo.
  const ultimaAtualizacao = atualizacaoDeChaves(
    chavesDeCampanhas(
      resumos.flatMap((r) => idsParaCache(r.contas)),
      periodo,
      personalizado,
    ),
  );
  const erro = resumos.find((r) => r.estado.estado === "erro")?.estado;
  const semContas = resumos.filter((r) => r.contas.length === 0);

  // Horário do render no servidor: o relógio do botão parte daqui.
  const agoraInicial = agoraDoServidor();

  const query = `?periodo=${periodo}&status=${status}${personalizado ? `&de=${personalizado.since}&ate=${personalizado.until}` : ""}`;

  return (
    <div className="space-y-6">
      <CabecalhoCampanhas
        migalhas={[{ label: "Campanhas" }]}
        titulo="Campanhas"
        descricao="Clientes com campanhas na Meta, conforme o período e o status escolhidos."
      />

      <FiltrosCampanhas
        periodo={periodo}
        status={status}
        de={personalizado?.since}
        ate={personalizado?.until}
        ultimaAtualizacao={ultimaAtualizacao}
        agoraInicial={agoraInicial}
      />

      {erro ? <AvisoMeta estado={erro} /> : null}

      {periodo === "custom" && !personalizado ? (
        <AvisoPeriodoPersonalizado />
      ) : comCampanhas.length === 0 && erro?.estado !== "erro" ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-surface px-6 py-14 text-center">
          <Megaphone className="size-8 text-dim/50" aria-hidden="true" />
          <p className="text-sm text-dim">
            Nenhum cliente com campanhas neste filtro. Ajuste o período ou o status
            acima.
          </p>
        </div>
      ) : (
        <ListaClientes
          clientes={comCampanhas.map((r) => r.cliente)}
          nichos={nichos}
          hrefBase="/campanhas"
          hrefSufixo={query}
          hrefLabel="Ver campanhas"
          bloqueados={[...bloqueados]}
          bloqueioLabel={`Sem parcela de ${nomeDoMes(mesAtual)}`}
          lembrarNicho="campanhas:nicho"
          detalhe={Object.fromEntries(
            comCampanhas.map(({ cliente, saldo, metricas, ativas }) => [
              cliente.id,
              <div
                key={cliente.id}
                className="flex flex-wrap items-start gap-x-8 gap-y-3 rounded-lg border border-line bg-surface-2/40 px-3 py-2.5"
              >
                {saldo ? <SaldoContaResumo resumo={saldo} /> : null}
                {/* Entrada do módulo: só investimento e campanhas ativas */}
                <dl className="flex flex-wrap items-start gap-x-8 gap-y-2 text-xs">
                  <div>
                    <dt className="text-dim">Investido</dt>
                    <dd className="font-semibold text-white">
                      {formatMoney(Math.round(metricas.investido * 100))}
                    </dd>
                    {metricas.anterior?.investido != null ? (
                      <dd className="text-[0.65rem] text-dim">
                        Anterior:{" "}
                        {formatMoney(Math.round(metricas.anterior.investido * 100))}
                      </dd>
                    ) : null}
                    {variacao(metricas.investido, metricas.anterior?.investido) ? (
                      <dd
                        className={`text-[0.65rem] ${
                          tendencia(
                            metricas.investido,
                            metricas.anterior?.investido,
                            true,
                          ) === "melhor"
                            ? "text-jade"
                            : "text-destructive"
                        }`}
                      >
                        {variacao(metricas.investido, metricas.anterior?.investido)}
                      </dd>
                    ) : null}
                  </div>
                  <div>
                    <dt className="text-dim">Campanhas ativas</dt>
                    <dd className="font-semibold text-white">{ativas}</dd>
                  </div>
                </dl>
              </div>,
            ]),
          )}
        />
      )}

      {semContas.length > 0 ? (
        <p className="text-xs text-dim">
          {semContas.length}{" "}
          {semContas.length === 1
            ? "cliente sem conta de anúncio vinculada a um contrato"
            : "clientes sem conta de anúncio vinculada a um contrato"}
          .{" "}
          <Link href="/clientes" className="text-ember hover:underline">
            Vincular contas
          </Link>
        </p>
      ) : null}
    </div>
  );
}
