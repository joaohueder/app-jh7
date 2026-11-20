/**
 * Compila durante o `npm ci`.
 *
 * Por que aqui e não no `start`: o painel executa `npm ci` → inicia o app →
 * roda o smoke test alguns segundos depois. Se o build acontecesse no `start`,
 * o smoke test encontraria a porta fechada durante os ~1-2 min de compilação e
 * aplicaria rollback — mesmo com o app perfeito.
 *
 * Colocando o build no `postinstall`, o `npm ci` só termina quando o pacote
 * standalone existe: quando o app sobe, ele sobe pronto.
 *
 * Guardas:
 * - `src/` ausente = estágio `deps` do Dockerfile, que só tem package.json e
 *   ainda não copiou o código → não há o que compilar, sai sem erro.
 * - Pacote já presente = nada a fazer (reinstalação local não recompila).
 * - `SKIP_BUILD=1` desliga explicitamente.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const raiz = process.cwd();

if (process.env.SKIP_BUILD === "1") {
  console.log("[postinstall] SKIP_BUILD=1 — build ignorado");
  process.exit(0);
}

const temCodigo = existsSync(path.join(raiz, "src"));
const pacote = existsSync(path.join(raiz, ".next", "standalone", "server.js"));

if (!temCodigo) {
  console.log("[postinstall] sem src/ (estágio de dependências) — build ignorado");
  process.exit(0);
}

if (pacote) {
  console.log("[postinstall] pacote standalone já existe — build ignorado");
  process.exit(0);
}

console.log("[postinstall] compilando o app (npm run build)...");
const resultado = spawnSync("npm", ["run", "build"], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

if (resultado.status !== 0) {
  console.error("[postinstall] o build falhou — o deploy não vai subir corretamente.");
  process.exit(resultado.status ?? 1);
}