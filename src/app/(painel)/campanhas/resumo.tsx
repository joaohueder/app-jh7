import { tendencia, variacao } from "@/lib/meta/insights";

/**
 * Card de resumo do topo das telas de campanhas: valor do período, valor do
 * período anterior e a variação percentual colorida (verde quando o movimento
 * é bom, vermelho quando é ruim). Sem período anterior, mostra só o valor.
 */
export function Resumo({
  rotulo,
  valor,
  atual,
  anterior,
  formatoAnterior,
  menorMelhor = false,
  detalhe,
}: {
  rotulo: string;
  valor: string;
  /** Valor numérico do período atual, para a comparação. */
  atual?: number | null;
  /** Valor numérico do período anterior. */
  anterior?: number | null;
  /** Formata o valor anterior na mesma unidade da métrica. */
  formatoAnterior?: (valor: number) => string;
  /** Métricas de custo: subir é ruim. */
  menorMelhor?: boolean;
  detalhe?: string;
}) {
  const delta =
    atual === undefined ? null : variacao(atual, anterior);
  const direcao =
    atual === undefined ? "neutro" : tendencia(atual, anterior, menorMelhor);
  const cor =
    direcao === "melhor" ? "text-jade" : direcao === "pior" ? "text-destructive" : "text-dim";

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="truncate text-xs text-dim">{rotulo}</p>
      <p className="mt-1 truncate text-lg font-semibold text-white">{valor}</p>
      {detalhe ? <p className="truncate text-xs text-dim">{detalhe}</p> : null}
      {anterior != null && formatoAnterior ? (
        <p className="truncate text-xs text-dim">
          Anterior: {formatoAnterior(anterior)}
        </p>
      ) : null}
      {delta ? <p className={`truncate text-xs ${cor}`}>{delta}</p> : null}
    </div>
  );
}
