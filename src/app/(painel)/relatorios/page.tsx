import type { Metadata } from "next";
import { FileText } from "lucide-react";

import { requirePermission } from "@/lib/auth/permissions";
import { hojeIso } from "@/lib/format/masks";
import { clientesBloqueados } from "@/lib/financeiro/bloqueio";
import { nomeDoMes } from "../financeiro/comum";
import { listNiches } from "../configuracoes/nichos-actions";
import { listClients } from "../clientes/actions";
import { ListaClientes } from "../clientes/lista-clientes";
import { CabecalhoCampanhas } from "../campanhas/cabecalho";

export const metadata: Metadata = { title: "Relatórios" };
export const dynamic = "force-dynamic";

export default async function RelatoriosPage() {
  await requirePermission("relatorios", "view");
  const clientes = await listClients();
  const { nichos } = await listNiches();

  const mes = hojeIso().slice(0, 7);
  const bloqueados = await clientesBloqueados(
    clientes.map((c) => c.id),
    mes,
  );

  return (
    <div className="space-y-6">
      <CabecalhoCampanhas
        migalhas={[{ label: "Relatórios" }]}
        titulo="Relatórios"
        descricao="Escolha um cliente para ver os relatórios já gerados."
      />

      <ListaClientes
        clientes={clientes}
        nichos={nichos}
        vazio="Nenhum cliente cadastrado. Cadastre um cliente para gerar relatórios."
        iconeVazio={<FileText className="size-8 text-dim/50" aria-hidden="true" />}
        hrefBase="/relatorios"
        hrefLabel="Ver relatórios"
        bloqueados={[...bloqueados]}
        bloqueioLabel={`Sem parcela de ${nomeDoMes(mes)}`}
      />
    </div>
  );
}