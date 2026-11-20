/**
 * Verificação do módulo Financeiro contra uma cópia do banco real.
 * Roda com: npx tsx scripts/check-financeiro.ts
 * Não toca em data/jh7.db — usa um arquivo temporário.
 */
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

const pasta = mkdtempSync(path.join(tmpdir(), "jh7-fin-"));
const banco = path.join(pasta, "teste.db");
const origem = path.join(process.cwd(), "data", "jh7.db");
copyFileSync(origem, banco);
// Banco em modo WAL: sem estes arquivos a cópia perde o que ainda não foi
// checkpointado — inclusive a tabela recém-migrada.
for (const sufixo of ["-wal", "-shm"]) {
  try {
    copyFileSync(`${origem}${sufixo}`, `${banco}${sufixo}`);
  } catch {
    // O arquivo pode não existir logo após um checkpoint.
  }
}
process.env.DB_PATH = banco;

async function main() {
  const { db } = await import("../src/lib/db");
  const { clients, financeEntries, financePayments } = await import(
    "../src/lib/db/schema"
  );
  const { listarLancamentos, resumoFinanceiro } = await import(
    "../src/app/(painel)/financeiro/dados"
  );
  const { intervaloDoMes, mesAnterior, mesSeguinte, vencimentoDaMensalidade } =
    await import("../src/app/(painel)/financeiro/comum");

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
  const cliente = db.select({ id: clients.id }).from(clients).get();
  db.delete(financePayments).run();
  db.delete(financeEntries).run();
  db.insert(financeEntries)
    .values([
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
    ])
    .run();

  // Baixas: integral na primeira receita, parcial na última, e a despesa paga.
  const porDescricao = (nome: string) =>
    db
      .select()
      .from(financeEntries)
      .all()
      .find((l) => l.description === nome)!;
  const hojeIso2 = "2026-11-19";
  void hojeIso2;
  db.insert(financePayments)
    .values([
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
    ])
    .run();

  const lista = listarLancamentos("2026-11", hoje);
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

  const resumo = resumoFinanceiro("2026-11", hoje);
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
  // O SQLite ainda segura o arquivo no Windows; a pasta é temporária.
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
