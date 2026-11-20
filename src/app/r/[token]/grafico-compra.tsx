"use client";

import { useState } from "react";

import type { DiaCompra } from "@/lib/meta/relatorio";
import { cor } from "./paleta";
import { useLargura } from "./use-largura";

/** Contorno escuro atrás do valor: mantém legível mesmo sobre uma barra. */
const HALO = {
  stroke: "#141414",
  strokeWidth: 2.5,
  paintOrder: "stroke" as const,
};

function moeda(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function diaCurto(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

const ALTURA = 200;
const BASE = 168;
const TOPO = 12;
const MARGEM_ESQ = 44;
const MARGEM_DIR = 36;

/**
 * Barras = faturamento por dia (eixo esquerdo), linha = compras por dia
 * (eixo direito). SVG puro: uma dependência de gráfico não se paga para
 * duas séries dentro de um relatório.
 */
export function GraficoCompra({ diario }: { diario: DiaCompra[] }) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const [ref, largura] = useLargura(320);

  const plotW = Math.max(80, largura - MARGEM_ESQ - MARGEM_DIR);
  const plotH = BASE - TOPO;

  const maxFat = Math.max(1, ...diario.map((d) => d.faturamento));
  const maxCompras = Math.max(1, ...diario.map((d) => d.compras));
  // Folga no topo para os rótulos de valor não saírem do gráfico.
  const escalaFat = maxFat * 1.15;
  const escalaCompras = maxCompras * 1.15;

  const passo = plotW / Math.max(1, diario.length);
  const larguraBarra = Math.max(4, Math.min(22, passo * 0.55));

  const yFat = (v: number) => BASE - (v / escalaFat) * plotH;
  const yCompras = (v: number) => BASE - (v / escalaCompras) * plotH;
  const x = (i: number) => MARGEM_ESQ + passo * i + passo / 2;

  const pontos = diario.map((d, i) => `${x(i)},${yCompras(d.compras)}`).join(" ");

  // Datas do eixo X: quantas couberem na largura, no máximo ~8.
  const salto = Math.max(1, Math.ceil(diario.length / Math.max(2, Math.floor(plotW / 44))));

  /**
   * Rótulos de valor: com passo estreito, mostrar a cada N dias em vez de
   * esconder. Mesmo cálculo para a barra (faturamento) e para o ponto (compras).
   */
  const maiorTexto = Math.max(
    ...diario.map((d) => Math.max(moeda(d.faturamento).length, String(d.compras).length)),
  );
  const passoRotulo = Math.max(1, Math.ceil((maiorTexto * 5.4 + 8) / passo));

  /**
   * Posição dos dois rótulos calculada junto: o de faturamento fica acima da
   * barra, o de compras acima/abaixo do ponto. Quando caem na mesma faixa
   * vertical, o de faturamento sobe — a barra tem folga no topo — em vez de
   * encostar o halo no do outro.
   */
  /**
 * Rótulo de compras ao lado do ponto quando os dois caem na mesma faixa
 * vertical. O deslocamento é a metade da largura do rótulo de faturamento
 * (que fica centrado na barra) mais uma folga — com 9px fixos o halo ainda
 * encostava no texto. No último dia o rótulo sairia por cima do eixo direito,
 * então nesse caso ele vai para a esquerda do ponto.
   */
  const rotulos = diario.map((d, i) => {
    const acima = yCompras(d.compras) < yFat(d.faturamento) - 10;
    const comprasY = acima ? yCompras(d.compras) - 7 : yCompras(d.compras) + 13;
    const fatY = Math.max(TOPO + 7, yFat(d.faturamento) - 6);
    const larguraFat = moeda(d.faturamento).length * 5.2;
    const colide = Math.abs(comprasY - fatY) < 20;
    const deslocaX = colide ? Math.round(larguraFat / 2 + 5) : 0;
    const larguraCompras = String(d.compras).length * 5.6 + 4;
    const paraEsquerda =
      deslocaX > 0 && x(i) + deslocaX + larguraCompras > largura - MARGEM_DIR;
    return {
      comprasY,
      fatY,
      deslocaX: deslocaX ? (paraEsquerda ? -deslocaX : deslocaX) : 0,
    };
  });

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-dim">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ backgroundColor: cor(1) }} aria-hidden="true" />
          Faturamento
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ backgroundColor: cor(0) }} aria-hidden="true" />
          Compras
        </span>
        {ativo !== null && diario[ativo] ? (
          <span className="text-white">
            {diaCurto(diario[ativo].data)} · {moeda(diario[ativo].faturamento)} ·{" "}
            {diario[ativo].compras.toLocaleString("pt-BR")} compras
          </span>
        ) : null}
      </div>

      <div ref={ref} className="w-full">
        <svg
          viewBox={`0 0 ${largura} ${ALTURA}`}
          width="100%"
          height={ALTURA}
          className="block"
          role="img"
          aria-label="Faturamento e compras por dia"
        >
          {/* Grade e eixo esquerdo (faturamento) */}
          {[0, 0.5, 1].map((fracao) => {
            const y = yFat(maxFat * fracao);
            return (
              <g key={fracao}>
                <line
                  x1={MARGEM_ESQ}
                  x2={largura - MARGEM_DIR}
                  y1={y}
                  y2={y}
                  className="stroke-line"
                  strokeDasharray={fracao === 0 ? undefined : "3 4"}
                />
                <text
                  x={MARGEM_ESQ - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-dim text-[9px]"
                >
                  {moeda(maxFat * fracao)}
                </text>
                <text
                  x={largura - MARGEM_DIR + 6}
                  y={y + 3}
                  textAnchor="start"
                  className="fill-dim text-[9px]"
                >
                  {Math.round(maxCompras * fracao)}
                </text>
              </g>
            );
          })}

          {/* Barras de faturamento — verde-limão do logotipo */}
          {diario.map((d, i) => {
            const altura = BASE - yFat(d.faturamento);
            const texto = moeda(d.faturamento);
            const yTexto = rotulos[i].fatY;
            return (
              <g key={d.data}>
                <rect
                  x={x(i) - larguraBarra / 2}
                  y={yFat(d.faturamento)}
                  width={larguraBarra}
                  height={Math.max(0, altura)}
                  rx={2}
                  style={{ fill: ativo === i ? cor(5) : cor(1) }}
                  opacity={d.faturamento > 0 ? 1 : 0.15}
                />
                {i % passoRotulo === 0 ? (
                  <text
                    x={x(i)}
                    y={yTexto}
                    textAnchor="middle"
                    style={{ fill: cor(1), ...HALO }}
                    className="text-[9px]"
                  >
                    {texto}
                  </text>
                ) : null}
              </g>
            );
          })}

          {/* Linha de compras — laranja da marca, para contrastar com a barra */}
          <polyline
            points={pontos}
            fill="none"
            style={{ stroke: cor(0) }}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {diario.map((d, i) => {
            const texto = d.compras.toLocaleString("pt-BR");
            const yRotuloCompras = rotulos[i].comprasY;
            // Se ainda cair sobre o rótulo do faturamento, desloca para o lado.
            const deslocaX = rotulos[i].deslocaX;
            const desloca = deslocaX > 0 || Math.abs(yRotuloCompras - rotulos[i].fatY) < 12;
            return (
              <g key={`p-${d.data}`}>
                <circle
                  cx={x(i)}
                  cy={yCompras(d.compras)}
                  r={ativo === i ? 4 : 2.5}
                  style={{ fill: cor(0) }}
                />
                {i % passoRotulo === 0 ? (
                  <text
                    x={desloca ? x(i) + (deslocaX || 9) : x(i)}
                    y={yRotuloCompras}
                    textAnchor={deslocaX < 0 ? "end" : desloca ? "start" : "middle"}
                    style={{ fill: cor(0), ...HALO }}
                    className="text-[9px]"
                  >
                    {texto}
                  </text>
                ) : null}
              </g>
            );
          })}

          {/* Rótulos do eixo X */}
          {diario.map((d, i) =>
            i % salto === 0 ? (
              <text
                key={`x-${d.data}`}
                x={x(i)}
                y={BASE + 14}
                textAnchor="middle"
                className="fill-dim text-[9px]"
              >
                {diaCurto(d.data)}
              </text>
            ) : null,
          )}

          {/* Área de hover — um alvo por dia, mais fácil que por barra */}
          {diario.map((d, i) => (
            <rect
              key={`h-${d.data}`}
              x={MARGEM_ESQ + passo * i}
              y={TOPO}
              width={passo}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setAtivo(i)}
              onMouseLeave={() => setAtivo(null)}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}