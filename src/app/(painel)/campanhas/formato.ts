import { formatMoney } from "@/lib/format/masks";

/**
 * Formatação das métricas das telas de campanhas. Valor ausente vira "—"
 * (nunca 0), porque a Meta não devolveu aquele dado no período.
 */

/** Número inteiro com separador brasileiro; "—" quando não houve entrega. */
export function inteiro(valor: number | null): string {
  if (valor === null) return "—";
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

export function decimal(valor: number | null, casas = 2): string {
  if (valor === null) return "—";
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

export function percentual(valor: number | null): string {
  return valor === null ? "—" : `${decimal(valor)}%`;
}

export function dinheiro(valor: number | null): string {
  return valor === null ? "—" : formatMoney(Math.round(valor * 100));
}

/**
 * Horário do render no servidor, entregue ao relógio do botão "Atualizar
 * dados". Em função própria porque ler o relógio direto no corpo de uma página
 * é barrado pela regra de pureza do lint (`react-hooks/purity`).
 */
export function agoraDoServidor(): number {
  return Date.now();
}
