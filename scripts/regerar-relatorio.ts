import "dotenv/config";
import { asc, eq } from "drizzle-orm";

import { db } from "../src/lib/db";
import { clients, reports } from "../src/lib/db/schema";
import { gerarSnapshotRelatorio } from "../src/lib/meta/relatorio";

async function main() {
  const ids = process.argv.slice(2).map(Number).filter(Number.isInteger);
  const todos = db
    .select({
      id: reports.id,
      clientId: reports.clientId,
      inicio: reports.startDate,
      fim: reports.endDate,
      cliente: clients.businessName,
    })
    .from(reports)
    .innerJoin(clients, eq(clients.id, reports.clientId))
    .orderBy(asc(reports.id))
    .all();
  const alvos = ids.length ? todos.filter((r) => ids.includes(r.id)) : todos;

  for (const alvo of alvos) {
    try {
      const gerado = await gerarSnapshotRelatorio(alvo.clientId, alvo.inicio, alvo.fim);
      if (!gerado.ok) {
        console.log({ id: alvo.id, cliente: alvo.cliente, erro: gerado.message });
        continue;
      }
      db.update(reports)
        .set({ data: JSON.stringify(gerado.snapshot) })
        .where(eq(reports.id, alvo.id))
        .run();
      console.log({
        id: alvo.id,
        cliente: alvo.cliente,
        periodo: `${alvo.inicio}..${alvo.fim}`,
        alcance: gerado.snapshot.total.resumo.alcance,
        impressoes: gerado.snapshot.total.resumo.impressoes,
        investido: gerado.snapshot.total.resumo.investido,
      });
    } catch (erro) {
      console.log({ id: alvo.id, cliente: alvo.cliente, erro: String(erro) });
    }
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});