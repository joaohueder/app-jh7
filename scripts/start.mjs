/**
 * Sobe o servidor de produção atrás de um proxy que abre a porta na hora.
 *
 * O painel roda `npm ci` → inicia o app → consulta `/health` poucos segundos
 * depois. Se a porta ainda não estiver aberta nesse instante, o smoke test
 * falha com `connection refused` e o deploy é revertido — mesmo quando o app
 * fica perfeito dois segundos depois.
 *
 * Aqui a porta externa (PORT) é aberta **antes de tudo**: enquanto o banco é
 * testado e, se preciso, enquanto o build roda, a resposta é 503 "iniciando".
 * O Next escuta numa porta interna e o proxy repassa. Só quando o Next está
 * aceitando conexões o proxy passa a encaminhar de verdade.
 *
 * Também força `HOSTNAME=0.0.0.0` no filho: Docker define `HOSTNAME` com o ID
 * do container e o server.js do Next usa esse valor, escutando num endereço
 * que o proxy não alcança.
 */
import { spawn } from "node:child_process";
import { createServer, request } from "node:http";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Raiz do runtime.
 *
 * `process.cwd()` não serve: no pacote do painel o `npm start` roda em `/app`
 * enquanto o runtime fica em `/app/app` (se estivesse na raiz, o `npm ci` do
 * painel apagaria o `node_modules`). Mas no repositório este script vive em
 * `scripts/` e a raiz é o diretório acima. Escolhe pelo que existe:
 *
 * - pasta deste script tem `.next/standalone` ou `server.next.js` → ela é a raiz;
 * - senão, a pasta acima (caso do `scripts/start.mjs` no repositório).
 */
function acharRaiz() {
  const aqui = path.dirname(fileURLToPath(import.meta.url));
  const marcas = [".next/standalone/server.next.js", "server.next.js", ".next/BUILD_ID"];
  if (marcas.some((marca) => existsSync(path.join(aqui, marca)))) return aqui;
  if (marcas.some((marca) => existsSync(path.join(path.dirname(aqui), marca)))) {
    return path.dirname(aqui);
  }
  return process.cwd();
}

const raiz = acharRaiz();
console.log(`[start] runtime em ${raiz}`);

process.env.NODE_ENV ??= "production";
process.env.HOSTNAME = "0.0.0.0";

const PORTA_EXTERNA = Number(process.env.PORT ?? 3000);
const PORTA_INTERNA = PORTA_EXTERNA + 1;

const pacote = path.join(raiz, ".next", "standalone", "server.js");
const local = path.join(raiz, "server.js");

let pronto = false;
let estado = "iniciando";

/* ------------------------------------------------------------------ */
/* Porta externa: responde sempre, nunca "connection refused"          */
/* ------------------------------------------------------------------ */

const proxy = createServer((req, res) => {
  if (!pronto) {
    res.writeHead(503, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Retry-After": "5",
    });
    res.end(
      JSON.stringify({
        ok: false,
        estado,
        dica: "O servidor ainda está subindo. Repita em alguns segundos.",
      }),
    );
    return;
  }

  const encaminhado = request(
    {
      host: "127.0.0.1",
      port: PORTA_INTERNA,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: req.headers.host ?? "localhost" },
    },
    (resposta) => {
      res.writeHead(resposta.statusCode ?? 502, resposta.headers);
      resposta.pipe(res);
    },
  );
  encaminhado.on("error", (erro) => {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, erro: erro.message }));
  });
  req.pipe(encaminhado);
});

proxy.listen(PORTA_EXTERNA, "0.0.0.0", () => {
  console.log(`[start] porta ${PORTA_EXTERNA} aberta (proxy)`);
});

/* ------------------------------------------------------------------ */
/* Banco: escolhe o endereço antes do Next carregar                    */
/* ------------------------------------------------------------------ */

/**
 * O mesmo Postgres costuma ter dois endereços: um IP público (sujeito a
 * allowlist do provedor) e um hostname interno (só resolve de dentro dele).
 * Onde o IP não está liberado, o app morre na migração no boot — daí o
 * `DATABASE_URL_FALLBACK`.
 */
function testarPorta(url) {
  let alvo;
  try {
    alvo = new URL(url);
  } catch {
    return Promise.resolve(false);
  }
  return new Promise((resolver) => {
    const socket = net.connect({
      host: alvo.hostname,
      port: Number(alvo.port || 5432),
      timeout: 2_500,
    });
    socket.once("connect", () => {
      socket.destroy();
      resolver(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolver(false);
    });
    socket.once("error", () => {
      socket.destroy();
      resolver(false);
    });
  });
}

const principal = process.env.DATABASE_URL;
const alternativo = process.env.DATABASE_URL_FALLBACK;

if (principal && alternativo && !(await testarPorta(principal))) {
  console.log("[start] banco principal inacessível; usando o alternativo");
  process.env.DATABASE_URL = alternativo;
}

/* ------------------------------------------------------------------ */
/* Build: só quando o pacote não corresponde ao código                 */
/* ------------------------------------------------------------------ */

function construir() {
  console.log("[start] pacote standalone ausente — rodando `npm run build`...");
  estado = "build em andamento";
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

/**
 * Servidor do Next, já sem o launcher.
 *
 * No pacote standalone o `server.js` é substituído pelo postbuild e delega a
 * este mesmo arquivo — apontar o filho para ele geraria loop infinito. O Next
 * original fica em `server.next.js`; o `start.mjs` do repositório é a cópia.
 */
const servidores = [
  path.join(raiz, ".next", "standalone", "server.next.js"),
  path.join(raiz, "server.next.js"),
  pacote,
  local,
];

if (!servidores.some((arquivo) => existsSync(arquivo))) {
  const montou = await construir();
  if (!montou) process.exit(1);
}

const alvo = servidores.find((arquivo) => existsSync(arquivo));
if (!alvo) {
  console.error(
    "[start] build terminou mas o servidor do Next não foi gerado. " +
      'Confira se next.config.ts tem `output: "standalone"`.',
  );
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/* Next na porta interna; proxy passa a encaminhar quando ele aceitar  */
/* ------------------------------------------------------------------ */

estado = "subindo o servidor";
const servidor = spawn(process.execPath, [alvo], {
  stdio: "inherit",
  env: {
    ...process.env,
    PORT: String(PORTA_INTERNA),
    HOSTNAME: "0.0.0.0",
  },
});

servidor.on("exit", (codigo) => {
  console.error(`[start] servidor encerrou (código ${codigo})`);
  proxy.close();
  process.exit(codigo ?? 1);
});

/** Espera a porta interna aceitar conexões; depois libera o proxy. */
async function aguardarServidor() {
  const limite = Date.now() + 120_000;
  while (Date.now() < limite) {
    const aberto = await new Promise((resolver) => {
      const socket = net.connect({ host: "127.0.0.1", port: PORTA_INTERNA });
      socket.once("connect", () => {
        socket.destroy();
        resolver(true);
      });
      socket.once("error", () => {
        socket.destroy();
        resolver(false);
      });
    });
    if (aberto) {
      pronto = true;
      console.log(`[start] pronto — encaminhando ${PORTA_EXTERNA} → ${PORTA_INTERNA}`);
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  estado = "servidor não respondeu a tempo";
  console.error("[start] o servidor não abriu a porta interna em 120s");
}

await aguardarServidor();