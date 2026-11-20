/**
 * Gera `pacote-ftp/` — a pasta que se envia por FTP para o servidor.
 *
 * O pacote é autossuficiente: já contém `.next`, `node_modules`, `drizzle`,
 * `public` e `.env.production`. No servidor NÃO se roda `npm install` nem
 * `npm run build`; só `node app/start.mjs`.
 *
 * Uso: `npm run pacote`
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const raiz = process.cwd();
const origem = path.join(raiz, "dist");
const destino = path.join(raiz, "pacote-ftp");

if (!existsSync(origem)) {
  console.error("[pacote] dist/ não existe. Rode `npm run build` antes.");
  process.exit(1);
}

rmSync(destino, { recursive: true, force: true });
cpSync(origem, destino, { recursive: true });

// O .htaccess só atrapalha se o servidor for Apache servindo estático; um
// arquivo com instruções claras evita que alguém procure o "comando de build".
writeFileSync(
  path.join(destino, "LEIA-ME.txt"),
  `JH7 Marketing — pasta pronta para enviar por FTP
================================================

O QUE É ISTO
  Pacote de produção completo. Já contém o código compilado, as
  dependências e as migrações do banco. Nada precisa ser instalado.

COMO ENVIAR
  1. Envie TODO o conteúdo desta pasta (não a pasta em si) para o
     diretório da aplicação no servidor. Ex.: /home/USUARIO/app-jh7
  2. Preserve a estrutura de subpastas.

COMO INICIAR
  O app é Node.js e precisa de um processo rodando. FTP não inicia nada.
  No servidor, uma única vez, crie o serviço (systemd):

    sudo tee /etc/systemd/system/jh7.service > /dev/null <<'EOF'
    [Unit]
    Description=JH7 Marketing
    After=network.target

    [Service]
    WorkingDirectory=/home/USUARIO/app-jh7
    ExecStart=/usr/bin/node app/start.mjs
    Restart=always
    Environment=NODE_ENV=production
    Environment=PORT=3000
    Environment=HOSTNAME=0.0.0.0
    User=USUARIO

    [Install]
    WantedBy=multi-user.target
    EOF

    sudo systemctl daemon-reload
    sudo systemctl enable --now jh7
    sudo systemctl status jh7

  Ajuste USUARIO e o caminho. O Node precisa estar instalado (v20+).

  Alternativa sem systemd:
    cd /home/USUARIO/app-jh7
    PORT=3000 HOSTNAME=0.0.0.0 node app/start.mjs

  Mantenha o processo vivo (pm2, screen, supervisor). Se o processo
  morrer, o site cai.

CONFIGURAÇÃO
  As credenciais estão em app/.env.production e são lidas
  automaticamente. Variáveis definidas no ambiente têm prioridade.

  ATENÇÃO: esse arquivo contém a senha do banco. Se alguém tiver acesso
  ao FTP, tem acesso ao banco.

VERIFICAR SE SUBIU
  curl http://127.0.0.1:3000/health
  Esperado: {"ok":true,"banco":"ok",...}
  Se vier 503, o banco está inacessível daquele servidor (allowlist).
  O campo "host" na resposta diz qual endereço foi tentado.

ACHAR PROBLEMA
  journalctl -u jh7 -n 100 --no-pager     (com systemd)
  ou a saída do processo em primeiro plano.

  Linhas úteis no log:
    [start] runtime em ...        caminho que o app usou
    [start] porta 3000 aberta     já aceita conexão
    [start] pronto — encaminhando servidor do Next no ar
    [db] migrações em dia         banco conectado
`,
);

console.log("[pacote] pronto: pacote-ftp/");

/**
 * Também gera o .zip: FTP de painel costuma aceitar só arquivo compactado, e
 * enviar 1.800 arquivos soltos é lento e propenso a perder estrutura.
 * Usa o `zip` do sistema quando existe; no Windows cai no PowerShell.
 */
const zip = path.join(raiz, "pacote-ftp.zip");
rmSync(zip, { force: true });

const compactou =
  process.platform === "win32"
    ? spawnSync(
        "powershell",
        [
          "-NoProfile",
          "-Command",
          `Compress-Archive -Path '${destino}\\*' -DestinationPath '${zip}' -Force`,
        ],
        { stdio: "inherit" },
      )
    : spawnSync("zip", ["-rq", zip, "."], { cwd: destino, stdio: "inherit" });

if (compactou.status === 0) {
  const mb = (statSync(zip).size / 1024 / 1024).toFixed(1);
  console.log(`[pacote] zip pronto: pacote-ftp.zip (${mb} MB)`);
} else {
  console.warn("[pacote] não foi possível gerar o .zip — use a pasta pacote-ftp/");
}

console.log("[pacote] envie por FTP e rode `node app/start.mjs` no servidor");