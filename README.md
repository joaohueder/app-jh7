# JH7 Marketing — sistema interno

Next.js 16 (App Router), SQLite via Drizzle, login com sessão assinada.

## Desenvolvimento

```bash
npm install
cp .env.example .env.local   # preencha SESSION_SECRET e ADMIN_*
npm run db:migrate
npm run db:seed
npm run dev
```

http://localhost:3000

## Produção

Ver [DEPLOY.md](DEPLOY.md): build standalone, Docker, campos do painel de
hospedagem e disco persistente.

Resumo: `npm run build` gera `.next/standalone`; o servidor roda com
`node .next/standalone/server.js` e lê `PORT`, `DATA_DIR` e `SESSION_SECRET`
do ambiente. Migrações e o primeiro administrador são criados na subida.

## Banco

SQLite em `DATA_DIR` (padrão `./data`). Schema em `src/lib/db/schema.ts`,
migrações em `drizzle/`.

```bash
npm run db:generate   # após editar o schema
npm run db:migrate    # aplica pendentes (o app também aplica ao subir)
npm run db:studio
```