import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

/**
 * Conexão única com o Postgres.
 *
 * `DATABASE_URL` é a fonte do endereço (formato
 * postgres://usuario:senha@host:porta/banco). Sem ela, aponta para o Postgres
 * local do docker-compose.
 *
 * A escolha entre IP público e hostname interno do provedor acontece **antes**
 * de o servidor carregar (ver `scripts/start.mjs`): aquele módulo testa o
 * endereço e reescreve `DATABASE_URL` com o que respondeu. Aqui só se lê o
 * resultado — diferente de tentar trocar o pool em tempo de execução, o que o
 * Drizzle não suporta (a instância guarda a referência original).
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
  const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 10,
    // Porta bloqueada por firewall pendura o TCP por ~2min e o app parece
    // "no ar mas sem responder". 8s basta para um banco na mesma região.
    connectionTimeoutMillis: 8_000,
  });
  globalForDb.__jh7Pool = pool;

  // Erro de pool sem handler derruba o processo Node inteiro e o proxy passa a
  // responder 502 sem log. Logar aqui mantém o motivo visível.
  pool.on("error", (erro) => {
    console.error("[db] erro no pool de conexões:", erro.message);
  });

  return drizzle(pool, { schema });
}

export const db: DbInstance = globalForDb.__jh7Db ?? createDb();

/** Pool cru, para scripts que precisam encerrar o processo (`pool.end()`). */
export const pool = globalForDb.__jh7Pool!;

if (process.env.NODE_ENV !== "production") {
  globalForDb.__jh7Db = db;
}

/** Host do banco em uso, sem credenciais — usado pelo `/health`. */
export function hostDoBanco(): string {
  try {
    return new URL(DATABASE_URL).host;
  } catch {
    return "(DATABASE_URL inválida)";
  }
}

export { schema };