/** Tipos e utilitários puros do Financeiro — sem banco, seguros no cliente. */
import type { FinanceKind } from "@/lib/db/schema";

export type StatusFinance = "aberto" | "parcial" | "pago" | "vencido";

export const STATUS_FINANCE_LABELS: Record<StatusFinance, string> = {
  aberto: "Em aberto",
  parcial: "Pago parcial",
  pago: "Pago",
  vencido: "Vencido",
};

export type StatusDetalhado = {
  status: StatusFinance;
  /** Soma das baixas não estornadas, em centavos. */
  baixado: number;
  /** O que ainda falta receber/pagar. */
  saldo: number;
};

export type Lancamento = {
  id: number;
  kind: FinanceKind;
  clientId: number | null;
  cliente: string | null;
  descricao: string;
  categoria: string;
  /** Centavos, sempre positivo. */
  valor: number;
  vencimento: string;
  /** Data da última baixa válida (ou a única); nulo = sem baixa. */
  pagoEm: string | null;
  status: StatusFinance;
  baixado: number;
  saldo: number;
  observacoes: string | null;
  doContrato: boolean;
};

export type Baixa = {
  id: number;
  valor: number;
  data: string;
  meio: string;
  meioLabel: string;
  observacoes: string | null;
  estornadaEm: string | null;
};

export type ResumoFinanceiro = {
  aReceber: number;
  recebido: number;
  despesas: number;
  pago: number;
  vencido: number;
  saldo: number;
};

/** "2026-11" → { inicio: "2026-11-01", fim: "2026-11-30" }. */
export function intervaloDoMes(mes: string): { inicio: string; fim: string } {
  const [ano, m] = mes.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(ano, m, 0)).getUTCDate();
  return { inicio: `${mes}-01`, fim: `${mes}-${String(ultimoDia).padStart(2, "0")}` };
}

/** Normaliza `?mes=` para YYYY-MM; fora do formato cai no mês atual. */
export function normalizarMes(valor: string | undefined, hoje: string): string {
  return valor && /^\d{4}-\d{2}$/.test(valor) ? valor : hoje.slice(0, 7);
}

export function mesAnterior(mes: string): string {
  const [ano, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(ano, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function mesSeguinte(mes: string): string {
  const [ano, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(ano, m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function nomeDoMes(mes: string): string {
  const [ano, m] = mes.split("-").map(Number);
  const texto = new Date(Date.UTC(ano, m - 1, 1)).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return texto.replace(/^./, (letra) => letra.toUpperCase());
}

/**
 * Vencimento da mensalidade: mesmo dia do início do contrato, limitado ao
 * último dia do mês (31 → 30 em mês de 30 dias, 28/29 em fevereiro).
 */
export function vencimentoDaMensalidade(
  inicioContrato: string,
  mes: string,
  /** Dia de vencimento do contrato; sem ele, o dia do início. */
  dueDay?: number | null,
): string {
  const { fim } = intervaloDoMes(mes);
  const dia = dueDay ?? (Number(inicioContrato.slice(8, 10)) || 10);
  const ultimo = Number(fim.slice(8, 10));
  return `${mes}-${String(Math.min(dia, ultimo)).padStart(2, "0")}`;
}

/**
 * Situação a partir do que já foi baixado: quitado, parcial (com ou sem
 * atraso) ou ainda em aberto. Pagamento parcial vencido continua "parcial" —
 * o badge vencido é para quem não recebeu nada.
 */
export function situacaoDoLancamento(
  valor: number,
  baixado: number,
  vencimento: string,
  hoje: string,
): StatusDetalhado {
  const saldo = Math.max(0, valor - baixado);
  let status: StatusFinance;
  if (saldo === 0) status = "pago";
  else if (baixado > 0) status = "parcial";
  else status = vencimento < hoje ? "vencido" : "aberto";
  return { status, baixado, saldo };
}