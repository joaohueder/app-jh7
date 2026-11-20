/**
 * Roda uma vez na subida do servidor, antes de atender requests.
 *
 * Só no runtime Node: no edge (middleware) o driver do Postgres não existe.
 * É aqui que as migrações pendentes são aplicadas — no deploy standalone não
 * há `drizzle-kit` no servidor para rodar `npm run db:migrate`.
 *
 * Nada aqui pode lançar: um erro neste hook aborta a preparação do Next e
 * **todas** as rotas passam a responder 500, inclusive `/health` — que existe
 * justamente para dizer o que está errado. Cada etapa trata a própria falha;
 * o servidor sobe e o estado do banco aparece em `/health`.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { garantirMigracoes } = await import("./lib/db/migrate");
    const migrou = await garantirMigracoes();
    // Sem banco, criar admin/configuração falharia do mesmo jeito: não insiste.
    if (!migrou) return;

    const { garantirAdministrador, garantirConfiguracoes } = await import(
      "./lib/db/bootstrap"
    );
    await garantirConfiguracoes();
    await garantirAdministrador();
  } catch (erro) {
    console.error("[boot] falha na inicialização do banco:", erro);
  }
}