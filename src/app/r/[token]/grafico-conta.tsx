"use client";

import { useState } from "react";

import type { DiaConta } from "@/lib/meta/relatorio";
import { cor } from "./paleta";
import { useLargura } from "./use-largura";

function diaCurto(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

function moeda(valor: number | null): string {
  if (valor === null) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function percentual(valor: number | null): string {
  if (valor === null) return "—";
  return `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

const ALTURA = 210;
const BASE = 172;
const TOPO = 18;
const MARGEM_ESQ = 50;
const MARGEM_DIR = 44;

const HALO = {
  stroke: "#141414",
  strokeWidth: 2.5,
  paintOrder: "stroke" as const,
};

/**
 * Série diária de uma métrica de leilão da conta inteira (CPM ou CTR).
 * Linha cheia no período, tracejada no período anterior, eixo próprio e
 * valor sobre cada ponto.
 */
export function GraficoConta({
  diario,
  anterior = [],
  metrica,
}: {
  diario: DiaConta[];
  /** Mesma métrica na janela anterior, para comparação. */
  anterior?: DiaConta[];
  metrica: "cpm" | "ctr";
}) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const [ref, largura] = useLargura(280);

  const formatar = metrica === "cpm" ? moeda : percentual;
  const rotulo = metrica === "cpm" ? "CPM" : "CTR no link";
  const descricao =
    metrica === "cpm" ? "Custo por mil impressões" : "Cliques no link ÷ impressões";

  const plotW = Math.max(80, largura - MARGEM_ESQ - MARGEM_DIR);
  const plotH = BASE - TOPO;

  // Recorta as duas séries no último dia que tem dado. O período do relatório
  // pode ir além (dias futuros) e a janela anterior costuma ter um ou dois
  // dias com entrega: desenhar os slots vazios punha o ponto do período
  // anterior no lugar de um dia futuro.
  const ultimoComDado = (serie: DiaConta[]) => {
    let ultimo = -1;
    serie.forEach((d, i) => {
      if (d[metrica] !== null) ultimo = i;
    });
    return ultimo;
  };
  const fimAtual = ultimoComDado(diario);
  const atualVisivel = fimAtual >= 0 ? diario.slice(0, fimAtual + 1) : diario;
  // Alinhamento pelo INÍCIO: 1º dia atual ↔ 1º dia anterior, 2º ↔ 2º...
  // As duas janelas têm a mesma duração, então esse é o par correto — 20/11
  // (5º dia) compara com 13/11 (5º dia). Cortar pelo fim deslocava a série em
  // tantos dias quantos fossem futuros, e o dia do período atual acabava
  // empatado com um dia vazio da janela anterior.
  const anteriorVisivel = anterior.slice(0, atualVisivel.length);

  const passo = plotW / Math.max(1, atualVisivel.length);
  const x = (i: number) => MARGEM_ESQ + passo * i + passo / 2;

  const valores = atualVisivel.map((d) => d[metrica]);
  const validos = valores.filter((v): v is number => v !== null);
  // A escala cobre as duas séries: comparar exige o mesmo eixo.
  const valoresAnteriores = anteriorVisivel.map((d) => d[metrica]);
  const validosAnteriores = valoresAnteriores.filter((v): v is number => v !== null);
  const max = Math.max(0.0001, ...validos, ...validosAnteriores) * 1.18;
  const y = (v: number) => BASE - (v / max) * plotH;

  // A série anterior entra no mesmo índice de dia (1º dia com 1º dia...).
  const comoPontos = (serie: DiaConta[]) =>
    serie
      .map((d, i) => {
        const v = d[metrica];
        return v === null ? null : `${x(i)},${y(v)}`;
      })
      .filter(Boolean)
      .join(" ");

  const pontos = comoPontos(atualVisivel);
  const pontosAnteriores = comoPontos(anteriorVisivel);

  const salto = Math.max(
    1,
    Math.ceil(atualVisivel.length / Math.max(2, Math.floor(plotW / 44))),
  );

  // Rótulo de cada ponto quando couber; senão a cada N dias.
  const maiorTexto = Math.max(...valores.map((v) => formatar(v).length));
  const passoRotulo = Math.max(1, Math.ceil((maiorTexto * 5.2 + 8) / passo));

  return (
    <div className="w-full">
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-dim">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ backgroundColor: cor(0) }} aria-hidden="true" />
          {descricao}
        </span>
        {validosAnteriores.length && pontosAnteriores ? (
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
        {ativo !== null && atualVisivel[ativo] ? (
          <span className="text-white">
            {diaCurto(atualVisivel[ativo].data)} · {formatar(atualVisivel[ativo][metrica])}
            {anteriorVisivel[ativo]?.[metrica] != null
              ? ` · anterior: ${formatar(anteriorVisivel[ativo][metrica] as number)}`
              : ""}
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
          aria-label={`${rotulo} diário da conta`}
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
                  {formatar((max * fracao) / 1.18)}
                </text>
              </g>
            );
          })}

          {/* Período anterior por baixo: a comparação não deve competir
              visualmente com a série do período. */}
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
          {/* Com um único dia o polyline não desenha nada: o marcador garante
              que o ponto do período anterior apareça. */}
          {anteriorVisivel.map((d, i) => {
            const v = d[metrica];
            if (v === null) return null;
            return (
              <g key={`ant-${d.data}`}>
                <circle
                  cx={x(i)}
                  cy={y(v)}
                  r={2.5}
                  fill="none"
                  style={{ stroke: cor(0) }}
                  strokeWidth={1.5}
                  strokeDasharray="2 2"
                  opacity={0.7}
                />
                {/* Valor do período anterior: sem ele a linha tracejada não
                    diz nada — o leitor comparava no olho. */}
                {i % passoRotulo === 0 ? (
                  <text
                    x={x(i)}
                    y={Math.min(BASE - 4, y(v) + 12)}
                    textAnchor="middle"
                    className="fill-dim text-[9px]"
                    opacity={0.85}
                  >
                    {formatar(v)}
                  </text>
                ) : null}
              </g>
            );
          })}

          <polyline
            points={pontos}
            fill="none"
            style={{ stroke: cor(0) }}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {atualVisivel.map((d, i) => {
            const v = d[metrica];
            if (v === null) return null;
            return (
              <g key={d.data}>
                <circle
                  cx={x(i)}
                  cy={y(v)}
                  r={ativo === i ? 4 : 2.5}
                  style={{ fill: cor(0) }}
                />
                {i % passoRotulo === 0 ? (
                  <text
                    x={x(i)}
                    y={Math.max(TOPO + 7, y(v) - 7)}
                    textAnchor="middle"
                    style={{ fill: cor(0), ...HALO }}
                    className="text-[9px] font-medium"
                  >
                    {formatar(v)}
                  </text>
                ) : null}
              </g>
            );
          })}

          {atualVisivel.map((d, i) =>
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

          {atualVisivel.map((d, i) => (
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