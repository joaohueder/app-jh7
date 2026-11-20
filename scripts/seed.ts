import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import { db, pool } from "../src/lib/db";
import { settings, users } from "../src/lib/db/schema";
import { ALL_PERMISSIONS } from "../src/lib/auth/permissions";

const ADMIN_NAME = process.env.ADMIN_NAME ?? "João Hueder";
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? "joaohueder@gmail.com")
  .trim()
  .toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "123456";

async function main() {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, ADMIN_EMAIL));

  if (existing) {
    await db
      .update(users)
      .set({
        role: "admin",
        permissions: ALL_PERMISSIONS,
        active: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id));
    console.log(`✓ Usuário ${ADMIN_EMAIL} já existe (id ${existing.id}).`);
  } else {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    const [created] = await db
      .insert(users)
      .values({
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        passwordHash,
        role: "admin",
        permissions: ALL_PERMISSIONS,
        active: true,
      })
      .returning();
    console.log(`✓ Administrador criado: ${created.email} (id ${created.id}).`);
  }

  const defaults: Record<string, string> = {
    system_name: "JH7 Marketing",
    logo_path: "",
  };

  for (const [key, value] of Object.entries(defaults)) {
    const [row] = await db.select().from(settings).where(eq(settings.key, key));
    if (!row) {
      await db.insert(settings).values({ key, value });
      console.log(`✓ Configuração padrão criada: ${key}`);
    }
  }

  console.log("Seed concluído.");
}

main()
  .catch((error) => {
    console.error("Falha no seed:", error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());