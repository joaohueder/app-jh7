import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/auth/permissions";
import { hojeIso } from "@/lib/format/masks";
import { situacaoCobranca } from "@/lib/financeiro/bloqueio";
import { nomeDoMes } from "../../financeiro/comum";
import { AvisoCobranca } from "../../bloqueio-cobranca";

import { listClientsWithContracts } from "../../clientes/actions";
import { CabecalhoCampanhas } from "../../campanhas/cabecalho";
import { listarRelatorios } from "../dados";
import { RelatoriosCliente } from "./relatorios-cliente";

export const metadata: Metadata = { title: "Relatórios do cliente" };
export const dynamic = "force-dynamic";

export default async function RelatoriosDoClientePage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const user = await requirePermission("relatorios", "view");

  const { clientId } = await params;
  const id = Number(clientId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const clientes = await listClientsWithContracts();
  const cliente = clientes.find((c) => c.id === id);
  if (!cliente) notFound();

  const hoje = hojeIso();
  if ((await situacaoCobranca(id, hoje.slice(0, 7))).bloqueado) {
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

  const relatorios = await listarRelatorios(id);
  const admin = user.role === "admin";
  const permitido = (acao: "create" | "delete") =>
    admin || (user.permissions.relatorios?.includes(acao) ?? false);

  return (
    <div className="space-y-6">
      <CabecalhoCampanhas
        migalhas={[
          { label: "Relatórios", href: "/relatorios" },
          { label: cliente.businessName },
        ]}
        titulo={cliente.businessName}
        descricao="Relatórios já gerados para este cliente."
      />

      <RelatoriosCliente
        clientId={id}
        relatorios={relatorios}
        podeCriar={permitido("create")}
        podeExcluir={permitido("delete")}
      />
    </div>
  );
}