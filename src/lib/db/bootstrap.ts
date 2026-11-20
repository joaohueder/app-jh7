import { count, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

import { db } from "./index";
import {
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  settings,
  users,
} from "./schema";

/**
 * Primeiro acesso em produção.
 *
 * O `scripts/seed.ts` precisa de tsx/drizzle-kit, que não existem no pacote
 * standalone. Então o próprio servidor cria o administrador na primeira subida
 * a partir de ADMIN_NAME/ADMIN_EMAIL/ADMIN_PASSWORD.
 *
 * Só cria quando a tabela de usuários está vazia — nunca sobrescreve senha de
 * quem já existe. Para redefinir, use a tela de Usuários.
 */
export async function garantirAdministrador(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const senha = process.env.ADMIN_PASSWORD;

  if (!email || !senha) {
    console.warn("[db] ADMIN_EMAIL/ADMIN_PASSWORD ausentes: nenhum administrador será criado.");
    return;
  }

  const [linha] = await db.select({ total: count() }).from(users);
  if ((linha?.total ?? 0) > 0) return;

  const permissions = Object.fromEntries(
    PERMISSION_MODULES.map((modulo) => [modulo, [...PERMISSION_ACTIONS]]),
  );

  const passwordHash = await bcrypt.hash(senha, 12);
  const [criado] = await db
    .insert(users)
    .values({
      name: process.env.ADMIN_NAME?.trim() || "Administrador",
      email,
      passwordHash,
      role: "admin",
      permissions,
      active: true,
    })
    .returning();

  console.log(`[db] administrador criado: ${criado.email}`);
}

/** Configurações padrão que a UI espera encontrar. */
export async function garantirConfiguracoes(): Promise<void> {
  const padroes: Record<string, string> = {
    system_name: "JH7 Marketing",
    logo_path: "",
  };

  for (const [key, value] of Object.entries(padroes)) {
    const [existe] = await db
      .select({ key: settings.key })
      .from(settings)
      .where(eq(settings.key, key));
    if (!existe) await db.insert(settings).values({ key, value });
  }
}