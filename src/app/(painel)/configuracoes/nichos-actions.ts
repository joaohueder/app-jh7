"use server";

import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { clients, niches } from "@/lib/db/schema";

export type NichoState = { ok?: boolean; error?: string; id?: number };

const nomeSchema = z
  .string()
  .trim()
  .min(2, "O nome do nicho precisa ter pelo menos 2 caracteres.")
  .max(60, "O nome do nicho pode ter no máximo 60 caracteres.");

function revalidar() {
  revalidatePath("/configuracoes");
  revalidatePath("/clientes");
}

/** Nichos em ordem de exibição, com quantos clientes cada um tem. */
export async function listNiches() {
  const todos = await db
    .select()
    .from(niches)
    .orderBy(asc(niches.position), asc(niches.name));
  const vinculos = await db.select({ nicheId: clients.nicheId }).from(clients);

  const porNicho = new Map<number, number>();
  let semNicho = 0;
  for (const v of vinculos) {
    if (v.nicheId === null) semNicho += 1;
    else porNicho.set(v.nicheId, (porNicho.get(v.nicheId) ?? 0) + 1);
  }

  return {
    nichos: todos.map((n) => ({ ...n, clientes: porNicho.get(n.id) ?? 0 })),
    semNicho,
  };
}

export async function createNicheAction(
  _prev: NichoState,
  formData: FormData,
): Promise<NichoState> {
  try {
    await requirePermission("configuracoes", "edit");
    const parsed = nomeSchema.safeParse(formData.get("name"));
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Nome inválido." };
    }

    const [existente] = await db
      .select({ id: niches.id })
      .from(niches)
      .where(eq(niches.name, parsed.data));
    if (existente) return { error: "Já existe um nicho com este nome." };

    // Novo nicho entra no fim da lista.
    const ultimo = await db.select({ position: niches.position }).from(niches);
    const proxima = ultimo.reduce((maior, n) => Math.max(maior, n.position), 0) + 1;

    const [criado] = await db
      .insert(niches)
      .values({ name: parsed.data, position: proxima })
      .returning({ id: niches.id });

    revalidar();
    return { ok: true, id: criado.id };
  } catch {
    return { error: "Não foi possível criar o nicho." };
  }
}

export async function renameNicheAction(
  _prev: NichoState,
  formData: FormData,
): Promise<NichoState> {
  try {
    await requirePermission("configuracoes", "edit");
    const id = Number(formData.get("id"));
    if (!Number.isInteger(id) || id <= 0) return { error: "Nicho inválido." };

    const parsed = nomeSchema.safeParse(formData.get("name"));
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Nome inválido." };
    }

    const [conflito] = await db
      .select({ id: niches.id })
      .from(niches)
      .where(eq(niches.name, parsed.data));
    if (conflito && conflito.id !== id) {
      return { error: "Já existe um nicho com este nome." };
    }

    await db.update(niches)
      .set({ name: parsed.data, updatedAt: new Date() })
      .where(eq(niches.id, id))
      ;

    revalidar();
    return { ok: true, id };
  } catch {
    return { error: "Não foi possível renomear o nicho." };
  }
}

/**
 * Exclui o nicho. A FK é `set null`: os clientes que estavam nele ficam sem
 * nicho em vez de serem apagados junto.
 */
export async function deleteNicheAction(id: number): Promise<NichoState> {
  try {
    await requirePermission("configuracoes", "edit");
    if (!Number.isInteger(id) || id <= 0) return { error: "Nicho inválido." };

    await db.delete(niches).where(eq(niches.id, id));
    revalidar();
    return { ok: true };
  } catch {
    return { error: "Não foi possível excluir o nicho." };
  }
}