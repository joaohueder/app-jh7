import { existsSync } from "node:fs";
import path from "node:path";

import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { db } from "./index";

/**
 * Aplica as migrações pendentes na subida do processo.
 *
 * No standalone não existe `drizzle-kit` (é devDependency) e o servidor não
 * tem como rodar `npm run db:migrate`. O próprio app aplica o que falta: o
 * Drizzle controla o que já rodou pela tabela `__drizzle_migrations`, então
 * chamar em todo boot é seguro e idempotente.
 *
 * A pasta `drizzle/` precisa ir junto no pacote. `MIGRATIONS_DIR` permite
 * apontar para fora; sem ela, procura `./drizzle` ao lado do `server.js`.
 */
const PASTA = process.env.MIGRATIONS_DIR ?? path.join(process.cwd(), "drizzle");

let aplicadas = false;

export function garantirMigracoes(): void {
  if (aplicadas) return;
  aplicadas = true;

  // Sem a pasta (ex.: dev sem migrações geradas), não derruba o servidor.
  if (!existsSync(path.join(PASTA, "meta", "_journal.json"))) {
    console.warn(`[db] pasta de migrações não encontrada em ${PASTA}`);
    return;
  }

  try {
    migrate(db, { migrationsFolder: PASTA });
  } catch (erro) {
    // Falhar aqui é melhor do que subir servindo dados inconsistentes, mas o
    // log precisa dizer o que fazer — o processo morre no primeiro request.
    console.error("[db] falha ao aplicar migrações:", erro);
    throw erro;
  }
}