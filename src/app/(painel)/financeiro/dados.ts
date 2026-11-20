import { and, asc, eq, gte, isNull, lte } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  clients,
  financeEntries,
  financePayments,
  FINANCE_PAYMENT_LABELS,
  type FinanceKind,
  type FinancePaymentMethod,
} from "@/lib/db/schema";
import {
  intervaloDoMes,
  situacaoDoLancamento,
  type Baixa,
  type Lancamento,
  type ResumoFinanceiro,
} from "./comum";

/** Baixas válidas (não estornadas) de um lançamento, mais recentes primeiro. */
export function listarBaixas(entryId: number): Baixa[] {
  return db
    .select()
    .from(financePayments)
    .where(eq(financePayments.entryId, entryId))
    .orderBy(asc(financePayments.paidOn), asc(financePayments.id))
    .all()
    .map((b) => ({
      id: b.id,
      valor: b.amount,
      data: b.paidOn,
      meio: b.method,
      meioLabel:
        FINANCE_PAYMENT_LABELS[b.method as FinancePaymentMethod] ?? b.method,
      observacoes: b.notes,
      estornadaEm: b.reversedAt,
    }));
}

/** Quanto está baixado por lançamento: soma das baixas válidas. */
function somasPorLancamento(): Map<number, { total: number; ultima: string | null }> {
  const mapa = new Map<number, { total: number; ultima: string | null }>();
  const linhas = db
    .select()
    .from(financePayments)
    .where(isNull(financePayments.reversedAt))
    .all();

  for (const linha of linhas) {
    const atual = mapa.get(linha.entryId) ?? { total: 0, ultima: null };
    atual.total += linha.amount;
    if (!atual.ultima || linha.paidOn > atual.ultima) atual.ultima = linha.paidOn;
    mapa.set(linha.entryId, atual);
  }
  return mapa;
}

/**
 * Lançamentos do mês escolhido + os que ainda têm saldo de meses anteriores,
 * `para a inadimplência não sumir ao trocar de mês.
 */
export function listarLancamentos(mes: string, hoje: string): Lancamento[] {
  const { inicio, fim } = intervaloDoMes(mes);
  const somas = somasPorLancamento();

  return db
    .select({
      id: financeEntries.id,
      kind: financeEntries.kind,
      clientId: financeEntries.clientId,
      cliente: clients.businessName,
      descricao: financeEntries.description,
      categoria: financeEntries.category,
      valor: financeEntries.amount,
      vencimento: financeEntries.dueDate,
      observacoes: financeEntries.notes,
      contratoId: financeEntries.contractId,
    })
    .from(financeEntries)
    .leftJoin(clients, eq(clients.id, financeEntries.clientId))
    // Sem filtro de data no SQL: o volume é pequeno e a regra depende do que
    // já foi baixado (parcela antiga some só quando quita).
    .where(gte(financeEntries.dueDate, "0000-00-00"))
    .orderBy(asc(financeEntries.dueDate), asc(financeEntries.id))
    .all()
    .map((linha) => {
      const soma = somas.get(linha.id);
      const { status, baixado, saldo } = situacaoDoLancamento(
        linha.valor,
        soma?.total ?? 0,
        linha.vencimento,
        hoje,
      );
      return {
        id: linha.id,
        kind: linha.kind as FinanceKind,
        clientId: linha.clientId,
        cliente: linha.cliente,
        descricao: linha.descricao,
        categoria: linha.categoria,
        valor: linha.valor,
        vencimento: linha.vencimento,
        pagoEm: soma?.ultima ?? null,
        status,
        baixado,
        saldo,
        observacoes: linha.observacoes,
        doContrato: linha.contratoId !== null,
      };
    })
    // Dentro do mês entra tudo; fora dele, só quem ainda tem saldo.
    .filter((l) => l.vencimento <= fim && (l.vencimento >= inicio || l.saldo > 0));
}

export function resumoFinanceiro(mes: string, hoje: string): ResumoFinanceiro {
  const lancamentos = listarLancamentos(mes, hoje);
  const { inicio, fim } = intervaloDoMes(mes);
  const doMes = (l: Lancamento) => l.vencimento >= inicio && l.vencimento <= fim;

  // Recebido/pago contam a baixa, não o vencimento: o dinheiro do mês é o que
  // entrou, mesmo que a parcela fosse de outro mês.
  const baixasDoMes = db
    .select()
    .from(financePayments)
    .where(
      and(
        isNull(financePayments.reversedAt),
        gte(financePayments.paidOn, inicio),
        lte(financePayments.paidOn, fim),
      ),
    )
    .all();

  const somaBaixas = (kind: FinanceKind) => {
    const ids = new Set(
      lancamentos.filter((l) => l.kind === kind).map((l) => l.id),
    );
    return baixasDoMes
      .filter((b) => ids.has(b.entryId))
      .reduce((total, b) => total + b.amount, 0);
  };

  const aReceber = lancamentos
    .filter((l) => l.kind === "receita" && doMes(l))
    .reduce((total, l) => total + l.saldo, 0);
  const recebido = somaBaixas("receita");
  const despesas = lancamentos
    .filter((l) => l.kind === "despesa" && doMes(l))
    .reduce((total, l) => total + l.valor, 0);
  const pago = somaBaixas("despesa");
  const vencido = lancamentos
    .filter((l) => l.kind === "receita" && l.vencimento < hoje)
    .reduce((total, l) => total + l.saldo, 0);

  return { aReceber, recebido, despesas, pago, vencido, saldo: recebido - pago };
}

/** Opções de cliente para o formulário. */
export function listarClientesParaLancamento(): { id: number; nome: string }[] {
  return db
    .select({ id: clients.id, nome: clients.businessName })
    .from(clients)
    .orderBy(asc(clients.businessName))
    .all();
}