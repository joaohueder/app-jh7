"use client";

import { useState } from "react";

import type { DiaInstagram } from "@/lib/meta/relatorio";
import { cor } from "./paleta";
import { ateUltimoDado } from "./recorte";
import { useLargura } from "./use-largura";

function diaCurto(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

function inteiro(valor: number | null): string {
  if (valor === null) return "—";
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

const ALTURA = 220;
const BASE = 176;
const TOPO = 20;
const MARGEM_ESQ = 46;
const MARGEM_DIR = 18;

const HALO = {
  stroke: "#141414",
  strokeWidth: 2.5,
  paintOrder: "stroke" as const,
};

/**
 * Visualizações do perfil por dia, comparadas com a janela anterior.
 * Mesma mecânica do CPM/CTR da conta: linha cheia no período, tracejada no
 * anterior, e a série anterior entra no mesmo índice de dia.
 */
export function GraficoViews({
  diario: diarioEntrada,
  anterior = [],
}: {
  diario: DiaInstagram[];
  anterior?: { data: string; valor: number }[];
}) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const [ref, largura] = useLargura(280);

  // Corta os dias futuros do período (sem views) antes de desenhar.
  const diario = ateUltimoDado(diarioEntrada, (d) => d.views !== null);

  const temViews = diario.some((d) => d.views !== null);
  if (!temViews) {
    return (
      <p className="text-sm text-dim">
        Não foi possível ler as visualizações do perfil pelo token da Meta.
      </p>
    );
  }

  const plotW = Math.max(80, largura - MARGEM_ESQ - MARGEM_DIR);
  const plotH = BASE - TOPO;
  const passo = plotW / Math.max(1, diario.length);
  const x = (i: number) => MARGEM_ESQ + passo * i + passo / 2;

  const validos = diario.map((d) => d.views).filter((v): v is number => v !== null);
  const validosAnteriores = anterior.map((d) => d.valor);
  const max = Math.max(1, ...validos, ...validosAnteriores) * 1.18;
  const y = (v: number) => BASE - (v / max) * plotH;

  const pontos = diario
    .map((d, i) => (d.views === null ? null : `${x(i)},${y(d.views)}`))
    .filter(Boolean)
    .join(" ");
  const pontosAnteriores = anterior
    .slice(0, diario.length)
    .map((d, i) => `${x(i)},${y(d.valor)}`)
    .join(" ");

  const salto = Math.max(1, Math.ceil(diario.length / Math.max(2, Math.floor(plotW / 44))));
  const maiorTexto = Math.max(...validos.map((v) => inteiro(v).length));
  const passoRotulo = Math.max(1, Math.ceil((maiorTexto * 5.2 + 8) / passo));

  return (
    <div className="w-full">
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-dim">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ backgroundColor: cor(0) }} aria-hidden="true" />
          Visualizações
        </span>
        {pontosAnteriores ? (
          <span className="flex items-center gap-1.5">
            <span
              className="h-0.5 w-4 rounded opacity-70"
              style={{
                backgroundImage: `repeating-linear-gradient(90deg, ${cor(0)} 0 3px, transparent 3px 6px)`,
              }}
              aria-hidden="true"
            />
            Período anterior
          </span>
        ) : null}
        {ativo !== null && diario[ativo] ? (
          <span className="text-white">
            {diaCurto(diario[ativo].data)} · {inteiro(diario[ativo].views)}
            {anterior[ativo] ? ` · anterior: ${inteiro(anterior[ativo].valor)}` : ""}
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
          aria-label="Visualizações do Instagram por dia"
        >
          {[0, 0.5, 1].map((fracao) => {
            const linhaY = BASE - fracao * plotH;
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
                <text
                  x={MARGEM_ESQ - 6}
                  y={linhaY + 3}
                  textAnchor="end"
                  className="fill-dim text-[9px]"
                >
                  {inteiro(Math.round((max * fracao) / 1.18))}
                </text>
              </g>
            );
          })}

          {pontosAnteriores ? (
            <polyline
              points={pontosAnteriores}
              fill="none"
              style={{ stroke: cor(0) }}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              opacity={0.55}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}

          <polyline
            points={pontos}
            fill="none"
            style={{ stroke: cor(0) }}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {diario.map((d, i) => {
            if (d.views === null) return null;
            return (
              <g key={d.data}>
                <circle
                  cx={x(i)}
                  cy={y(d.views)}
                  r={ativo === i ? 4 : 2.5}
                  style={{ fill: cor(0) }}
                />
                {i % passoRotulo === 0 ? (
                  <text
                    x={x(i)}
                    y={Math.max(TOPO + 7, y(d.views) - 7)}
                    textAnchor="middle"
                    style={{ fill: cor(0), ...HALO }}
                    className="text-[9px] font-medium"
                  >
                    {inteiro(d.views)}
                  </text>
                ) : null}
              </g>
            );
          })}

          {diario.map((d, i) =>
            i % salto === 0 ? (
              <text
                key={`x-${d.data}`}
                x={x(i)}
                y={BASE + 16}
                textAnchor="middle"
                className="fill-dim text-[9px]"
              >
                {diaCurto(d.data)}
              </text>
            ) : null,
          )}

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