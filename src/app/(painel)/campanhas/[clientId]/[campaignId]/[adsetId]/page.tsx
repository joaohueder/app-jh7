import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/auth/permissions";
import { hojeIso } from "@/lib/format/masks";
import { situacaoCobranca } from "@/lib/financeiro/bloqueio";
import { nomeDoMes } from "../../../../financeiro/comum";
import { AvisoCobranca } from "../../../../bloqueio-cobranca";

import { getMetaToken } from "@/lib/settings";
import {
  anunciosDoConjunto,
  campanhasDoCliente,
  conjuntosDaCampanha,
  contasDoCliente,
  idsParaCache,
  somarMetricas,
} from "@/lib/meta/campaigns";
import { atualizacaoDeChaves, chavesDeAnuncios } from "@/lib/meta/cache";
import { intervaloPersonalizado, normalizarPeriodo, normalizarStatus } from "@/lib/meta/insights";
import { agoraDoServidor, dinheiro, inteiro } from "../../../formato";
import { listClientsWithContracts } from "../../../../clientes/actions";
import { AvisoMeta } from "../../../aviso-meta";
import { AvisoPeriodoPersonalizado } from "../../../aviso-periodo";
import { CabecalhoCampanhas } from "../../../cabecalho";
import { FiltrosCampanhas } from "../../../filtros";
import { Resumo } from "../../../resumo";
import { AnalisarAnuncios } from "../../../analisar-anuncios";

export const metadata: Metadata = { title: "Anúncios do conjunto" };
export const dynamic = "force-dynamic";

export default async function AnunciosPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string; campaignId: string; adsetId: string }>;
  searchParams: Promise<{ periodo?: string; status?: string; de?: string; ate?: string }>;
}) {
  await requirePermission("campanhas", "view");

  const [{ clientId, campaignId, adsetId }, search] = await Promise.all([
    params,
    searchParams,
  ]);
  const id = Number(clientId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const periodo = normalizarPeriodo(search.periodo);
  const status = normalizarStatus(search.status);
  const personalizado = periodo === "custom" ? intervaloPersonalizado(search.de, search.ate) : null;
  const query = `?periodo=${periodo}&status=${status}${personalizado ? `&de=${personalizado.since}&ate=${personalizado.until}` : ""}`;

  const clientes = await listClientsWithContracts();
  const cliente = clientes.find((c) => c.id === id);
  if (!cliente) notFound();

  const hoje = hojeIso();
  if (situacaoCobranca(id, hoje.slice(0, 7)).bloqueado) {
    return (
      <div className="space-y-6">
        <CabecalhoCampanhas
          migalhas={[{ label: "Financeiro", href: "/financeiro" }, { label: cliente.businessName }]}
          titulo={cliente.businessName}
        />
        <AvisoCobranca cliente={cliente.businessName} mesLabel={nomeDoMes(hoje.slice(0, 7))} />
      </div>
    );
  }

  const contas = await contasDoCliente(cliente.contracts);
  const token = getMetaToken();

  const campanhas = token
    ? await campanhasDoCliente(contas, periodo, "all", token, personalizado)
    : { estado: { estado: "sem-token" as const }, linhas: [], contas };
  const campanha = campanhas.linhas.find((l) => l.id === campaignId);
  if (!campanha) notFound();

  const conjuntos = token
    ? await conjuntosDaCampanha(
        campaignId,
        campanha.contaId,
        campanha.objetivoCodigo ?? null,
        periodo,
        "all",
        token,
        personalizado,
      )
    : { estado: { estado: "sem-token" as const }, linhas: [] };
  const conjunto = conjuntos.linhas.find((l) => l.id === adsetId);
  if (!conjunto) notFound();

  const resultado = token
    ? await anunciosDoConjunto(
        adsetId,
        campanha.contaId,
        campanha.objetivoCodigo ?? null,
        periodo,
        status,
        token,
        conjunto.destino,
        personalizado,
      )
    : { estado: { estado: "sem-token" as const }, linhas: [] };

  // Horário do render no servidor: o relógio do botão parte daqui.
  const agoraInicial = agoraDoServidor();

  const metricas = somarMetricas(resultado.linhas);
  const ultimaAtualizacao = atualizacaoDeChaves(
    chavesDeAnuncios(
      idsParaCache(contas)[0] ?? "",
      adsetId,
      status,
      conjunto.destino ?? null,
      periodo,
      personalizado,
    ),
  );

  return (
    <div className="space-y-6">
      <CabecalhoCampanhas
        migalhas={[
          { label: "Campanhas", href: `/campanhas${query}` },
          { label: cliente.businessName, href: `/campanhas/${id}${query}` },
          {
            label: campanha.nome,
            href: `/campanhas/${id}/${campaignId}${query}`,
          },
          { label: conjunto.nome },
        ]}
        titulo={conjunto.nome}
        descricao={`${conjunto.objetivo} · anúncios do conjunto`}
      />

      <FiltrosCampanhas
        periodo={periodo}
        status={status}
        de={personalizado?.since}
        ate={personalizado?.until}
        clientId={id}
        ultimaAtualizacao={ultimaAtualizacao}
        agoraInicial={agoraInicial}
        campanhaId={campaignId}
        conjuntoId={adsetId}
        objetivoCodigo={campanha.objetivoCodigo ?? null}
        destino={conjunto.destino ?? null}
      />

      <AvisoMeta estado={resultado.estado} />

      {periodo === "custom" && !personalizado ? (
        <AvisoPeriodoPersonalizado />
      ) : resultado.estado.estado === "ok" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Resumo
              rotulo="Investido"
              valor={dinheiro(metricas.investido)}
              atual={metricas.investido}
              anterior={metricas.anterior?.investido}
              formatoAnterior={dinheiro}
            />
            <Resumo
              rotulo={metricas.resultadoRotulo}
              valor={inteiro(metricas.resultadoValor)}
              atual={metricas.resultadoValor}
              anterior={metricas.anterior?.resultadoValor}
              formatoAnterior={inteiro}
            />
            <Resumo
              rotulo="Custo por resultado"
              valor={dinheiro(metricas.custoPorResultado)}
              atual={metricas.custoPorResultado}
              anterior={metricas.anterior?.custoPorResultado}
              formatoAnterior={dinheiro}
              menorMelhor
            />
            <Resumo rotulo="Anúncios" valor={String(resultado.linhas.length)} />
          </div>

          <AnalisarAnuncios linhas={resultado.linhas} periodo={periodo} />
        </>
      ) : null}
    </div>
  );
}

