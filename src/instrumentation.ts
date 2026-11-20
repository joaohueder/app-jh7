/**
 * Roda uma vez na subida do servidor, antes de atender requests.
 *
 * Só no runtime Node: no edge (middleware) o better-sqlite3 não existe.
 * É aqui que as migrações pendentes são aplicadas — no deploy standalone não
 * há `drizzle-kit` no servidor para rodar `npm run db:migrate`.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { garantirMigracoes } = await import("./lib/db/migrate");
  garantirMigracoes();

  const { garantirAdministrador, garantirConfiguracoes } = await import(
    "./lib/db/bootstrap"
  );
  garantirConfiguracoes();
  await garantirAdministrador();
}