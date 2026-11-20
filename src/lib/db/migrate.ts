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

let aplicando: Promise<void> | null = null;

export async function garantirMigracoes(): Promise<void> {
  if (aplicando) return aplicando;
  aplicando = rodar();
  return aplicando;
}

async function rodar(): Promise<void> {
  // Sem a pasta (ex.: dev sem migrações geradas), não derruba o servidor.
  if (!existsSync(path.join(PASTA, "meta", "_journal.json"))) {
    console.warn(`[db] pasta de migrações não encontrada em ${PASTA}`);
    return;
  }

  try {
    await migrate(db, { migrationsFolder: PASTA });
    console.log("[db] migrações em dia");
  } catch (erro) {
    // Falhar aqui é melhor do que subir servindo dados inconsistentes, mas o
    // log precisa dizer o que fazer — o processo morre no primeiro request.
    // Em container, erro de conexão aqui é o que deixa o log vazio e o proxy
    // respondendo 502: o motivo real precisa aparecer.
    const codigo = (erro as { code?: string }).code ?? "";
    console.error("[db] falha ao aplicar migrações:", erro);
    if (["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN"].includes(codigo)) {
      console.error(
        "[db] não foi possível conectar no Postgres em DATABASE_URL. " +
          "Confira host/porta e se a allowlist do banco aceita o IP do servidor.",
      );
    }
    throw erro;
  }
}