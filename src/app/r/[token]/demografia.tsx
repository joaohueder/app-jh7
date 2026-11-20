"use client";

import type { Segmento } from "@/lib/meta/relatorio";
import { cor } from "./paleta";
import { useLargura } from "./use-largura";

function inteiro(valor: number): string {
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

/** Pizza de sexo em SVG puro, com legenda e percentual. */
export function PizzaSexo({ dados }: { dados: Segmento[] }) {
  const total = dados.reduce((soma, d) => soma + d.valor, 0);
  if (!total) {
    return <p className="text-sm text-dim">Sem conversões no período.</p>;
  }

  const raio = 60;
  const centro = 80;

  // Ângulos acumulados calculados antes do map: nada é reatribuído no render.
  const inicios = dados.reduce<number[]>((acc, segmento) => {
    const anterior = acc[acc.length - 1] ?? -Math.PI / 2;
    acc.push(anterior + (segmento.valor / total) * Math.PI * 2);
    return acc;
  }, [-Math.PI / 2]);

  const fatias = dados.map((segmento, indice) => {
    const fracao = segmento.valor / total;
    const inicio = inicios[indice];
    const fim = inicios[indice + 1];

    // Fatia inteira vira círculo: o arco de 360° degenera num ponto.
    if (fracao >= 0.9999) {
      return { segmento, caminho: null, cor: cor(indice) };
    }

    const x1 = centro + raio * Math.cos(inicio);
    const y1 = centro + raio * Math.sin(inicio);
    const x2 = centro + raio * Math.cos(fim);
    const y2 = centro + raio * Math.sin(fim);
    const grande = fracao > 0.5 ? 1 : 0;

    return {
      segmento,
      caminho: `M ${centro} ${centro} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${raio} ${raio} 0 ${grande} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`,
      cor: cor(indice),
    };
  });

  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg viewBox="0 0 160 160" className="size-36 shrink-0" role="img" aria-label="Compras por sexo">
        {fatias.map(({ segmento, caminho, cor }) =>
          caminho ? (
            <path key={segmento.chave} d={caminho} fill={cor} />
          ) : (
            <circle key={segmento.chave} cx={centro} cy={centro} r={raio} fill={cor} />
          ),
        )}
      </svg>
      <ul className="min-w-0 space-y-1.5 text-sm">
        {dados.map((segmento, indice) => (
          <li key={segmento.chave} className="flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: cor(indice) }}
              aria-hidden="true"
            />
            <span className="text-dim">{segmento.chave}</span>
            <span className="font-medium text-white">{inteiro(segmento.valor)}</span>
            <span className="text-xs text-dim">
              {((segmento.valor / total) * 100).toLocaleString("pt-BR", {
                maximumFractionDigits: 0,
              })}
              %
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Contorno escuro atrás do valor: legível mesmo sobre uma barra. */
const HALO = {
  stroke: "#141414",
  strokeWidth: 2.5,
  paintOrder: "stroke" as const,
};

/** Abaixo disso o rótulo encostaria no topo do SVG. */
const TOPO_TEXTO = 10;

function dinheiro(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

/**
 * Barras verticais de idade em SVG puro. Quando `gasto` vem preenchido,
 * desenha no eixo direito uma linha do investimento por faixa de idade.
 */
export function BarrasIdade({
  dados,
  rotulo,
  gasto,
  rotuloBarras = "mensagens",
}: {
  dados: Segmento[];
  rotulo: string;
  gasto?: Segmento[];
  /** O que as barras representam, usado na legenda inferior. */
  rotuloBarras?: string;
}) {
  const [ref, largura] = useLargura(280);

  if (!dados.length) {
    return <p className="text-sm text-dim">Sem conversões no período.</p>;
  }

  const max = Math.max(1, ...dados.map((d) => d.valor));
  const gastoPorChave = new Map((gasto ?? []).map((g) => [g.chave, g.valor]));
  const temGasto = Boolean(gasto?.length) && gastoPorChave.size > 0;
  const maxGasto = Math.max(1, ...(gasto ?? []).map((g) => g.valor));

  const alturaPlot = 120;
  /** Faixa acima das barras onde o valor fica — sem ela o número do topo corta. */
  const topo = 26;
  const margemDir = temGasto ? 52 : 4;
  const gap = 10;

  // As barras se ajustam à largura disponível: nada de rolagem horizontal.
  const larguraBarra = Math.max(
    8,
    Math.min(46, (largura - margemDir - gap * (dados.length + 1)) / dados.length),
  );
  const alturaSvg = alturaPlot + topo + 36;

  const baseY = topo + alturaPlot;
  const centro = (indice: number) => gap + indice * (larguraBarra + gap) + larguraBarra / 2;
  const yGasto = (valor: number) => baseY - (valor / maxGasto) * alturaPlot;

  /**
   * Cada rótulo do investimento é posicionado testando caixas já ocupadas
   * (números das barras e os próprios rótulos do gasto). Tentar por regra
   * fixa (acima/lado) falha quando a linha cruza a base das barras no meio
   * do gráfico — o rótulo caía sobre o número da barra vizinha.
   */
  type Caixa = { x1: number; x2: number; y1: number; y2: number };
  const caixa = (
    x: number,
    y: number,
    larguraTexto: number,
    ancora: "middle" | "start" | "end",
    alturaTexto = 10,
  ): Caixa => {
    const x1 = ancora === "middle" ? x - larguraTexto / 2 : ancora === "start" ? x : x - larguraTexto;
    return { x1, x2: x1 + larguraTexto, y1: y - alturaTexto, y2: y + 3 };
  };
  const colide = (a: Caixa, b: Caixa) =>
    a.x1 < b.x2 + 1 && b.x1 < a.x2 + 1 && a.y1 < b.y2 + 1 && b.y1 < a.y2 + 1;

  const ocupados: Caixa[] = dados.map((segmento, indice) => {
    const altura = (segmento.valor / max) * alturaPlot;
    const y = topo + (alturaPlot - altura);
    const gastoDaFaixa = gastoPorChave.get(segmento.chave);
    const valorDentro = temGasto && gastoDaFaixa !== undefined && altura > 16;
    const larguraTexto = inteiro(segmento.valor).length * 6 + 2;
    return caixa(
      gap + indice * (larguraBarra + gap) + larguraBarra / 2,
      valorDentro ? y + 13 : y - 4,
      larguraTexto,
      "middle",
    );
  });

  const posicoesGasto = dados.map((segmento, indice) => {
    const valor = gastoPorChave.get(segmento.chave);
    if (valor === undefined) return null;

    const yPonto = yGasto(valor);
    const larguraTexto = dinheiro(valor).length * 5.2 + 2;
    const candidatos: { x: number; y: number; ancora: "middle" | "start" | "end" }[] = [
      { x: centro(indice), y: yPonto - 6, ancora: "middle" },
      { x: centro(indice) + larguraBarra / 2 + 4, y: yPonto + 3, ancora: "start" },
      { x: centro(indice) - larguraBarra / 2 - 4, y: yPonto + 3, ancora: "end" },
      { x: centro(indice), y: yPonto - 18, ancora: "middle" },
      { x: centro(indice), y: yPonto + 16, ancora: "middle" },
    ];
    for (const candidato of candidatos) {
      const teste = caixa(candidato.x, candidato.y, larguraTexto, candidato.ancora);
      if (!ocupados.some((caixaExistente) => colide(teste, caixaExistente))) {
        ocupados.push(teste);
        return { ...candidato, y: Math.max(TOPO_TEXTO, candidato.y), valor };
      }
    }
    // Todos os espaços colidem: usa o lado direito, o menos ruim.
    const ultimo = candidatos[1];
    return { ...ultimo, y: Math.max(TOPO_TEXTO, ultimo.y), valor };
  });
  const pontosGasto = dados
    .map((segmento, indice) => {
      const valor = gastoPorChave.get(segmento.chave);
      return valor === undefined ? null : `${centro(indice)},${yGasto(valor)}`;
    })
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={ref} className="w-full">
      <svg
        viewBox={`0 0 ${largura} ${alturaSvg}`}
        width="100%"
        height={alturaSvg}
        className="block"
        role="img"
        aria-label={rotulo}
      >
        {dados.map((segmento, indice) => {
          const altura = (segmento.valor / max) * alturaPlot;
          const x = gap + indice * (larguraBarra + gap);
          const y = topo + (alturaPlot - altura);
          const preenchimento = cor(indice);
          // Com a linha de investimento, o valor da barra desce para dentro dela
          // (a faixa acima do topo fica reservada ao rótulo do gasto).
          const gastoDaFaixa = gastoPorChave.get(segmento.chave);
          const valorDentro = temGasto && gastoDaFaixa !== undefined && altura > 16;

          return (
            <g key={segmento.chave}>
              <rect x={x} y={y} width={larguraBarra} height={Math.max(1, altura)} rx={3} style={{ fill: preenchimento }} />
              <text
                x={x + larguraBarra / 2}
                y={valorDentro ? y + 13 : y - 4}
                textAnchor="middle"
                className="fill-white text-[10px] font-medium"
              >
                {inteiro(segmento.valor)}
              </text>
              <text
                x={x + larguraBarra / 2}
                y={alturaPlot + topo + 16}
                textAnchor="middle"
                className="fill-dim text-[9px]"
              >
                {segmento.chave}
              </text>
            </g>
          );
        })}

        {temGasto ? (
          <>
            <polyline
              points={pontosGasto}
              fill="none"
              style={{ stroke: cor(2) }}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {dados.map((segmento, indice) => {
              const posicao = posicoesGasto[indice];
              if (!posicao) return null;
              return (
                <g key={`g-${segmento.chave}`}>
                  <circle cx={centro(indice)} cy={yGasto(posicao.valor)} r={2.5} style={{ fill: cor(2) }} />
                  <text
                    x={posicao.x}
                    y={posicao.y}
                    textAnchor={posicao.ancora}
                    style={{ fill: cor(2), ...HALO }}
                    className="text-[9px]"
                  >
                    {dinheiro(posicao.valor)}
                  </text>
                </g>
              );
            })}
            {/* Eixo direito do gasto. */}
            {[0, 0.5, 1].map((fracao) => (
              <text
                key={`e-${fracao}`}
                x={largura - 2}
                y={baseY - fracao * alturaPlot + 3}
                textAnchor="end"
                className="fill-dim text-[9px]"
              >
                {dinheiro(maxGasto * fracao)}
              </text>
            ))}
          </>
        ) : null}
      </svg>
      {temGasto ? (
        <p className="mt-1 text-[0.65rem] text-dim">
          Barras: {rotuloBarras} · Linha: investimento por faixa
        </p>
      ) : null}
    </div>
  );
}