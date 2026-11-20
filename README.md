# JH7 Marketing — sistema interno

Next.js 16 (App Router), Postgres via Drizzle, login com sessão assinada.

## Desenvolvimento

```bash
docker compose up -d          # Postgres local em 127.0.0.1:55432
npm install
cp .env.example .env.local    # preencha DATABASE_URL, SESSION_SECRET e ADMIN_*
npm run db:seed
npm run dev
```

http://localhost:3000

As migrações rodam sozinhas na subida. `npm run db:seed` garante o admin mesmo
com o servidor parado.

## Produção

Ver [DEPLOY.md](DEPLOY.md): build standalone, Docker, campos do painel de
hospedagem, Postgres remoto e migração dos dados do SQLite antigo.

Resumo: `npm run build` gera `.next/standalone`; o servidor roda com
`node .next/standalone/server.js` e lê `PORT`, `DATABASE_URL`, `DATA_DIR` e
`SESSION_SECRET` do ambiente.

## Banco

Postgres. Schema em `src/lib/db/schema.ts`, migrações em `drizzle/`.

```bash
npm run db:generate      # após editar o schema
npm run db:migrate       # aplica pendentes (o app também aplica ao subir)
npm run db:migrar-sqlite # copia data/jh7.db (SQLite antigo) para o Postgres
npm run db:check         # auto-teste do Financeiro (banco descartável)
npm run db:studio
```

`db:check` APAGA lançamentos: aponte `TEST_DATABASE_URL` para um banco
descartável (padrão `appjh7_teste` no compose local).