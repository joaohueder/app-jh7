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
import { spawn } from "node:child_process";
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
 * que copia public/, .next/static, drizzle/ e .env.production). stdio "inherit"
 * para o log do painel mostrar cada linha.
 *
 * Assíncrono (`spawn`, não `spawnSync`): o build leva ~1 min e bloquear o event
 * loop impediria o servidor provisório de aceitar conexão enquanto isso.
 */
function construir() {
  console.log("[start] pacote standalone ausente — rodando `npm run build`...");
  return new Promise((resolver) => {
    const filho = spawn("npm", ["run", "build"], {
      stdio: "inherit",
      env: process.env,
      shell: process.platform === "win32",
    });
    filho.on("error", (erro) => {
      console.error("[start] não foi possível executar o build:", erro.message);
      resolver(false);
    });
    filho.on("exit", (codigo) => {
      if (codigo !== 0) {
        console.error(
          "[start] o build falhou. Rode `npm run build` manualmente para ver o erro completo.",
        );
      }
      resolver(codigo === 0);
    });
  });
}

// O smoke test do painel dispara poucos segundos após "Iniciando aplicação".
// Com o build pendente ele encontraria a porta fechada e aplicaria rollback.
// Um servidor mínimo na porta já responde `/health` como "preparando" (503)
// enquanto o build roda — o proxy devolve resposta em vez de recusar conexão.
const precisaBuild = !existsSync(pacote) && !existsSync(local);
let provisorio = null;

if (precisaBuild) {
  const { createServer } = await import("node:http");
  provisorio = createServer((_req, res) => {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, estado: "build em andamento" }));
  });
  provisorio.listen(Number(process.env.PORT), "0.0.0.0", () => {
    console.log(`[start] build em andamento — respondendo 503 na porta ${process.env.PORT}`);
  });
  provisorio.on("error", () => {
    // Porta ocupada: o build ainda pode terminar; não impede o fluxo.
    provisorio = null;
  });

  const montou = await construir();
  if (!montou) {
    provisorio?.close();
    process.exit(1);
  }
}

const alvo = [pacote, local].find((arquivo) => existsSync(arquivo));
if (!alvo) {
  console.error(
    "[start] build terminou mas .next/standalone/server.js não foi gerado. " +
      "Confira se next.config.ts tem `output: \"standalone\"`.",
  );
  provisorio?.close();
  process.exit(1);
}

// Libera a porta para o servidor real do Next.
if (provisorio) {
  await new Promise((resolver) => provisorio.close(resolver));
  provisorio = null;
}

// O server.js faz `process.chdir(__dirname)` e lê o ambiente de lá; variáveis
// já definidas aqui continuam valendo.
await import(pathToFileURL(alvo).href);