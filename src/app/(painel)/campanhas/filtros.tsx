"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import {
  PERIODOS,
  PERIODO_LABELS,
  STATUS_LABELS,
  STATUS_VALORES,
  type FiltroStatus,
  type PeriodoCampanha,
} from "@/lib/meta/insights";
import { AtualizarDados } from "./atualizar-dados";

/**
 * Filtros globais do módulo Campanhas. Ficam na URL (`?periodo=&status=`),
 * então a escolha é preservada ao navegar entre cliente/campanha/conjunto.
 * O período "Personalizado" usa `de`/`ate` (ISO) e só é aplicado quando as
 * duas datas estão preenchidas e em ordem.
 *
 * À direita ficam o botão "Atualizar dados" e a idade do que está na tela:
 * o módulo não consulta a Meta sozinho.
 */
export function FiltrosCampanhas({
  periodo,
  status,
  de = "",
  ate = "",
  clientId = null,
  ultimaAtualizacao = null,
  agoraInicial,
  campanhaId,
  conjuntoId,
  objetivoCodigo,
  destino,
}: {
  periodo: PeriodoCampanha;
  status: FiltroStatus;
  de?: string;
  ate?: string;
  /** `null` na tela inicial: o botão atualiza todos os clientes do filtro. */
  clientId?: number | null;
  /** Milissegundos da última consulta à Meta; `null` = nunca atualizado. */
  ultimaAtualizacao?: number | null;
  /** Horário do servidor, repassado para o relógio do botão. */
  agoraInicial: number;
  /** Nível aberto, para o botão renovar o que está na tela. */
  campanhaId?: string;
  conjuntoId?: string;
  objetivoCodigo?: string | null;
  destino?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pendente, start] = useTransition();
  // Datas digitadas antes do intervalo completo; partem do que veio na URL.
  const [datas, setDatas] = useState({ de, ate });

  function ir(params: URLSearchParams) {
    start(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  function atualizar(chave: "periodo" | "status", valor: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(chave, valor);
    // Fora do personalizado as datas não fazem sentido na URL.
    if (chave === "periodo" && valor !== "custom") {
      params.delete("de");
      params.delete("ate");
    }
    ir(params);
  }

  function atualizarData(chave: "de" | "ate", valor: string) {
    // Estado local: enquanto as duas datas não estão completas, a página
    // não navega — e o input precisa refletir o que foi digitado.
    const novo = { ...datas, [chave]: valor };
    setDatas(novo);
    if (novo.de && novo.ate) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("periodo", "custom");
      params.set("de", novo.de);
      params.set("ate", novo.ate);
      ir(params);
    }
  }

  const personalizado = periodo === "custom";

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-dim">
          Período
          <select
            value={periodo}
            onChange={(e) => atualizar("periodo", e.target.value)}
            className="h-9 rounded-lg border border-input bg-input/30 px-2.5 text-sm text-white outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {PERIODOS.map((valor) => (
              <option key={valor} value={valor}>
                {PERIODO_LABELS[valor]}
              </option>
            ))}
          </select>
        </label>

        {personalizado ? (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-dim">
              De
              <input
                type="date"
                value={datas.de}
                max={datas.ate || undefined}
                onChange={(e) => atualizarData("de", e.target.value)}
                className="h-9 rounded-lg border border-input bg-input/30 px-2.5 text-sm text-white outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-dim">
              Até
              <input
                type="date"
                value={datas.ate}
                min={datas.de || undefined}
                onChange={(e) => atualizarData("ate", e.target.value)}
                className="h-9 rounded-lg border border-input bg-input/30 px-2.5 text-sm text-white outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </label>
            {!datas.de || !datas.ate ? (
              <span className="text-xs text-ember">Escolha as duas datas</span>
            ) : null}
          </div>
        ) : null}

        <label className="flex items-center gap-2 text-sm text-dim">
          Status
          <select
            value={status}
            onChange={(e) => atualizar("status", e.target.value)}
            className="h-9 rounded-lg border border-input bg-input/30 px-2.5 text-sm text-white outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {STATUS_VALORES.map((valor) => (
              <option key={valor} value={valor}>
                {STATUS_LABELS[valor]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {pendente ? (
          <p className="flex items-center gap-2 text-xs text-dim">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            Carregando...
          </p>
        ) : null}
        <AtualizarDados
          clientId={clientId}
          periodo={periodo}
          status={status}
          de={datas.de}
          ate={datas.ate}
          ultimaAtualizacao={ultimaAtualizacao}
          agoraInicial={agoraInicial}
          campanhaId={campanhaId}
          conjuntoId={conjuntoId}
          objetivoCodigo={objetivoCodigo}
          destino={destino}
        />
      </div>
    </div>
  );
}

/** Query string dos filtros, preservando o intervalo personalizado. */
export function queryComFiltros(
  periodo: PeriodoCampanha,
  status: FiltroStatus,
  de?: string | null,
  ate?: string | null,
): string {
  const params = new URLSearchParams({ periodo, status });
  if (periodo === "custom" && de && ate) {
    params.set("de", de);
    params.set("ate", ate);
  }
  return `?${params.toString()}`;
}
