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

function inteiro(valor: number): string {
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

const ALTURA = 210;
const BASE = 172;
const TOPO = 14;
const MARGEM_ESQ = 40;
const MARGEM_DIR = 16;

/** Contorno escuro atrás do valor: legível mesmo sobre uma barra. */
const HALO = {
  stroke: "#141414",
  strokeWidth: 2.5,
  paintOrder: "stroke" as const,
};

/**
 * Barras agrupadas de visitas ao perfil e seguidores por dia, na mesma
 * escala. A barra de seguidores é empilhada: orgânicos embaixo, os do
 * tráfego pago em cima — a altura total é o total de seguidores do dia.
 */
export function GraficoInstagram({ diario: diarioEntrada }: { diario: DiaInstagram[] }) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const [ref, largura] = useLargura(300);

  // Corta os dias futuros do período (sem visita nem seguidor) antes de desenhar.
  const diario = ateUltimoDado(
    diarioEntrada,
    (d) => d.visitas > 0 || d.seguidores > 0 || d.seguidoresTotal !== null,
  );

  const plotW = Math.max(80, largura - MARGEM_ESQ - MARGEM_DIR);
  const plotH = BASE - TOPO;
  const passo = plotW / Math.max(1, diario.length);

  // Sem o total do perfil, não há como separar: a barra mostra o pago inteiro.
  const temSeparacao = diario.some((d) => d.seguidoresTotal !== null);
  const totalDoDia = (d: DiaInstagram) => d.seguidoresTotal ?? d.seguidores;
  // Total desconhecido (dia ainda não consolidado) = nenhum orgânico a exibir;
  // a barra inteira é o pago, em vez de pintar o pago como se fosse orgânico.
  const organicosDoDia = (d: DiaInstagram) => d.seguidoresOrganicos ?? 0;

  // Quando o número do gráfico vem do perfil inteiro, as visitas dos anúncios
  // aparecem ao lado como barra menor: é o número que o cliente vê no
  // Gerenciador e o que ele usa para cobrar o resultado da campanha.
  const mostraAnuncios = diario.some((d) => d.visitasDoPerfil && d.visitasAnuncios > 0);

  const max = Math.max(
    1,
    ...diario.map((d) => Math.max(d.visitas, totalDoDia(d))),
  );
  // Folga no topo para o rótulo do maior valor caber dentro do SVG.
  const escala = max * 1.15;

  const y = (v: number) => BASE - (v / escala) * plotH;
  const centro = (i: number) => MARGEM_ESQ + passo * i + passo / 2;

  const larguraBarra = Math.max(3, Math.min(16, passo * 0.3));
  const saltoX = Math.max(1, Math.ceil(diario.length / Math.max(2, Math.floor(plotW / 40))));
  // Cada coluna tem dois rótulos; só cabem quando o dia é largo o bastante.
  const mostrarValores = passo >= 34;

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-dim">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ backgroundColor: cor(0) }} aria-hidden="true" />
          {mostraAnuncios ? "Visitas ao perfil (total)" : "Visitas ao perfil"}
        </span>
        {mostraAnuncios ? (
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ backgroundColor: cor(4) }} aria-hidden="true" />
            Visitas pelo tráfego pago
          </span>
        ) : null}
        {temSeparacao ? (
          <>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ backgroundColor: cor(2) }} aria-hidden="true" />
              Seguidores do tráfego pago
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ backgroundColor: cor(1) }} aria-hidden="true" />
              Seguidores orgânicos
            </span>
          </>
        ) : (
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ backgroundColor: cor(1) }} aria-hidden="true" />
            Seguidores
          </span>
        )}
        {ativo !== null && diario[ativo] ? (
          <span className="text-white">
            {diaCurto(diario[ativo].data)} · {inteiro(diario[ativo].visitas)} visitas
            {mostraAnuncios
              ? ` (${inteiro(diario[ativo].visitasAnuncios)} do tráfego pago)`
              : ""}
            {temSeparacao
              ? ` · ${inteiro(totalDoDia(diario[ativo]))} seguidores (${inteiro(
                  organicosDoDia(diario[ativo]),
                )} orgânicos · ${inteiro(diario[ativo].seguidores)} pago)`
              : ` · ${inteiro(diario[ativo].seguidores)} seguidores`}
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
          aria-label="Visitas ao perfil e seguidores por dia"
        >
          {[0, 0.5, 1].map((fracao) => {
            const linhaY = y(max * fracao);
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
                  {Math.round(max * fracao)}
                </text>
              </g>
            );
          })}

          {diario.map((d, i) => {
            const total = totalDoDia(d);
            const organicos = organicosDoDia(d);
            const pago = d.seguidoresTotal === null ? d.seguidores : Math.max(0, total - organicos);
            const topoTotal = y(total);
            // Pago na base, orgânico em cima: o topo da pilha é o total do dia.
            const topoPago = y(pago);
            const textoVisitas = inteiro(d.visitas);
            const textoSeguidores = inteiro(total);
            const mostra = mostrarValores && i % Math.max(1, Math.ceil((7 * 5.4 + 6) / passo)) === 0;
            return (
              <g key={d.data}>
                <rect
                  x={centro(i) - larguraBarra - 1}
                  y={y(d.visitas)}
                  width={larguraBarra}
                  height={Math.max(1, BASE - y(d.visitas))}
                  rx={2}
                  style={{ fill: ativo === i ? cor(4) : cor(0) }}
                  opacity={d.visitas > 0 ? 1 : 0.2}
                />
                {mostraAnuncios ? (
                  <rect
                    x={centro(i) - larguraBarra - 1}
                    y={y(d.visitasAnuncios)}
                    width={larguraBarra}
                    height={Math.max(d.visitasAnuncios > 0 ? 1 : 0, BASE - y(d.visitasAnuncios))}
                    rx={2}
                    style={{ fill: cor(4) }}
                    opacity={d.visitasAnuncios > 0 ? 1 : 0.2}
                  />
                ) : null}
                {/* Tráfego pago na base da pilha. */}
                <rect
                  x={centro(i) + 1}
                  y={topoPago}
                  width={larguraBarra}
                  height={Math.max(pago > 0 ? 1 : 0, BASE - topoPago)}
                  rx={2}
                  style={{ fill: cor(2) }}
                  opacity={pago > 0 ? 1 : 0.2}
                />
                {/* Orgânicos empilhados em cima. */}
                {organicos > 0 ? (
                  <rect
                    x={centro(i) + 1}
                    y={topoTotal}
                    width={larguraBarra}
                    height={Math.max(1, topoPago - topoTotal)}
                    rx={2}
                    style={{ fill: ativo === i ? cor(5) : cor(1) }}
                  />
                ) : null}
                {mostra ? (
                  <>
                    <text
                      x={centro(i) - larguraBarra / 2 - 1}
                      y={Math.max(TOPO + 7, y(d.visitas) - 4)}
                      textAnchor="middle"
                      style={{ fill: cor(0), ...HALO }}
                      className="text-[9px]"
                    >
                      {textoVisitas}
                    </text>
                    <text
                      x={centro(i) + larguraBarra / 2 + 1}
                      y={Math.max(TOPO + 7, topoTotal - 4)}
                      textAnchor="middle"
                      style={{ fill: "#ffffff", ...HALO }}
                      className="text-[9px]"
                    >
                      {textoSeguidores}
                    </text>
                  </>
                ) : null}
              </g>
            );
          })}

          {diario.map((d, i) =>
            i % saltoX === 0 ? (
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