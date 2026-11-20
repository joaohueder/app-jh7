import path from "node:path";

/**
 * Pasta de dados (banco e uploads).
 *
 * Em `next dev`/`next start` o cwd é a raiz do projeto e o padrão (`./data`)
 * já aponta para o lugar certo. No build **standalone** o cwd é
 * `.next/standalone`, então o deploy passa `DATA_DIR=/var/lib/jh7` para o dado
 * ficar fora da pasta do código — atualizar o sistema não toca no banco.
 *
 * Ser a única fonte do caminho evita o clássico "banco em um lugar, logo em
 * outro" depois de um deploy.
 */
export const DATA_DIR =
  process.env.DATA_DIR ?? path.join(process.cwd(), "data");

export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");