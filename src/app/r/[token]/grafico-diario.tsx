"use client";

import { useState } from "react";

import { cor } from "./paleta";
import { ateUltimoDado } from "./recorte";
import { useLargura } from "./use-largura";

function moeda(valor: number | null): string {
  if (valor === null) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function diaCurto(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

function inteiro(valor: number): string {
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

const ALTURA = 224;
const BASE = 186;
const TOPO = 16;
const MARGEM_ESQ = 44;
const MARGEM_DIR = 60;

/** Contorno escuro atrás do valor: legível mesmo sobre barra ou linha. */
const HALO = {
  stroke: "#141414",
  strokeWidth: 2.5,
  paintOrder: "stroke" as const,
};

export type PontoDiario = {
  data: string;
  /** Série principal, desenhada como linha. */
  valor: number;
  /** Série de dinheiro por unidade, desenhada como barra. */
  custo: number | null;
  /** Dinheiro por mil impressões, para o gráfico de CPM. */
  cpm: number | null;
};

/**
 * Dois gráficos na mesma base:
 * - `serie="combinado"`: linha dos valores + barras do custo unitário.
 * - `serie="cpm"`: linha do CPM (custo por mil impressões).
 * Desenhado na largura disponível, sem rolagem horizontal: o SVG encolhe e os
 * rótulos são redistribuídos (mostrados a cada N dias quando não couberem).
 */
export function GraficoDiario({
  pontos: pontosEntrada,
  serie,
  rotuloValor,
  rotuloCusto,
}: {
  pontos: PontoDiario[];
  serie: "combinado" | "cpm";
  rotuloValor: string;
  rotuloCusto: string;
}) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const [ref, largura] = useLargura(260);

  // Corta os dias futuros do período (sem entrega) antes de desenhar.
  const pontos = ateUltimoDado(
    pontosEntrada,
    (p) => p.valor > 0 || p.custo !== null || p.cpm !== null,
  );

  const plotW = Math.max(80, largura - MARGEM_ESQ - MARGEM_DIR);
  const plotH = BASE - TOPO;
  const passo = plotW / Math.max(1, pontos.length);
  const x = (i: number) => MARGEM_ESQ + passo * i + passo / 2;

  // Cada série tem sua escala; 18% de topo livre para o rótulo do maior valor.
  const escala = (valores: (number | null)[]) => {
    const validos = valores.filter((v): v is number => v !== null);
    return Math.max(1, ...validos) * 1.18;
  };

  const valoresValor = pontos.map((p) => p.valor);
  const valoresCusto = pontos.map((p) => (serie === "cpm" ? p.cpm : p.custo));
  const escalaValor = escala(valoresValor);
  const escalaCusto = escala(valoresCusto);

  const yValor = (v: number) => BASE - (v / escalaValor) * plotH;
  const yCusto = (v: number) => BASE - (v / escalaCusto) * plotH;

  const pontosValor = pontos.map((p, i) => `${x(i)},${yValor(p.valor)}`).join(" ");
  const pontosCusto = pontos
    .map((p, i) => {
      const v = serie === "cpm" ? p.cpm : p.custo;
      return v === null ? null : `${x(i)},${yCusto(v)}`;
    })
    .filter(Boolean)
    .join(" ");

  // Eixo X: no máximo ~8 datas, para não virar poeira.
  const saltoData = Math.max(
    1,
    Math.ceil(pontos.length / Math.max(2, Math.floor(plotW / 44))),
  );

  // Rótulos de valor: um precisa de ~5,4px por caractere. Se não couber em todo
  // dia, mostra a cada N dias (o valor do dia segue no tooltip do hover).
  const maiorRotulo = Math.max(
    ...pontos.map((p) =>
      Math.max(moeda(p.custo).length, moeda(p.cpm).length, inteiro(p.valor).length),
    ),
  );
  const passoRotulo = Math.max(1, Math.ceil((maiorRotulo * 5.4 + 10) / passo));
  const cabeValor = (i: number) => i % passoRotulo === 0;

  return (
    <div className="w-full">
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-dim">
        {serie === "combinado" ? (
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded" style={{ backgroundColor: cor(1) }} aria-hidden="true" />
            {rotuloValor}
          </span>
        ) : null}
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ backgroundColor: cor(0) }} aria-hidden="true" />
          {serie === "cpm" ? "CPM (custo por mil impressões)" : rotuloCusto}
        </span>
        {ativo !== null && pontos[ativo] ? (
          <span className="text-white">
            {diaCurto(pontos[ativo].data)} · {inteiro(pontos[ativo].valor)}{" "}
            {rotuloValor.toLowerCase()} ·{" "}
            {serie === "cpm"
              ? `CPM ${moeda(pontos[ativo].cpm)}`
              : moeda(pontos[ativo].custo)}
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
          aria-label={
            serie === "cpm"
              ? `CPM diário (custo por mil impressões) — ${rotuloValor}`
              : `${rotuloValor} e ${rotuloCusto.toLowerCase()}, por dia`
          }
        >
          {/* Grade; no CPM só há a escala de dinheiro. */}
          {[0, 0.5, 1].map((fracao) => {
            const linhaY =
              serie === "cpm" ? yCusto(escalaCusto * fracao) : yValor(escalaValor * fracao);
            return (
              <g key={fracao}>
                <line
                  x1={MARGEM_ESQ}
                  x2={largura - MARGEM_DIR}
                  y1={linhaY}
                  y2={linhaY}
                  className="stroke-line"
                  strokeDasharray={fracao === 0 ? undefined : "3 4"}
                />
                {serie === "combinado" ? (
                  <text
                    x={MARGEM_ESQ - 6}
                    y={linhaY + 3}
                    textAnchor="end"
                    className="fill-dim text-[9px]"
                  >
                    {Math.round((escalaValor * fracao) / 1.18)}
                  </text>
                ) : null}
                <text
                  x={serie === "cpm" ? MARGEM_ESQ - 6 : largura - MARGEM_DIR + 6}
                  y={yCusto(escalaCusto * fracao) + 3}
                  textAnchor={serie === "cpm" ? "end" : "start"}
                  className="fill-dim text-[9px]"
                >
                  {moeda((escalaCusto * fracao) / 1.18)}
                </text>
              </g>
            );
          })}

          {/* Barras do custo unitário, desenhadas antes da linha. */}
          {serie === "combinado"
            ? pontos.map((p, i) => {
                if (p.custo === null) return null;
                const topoBarra = yCusto(p.custo);
                const alturaBarra = Math.max(1, BASE - topoBarra);
                const texto = moeda(p.custo);
                // Barra alta: valor branco dentro dela. Baixa: acima, com halo.
                const dentro = alturaBarra >= 22;
                return (
                  <g key={`b-${p.data}`}>
                    <rect
                      x={x(i) - 7}
                      y={topoBarra}
                      width={14}
                      height={alturaBarra}
                      rx={2}
                      style={{ fill: ativo === i ? cor(2) : cor(0) }}
                      opacity={0.85}
                    />
                    {cabeValor(i) ? (
                      <text
                        x={x(i)}
                        y={dentro ? BASE - 5 : Math.max(TOPO + 8, topoBarra - 4)}
                        textAnchor="middle"
                        style={
                          dentro ? { fill: "#ffffff" } : { fill: cor(0), ...HALO }
                        }
                        className="text-[9px] font-medium"
                      >
                        {texto}
                      </text>
                    ) : null}
                  </g>
                );
              })
            : null}

          {serie === "combinado" ? (
            <>
              <polyline
                points={pontosValor}
                fill="none"
                style={{ stroke: cor(1) }}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {pontos.map((p, i) => (
                <g key={`c-${p.data}`}>
                  <circle
                    cx={x(i)}
                    cy={yValor(p.valor)}
                    r={ativo === i ? 4 : 2.5}
                    style={{ fill: cor(1) }}
                  />
                  {cabeValor(i) ? (
                    <text
                      x={x(i)}
                      y={Math.max(TOPO + 7, yValor(p.valor) - 6)}
                      textAnchor="middle"
                      style={{ fill: cor(1), ...HALO }}
                      className="text-[9px]"
                    >
                      {inteiro(p.valor)}
                    </text>
                  ) : null}
                </g>
              ))}
            </>
          ) : (
            <>
              <polyline
                points={pontosCusto}
                fill="none"
                style={{ stroke: cor(0) }}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {pontos.map((p, i) => {
                const v = serie === "cpm" ? p.cpm : p.custo;
                return v === null ? null : (
                  <g key={`c-${p.data}`}>
                    <circle
                      cx={x(i)}
                      cy={yCusto(v)}
                      r={ativo === i ? 4 : 2.5}
                      style={{ fill: cor(0) }}
                    />
                    {cabeValor(i) ? (
                      <text
                        x={x(i)}
                        y={Math.max(TOPO + 7, yCusto(v) - 6)}
                        textAnchor="middle"
                        style={{ fill: cor(0), ...HALO }}
                        className="text-[9px]"
                      >
                        {moeda(v)}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </>
          )}

          {pontos.map((p, i) =>
            i % saltoData === 0 ? (
              <text
                key={`x-${p.data}`}
                x={x(i)}
                y={BASE + 16}
                textAnchor="middle"
                className="fill-dim text-[9px]"
              >
                {diaCurto(p.data)}
              </text>
            ) : null,
          )}

          {pontos.map((p, i) => (
            <rect
              key={`h-${p.data}`}
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