import Link from "next/link";
import { CircleAlert } from "lucide-react";

/**
 * Aviso de bloqueio por mensalidade não gerada. O pisca é lento (1,6s) e a
 * cor/laranja de alerta continua legível sem animação.
 */
export function AvisoCobranca({
  cliente,
  mesLabel,
  variante = "bloco",
}: {
  cliente?: string;
  mesLabel: string;
  /** "bloco": tela inteira de bloqueio · "linha": aviso curto no card. */
  variante?: "bloco" | "linha";
}) {
  if (variante === "linha") {
    return (
      <span className="saldo-alerta inline-flex items-center gap-1.5 rounded-full border border-destructive/50 bg-destructive/15 px-2 py-0.5 text-[0.65rem] font-semibold text-destructive">
        <CircleAlert className="size-3" aria-hidden="true" />
        Sem parcela de {mesLabel}
      </span>
    );
  }

  return (
    <div
      role="alert"
      className="saldo-alerta rounded-xl border border-destructive/50 bg-destructive/10 p-6"
    >
      <div className="flex items-start gap-3">
        <CircleAlert
          className="mt-0.5 size-5 shrink-0 text-destructive"
          aria-hidden="true"
        />
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-white">
            {cliente
              ? `${cliente} está bloqueado em ${mesLabel}`
              : `Acesso bloqueado em ${mesLabel}`}
          </h2>
          <p className="text-sm text-dim">
            A mensalidade deste mês ainda não foi gerada no Financeiro. Enquanto
            isso, campanhas e relatórios ficam indisponíveis. Gere a parcela no
            Financeiro ou ajuste o dia de vencimento no cadastro do contrato.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              href="/financeiro"
              className="inline-flex h-9 items-center rounded-lg bg-ember px-3 text-sm font-medium text-ink hover:bg-ember/90"
            >
              Abrir Financeiro
            </Link>
            {cliente ? (
              <Link
                href="/clientes"
                className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3 text-sm font-medium text-white hover:bg-surface-2"
              >
                Ir para Clientes
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}