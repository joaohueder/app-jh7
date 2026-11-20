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
import { cpSync, existsSync, rmSync } from "node:fs";
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