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

/**
 * Substitui o `server.js` gerado pelo Next por um launcher que força
 * HOSTNAME=0.0.0.0.
 *
 * O original faz `process.env.HOSTNAME || '0.0.0.0'`. Em Docker o HOSTNAME já
 * vem preenchido com o ID do container, então o servidor tenta escutar em
 * `abef49bc2b8f:3000`, ninguém alcança em 127.0.0.1 e o proxy responde 502 —
 * sem uma linha de log, porque a falha é antes de o logger subir.
 *
 * O Next original fica como `server.next.js`, caso se queira voltar ao
 * comportamento padrão.
 */
const serverOriginal = path.join(destino, "server.js");
const serverCopia = path.join(destino, "server.next.js");
if (existsSync(serverOriginal) && !existsSync(serverCopia)) {
  cpSync(serverOriginal, serverCopia);
  // `server.js` passa a ser o launcher: abre a porta externa na hora (responde
  // 503 enquanto sobe) e delega ao Next. Vale para qualquer comando que o
  // painel use — `node server.js`, `npm start` ou `node start.mjs`.
  writeFileSync(
    serverOriginal,
    `// Gerado pelo postbuild. Ver scripts/start.mjs: sobe o proxy que abre a
// porta imediatamente e força HOSTNAME=0.0.0.0 (o HOSTNAME do Docker é o ID
// do container e impedia o proxy de alcançar o servidor).
import("./start.mjs").catch((erro) => {
  console.error("[server] falha ao iniciar:", erro);
  process.exit(1);
});
`,
  );
  console.log("[postbuild] server.js delega ao start.mjs (proxy na porta)");
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

// O `server.js` do pacote delega a `start.mjs`; sem esta cópia o standalone
// sobe com ERR_MODULE_NOT_FOUND (foi o que quebrou a imagem Docker).
cpSync(
  path.join(raiz, "scripts", "start.mjs"),
  path.join(destino, "start.mjs"),
);

console.log("[postbuild] pacote pronto em .next/standalone");

/**
 * O painel copia o "diretório de saída" (por padrão `dist`) para o runtime e
 * falha com `cp: can't stat 'dist/.'` se ele não existir. Em vez de exigir que
 * alguém mude a configuração do painel, publicamos o pacote também ali.
 * `output: "standalone"` continua sendo a fonte; `dist` é só o espelho.
 */
const dist = path.join(raiz, "dist");
rmSync(dist, { recursive: true, force: true });

/**
 * `dist` é a raiz que o painel copia para o runtime (ex.: `/app`) e onde ele
 * roda `npm ci` e `npm run start`.
 *
 * Dois requisitos quebraram o deploy quando `dist` era só o standalone:
 * - `npm ci` em `/app` → `ENOENT: /app/package.json` (o standalone não tem);
 * - `npm run start` → precisa do script no package.json da raiz copiada.
 *
 * Mas `npm ci` apaga `node_modules` antes de instalar: pôr o runtime na raiz
 * destruiria o pacote. Então `dist/` fica com um `package.json` mínimo (sem
 * dependências) e o runtime completo em `dist/app/`, onde o launcher entra.
 *
 * Layout final:
 *   dist/package.json      → scripts.start = node app/start.mjs, sem deps
 *   dist/app/              → server.js, .next/, node_modules/, drizzle/, ...
 */
const runtime = path.join(dist, "app");
cpSync(destino, runtime, { recursive: true });

const pkgRaiz = JSON.parse(readFileSync(path.join(raiz, "package.json"), "utf8"));
const embrulho = {
  name: pkgRaiz.name,
  version: pkgRaiz.version,
  private: true,
  engines: pkgRaiz.engines,
  scripts: {
    start: "node app/start.mjs",
    // `npm ci` exige o script de instalação? Não — mas ferramentas de painel
    // às vezes chamam `build` por padrão. Um no-op evita falha ruidosa.
    build: "node -e \"console.log('build já incluído em app/')\"",
  },
};
writeFileSync(
  path.join(dist, "package.json"),
  `${JSON.stringify(embrulho, null, 2)}\n`,
);
// Sem dependências, o lockfile é trivial e o `npm ci` vira um no-op válido.
writeFileSync(
  path.join(dist, "package-lock.json"),
  `${JSON.stringify(
    {
      name: embrulho.name,
      version: embrulho.version,
      lockfileVersion: 3,
      requires: true,
      packages: {
        "": { name: embrulho.name, version: embrulho.version },
      },
    },
    null,
    2,
  )}\n`,
);
writeFileSync(
  path.join(runtime, "start.mjs"),
  readFileSync(path.join(raiz, "scripts", "start.mjs"), "utf8"),
);

console.log("[postbuild] dist/ com embrulho npm + runtime em dist/app/");

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