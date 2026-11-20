/**
 * Compila durante o `npm ci`.
 *
 * Por que aqui e não no `start`: o painel executa `npm ci` → inicia o app →
 * roda o smoke test alguns segundos depois. Se o build acontecesse no `start`,
 * o smoke test encontraria a porta fechada durante os 1–3 min de compilação e
 * aplicaria rollback — mesmo com o app perfeito.
 *
 * Guardas:
 * - `src/` ausente = estágio `deps` do Dockerfile (só package.json) → sai.
 * - `SKIP_BUILD=1` desliga explicitamente (Dockerfile usa).
 * - Pacote existente **com o mesmo conteúdo do código** → não recompila.
 *
 * A comparação é por hash de conteúdo, não por data: o painel reaproveita a
 * pasta entre deploys e `npm ci` não apaga `.next`, então confiar só na
 * existência do pacote fazia o deploy rodar o build antigo — o bug voltava a
 * aparecer mesmo com a correção já publicada.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const raiz = process.cwd();

if (process.env.SKIP_BUILD === "1") {
  console.log("[postinstall] SKIP_BUILD=1 — build ignorado");
  process.exit(0);
}

if (!existsSync(path.join(raiz, "src"))) {
  console.log("[postinstall] sem src/ (estágio de dependências) — build ignorado");
  process.exit(0);
}

const pacote = path.join(raiz, ".next", "standalone", "server.js");
const selo = path.join(raiz, ".next", "build-stamp.json");

/** Tudo que entra no build e muda o resultado. */
const FONTES = ["src", "drizzle", "public", "scripts"];
const CONFIGS = [
  "package.json",
  "package-lock.json",
  "next.config.ts",
  "next.config.js",
  "tsconfig.json",
];

function arquivosDe(dir, acumulado = []) {
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = path.join(dir, entrada.name);
    if (entrada.isDirectory()) arquivosDe(caminho, acumulado);
    else acumulado.push(caminho);
  }
  return acumulado;
}

/** Hash estável: caminho relativo + conteúdo, em ordem. */
function hashDoCodigo() {
  const arquivos = [
    ...FONTES.map((pasta) => path.join(raiz, pasta))
      .filter((pasta) => existsSync(pasta))
      .flatMap((pasta) => arquivosDe(pasta)),
    ...CONFIGS.map((arquivo) => path.join(raiz, arquivo)).filter((arquivo) =>
      existsSync(arquivo),
    ),
  ].sort();

  const hash = createHash("sha256");
  for (const arquivo of arquivos) {
    hash.update(path.relative(raiz, arquivo));
    hash.update(readFileSync(arquivo));
  }
  return hash.digest("hex");
}

function seloValido(hash) {
  if (!existsSync(pacote) || !existsSync(selo)) return false;
  try {
    return JSON.parse(readFileSync(selo, "utf8")).hash === hash;
  } catch {
    return false;
  }
}

const hash = hashDoCodigo();

if (seloValido(hash)) {
  console.log("[postinstall] pacote standalone já corresponde ao código — build ignorado");
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

writeFileSync(selo, `${JSON.stringify({ hash, em: new Date().toISOString() }, null, 2)}\n`);