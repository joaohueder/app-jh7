import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { reports } from "@/lib/db/schema";

export type RelatorioListaItem = {
  id: number;
  inicio: string;
  fim: string;
  token: string;
  criadoEm: Date;
};

/** Relatórios de um cliente, mais recentes primeiro. */
export async function listarRelatorios(
  clientId: number,
): Promise<RelatorioListaItem[]> {
  const linhas = await db
    .select()
    .from(reports)
    .where(eq(reports.clientId, clientId))
    .orderBy(desc(reports.id));

  return linhas.map((r) => ({
      id: r.id,
      inicio: r.startDate,
      fim: r.endDate,
      token: r.token,
      criadoEm: r.createdAt,
    }));
}