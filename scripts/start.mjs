/**
 * Inicia o servidor standalone com bind correto.
 *
 * O `server.js` gerado pelo Next faz `process.env.HOSTNAME || '0.0.0.0'`.
 * Dentro de Docker/container o `HOSTNAME` já vem definido como o ID do
 * container, então o servidor tenta escutar em `abc123def456` e morre com:
 *
 *     Error: getaddrinfo EAI_AGAIN abc123def456
 *
 * Resultado: processo morto, proxy responde 502 e o log fica vazio (o erro
 * ocorre antes do logger subir). `.env.production` não salva, porque o Next não
 * sobrescreve variável que já existe no ambiente — a do container vence.
 *
 * Aqui o HOSTNAME é forçado no próprio processo, antes de carregar o server.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const raiz = process.cwd();

process.env.NODE_ENV ??= "production";
// Mesma regra do Dockerfile e do painel: escutar em todas as interfaces.
process.env.HOSTNAME = "0.0.0.0";
process.env.PORT ??= "3000";

const candidatos = [
  path.join(raiz, ".next", "standalone", "server.js"),
  path.join(raiz, "server.js"),
];

const alvo = candidatos.find((arquivo) => existsSync(arquivo));
if (!alvo) {
  console.error(
    "[start] server.js do standalone não encontrado. Rode `npm run build` antes de `npm start`.",
  );
  process.exit(1);
}

// O server.js faz `process.chdir(__dirname)` e lê o ambiente de lá; variáveis
// já definidas aqui continuam valendo.
await import(pathToFileURL(alvo).href);