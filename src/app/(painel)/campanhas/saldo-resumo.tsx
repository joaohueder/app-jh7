import { Wallet } from "lucide-react";

/** Abaixo disto o saldo é sinalizado como crítico (em reais). */
const SALDO_BAIXO = 20;

type ResumoSaldo = {
  texto: string;
  /** `null` quando não há saldo numérico (pós-pago ou sem dado da Meta). */
  saldo: number | null;
  moeda: string;
};

/**
 * Destaque do saldo da conta no card do cliente. Abaixo de R$ 20 o valor fica
 * vermelho e pisca devagar (a animação respeita `prefers-reduced-motion`, onde
 * fica vermelho fixo — o aviso nunca depende só do movimento).
 */
export function SaldoContaResumo({ resumo }: { resumo: ResumoSaldo }) {
  const critico =
    resumo.saldo !== null && resumo.moeda === "BRL" && resumo.saldo < SALDO_BAIXO;

  return (
    <p
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold ${
        critico
          ? "saldo-alerta border-destructive/50 bg-destructive/15 text-destructive"
          : "border-ember/40 bg-ember/10 text-ember"
      }`}
    >
      <Wallet className="size-3.5" aria-hidden="true" />
      {resumo.texto}
      {critico ? <span className="sr-only">— saldo abaixo de R$ 20,00</span> : null}
    </p>
  );
}