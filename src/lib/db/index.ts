import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

import { DATA_DIR } from "@/lib/paths";
import * as schema from "./schema";

export const DB_PATH = process.env.DB_PATH ?? path.join(DATA_DIR, "jh7.db");

mkdirSync(path.dirname(DB_PATH), { recursive: true });

type DbInstance = BetterSQLite3Database<typeof schema>;

const globalForDb = globalThis as unknown as {
  __jh7Db?: DbInstance;
  __jh7Client?: Database.Database;
};

function createDb(): DbInstance {
  const client = new Database(DB_PATH);
  client.pragma("journal_mode = WAL");
  client.pragma("foreign_keys = ON");
  globalForDb.__jh7Client = client;
  return drizzle(client, { schema });
}

/**
 * Instância única do banco. Fica em globalThis para sobreviver ao
 * hot-reload do `next dev` no Windows (evita travar o arquivo .db).
 */
export const db: DbInstance = globalForDb.__jh7Db ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__jh7Db = db;
}

export { schema };
