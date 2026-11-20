import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/auth/permissions";
import { getMetaToken } from "@/lib/settings";
import {
  campanhasDoCliente,
  contasDoCliente,
  idsParaCache,
  somarMetricas,
} from "@/lib/meta/campaigns";
import { atualizacaoDeChaves, chavesDeCampanhas } from "@/lib/meta/cache";
import {
  intervaloPersonalizado,
  normalizarPeriodo,
  normalizarStatus,
} from "@/lib/meta/insights";
import { hojeIso } from "@/lib/format/masks";
import { situacaoCobranca } from "@/lib/financeiro/bloqueio";
import { nomeDoMes } from "../../financeiro/comum";
import { AvisoCobranca } from "../../bloqueio-cobranca";
import { listClientsWithContracts } from "../../clientes/actions";
import { AvisoMeta } from "../aviso-meta";
import { AvisoPeriodoPersonalizado } from "../aviso-periodo";
import { CabecalhoCampanhas } from "../cabecalho";
import { FiltrosCampanhas } from "../filtros";
import { MetricasLista } from "../metricas-lista";
import { Resumo } from "../resumo";
import { agoraDoServidor, dinheiro } from "../formato";

export const metadata: Metadata = { title: "Campanhas do cliente" };
export const dynamic = "force-dynamic";

export default async function CampanhasDoClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ periodo?: string; status?: string; de?: string; ate?: string }>;
}) {
  await requirePermission("campanhas", "view");

  const [{ clientId }, search] = await Promise.all([params, searchParams]);
  const id = Number(clientId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const periodo = normalizarPeriodo(search.periodo);
  const status = normalizarStatus(search.status);
  const personalizado =
    periodo === "custom"
      ? intervaloPersonalizado(search.de, search.ate)
      : null;

  const clientes = await listClientsWithContracts();
  const cliente = clientes.find((c) => c.id === id);
  if (!cliente) notFound();

  const hoje = hojeIso();
  if ((await situacaoCobranca(id, hoje.slice(0, 7))).bloqueado) {
    return (
      <div className="space-y-6">
        <CabecalhoCampanhas
          migalhas={[
            { label: "Campanhas", href: "/campanhas" },
            { label: cliente.businessName },
          ]}
          titulo={cliente.businessName}
        />
        <AvisoCobranca
          cliente={cliente.businessName}
          mesLabel={nomeDoMes(hoje.slice(0, 7))}
        />
      </div>
    );
  }

  const contas = await contasDoCliente(cliente.contracts);
  const token = await getMetaToken();
  const query = `?periodo=${periodo}&status=${status}${personalizado ? `&de=${personalizado.since}&ate=${personalizado.until}` : ""}`;

  // Horário do render no servidor: o relógio do botão parte daqui.
  const agoraInicial = agoraDoServidor();

  const resultado = token
    ? await campanhasDoCliente(contas, periodo, status, token, personalizado)
    : { estado: { estado: "sem-token" as const }, linhas: [], contas };

  const metricas = somarMetricas(resultado.linhas);
  const ultimaAtualizacao = await atualizacaoDeChaves(
    chavesDeCampanhas(idsParaCache(contas), periodo, personalizado),
  );

  return (
    <div className="space-y-6">
      <CabecalhoCampanhas
        migalhas={[
          { label: "Campanhas", href: `/campanhas${query}` },
          { label: cliente.businessName },
        ]}
        titulo={cliente.businessName}
        descricao="Campanhas na Meta Ads conforme o período e o status escolhidos."
      />

      <FiltrosCampanhas
        periodo={periodo}
        status={status}
        de={personalizado?.since}
        ate={personalizado?.until}
        clientId={id}
        ultimaAtualizacao={ultimaAtualizacao}
        agoraInicial={agoraInicial}
      />

      <AvisoMeta estado={resultado.estado} />

      {periodo === "custom" && !personalizado ? (
        <AvisoPeriodoPersonalizado />
      ) : contas.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface px-4 py-4 text-sm text-dim">
          Este cliente não tem conta de anúncio vinculada a um contrato. Vincule
          em Clientes → Contratos para acompanhar as campanhas.
        </p>
      ) : resultado.estado.estado === "ok" ? (
        <>
          {/* Topo enxuto: resultado e custo por resultado ficam em cada card */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Resumo
              rotulo="Investido"
              valor={dinheiro(metricas.investido)}
              atual={metricas.investido}
              anterior={metricas.anterior?.investido}
              formatoAnterior={dinheiro}
            />
            <Resumo
              rotulo="Campanhas"
              valor={String(resultado.linhas.length)}
              detalhe={`${resultado.linhas.filter((l) => l.ativo).length} ativas`}
            />
          </div>

          <MetricasLista
            linhas={resultado.linhas}
            mostrarConta={contas.length > 1}
            hrefBase={`/campanhas/${id}`}
            query={query}
            labelAbrir="Ver conjuntos"
            vazio="Nenhuma campanha neste período e status. Ajuste os filtros acima."
          />
        </>
      ) : null}
    </div>
  );
}

