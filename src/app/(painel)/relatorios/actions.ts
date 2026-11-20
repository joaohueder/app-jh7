"use server";

import { randomBytes } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { currentUserHasPermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { clients, reports } from "@/lib/db/schema";
import { gerarSnapshotRelatorio } from "@/lib/meta/relatorio";

export type RelatorioState = { ok?: boolean; message?: string; erro?: string };

const dataIso = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe as datas de início e fim.");

const novoSchema = z
  .object({
    clientId: z.number().int().positive(),
    inicio: dataIso,
    fim: dataIso,
  })
  .refine((d) => d.inicio <= d.fim, {
    message: "A data de início precisa ser anterior ou igual à data de fim.",
    path: ["fim"],
  });

/** Token curto e opaco usado na URL pública /r/<token>. */
function novoToken(): string {
  return randomBytes(9).toString("base64url");
}

export async function criarRelatorioAction(
  _estado: RelatorioState,
  formData: FormData,
): Promise<RelatorioState> {
  if (!(await currentUserHasPermission("relatorios", "create"))) {
    return { erro: "Você não tem permissão para gerar relatórios." };
  }

  const parsed = novoSchema.safeParse({
    clientId: Number(formData.get("clientId")),
    inicio: String(formData.get("inicio") ?? ""),
    fim: String(formData.get("fim") ?? ""),
  });
  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const cliente = db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.id, parsed.data.clientId))
    .get();
  if (!cliente) return { erro: "Cliente não encontrado." };

  // Consulta a Meta só aqui, na geração; a página pública lê este snapshot.
  const gerado = await gerarSnapshotRelatorio(
    parsed.data.clientId,
    parsed.data.inicio,
    parsed.data.fim,
  );
  if (!gerado.ok) return { erro: gerado.message };

  db.insert(reports)
    .values({
      clientId: parsed.data.clientId,
      startDate: parsed.data.inicio,
      endDate: parsed.data.fim,
      token: novoToken(),
      data: JSON.stringify(gerado.snapshot),
    })
    .run();

  revalidatePath(`/relatorios/${parsed.data.clientId}`);
  return { ok: true, message: "Relatório gerado." };
}

/**
 * Refaz a consulta à Meta mantendo id, token e link: o cliente continua
 * abrindo a mesma URL e vê os números atualizados.
 */
export async function regerarRelatorioAction(
  clientId: number,
  reportId: number,
): Promise<RelatorioState> {
  if (!(await currentUserHasPermission("relatorios", "create"))) {
    return { erro: "Você não tem permissão para gerar relatórios." };
  }

  const atual = db
    .select()
    .from(reports)
    .where(and(eq(reports.id, reportId), eq(reports.clientId, clientId)))
    .get();
  if (!atual) return { erro: "Relatório não encontrado." };

  const gerado = await gerarSnapshotRelatorio(
    atual.clientId,
    atual.startDate,
    atual.endDate,
  );
  if (!gerado.ok) return { erro: gerado.message };

  db.update(reports)
    .set({ data: JSON.stringify(gerado.snapshot) })
    .where(eq(reports.id, reportId))
    .run();

  revalidatePath(`/relatorios/${clientId}`);
  revalidatePath(`/r/${atual.token}`);
  return { ok: true, message: "Relatório atualizado." };
}

export async function excluirRelatorioAction(
  clientId: number,
  reportId: number,
): Promise<RelatorioState> {
  if (!(await currentUserHasPermission("relatorios", "delete"))) {
    return { erro: "Você não tem permissão para excluir relatórios." };
  }

  db.delete(reports)
    .where(and(eq(reports.id, reportId), eq(reports.clientId, clientId)))
    .run();

  revalidatePath(`/relatorios/${clientId}`);
  return { ok: true, message: "Relatório excluído." };
}

