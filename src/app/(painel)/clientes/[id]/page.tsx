import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CircleCheck, CircleOff } from "lucide-react";

import { requirePermission, userHasPermission } from "@/lib/auth/permissions";
import { getClientDetail } from "../actions";
import { listNiches } from "../../configuracoes/nichos-actions";
import { ClientTabs } from "../client-tabs";

export const metadata: Metadata = { title: "Cliente" };
export const dynamic = "force-dynamic";

export default async function ClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const clienteId = Number(id);
  if (!Number.isInteger(clienteId) || clienteId <= 0) notFound();

  const usuario = await requirePermission("clientes", "view");

  const detalhe = await getClientDetail(clienteId);
  if (!detalhe) notFound();

  const podeEditar = userHasPermission(usuario, "clientes", "edit");
  const podeExcluir = userHasPermission(usuario, "clientes", "delete");
  const { nichos } = await listNiches();

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href="/clientes"
          className="inline-flex items-center gap-1.5 text-sm text-dim transition-colors hover:text-white"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar para clientes
        </Link>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            {detalhe.cliente.businessName}
          </h1>
          {detalhe.cliente.active ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-jade/40 bg-jade/10 px-2 py-0.5 text-[0.65rem] font-medium text-jade">
              <CircleCheck className="size-3" aria-hidden="true" />
              Ativo
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[0.65rem] font-medium text-destructive">
              <CircleOff className="size-3" aria-hidden="true" />
              Inativo
            </span>
          )}
        </div>
        <p className="text-sm text-dim">
          Dados, endereço, contratos e histórico de anotações.
        </p>
      </div>

      <ClientTabs
        cliente={detalhe.cliente}
        endereco={detalhe.endereco}
        contratos={detalhe.contratos}
        anotacoes={detalhe.anotacoes}
        nichos={nichos}
        podeEditar={podeEditar}
        podeExcluir={podeExcluir}
      />
    </div>
  );
}
