import type { Metadata } from "next";

import { requirePermission } from "@/lib/auth/permissions";
import { hojeIso } from "@/lib/format/masks";
import { CabecalhoCampanhas } from "../campanhas/cabecalho";
import { FinanceiroCliente } from "./financeiro-cliente";
import {
  listarBaixas,
  listarClientesParaLancamento,
  listarLancamentos,
  resumoFinanceiro,
} from "./dados";
import { nomeDoMes, normalizarMes } from "./comum";

export const metadata: Metadata = { title: "Financeiro" };
export const dynamic = "force-dynamic";

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const user = await requirePermission("financeiro", "view");
  const params = await searchParams;

  const hoje = hojeIso();
  const mes = normalizarMes(params.mes, hoje);

  const lancamentos = await listarLancamentos(mes, hoje);
  const resumo = await resumoFinanceiro(mes, hoje);
  const clientes = await listarClientesParaLancamento();
  const baixasDoLancamento = Object.fromEntries(
    await Promise.all(
      lancamentos.map(async (l) => [l.id, await listarBaixas(l.id)] as const),
    ),
  );

  const admin = user.role === "admin";
  const permitido = (acao: "create" | "edit" | "delete") =>
    admin || (user.permissions.financeiro?.includes(acao) ?? false);

  return (
    <div className="space-y-6">
      <CabecalhoCampanhas
        migalhas={[{ label: "Financeiro" }]}
        titulo="Financeiro"
        descricao={`Receitas, despesas e vencimentos de ${nomeDoMes(mes).toLowerCase()}.`}
      />

      <FinanceiroCliente
        mes={mes}
        hoje={hoje}
        lancamentos={lancamentos}
        resumo={resumo}
        baixasDoLancamento={baixasDoLancamento}
        clientes={clientes}
        podeCriar={permitido("create")}
        podeEditar={permitido("edit")}
        podeExcluir={permitido("delete")}
      />
    </div>
  );
}