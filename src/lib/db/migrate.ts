import { existsSync } from "node:fs";
import path from "node:path";

import { migrate } from "drizzle-orm/node-postgres/migrator";

import { db } from "./index";

/**
 * Aplica as migrações pendentes na subida do processo.
 *
 * No standalone não existe `drizzle-kit` (é devDependency) e o servidor não
 * tem como rodar `npm run db:migrate`. O próprio app aplica o que falta: o
 * Drizzle controla o que já rodou pela tabela `drizzle.__drizzle_migrations`,
 * então chamar em todo boot é seguro e idempotente.
 *
 * A pasta `drizzle/` precisa ir junto no pacote. `MIGRATIONS_DIR` permite
 * apontar para fora; sem ela, procura `./drizzle` ao lado do `server.js`.
 */
const PASTA = process.env.MIGRATIONS_DIR ?? path.join(process.cwd(), "drizzle");

let aplicando: Promise<boolean> | null = null;

/**
 * Nunca lança: um banco fora do ar **não pode impedir o servidor de subir**.
 *
 * Antes esta função propagava o erro. Chamada do `instrumentation.ts`, isso
 * fazia o Next abortar a preparação e responder **500 em toda rota** — inclusive
 * `/health`, que existe justamente para diagnosticar. Agora a falha fica
 * registrada e é o `/health` (503) e as telas que reportam o problema.
 */
export async function garantirMigracoes(): Promise<boolean> {
  if (!aplicando) aplicando = rodar();
  return aplicando;
}

async function rodar(): Promise<boolean> {
  // Sem a pasta (ex.: dev sem migrações geradas), não derruba o servidor.
  if (!existsSync(path.join(PASTA, "meta", "_journal.json"))) {
    console.warn(`[db] pasta de migrações não encontrada em ${PASTA}`);
    return false;
  }

  try {
    await migrate(db, { migrationsFolder: PASTA });
    console.log("[db] migrações em dia");
    return true;
  } catch (erro) {
    const codigo = (erro as { code?: string }).code ?? "";
    console.error("[db] falha ao aplicar migrações:", erro);
    if (
      ["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN"].includes(codigo) ||
      /timeout|terminated/i.test(String((erro as Error)?.message))
    ) {
      console.error(
        "[db] não foi possível conectar no Postgres em DATABASE_URL. " +
          "Confira host/porta e se a allowlist do banco aceita o IP do servidor. " +
          "O servidor segue no ar; /health reporta o estado do banco.",
      );
    }
    return false;
  }
}