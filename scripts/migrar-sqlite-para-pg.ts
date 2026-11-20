/**
 * Copia os dados do SQLite local (`data/jh7.db`) para o Postgres.
 *
 * Uso:
 *   DATABASE_URL=postgres://... npx tsx scripts/migrar-sqlite-para-pg.ts
 *
 * Preserva os ids (o app referencia cliente/contrato por número) e no fim
 * avança as sequences, senão o próximo INSERT colide. Idempotente: limpa o
 * destino antes de copiar, então rodar de novo substitui em vez de duplicar.
 *
 * Datas: no SQLite eram epoch em segundos (`created_at`, `updated_at`) e epoch
 * em ms (`meta_cache.updated_at`); aqui viram `timestamptz` e `bigint`.
 */
import "dotenv/config";
import Database from "better-sqlite3";
import path from "node:path";

import { garantirMigracoes } from "../src/lib/db/migrate";

const ORIGEM =
  process.env.SQLITE_PATH ?? path.join(process.cwd(), "data", "jh7.db");

/** Na ordem que respeita as FKs (pais primeiro). */
const TABELAS = [
  "users",
  "settings",
  "niches",
  "clients",
  "client_ad_accounts",
  "client_addresses",
  "contracts",
  "contract_ad_accounts",
  "client_notes",
  "reports",
  "finance_entries",
  "finance_payments",
  "meta_cache",
] as const;

const BOOLEANAS = new Set(["active"]);
const JSONB = new Set(["permissions"]);

function converter(tabela: string, coluna: string, valor: unknown): unknown {
  if (valor === null || valor === undefined) return null;
  // ms: já é número de milissegundos no SQLite e continua bigint no Postgres.
  if (tabela === "meta_cache" && coluna === "updated_at") return Number(valor);
  if (BOOLEANAS.has(coluna)) return valor ? 1 : 0;
  // created_at/updated_at: epoch em segundos → Date.
  if ((coluna === "created_at" || coluna === "updated_at") && typeof valor === "number") {
    return new Date(valor * 1000);
  }
  if (JSONB.has(coluna) && typeof valor === "string") {
    try {
      return JSON.parse(valor);
    } catch {
      return {};
    }
  }
  return valor;
}

async function main() {
  const origem = new Database(ORIGEM, { readonly: true });
  const { pool } = await import("../src/lib/db");
  await garantirMigracoes();

  // Limpa na ordem inversa (filhos primeiro).
  for (const tabela of [...TABELAS].reverse()) {
    await pool.query(`delete from "${tabela}"`);
  }

  for (const tabela of TABELAS) {
    const linhas = origem
      .prepare(`select * from "${tabela}"`)
      .all() as Record<string, unknown>[];

    if (linhas.length === 0) {
      console.log(`${tabela}: vazia`);
      continue;
    }

    const colunas = Object.keys(linhas[0]);
    const nomes = colunas.map((c) => `"${c}"`).join(", ");
    const marcadores = colunas.map((_, i) => `$${i + 1}`).join(", ");
    const insert = `insert into "${tabela}" (${nomes}) values (${marcadores})`;

    for (const linha of linhas) {
      await pool.query(
        insert,
        colunas.map((c) => converter(tabela, c, linha[c])),
      );
    }
    console.log(`${tabela}: ${linhas.length}`);
  }

  // Avança as sequences das colunas identity para o maior id copiado.
  for (const tabela of TABELAS) {
    const temId = (
      origem.prepare(`pragma table_info("${tabela}")`).all() as { name: string }[]
    ).some((c) => c.name === "id");
    if (!temId) continue;
    await pool.query(
      `select setval(pg_get_serial_sequence('"${tabela}"', 'id'),
                     coalesce((select max(id) from "${tabela}"), 1))`,
    );
  }

  origem.close();
  await pool.end();
  console.log("Migração concluída.");
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});