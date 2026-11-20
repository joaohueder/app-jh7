/**
 * Sobe o servidor de produção — e constrói o pacote se ele ainda não existir.
 *
 * Dois problemas reais de painel estão resolvidos aqui:
 *
 * 1. **Build ausente.** Alguns painéis rodam `npm ci` e vão direto para o
 *    `start`, sem etapa de build. Sem `.next/standalone` o processo morria com
 *    "server.js não encontrado". Agora o `start` roda o build na primeira vez
 *    (e só quando falta o pacote).
 *
 * 2. **HOSTNAME do container.** Docker define `HOSTNAME` com o ID do container
 *    e o `server.js` do Next faz `process.env.HOSTNAME || '0.0.0.0'`. Escutando
 *    em `abc123def456:3000`, o proxy não conecta e a resposta é 502 sem log.
 *    O `HOSTNAME` é forçado aqui, antes de carregar o servidor.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const raiz = process.cwd();

process.env.NODE_ENV ??= "production";
// Mesma regra do Dockerfile e do painel: escutar em todas as interfaces.
process.env.HOSTNAME = "0.0.0.0";
process.env.PORT ??= "3000";

const pacote = path.join(raiz, ".next", "standalone", "server.js");
const local = path.join(raiz, "server.js");

/**
 * Roda `next build` quando o pacote standalone não existe.
 *
 * `npm run build` em vez de `next build` para o `postbuild` rodar junto (é ele
 * que copia public/, .next/static, drizzle/ e .env.production). herda o stdio
 * para o log do painel mostrar cada linha.
 */
function construir() {
  console.log("[start] pacote standalone ausente — rodando `npm run build`...");
  const resultado = spawnSync("npm", ["run", "build"], {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });
  if (resultado.status !== 0) {
    console.error(
      "[start] o build falhou. Rode `npm run build` manualmente para ver o erro completo.",
    );
    process.exit(resultado.status ?? 1);
  }
}

if (!existsSync(pacote) && !existsSync(local)) construir();

const alvo = [pacote, local].find((arquivo) => existsSync(arquivo));
if (!alvo) {
  console.error(
    "[start] build terminou mas .next/standalone/server.js não foi gerado. " +
      "Confira se next.config.ts tem `output: \"standalone\"`.",
  );
  process.exit(1);
}

// O server.js faz `process.chdir(__dirname)` e lê o ambiente de lá; variáveis
// já definidas aqui continuam valendo.
await import(pathToFileURL(alvo).href);