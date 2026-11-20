import path from "node:path";

/**
 * Pasta de arquivos enviados (logotipo da marca).
 *
 * O banco fica no Postgres; só uploads precisam de disco. No build
 * **standalone** o cwd é `.next/standalone`, então o deploy passa
 * `DATA_DIR=/data` (volume) para os arquivos ficarem fora do código —
 * atualizar o sistema não apaga o que o cliente enviou.
 */
export const DATA_DIR =
  process.env.DATA_DIR ?? path.join(process.cwd(), "data");

export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
