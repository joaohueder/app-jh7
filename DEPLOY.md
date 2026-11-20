# Deploy

App Next.js em modo **standalone**: `npm run build` gera `.next/standalone` com
servidor e dependências prontos. O `postbuild` copia `public/`, `.next/static` e
`drizzle/` para dentro do pacote — sem isso o site sobe sem CSS e sem migrações.

Banco é SQLite (`better-sqlite3`), binário nativo. **O build precisa rodar na
mesma arquitetura do servidor** (Linux). Build feito no Windows não sobe em
container Linux.

## Variáveis de ambiente

| Variável | Obrigatória | Uso |
|---|---|---|
| `SESSION_SECRET` | sim | Assina o cookie de sessão. 32+ caracteres aleatórios. |
| `DATA_DIR` | sim em produção | Pasta do banco e uploads. Dockerfile usa `/data`. |
| `ADMIN_NAME` | não | Nome do admin criado no primeiro boot. |
| `ADMIN_EMAIL` | sim | Login do admin criado no primeiro boot. |
| `ADMIN_PASSWORD` | sim | Senha do admin criado no primeiro boot. |
| `PORT` / `HOSTNAME` | não | Padrão `3000` / `0.0.0.0`. |
| `DB_PATH` | não | Caminho do `.db`. Sem ele: `DATA_DIR/jh7.db`. |

Na primeira subida com banco vazio o próprio servidor aplica as migrações
(`drizzle/`) e cria o administrador. Isso só acontece **uma vez**: com usuário
já cadastrado, `ADMIN_PASSWORD` é ignorado. Troque a senha depois pelo sistema.

Gere o segredo:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Opção 1 — Docker (recomendado)

O `Dockerfile` compila em `node:22-alpine` (musl/x64) e roda só o pacote
standalone. Dados ficam no volume montado em `/data`.

```powershell
docker build -t jh7 .
docker run -d --name jh7 -p 3000:3000 `
  -v jh7-data:/data `
  -e SESSION_SECRET="cole-o-segredo" `
  -e ADMIN_NAME="João Hueder" `
  -e ADMIN_EMAIL="email@dominio.com" `
  -e ADMIN_PASSWORD="senha-forte" `
  jh7
```

Abra http://localhost:3000.

Atualizar: `docker build -t jh7 .` e `docker rm -f jh7` + `docker run` de novo.
O volume `jh7-data` mantém banco e uploads; migrações novas entram sozinhas.

## Opção 2 — Painel com build a partir do código

Configuração equivalente à tela de Build:

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

Se o painel fizer build sozinho com `output: "standalone"` detectado, o
`postbuild` ainda roda e completa o pacote — pode manter `npm run build`.

### Disco persistente

Ative um volume/disco e monte em `/data`, com `DATA_DIR=/data`. Sem isso o
container é recriado a cada deploy e o SQLite + logos enviados somem.

## Opção 3 — Servidor Linux com Node instalado

```bash
npm ci
npm run build
DATA_DIR=/var/lib/jh7 PORT=3000 HOSTNAME=0.0.0.0 \
  ADMIN_EMAIL=... ADMIN_PASSWORD=... SESSION_SECRET=... \
  node .next/standalone/server.js
```

`npm ci` instala devDependencies — `next build` e o `better-sqlite3` precisam
delas. Depois do build só `.next/standalone` é necessário para rodar.

Mantenha com systemd ou pm2 e ponha nginx com HTTPS na frente.

## Backup

Copie a pasta `DATA_DIR` inteira (`jh7.db` + `uploads/`). Com WAL ativo, o
`.db-wal` faz parte do banco: copie com o app parado ou use
`sqlite3 jh7.db ".backup copia.db"`.