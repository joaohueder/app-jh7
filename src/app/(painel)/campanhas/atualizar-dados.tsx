"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import type { FiltroStatus, PeriodoCampanha } from "@/lib/meta/insights";
import { atualizarCampanhas } from "./atualizar-actions";

/**
 * Relógio de 1s que começa no horário do servidor. Partir do valor do
 * servidor (e não de `Date.now()` no cliente) deixa o texto igual nos dois
 * lados — sem o "pisca" de hidratação — e já aparece no HTML.
 */
function useRelogio(agoraInicial: number): number {
  const [agora, setAgora] = useState(agoraInicial);
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return agora;
}

const plural = (valor: number, singular: string, plural_: string) =>
  `${valor} ${valor === 1 ? singular : plural_}`;

/**
 * "Sem atualizar há 1 mês", "15 dias", "1 semana", "7 horas", "30 segundos" —
 * uma unidade só, a maior que couber. Semana é usada apenas na primeira
 * semana (7 a 13 dias); da segunda em diante a contagem volta a ser em dias,
 * como o usuário pediu ("15 dias", não "2 semanas").
 */
export function tempoSemAtualizar(ms: number): string {
  const segundos = Math.max(1, Math.round(ms / 1000));
  if (segundos < 60) return plural(segundos, "segundo", "segundos");

  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return plural(minutos, "minuto", "minutos");

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return plural(horas, "hora", "horas");

  const dias = Math.floor(horas / 24);
  if (dias < 7) return plural(dias, "dia", "dias");
  if (dias < 14) return plural(1, "semana", "semanas");
  if (dias < 30) return plural(dias, "dia", "dias");

  const meses = Math.min(11, Math.floor(dias / 30));
  if (dias < 365) return plural(meses, "mês", "meses");

  return plural(Math.floor(dias / 365), "ano", "anos");
}

const UM_DIA = 24 * 60 * 60 * 1000;

/**
 * Botão "Atualizar dados" e o tempo desde a última consulta à Meta.
 *
 * O módulo não fala com a Meta sozinho: os números ficam guardados até alguém
 * clicar aqui. Acima de um dia sem atualização a mensagem pisca.
 */
export function AtualizarDados({
  clientId,
  periodo,
  status,
  de,
  ate,
  ultimaAtualizacao,
  agoraInicial,
  campanhaId,
  conjuntoId,
  objetivoCodigo,
  destino,
}: {
  /** `null` na tela inicial, onde a atualização vale para todos os clientes. */
  clientId: number | null;
  periodo: PeriodoCampanha;
  status: FiltroStatus;
  de?: string;
  ate?: string;
  /** Milissegundos da última consulta; `null` = nunca atualizado. */
  ultimaAtualizacao: number | null;
  /** Horário do servidor no render, para o texto já sair no HTML. */
  agoraInicial: number;
  /** Nível aberto: sem isto o botão só renovaria a lista de campanhas. */
  campanhaId?: string;
  conjuntoId?: string;
  objetivoCodigo?: string | null;
  destino?: string | null;
}) {
  const router = useRouter();
  const [pendente, start] = useTransition();
  const agora = useRelogio(agoraInicial);

  const desde = ultimaAtualizacao === null ? null : agora - ultimaAtualizacao;
  // Nunca atualizado é o pior caso, então também pisca.
  const atrasado = desde === null || desde > UM_DIA;

  const texto =
    ultimaAtualizacao === null
      ? "Nunca atualizado"
      : desde !== null && desde < 10_000
        ? "Atualizado agora"
        : `Sem atualizar há ${tempoSemAtualizar(desde ?? 0)}`;

  function atualizar() {
    start(async () => {
      const estado = await atualizarCampanhas({
        clientId,
        periodo,
        status,
        de,
        ate,
        campanhaId,
        conjuntoId,
        objetivoCodigo,
        destino,
      });
      if (estado.ok) {
        toast.success(estado.message ?? "Dados atualizados.");
        router.refresh();
      } else {
        toast.error(estado.message ?? "Não foi possível atualizar os dados.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <button
        type="button"
        onClick={atualizar}
        disabled={pendente}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 text-sm font-medium text-white transition-colors hover:border-ember/50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pendente ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <RefreshCw className="size-4" aria-hidden="true" />
        )}
        {pendente ? "Atualizando..." : "Atualizar dados"}
      </button>

      {texto ? (
        <span
          aria-live="polite"
          className={`text-xs ${
            atrasado
              ? "font-medium text-ember motion-safe:animate-pulse"
              : "text-dim"
          }`}
        >
          {texto}
        </span>
      ) : null}
    </div>
  );
}