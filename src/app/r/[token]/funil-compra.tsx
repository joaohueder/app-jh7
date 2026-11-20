import type { FunilCompra as Funil } from "@/lib/meta/relatorio";
import { cor } from "./paleta";

function inteiro(valor: number | null): string {
  if (valor === null) return "—";
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function percentual(atual: number | null, anterior: number | null): string | null {
  if (atual === null || anterior === null || anterior <= 0) return null;
  const pct = (atual / anterior) * 100;
  return `${pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

/**
 * Funil de compra em barras horizontais. A largura de cada etapa é relativa
 * à primeira (cliques no link); a porcentagem à direita é a conversão em
 * relação à etapa imediatamente anterior.
 */
export function FunilCompra({ funil }: { funil: Funil }) {
  const etapas = [
    { rotulo: "Cliques no link", valor: funil.cliquesLink },
    { rotulo: "Visualização da página", valor: funil.visitasPagina },
    { rotulo: "Adição ao carrinho", valor: funil.adicoesCarrinho },
    { rotulo: "Finalização de compra", valor: funil.finalizacoesCompra },
    { rotulo: "Compra", valor: funil.compras },
  ];

  const topo = funil.cliquesLink ?? 0;

  return (
    <ol className="space-y-3">
      {etapas.map((etapa, indice) => {
        const anterior = indice > 0 ? etapas[indice - 1].valor : null;
        const largura =
          topo > 0 && etapa.valor !== null
            ? Math.max(etapa.valor > 0 ? 4 : 0, (etapa.valor / topo) * 100)
            : 0;
        const conversao = percentual(etapa.valor, anterior);

        return (
          <li key={etapa.rotulo}>
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="text-dim">{etapa.rotulo}</span>
              <span className="shrink-0 text-sm font-semibold text-white">
                {inteiro(etapa.valor)}
                {conversao ? (
                  <span className="ml-2 text-[0.65rem] font-normal text-dim">
                    {conversao}
                  </span>
                ) : null}
              </span>
            </div>
            <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full"
                style={{ width: `${largura}%`, backgroundColor: cor(indice) }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}