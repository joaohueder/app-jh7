import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

/**
 * Conexão única com o Postgres.
 *
 * `DATABASE_URL` é a fonte do endereço (formato
 * postgres://usuario:senha@host:porta/banco). Sem ela, aponta para o Postgres
 * local do docker-compose. O pool fica em globalThis para o hot-reload do
 * `next dev` não abrir uma conexão nova a cada alteração.
 */
export const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://appjh7:teste@127.0.0.1:55432/appjh7";

type DbInstance = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  __jh7Db?: DbInstance;
  __jh7Pool?: Pool;
};

function createDb(): DbInstance {
  const pool = new Pool({ connectionString: DATABASE_URL, max: 10 });
  globalForDb.__jh7Pool = pool;
  return drizzle(pool, { schema });
}

export const db: DbInstance = globalForDb.__jh7Db ?? createDb();

/** Pool cru, para scripts que precisam encerrar o processo (`pool.end()`). */
export const pool = globalForDb.__jh7Pool!;

if (process.env.NODE_ENV !== "production") {
  globalForDb.__jh7Db = db;
}

export { schema };