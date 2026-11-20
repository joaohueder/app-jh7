/**
 * Verificação do módulo Financeiro contra um banco de teste.
 * Roda com: npx tsx scripts/check-financeiro.ts
 *
 * Usa `TEST_DATABASE_URL` (nunca o banco de produção): o script APAGA os
 * lançamentos e baixas, então precisa de um Postgres descartável.
 * Padrão: postgres://appjh7:teste@127.0.0.1:55432/appjh7_teste
 */
import assert from "node:assert/strict";

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://appjh7:teste@127.0.0.1:55432/appjh7_teste";

async function main() {
  const { db, pool } = await import("../src/lib/db");
  const { garantirMigracoes } = await import("../src/lib/db/migrate");
  const { clients, financeEntries, financePayments } = await import(
    "../src/lib/db/schema"
  );
  const { listarLancamentos, resumoFinanceiro } = await import(
    "../src/app/(painel)/financeiro/dados"
  );
  const { intervaloDoMes, mesAnterior, mesSeguinte, vencimentoDaMensalidade } =
    await import("../src/app/(painel)/financeiro/comum");

  await garantirMigracoes();

  // Datas de calendário
  assert.deepEqual(intervaloDoMes("2026-02"), { inicio: "2026-02-01", fim: "2026-02-28" });
  assert.deepEqual(intervaloDoMes("2024-02"), { inicio: "2024-02-01", fim: "2024-02-29" });
  assert.equal(mesAnterior("2026-01"), "2025-12");
  assert.equal(mesSeguinte("2026-12"), "2027-01");

  // Vencimento da mensalidade respeita o dia do contrato e o fim do mês
  assert.equal(vencimentoDaMensalidade("2026-11-17", "2026-11"), "2026-11-17");
  assert.equal(vencimentoDaMensalidade("2026-01-31", "2026-02"), "2026-02-28");
  assert.equal(vencimentoDaMensalidade("2026-01-31", "2026-04"), "2026-04-30");

  // Lançamentos somam e classificam pelo vencimento
  const hoje = "2026-11-19";
  const [cliente] = await db.select({ id: clients.id }).from(clients);
  await db.delete(financePayments);
  await db.delete(financeEntries);
  await db.insert(financeEntries).values([
    {
      kind: "receita",
      clientId: cliente?.id ?? null,
      description: "Teste recebido",
      category: "Mensalidade",
      amount: 50_000,
      dueDate: "2026-11-10",
    },
    {
      kind: "receita",
      clientId: cliente?.id ?? null,
      description: "Teste em aberto",
      category: "Mensalidade",
      amount: 30_000,
      dueDate: "2026-11-25",
    },
    {
      kind: "receita",
      clientId: cliente?.id ?? null,
      description: "Teste vencido do mês anterior",
      category: "Mensalidade",
      amount: 20_000,
      dueDate: "2026-10-05",
    },
    {
      kind: "receita",
      clientId: cliente?.id ?? null,
      description: "Teste baixa parcial",
      category: "Mensalidade",
      amount: 10_000,
      dueDate: "2026-11-28",
    },
    {
      kind: "despesa",
      description: "Teste despesa paga",
      category: "Ferramentas",
      amount: 10_000,
      dueDate: "2026-11-05",
    },
  ]);

  // Baixas: integral na primeira receita, parcial na última, e a despesa paga.
  const lancamentos = await db.select().from(financeEntries);
  const porDescricao = (nome: string) =>
    lancamentos.find((l) => l.description === nome)!;

  await db.insert(financePayments).values([
    {
      entryId: porDescricao("Teste recebido").id,
      amount: 50_000,
      paidOn: "2026-11-12",
      method: "pix",
    },
    {
      entryId: porDescricao("Teste baixa parcial").id,
      amount: 4_000,
      paidOn: "2026-11-14",
      method: "permuta",
    },
    {
      entryId: porDescricao("Teste despesa paga").id,
      amount: 10_000,
      paidOn: "2026-11-06",
      method: "credito",
    },
  ]);

  const lista = await listarLancamentos("2026-11", hoje);
  assert.equal(lista.length, 5, "lista do mês + vencidos anteriores");
  assert.equal(
    lista.filter((l) => l.status === "vencido").length,
    1,
    "só a parcela de outubro sem baixa está vencida",
  );
  const parcial = lista.find((l) => l.descricao === "Teste baixa parcial")!;
  assert.equal(parcial.status, "parcial");
  assert.equal(parcial.baixado, 4_000);
  assert.equal(parcial.saldo, 6_000);

  const resumo = await resumoFinanceiro("2026-11", hoje);
  assert.deepEqual(resumo, {
    // aReceber do mês: 30.000 em aberto + 6.000 restantes da baixa parcial
    aReceber: 36_000,
    // baixas de receita em novembro: 50.000 + 4.000
    recebido: 54_000,
    despesas: 10_000,
    pago: 10_000,
    vencido: 20_000,
    saldo: 44_000,
  });

  console.log("✓ Financeiro: datas, status e totais conferem.");
  await pool.end();
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});