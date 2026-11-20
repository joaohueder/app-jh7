import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/auth/permissions";
import { listNiches } from "../configuracoes/nichos-actions";
import { listClients } from "./actions";
import { ClientsClient } from "./clients-client";
export const metadata: Metadata = { title: "Clientes" };
export const dynamic = "force-dynamic";
export default async function ClientesPage() {
  const user = await requirePermission("clientes", "view");
  const clients = await listClients();
  const { nichos } = await listNiches();
  const podeCriar = user.role === "admin" || user.permissions.clientes?.includes("create");
  const podeEditar = user.role === "admin" || user.permissions.clientes?.includes("edit");
  const podeExcluir = user.role === "admin" || user.permissions.clientes?.includes("delete");
  return <div className="space-y-6"><div className="space-y-3"><Link href="/painel" className="inline-flex items-center gap-1.5 text-sm text-dim hover:text-white"><ArrowLeft className="size-4" />Voltar ao painel</Link><div><h1 className="text-2xl font-semibold tracking-tight text-white">Clientes</h1><p className="mt-1 text-sm text-dim">Cadastre clientes e relacione as contas de anúncio que serão usadas.</p></div></div><ClientsClient clients={clients} nichos={nichos} podeCriar={!!podeCriar} podeEditar={!!podeEditar} podeExcluir={!!podeExcluir} /></div>;
}
