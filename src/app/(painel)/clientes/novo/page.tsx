import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requirePermission } from "@/lib/auth/permissions";
import { listNiches } from "../../configuracoes/nichos-actions";
import { ClientTabs } from "../client-tabs";

export const metadata: Metadata = { title: "Novo cliente" };

export default async function NovoClientePage() {
  await requirePermission("clientes", "create");
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
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Novo cliente
          </h1>
          <p className="mt-1 text-sm text-dim">
            Preencha os dados principais. Endereço, contratos e anotações ficam
            disponíveis assim que o cliente for salvo.
          </p>
        </div>
      </div>

      <ClientTabs
        endereco={null}
        contratos={[]}
        anotacoes={[]}
        nichos={nichos}
        podeEditar
        podeExcluir={false}
      />
    </div>
  );
}
