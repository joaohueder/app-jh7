# Deploy

App Next.js em modo **standalone**: `npm run build` gera `.next/standalone` com
servidor e dependências prontos. O `postbuild` copia `public/`, `.next/static` e
`drizzle/` para dentro do pacote — sem isso o site sobe sem CSS e sem migrações.

Banco: **Postgres** (via `pg`). Só os uploads precisam de disco.

## Variáveis de ambiente

| Variável | Obrigatória | Uso |
|---|---|---|
| `DATABASE_URL` | sim | `postgres://usuario:senha@host:porta/banco`. |
| `SESSION_SECRET` | sim | Assina o cookie de sessão. 32+ caracteres aleatórios. |
| `DATA_DIR` | sim em produção | Pasta dos uploads (logo). Dockerfile usa `/data`. |
| `ADMIN_NAME` | não | Nome do admin criado no primeiro boot. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | sim | Admin criado no primeiro boot. |
| `PORT` / `HOSTNAME` | não | Padrão `3000` / `0.0.0.0`. |

Na primeira subida o servidor aplica as migrações pendentes (`drizzle/`) e, se
a tabela de usuários estiver vazia, cria o administrador. Com usuário já
cadastrado, `ADMIN_PASSWORD` é ignorado — troque a senha pelo sistema.

Gere o segredo:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## O Postgres precisa aceitar conexão de fora

O app roda em um container/host diferente do banco. Sem isto a conexão fica em
_timeout_ (não é senha errada — nem chega a abrir):

1. No painel do Postgres, libere **acesso remoto** / conexões externas.
2. Libere o **IP do servidor do app** na allowlist (ou `0.0.0.0/0` enquanto
   testa; restrinja depois).
3. Confirme a porta (normalmente `5432`) e use o **host externo/IP**, não o
   hostname interno (`ic-postgresql-...` só resolve dentro do provedor).

Teste do seu computador:

```powershell
docker run --rm postgres:16-alpine psql "postgresql://usuario:senha@HOST:5432/banco?connect_timeout=15" -c "select 1"
```

Se der `timeout expired`, ainda é firewall/allowlist.

## Migrar os dados do SQLite antigo

O `data/jh7.db` continua no projeto como fonte. Rode uma vez, com o Postgres
vazio:

```powershell
npm i --no-save better-sqlite3
$env:DATABASE_URL="postgres://usuario:senha@HOST:5432/banco"
npm run db:migrar-sqlite
```

O `better-sqlite3` é instalado só nesta execução. Ele **não** fica nas
dependências do projeto: é um módulo nativo que compila com node-gyp e faz o
`npm ci` falhar em imagens sem Python (Python é o build do deploy).

O script aplica as migrações Postgres, copia as tabelas preservando os ids e
avança as sequences. É idempotente (limpa o destino antes). Depois da cópia, o
`data/jh7.db` pode ser apagado.

## Opção 1 — Docker (recomendado)

```powershell
docker build -t jh7 .
docker run -d --name jh7 -p 3000:3000 `
  -v jh7-uploads:/data `
  -e DATABASE_URL="postgres://usuario:senha@HOST:5432/banco" `
  -e SESSION_SECRET="cole-o-segredo" `
  -e ADMIN_NAME="João Hueder" `
  -e ADMIN_EMAIL="email@dominio.com" `
  -e ADMIN_PASSWORD="senha-forte" `
  jh7
```

Abra http://localhost:3000.

Atualizar: `docker build -t jh7 .`, `docker rm -f jh7` e `docker run` de novo.
O volume mantém os uploads; o banco é o Postgres. Migrações novas entram sozinhas.

## Opção 2 — Painel com build a partir do código

| Campo | Valor |
|---|---|
| Framework | Next.js (ou Other, se não listar) |
| Diretório de trabalho / raiz | `.` (a pasta do `package.json`) |
| Comando de instalação | `npm ci` |
| Comando de build | `npm run build` |
| Comando de start | `npm start` (ou `node .next/standalone/server.js`) |
| Diretório de saída | `.next` |
| Porta | `3000` (o `server.js` lê `PORT`) |
| Redirecionar rotas para `index.html` (SPA) | **desligado** |

O redirect SPA quebra o Next: ele já responde suas próprias rotas, e mandar
tudo para `index.html` derruba as páginas. Deixe desmarcado.

Cadastre `DATABASE_URL`, `SESSION_SECRET` e `DATA_DIR=/data` nas variáveis do
app. Ative um volume persistente montado em `/data` para os uploads.

## Opção 3 — Servidor Linux com Node instalado

```bash
npm ci
npm run build
DATABASE_URL=postgres://... DATA_DIR=/var/lib/jh7 PORT=3000 HOSTNAME=0.0.0.0 \
  SESSION_SECRET=... node .next/standalone/server.js
```

Mantenha com systemd ou pm2 e ponha nginx com HTTPS na frente.

## Backup

Banco: dump do Postgres (`pg_dump`) pelo painel do provedor. Uploads: copie
`DATA_DIR` inteira.