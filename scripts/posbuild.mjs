/**
 * Depois do `next build`: completa o pacote standalone.
 *
 * O Next gera `.next/standalone` com o servidor e as dependências rastreadas,
 * mas deixa de fora `public/`, `.next/static` e (em alguns casos) `drizzle/`.
 * Sem essas pastas o site sobe sem CSS, sem logo e sem migrações.
 *
 * Roda via `postbuild` no package.json — inclusive dentro do Dockerfile e do
 * build do painel, então o deploy não precisa copiar nada à mão.
 */
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const raiz = process.cwd();
const destino = path.join(raiz, ".next", "standalone");

if (!existsSync(destino)) {
  console.error("[postbuild] .next/standalone não existe — o build rodou com output: standalone?");
  process.exit(1);
}

// Dados de desenvolvimento não podem ir para o pacote de produção.
const dados = path.join(destino, "data");
if (existsSync(dados)) rmSync(dados, { recursive: true, force: true });

const copias = [
  [path.join(raiz, "public"), path.join(destino, "public")],
  [path.join(raiz, ".next", "static"), path.join(destino, ".next", "static")],
  [path.join(raiz, "drizzle"), path.join(destino, "drizzle")],
  // Configuração de produção versionada: o deploy não depende de variáveis
  // cadastradas no painel. Sem ela os valores ficam por conta do ambiente.
  [path.join(raiz, ".env.production"), path.join(destino, ".env.production")],
];

for (const [origem, alvo] of copias) {
  if (!existsSync(origem)) continue;
  cpSync(origem, alvo, { recursive: true });
  console.log(`[postbuild] ${path.relative(raiz, origem)} -> ${path.relative(raiz, alvo)}`);
}

console.log("[postbuild] pacote pronto em .next/standalone");

/**
 * O painel copia o "diretório de saída" (por padrão `dist`) para o runtime e
 * falha com `cp: can't stat 'dist/.'` se ele não existir. Em vez de exigir que
 * alguém mude a configuração do painel, publicamos o pacote também ali.
 * `output: "standalone"` continua sendo a fonte; `dist` é só o espelho.
 */
const dist = path.join(raiz, "dist");
rmSync(dist, { recursive: true, force: true });
cpSync(destino, dist, { recursive: true });

// Quem roda a partir de `dist` executa `server.js` na mesma pasta, não
// `.next/standalone/server.js` (esse caminho só vale na raiz do projeto).
const pkgDist = path.join(dist, "package.json");
if (existsSync(pkgDist)) {
  const pkg = JSON.parse(readFileSync(pkgDist, "utf8"));
  pkg.scripts = { ...pkg.scripts, start: "node server.js" };
  writeFileSync(pkgDist, `${JSON.stringify(pkg, null, 2)}\n`);
}

console.log("[postbuild] espelho do pacote em dist/");

/**
 * Se o painel servir `dist` como site estático (nginx procurando `index.html`
 * e respondendo 403 quando não há), o usuário não vê nada e não sabe o porquê.
 * Este index.html é a única coisa que aparece nesse cenário: o app Next em si
 * é servido pelo `server.js`, que só responde quando o processo Node roda.
 */
writeFileSync(
  path.join(dist, "index.html"),
  `<!doctype html>
<html lang="pt-BR">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Deploy incompleto — JH7 Marketing</title>
<style>
  body { margin:0; min-height:100vh; display:grid; place-items:center;
         font:16px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif;
         background:#0a0a0a; color:#e5e5e5; }
  main { max-width:44rem; padding:2.5rem; }
  h1 { font-size:1.5rem; margin:0 0 .5rem; }
  p { margin:.6rem 0; color:#a3a3a3; }
  code { background:#171717; border:1px solid #262626; border-radius:6px;
         padding:.1rem .35rem; font-size:.9em; color:#e5e5e5; }
  ol { color:#a3a3a3; padding-left:1.2rem; }
  li { margin:.4rem 0; }
  .box { margin-top:1.5rem; padding:1rem 1.2rem; border:1px solid #262626;
         border-radius:10px; background:#111; }
  strong { color:#e5e5e5; }
</style>
<main>
  <h1>Servidor não iniciado</h1>
  <p>Os arquivos do sistema chegaram ao servidor, mas o processo Node do Next
     não está rodando. Por isso esta página é a única resposta disponível.</p>
  <div class="box">
    <strong>Para o administrador</strong>
    <ol>
      <li>No painel, defina a aplicação como <code>Node.js</code> /
          <code>Next.js</code> — não como site estático.</li>
      <li>Diretório de saída: <code>.next</code> (não <code>dist</code>).</li>
      <li>Comando de start: <code>node server.js</code>, porta
          <code>3000</code>.</li>
      <li>Redeploy — isso regenera o roteamento do nginx.</li>
    </ol>
    <p>O acesso pelo sistema fica em <code>/login</code> quando o processo
       Node estiver no ar.</p>
  </div>
</main>
</html>
`,
);

console.log("[postbuild] index.html de diagnóstico em dist/");