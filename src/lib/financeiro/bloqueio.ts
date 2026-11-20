import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { contracts, financeEntries } from "@/lib/db/schema";

/**
 * Regra de bloqueio do sistema: o cliente só acessa Campanhas e Relatórios se
 * a mensalidade do mês já foi lançada no Financeiro. Cadastro de clientes e o
 * próprio Financeiro continuam liberados para resolver o pendente.
 *
 * Cliente sem contrato ativo **não** é bloqueado — não há cobrança possível, e
 * bloquear para sempre esconderia o cadastro sem oferecer saída.
 */
export type SituacaoCobranca = {
  temContratoAtivo: boolean;
  /** Lançamento de mensalidade do mês já existe. */
  gerada: boolean;
  bloqueado: boolean;
};

export async function situacaoCobranca(
  clientId: number,
  mes: string,
): Promise<SituacaoCobranca> {
  const [contrato] = await db
      .select({ id: contracts.id })
      .from(contracts)
      .where(and(eq(contracts.clientId, clientId), eq(contracts.status, "active")));

  const [lancada] = await db
    .select({ id: financeEntries.id })
    .from(financeEntries)
    .where(
      and(
        eq(financeEntries.clientId, clientId),
        eq(financeEntries.competence, mes),
      ),
    )
    ;

  const temContratoAtivo = Boolean(contrato);

  return {
    temContratoAtivo,
    gerada: Boolean(lancada),
    bloqueado: temContratoAtivo && !lancada,
  };
}

/** Versão para listas: devolve os ids bloqueados de uma vez. */
export async function clientesBloqueados(
  clientIds: number[],
  mes: string,
): Promise<Set<number>> {
  if (clientIds.length === 0) return new Set();

  const comContrato = new Set(
    (await db
      .select({ clientId: contracts.clientId })
      .from(contracts)
      .where(eq(contracts.status, "active")))
      .map((c) => c.clientId),
  );

  const lancados = new Set(
    (await db
      .select({ clientId: financeEntries.clientId })
      .from(financeEntries)
      .where(eq(financeEntries.competence, mes)))
      .map((l) => l.clientId)
      .filter((id): id is number => id !== null),
  );

  return new Set(
    clientIds.filter((id) => comContrato.has(id) && !lancados.has(id)),
  );
}