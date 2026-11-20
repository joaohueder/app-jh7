import { and, asc, eq, gte, isNull, lte } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  clients,
  contracts,
  financeEntries,
  financePayments,
  niches,
} from "@/lib/db/schema";
import {
  intervaloDoMes,
  mesAnterior,
  nomeDoMes,
  situacaoDoLancamento,
} from "../financeiro/comum";

export type Kpi = {
  titulo: string;
  valor: string;
  detalhe?: string;
  /** "bom" | "ruim" | "neutro" — só a cor do valor. */
  tom?: "bom" | "ruim" | "neutro";
};

export type MesSerie = {
  mes: string;
  rotulo: string;
  recebido: number;
  despesaPaga: number;
  emAberto: number;
};

export type ParcelaPendente = {
  contratoId: number;
  clientId: number;
  contrato: string;
  cliente: string;
  valor: number;
  diaVencimento: number;
};

export type ClienteEmAberto = {
  clientId: number;
  cliente: string;
  valor: number;
  quantidade: number;
};

export type ContratoComVencimento = {
  contratoId: number;
  cliente: string;
  contrato: string;
  valor: number;
  diaVencimento: number;
  /** "paga" | "pendente" | "gerada" */
  situacao: "paga" | "gerada" | "pendente";
};

export type ProximoVencimento = {
  id: number;
  descricao: string;
  cliente: string | null;
  /** Saldo em aberto (descontadas as baixas). */
  valor: number;
  valorTotal: number;
  vencimento: string;
  dias: number;
};

export type PainelFinanceiro = {
  mes: string;
  mesLabel: string;
  kpis: Kpi[];
  serie: MesSerie[];
  /** Contratos ativos cuja mensalidade do mês ainda não foi lançada. */
  parcelasPendentes: ParcelaPendente[];
  parcelasGeradas: number;
  parcelasEsperadas: number;
  totalEmAberto: number;
  totalRecebido: number;
  totalDespesas: number;
  totalDespesasPagas: number;
  totalVencido: number;
  clientesEmAberto: ClienteEmAberto[];
  proximosVencimentos: ProximoVencimento[];
  contratosAtivos: number;
  /** Contratos ativos sem dia de vencimento: não entram em cobrança. */
  contratosSemVencimento: number;
  /** Toda a carteira com dia de vencimento, paga ou não neste mês. */
  contratosComVencimento: ContratoComVencimento[];
  contratosSemDia: { contratoId: number; cliente: string; contrato: string }[];
  clientesAtivos: number;
  clientesInativos: number;
  mrr: number;
  nichos: { nome: string; clientes: number }[];
};

function formatarBRL(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** Diferença em dias entre uma data ISO e hoje; negativo = já passou. */
function diasAte(iso: string, hoje: string): number {
  const alvo = Date.parse(`${iso}T00:00:00Z`);
  const base = Date.parse(`${hoje}T00:00:00Z`);
  return Math.round((alvo - base) / 86_400_000);
}

/**
 * Dados do painel. Tudo vem do SQLite — nada de rede aqui, para a tela abrir
 * rápido e continuar útil com a Meta fora do ar.
 */
export function dadosDoPainel(hoje: string): PainelFinanceiro {
  const mes = hoje.slice(0, 7);
  const { inicio, fim } = intervaloDoMes(mes);

  const lancamentos = db
    .select({
      id: financeEntries.id,
      kind: financeEntries.kind,
      clientId: financeEntries.clientId,
      cliente: clients.businessName,
      descricao: financeEntries.description,
      valor: financeEntries.amount,
      vencimento: financeEntries.dueDate,
      competence: financeEntries.competence,
      contractId: financeEntries.contractId,
    })
    .from(financeEntries)
    .leftJoin(clients, eq(clients.id, financeEntries.clientId))
    .all();

  // Baixas válidas (não estornadas), agrupadas por lançamento.
  const baixas = db
    .select()
    .from(financePayments)
    .where(isNull(financePayments.reversedAt))
    .all();
  const baixadoPor = new Map<number, number>();
  for (const b of baixas) {
    baixadoPor.set(b.entryId, (baixadoPor.get(b.entryId) ?? 0) + b.amount);
  }

  const situacao = (l: (typeof lancamentos)[number]) =>
    situacaoDoLancamento(
      l.valor,
      baixadoPor.get(l.id) ?? 0,
      l.vencimento,
      hoje,
    );

  const doMes = lancamentos.filter(
    (l) => l.vencimento >= inicio && l.vencimento <= fim,
  );

  const receitasMes = doMes.filter((l) => l.kind === "receita");
  const despesasMes = doMes.filter((l) => l.kind === "despesa");

  // Baixas do mês contam pelo dia em que o dinheiro entrou/saiu.
  const baixasDoMes = baixas.filter(
    (b) => b.paidOn >= inicio && b.paidOn <= fim,
  );
  const kindDoLancamento = new Map(lancamentos.map((l) => [l.id, l.kind]));
  const totalRecebido = baixasDoMes
    .filter((b) => kindDoLancamento.get(b.entryId) === "receita")
    .reduce((t, b) => t + b.amount, 0);
  const totalEmAberto = receitasMes.reduce((t, l) => t + situacao(l).saldo, 0);
  const totalDespesas = despesasMes.reduce((t, l) => t + l.valor, 0);
  const totalDespesasPagas = baixasDoMes
    .filter((b) => kindDoLancamento.get(b.entryId) === "despesa")
    .reduce((t, b) => t + b.amount, 0);
  // Vencido soma todas as competências em aberto, não só a do mês.
  const vencidos = lancamentos.filter(
    (l) => l.kind === "receita" && l.vencimento < hoje && situacao(l).saldo > 0,
  );
  const totalVencido = vencidos.reduce((t, l) => t + situacao(l).saldo, 0);

  /* ---------------- contratos e parcelas do mês ---------------- */

  const contratosAtivos = db
    .select({
      id: contracts.id,
      nome: contracts.name,
      cliente: clients.businessName,
      valor: contracts.monthlyValue,
      inicio: contracts.startDate,
      dueDay: contracts.dueDay,
      clienteId: contracts.clientId,
    })
    .from(contracts)
    .innerJoin(clients, eq(clients.id, contracts.clientId))
    .where(eq(contracts.status, "active"))
    .all()
    // Só entra em cobrança o contrato com dia de vencimento definido; valor
    // zero também gera parcela (é o que libera o acesso aos módulos).
    .filter((c) => c.dueDay !== null);

  const geradasNoMes = new Set(
    lancamentos
      .filter((l) => l.competence === mes && l.contractId !== null)
      .map((l) => l.contractId as number),
  );

  const parcelasPendentes: ParcelaPendente[] = contratosAtivos
    .filter((c) => !geradasNoMes.has(c.id))
    .map((c) => ({
      contratoId: c.id,
      clientId: c.clienteId,
      contrato: c.nome,
      cliente: c.cliente,
      valor: c.valor,
      diaVencimento: c.dueDay ?? 1,
    }))
    .sort((a, b) => a.diaVencimento - b.diaVencimento);

  const mrr = contratosAtivos.reduce((t, c) => t + c.valor, 0);

  const todosContratosAtivos = db
    .select({
      id: contracts.id,
      nome: contracts.name,
      cliente: clients.businessName,
      valor: contracts.monthlyValue,
      dueDay: contracts.dueDay,
    })
    .from(contracts)
    .innerJoin(clients, eq(clients.id, contracts.clientId))
    .where(eq(contracts.status, "active"))
    .all();

  const contratosSemDia = todosContratosAtivos
    .filter((c) => c.dueDay === null)
    .map((c) => ({ contratoId: c.id, cliente: c.cliente, contrato: c.nome }));

  const contratosSemVencimento = contratosSemDia.length;

  const situacaoDoContrato = new Map<number, "paga" | "gerada">();
  for (const l of lancamentos) {
    if (l.competence !== mes || l.contractId === null) continue;
    situacaoDoContrato.set(l.contractId, situacao(l).saldo === 0 ? "paga" : "gerada");
  }

  const contratosComVencimento: ContratoComVencimento[] = todosContratosAtivos
    .filter((c) => c.dueDay !== null)
    .map((c) => ({
      contratoId: c.id,
      cliente: c.cliente,
      contrato: c.nome,
      valor: c.valor,
      diaVencimento: c.dueDay as number,
      situacao: situacaoDoContrato.get(c.id) ?? ("pendente" as const),
    }))
    .sort((a, b) => a.diaVencimento - b.diaVencimento);

  /* ---------------- clientes ---------------- */

  const todosClientes = db.select().from(clients).all();
  const clientesAtivos = todosClientes.filter((c) => c.active).length;
  const clientesInativos = todosClientes.length - clientesAtivos;

  const listaNichos = db
    .select({ id: niches.id, nome: niches.name, position: niches.position })
    .from(niches)
    .orderBy(asc(niches.position), asc(niches.name))
    .all();
  const nichosComContagem = listaNichos
    .map((n) => ({
      nome: n.nome,
      clientes: todosClientes.filter((c) => c.nicheId === n.id).length,
    }))
    .filter((n) => n.clientes > 0);

  /* ---------------- quem está devendo ---------------- */

  const porCliente = new Map<number, ClienteEmAberto>();
  for (const l of lancamentos) {
    if (l.kind !== "receita" || l.clientId === null) continue;
    const s = situacao(l);
    if (s.saldo === 0) continue;
    const atual = porCliente.get(l.clientId) ?? {
      clientId: l.clientId,
      cliente: l.cliente ?? "Cliente removido",
      valor: 0,
      quantidade: 0,
    };
    atual.valor += s.saldo;
    atual.quantidade += 1;
    porCliente.set(l.clientId, atual);
  }
  const clientesEmAberto = [...porCliente.values()]
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 6);

  /* ---------------- próximos vencimentos (7 dias) ---------------- */

  const limite = new Date(`${hoje}T00:00:00Z`);
  limite.setUTCDate(limite.getUTCDate() + 7);
  const limiteIso = limite.toISOString().slice(0, 10);

  const proximosVencimentos = db
    .select({
      id: financeEntries.id,
      descricao: financeEntries.description,
      cliente: clients.businessName,
      valor: financeEntries.amount,
      vencimento: financeEntries.dueDate,
    })
    .from(financeEntries)
    .leftJoin(clients, eq(clients.id, financeEntries.clientId))
    .where(
      and(
        eq(financeEntries.kind, "receita"),
        gte(financeEntries.dueDate, hoje),
        lte(financeEntries.dueDate, limiteIso),
      ),
    )
    .orderBy(asc(financeEntries.dueDate))
    .all()
    // Pago não entra: o que interessa aqui é o que ainda falta receber. O
    // saldo vem das baixas, não do `paid_at` antigo.
    .map((l) => ({
      linha: l,
      saldo: situacaoDoLancamento(
        l.valor,
        baixadoPor.get(l.id) ?? 0,
        l.vencimento,
        hoje,
      ).saldo,
    }))
    .filter(({ saldo }) => saldo > 0)
    .map(({ linha: l, saldo }) => ({
      id: l.id,
      descricao: l.descricao,
      cliente: l.cliente,
      valor: saldo,
      valorTotal: l.valor,
      vencimento: l.vencimento,
      dias: diasAte(l.vencimento, hoje),
    }));

  /* ---------------- série dos últimos 6 meses ---------------- */

  const meses: string[] = [];
  let cursor = mes;
  for (let i = 0; i < 6; i += 1) {
    meses.unshift(cursor);
    cursor = mesAnterior(cursor);
  }

  const serie: MesSerie[] = meses.map((m) => {
    const { inicio: ini, fim: fimMes } = intervaloDoMes(m);
    const doMesM = lancamentos.filter(
      (l) => l.vencimento >= ini && l.vencimento <= fimMes,
    );
    const baixasMes = baixas.filter((b) => b.paidOn >= ini && b.paidOn <= fimMes);
    return {
      mes: m,
      rotulo: nomeDoMes(m).split(" de ")[0]?.slice(0, 3) ?? m,
      // Baixas do mês, pelo dia do recebimento/pagamento.
      recebido: baixasMes.filter((b) => kindDoLancamento.get(b.entryId) === "receita")
        .reduce((t, b) => t + b.amount, 0),
      despesaPaga: baixasMes.filter((b) => kindDoLancamento.get(b.entryId) === "despesa")
        .reduce((t, b) => t + b.amount, 0),
      emAberto: doMesM
        .filter((l) => l.kind === "receita")
        .reduce((t, l) => t + situacao(l).saldo, 0),
    };
  });

  /* ---------------- KPIs ---------------- */

  const kpis: Kpi[] = [
    {
      titulo: "Recebido no mês",
      valor: formatarBRL(totalRecebido),
      detalhe: (() => {
        const quitadas = receitasMes.filter((l) => situacao(l).saldo === 0).length;
        return `${quitadas} ${quitadas === 1 ? "parcela quitada" : "parcelas quitadas"}`;
      })(),
      tom: "bom",
    },
    {
      titulo: "A receber no mês",
      valor: formatarBRL(totalEmAberto),
      detalhe: (() => {
        const abertas = receitasMes.filter((l) => situacao(l).saldo > 0);
        const parciais = abertas.filter((l) => situacao(l).baixado > 0).length;
        return `${abertas.length} em aberto${parciais > 0 ? ` · ${parciais} parcial${parciais === 1 ? "" : "is"}` : ""}`;
      })(),
      tom: "neutro",
    },
    {
      titulo: "Vencido",
      valor: formatarBRL(totalVencido),
      detalhe:
        vencidos.length === 0
          ? "Nada em atraso"
          : `${vencidos.length} ${vencidos.length === 1 ? "parcela" : "parcelas"} em atraso`,
      tom: totalVencido > 0 ? "ruim" : "bom",
    },
    {
      titulo: "Parcelas não geradas",
      valor: String(parcelasPendentes.length),
      detalhe: `${parcelasPendentes.length} de ${contratosAtivos.length} contratos ativos`,
      tom: parcelasPendentes.length > 0 ? "ruim" : "bom",
    },
    {
      titulo: "Receita recorrente",
      valor: formatarBRL(mrr),
      detalhe: `${contratosAtivos.length} contratos ativos`,
      tom: "neutro",
    },
    {
      titulo: "Despesas do mês",
      valor: formatarBRL(totalDespesas),
      detalhe: `${formatarBRL(totalDespesasPagas)} pagas`,
      tom: "neutro",
    },
    {
      titulo: "Saldo do mês",
      valor: formatarBRL(totalRecebido - totalDespesasPagas),
      detalhe: "Recebido − despesas pagas",
      tom: totalRecebido - totalDespesasPagas < 0 ? "ruim" : "bom",
    },
    {
      titulo: "Carteira de clientes",
      valor: String(clientesAtivos),
      detalhe: `${clientesInativos} inativo${clientesInativos === 1 ? "" : "s"}`,
      tom: "neutro",
    },
  ];

  return {
    mes,
    mesLabel: nomeDoMes(mes),
    kpis,
    serie,
    parcelasPendentes,
    parcelasGeradas: geradasNoMes.size,
    parcelasEsperadas: contratosAtivos.length,
    totalEmAberto,
    totalRecebido,
    totalDespesas,
    totalDespesasPagas,
    totalVencido,
    clientesEmAberto,
    proximosVencimentos,
    contratosAtivos: contratosAtivos.length,
    contratosSemVencimento,
    contratosComVencimento,
    contratosSemDia,
    clientesAtivos,
    clientesInativos,
    mrr,
    nichos: nichosComContagem,
  };
}

export { formatarBRL };