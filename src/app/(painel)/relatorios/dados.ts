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
export function listarRelatorios(clientId: number): RelatorioListaItem[] {
  return db
    .select()
    .from(reports)
    .where(eq(reports.clientId, clientId))
    .orderBy(desc(reports.id))
    .all()
    .map((r) => ({
      id: r.id,
      inicio: r.startDate,
      fim: r.endDate,
      token: r.token,
      criadoEm: r.createdAt,
    }));
}