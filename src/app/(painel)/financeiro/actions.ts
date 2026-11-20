"use server";

import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { currentUserHasPermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import {
  clients,
  contracts,
  financeEntries,
  financePayments,
  FINANCE_KINDS,
  FINANCE_PAYMENT_METHODS,
} from "@/lib/db/schema";
import { parseMoney } from "@/lib/format/masks";
import { vencimentoDaMensalidade } from "./comum";

export type FinanceState = { ok?: boolean; message?: string; erro?: string };

const dataIso = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.");

const lancamentoSchema = z.object({
  kind: z.enum(FINANCE_KINDS),
  clientId: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v > 0), "Cliente inválido."),
  description: z
    .string()
    .trim()
    .min(2, "Informe a descrição.")
    .max(160, "Descrição muito longa."),
  category: z.string().trim().min(1, "Informe a categoria.").max(60),
  amount: z.number().int().positive("Informe um valor maior que zero."),
  dueDate: dataIso,
  paidAt: z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data de pagamento inválida."),
  notes: z
    .string()
    .trim()
    .max(2000, "Observações muito longas.")
    .optional()
    .transform((v) => (v ? v : null)),
});

function dadosDoFormulario(formData: FormData) {
  return lancamentoSchema.safeParse({
    kind: formData.get("kind") ?? "receita",
    clientId: formData.get("clientId") ?? "",
    description: formData.get("description") ?? "",
    category: formData.get("category") ?? "",
    amount: parseMoney(String(formData.get("amount") ?? "")),
    dueDate: formData.get("dueDate") ?? "",
    paidAt: formData.get("paidAt") ?? "",
    notes: formData.get("notes") ?? "",
  });
}

function refresh() {
  revalidatePath("/financeiro");
  revalidatePath("/painel");
}

export async function createFinanceEntryAction(
  _estado: FinanceState,
  formData: FormData,
): Promise<FinanceState> {
  if (!(await currentUserHasPermission("financeiro", "create"))) {
    return { erro: "Você não tem permissão para criar lançamentos." };
  }

  const parsed = dadosDoFormulario(formData);
  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  db.insert(financeEntries).values(parsed.data).run();
  refresh();
  return { ok: true, message: "Lançamento criado." };
}

export async function updateFinanceEntryAction(
  _estado: FinanceState,
  formData: FormData,
): Promise<FinanceState> {
  if (!(await currentUserHasPermission("financeiro", "edit"))) {
    return { erro: "Você não tem permissão para editar lançamentos." };
  }

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { erro: "Lançamento não encontrado." };

  const parsed = dadosDoFormulario(formData);
  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  db.update(financeEntries)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(financeEntries.id, id))
    .run();
  refresh();
  return { ok: true, message: "Lançamento atualizado." };
}

export async function excluirLancamentoAction(id: number): Promise<FinanceState> {
  if (!(await currentUserHasPermission("financeiro", "delete"))) {
    return { erro: "Você não tem permissão para excluir lançamentos." };
  }

  db.delete(financeEntries).where(eq(financeEntries.id, id)).run();
  refresh();
  return { ok: true, message: "Lançamento excluído." };
}

/* ------------------------------------------------------------------ */
/* Baixas (pagamentos) e estornos                                      */
/* ------------------------------------------------------------------ */

const baixaSchema = z.object({
  entryId: z.number().int().positive("Lançamento inválido."),
  /** Centavos; 0 = pagamento integral (o restante). */
  amount: z.number().int().min(0, "Valor inválido."),
  paidOn: dataIso,
  method: z.enum(FINANCE_PAYMENT_METHODS, {
    message: "Informe o meio de pagamento.",
  }),
  notes: z
    .string()
    .trim()
    .max(2000, "Observações muito longas.")
    .optional()
    .transform((v) => (v ? v : null)),
});

/** Quanto já foi baixado (baixas válidas) de um lançamento. */
function totalBaixado(entryId: number): number {
  return db
    .select()
    .from(financePayments)
    .where(and(eq(financePayments.entryId, entryId), isNull(financePayments.reversedAt)))
    .all()
    .reduce((total, b) => total + b.amount, 0);
}

/**
 * Dá baixa em um lançamento. Valor vazio/zero significa "o restante" (pagamento
 * integral). Baixar mais do que o saldo é recusado.
 */
export async function baixarLancamentoAction(
  input: unknown,
): Promise<FinanceState> {
  if (!(await currentUserHasPermission("financeiro", "edit"))) {
    return { erro: "Você não tem permissão para dar baixa." };
  }

  const parsed = baixaSchema.safeParse(input);
  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const lancamento = db
    .select()
    .from(financeEntries)
    .where(eq(financeEntries.id, parsed.data.entryId))
    .get();
  if (!lancamento) return { erro: "Lançamento não encontrado." };

  const saldo = lancamento.amount - totalBaixado(lancamento.id);
  if (saldo <= 0) return { erro: "Este lançamento já está quitado." };

  const valor = parsed.data.amount > 0 ? parsed.data.amount : saldo;
  if (valor > saldo) {
    return { erro: "O valor informado é maior que o saldo em aberto." };
  }

  db.insert(financePayments)
    .values({
      entryId: lancamento.id,
      amount: valor,
      paidOn: parsed.data.paidOn,
      method: parsed.data.method,
      notes: parsed.data.notes,
    })
    .run();
  refresh();
  return {
    ok: true,
    message: valor === saldo ? "Baixa integral registrada." : "Baixa parcial registrada.",
  };
}

/** Estorna uma baixa: a linha fica no histórico, marcada como estornada. */
export async function estornarBaixaAction(baixaId: number): Promise<FinanceState> {
  if (!(await currentUserHasPermission("financeiro", "edit"))) {
    return { erro: "Você não tem permissão para estornar pagamentos." };
  }

  const baixa = db
    .select()
    .from(financePayments)
    .where(eq(financePayments.id, baixaId))
    .get();
  if (!baixa) return { erro: "Baixa não encontrada." };
  if (baixa.reversedAt) return { erro: "Esta baixa já foi estornada." };

  db.update(financePayments)
    .set({ reversedAt: new Date().toISOString().slice(0, 10) })
    .where(eq(financePayments.id, baixaId))
    .run();
  refresh();
  return { ok: true, message: "Pagamento estornado." };
}

type ContratoCobravel = {
  id: number;
  clientId: number;
  nome: string;
  inicio: string;
  dueDay: number | null;
  valor: number;
};

/**
 * Lança a mensalidade de um contrato no mês. Devolve `false` quando não há o
 * que gerar (valor zero, contrato sem dia de vencimento ou já lançado).
 */
function lancarMensalidade(contrato: ContratoCobravel, mes: string): boolean {
  // Valor zero é gerado do mesmo jeito: a parcela existe (e libera o acesso),
  // só não soma no financeiro.
  // Sem dia de vencimento definido o contrato não entra em cobrança — quem
  // garante a data é o cadastro, não um palpite do sistema.
  if (!contrato.dueDay) return false;

  const existente = db
    .select({ id: financeEntries.id })
    .from(financeEntries)
    .where(
      and(
        eq(financeEntries.contractId, contrato.id),
        eq(financeEntries.competence, mes),
      ),
    )
    .get();
  if (existente) return false;

  db.insert(financeEntries)
    .values({
      kind: "receita",
      clientId: contrato.clientId,
      contractId: contrato.id,
      description: `Mensalidade ${mes} — ${contrato.nome}`,
      category: "Mensalidade",
      amount: contrato.valor,
      dueDate: vencimentoDaMensalidade(contrato.inicio, mes, contrato.dueDay),
      competence: mes,
    })
    .run();
  return true;
}

/** Contratos ativos que podem entrar na cobrança do mês. */
function contratosCobraveis(): ContratoCobravel[] {
  return db
    .select({
      id: contracts.id,
      clientId: contracts.clientId,
      nome: contracts.name,
      inicio: contracts.startDate,
      dueDay: contracts.dueDay,
      valor: contracts.monthlyValue,
    })
    .from(contracts)
    .innerJoin(clients, eq(clients.id, contracts.clientId))
    .where(
      and(
        eq(contracts.status, "active"),
        eq(clients.active, true),
        isNotNull(contracts.dueDay),
      ),
    )
    .all();
}

/**
 * Gera a mensalidade de cada contrato ativo para o mês escolhido, no dia de
 * vencimento cadastrado no contrato.
 */
export async function gerarCobrancasAction(mes: string): Promise<
  FinanceState & { criadas?: number; puladas?: number }
> {
  if (!(await currentUserHasPermission("financeiro", "create"))) {
    return { erro: "Você não tem permissão para gerar cobranças." };
  }
  if (!/^\d{4}-\d{2}$/.test(mes)) return { erro: "Mês inválido." };

  const ativos = contratosCobraveis();
  let criadas = 0;
  let puladas = 0;

  for (const contrato of ativos) {
    if (lancarMensalidade(contrato, mes)) criadas += 1;
    else puladas += 1;
  }

  refresh();
  if (criadas === 0) {
    return { ok: true, criadas, puladas, message: "Nenhuma cobrança nova para gerar." };
  }
  return {
    ok: true,
    criadas,
    puladas,
    message: `${criadas} ${criadas === 1 ? "cobrança gerada" : "cobranças geradas"}.`,
  };
}

/** Gera a mensalidade de um único contrato — botão de cada linha do painel. */
export async function gerarCobrancaDoContratoAction(
  contratoId: number,
  mes: string,
): Promise<FinanceState> {
  if (!(await currentUserHasPermission("financeiro", "create"))) {
    return { erro: "Você não tem permissão para gerar cobranças." };
  }
  if (!/^\d{4}-\d{2}$/.test(mes)) return { erro: "Mês inválido." };

  const contrato = contratosCobraveis().find((c) => c.id === contratoId);
  if (!contrato) {
    return {
      erro: "Contrato sem dia de vencimento definido não pode ser cobrado.",
    };
  }

  if (!lancarMensalidade(contrato, mes)) {
    return { erro: "Esta cobrança já foi gerada." };
  }

  refresh();
  return { ok: true, message: "Cobrança gerada." };
}

