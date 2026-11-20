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

const ALTURA = 210;
const BASE = 172;
const TOPO = 18;
const MARGEM_ESQ = 26;
const MARGEM_DIR = 14;

type Tipo = "feed" | "reels";

const TIPOS: { chave: Tipo; nome: string; cor: number }[] = [
  { chave: "feed", nome: "Feed", cor: 1 },
  { chave: "reels", nome: "Reels", cor: 0 },
];

const valorDoTipo = (d: DiaInstagram, tipo: Tipo) =>
  tipo === "feed" ? d.postsFeed : d.postsReels;

/** Postagens do perfil por dia, separadas em feed e Reels. */
export function GraficoPostsInstagram({ diario: diarioEntrada }: { diario: DiaInstagram[] }) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const [ref, largura] = useLargura(280);

  // Corta os dias futuros do período antes de desenhar. `posts` é 0 (não null)
  // nos dias sem publicação, então o sinal de "existe dado" é visita/seguidor.
  const diario = ateUltimoDado(
    diarioEntrada,
    (d) => d.visitas > 0 || d.seguidores > 0 || d.seguidoresTotal !== null,
  );

  // Série ausente (perfil não localizado): nada a desenhar.
  if (diario.every((d) => d.posts === null)) {
    return (
      <p className="text-sm text-dim">
        Não foi possível localizar o perfil do Instagram desta conta pelo token da Meta.
      </p>
    );
  }

  const plotW = Math.max(60, largura - MARGEM_ESQ - MARGEM_DIR);
  const plotH = BASE - TOPO;
  const passo = plotW / Math.max(1, diario.length);
  const centro = (i: number) => MARGEM_ESQ + passo * i + passo / 2;

  const max = Math.max(
    1,
    ...diario.map((d) => Math.max(d.postsFeed ?? 0, d.postsReels ?? 0)),
  );
  // Escala em números inteiros: "meio post" não existe.
  const topo = Math.max(1, Math.ceil(max * 1.25));
  const y = (v: number) => BASE - (v / topo) * plotH;

  // Três barras por dia; no mínimo 2px cada para continuar visíveis no mobile.
  const larguraBarra = Math.max(2, Math.min(12, (passo * 0.66) / TIPOS.length));
  const espaco = larguraBarra + 1;
  const salto = Math.max(
    1,
    Math.ceil(diario.length / Math.max(2, Math.floor(plotW / 40))),
  );

  return (
    <div className="w-full">
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-dim">
        {TIPOS.map((tipo) => (
          <span key={tipo.chave} className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-sm"
              style={{ backgroundColor: cor(tipo.cor) }}
              aria-hidden="true"
            />
            {tipo.nome}
          </span>
        ))}
        {ativo !== null && diario[ativo] ? (
          <span className="text-white">
            {diaCurto(diario[ativo].data)} · {diario[ativo].postsFeed ?? 0} feed ·{" "}
            {diario[ativo].postsReels ?? 0} reels
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
          aria-label="Postagens no Instagram por tipo, por dia"
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
                  x={MARGEM_ESQ - 4}
                  y={linhaY + 3}
                  textAnchor="end"
                  className="fill-dim text-[9px]"
                >
                  {Math.round(topo * fracao)}
                </text>
              </g>
            );
          })}

          {diario.map((d, i) => (
            <g key={d.data}>
              {TIPOS.map((tipo, t) => {
                const valor = valorDoTipo(d, tipo.chave) ?? 0;
                const xBarra = centro(i) - (espaco * TIPOS.length) / 2 + t * espaco;
                return (
                  <g key={tipo.chave}>
                    <rect
                      x={xBarra}
                      y={y(valor)}
                      width={larguraBarra}
                      height={Math.max(valor > 0 ? 2 : 0, BASE - y(valor))}
                      rx={1.5}
                      style={{ fill: cor(tipo.cor) }}
                      opacity={valor > 0 ? (ativo === i ? 1 : 0.9) : 0.2}
                    />
                    {/* Valor dentro do topo da barra só quando há espaço. */}
                    {valor > 0 && larguraBarra >= 9 ? (
                      <text
                        x={xBarra + larguraBarra / 2}
                        y={Math.max(TOPO, y(valor) - 3)}
                        textAnchor="middle"
                        className="fill-white text-[8px]"
                      >
                        {valor}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </g>
          ))}

          {diario.map((d, i) =>
            i % salto === 0 ? (
              <text
                key={`x-${d.data}`}
                x={centro(i)}
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