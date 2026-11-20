"use client";

import type { DiaMensagem } from "@/lib/meta/relatorio";
import { GraficoDiario } from "./grafico-diario";

/**
 * Mensagens por dia: linha das mensagens + barras do custo por mensagem, ou a
 * linha do CPM. O desenho fica em `GraficoDiario` (compartilhado com o bloco
 * de seguidores do tráfego para o Instagram).
 */
export function GraficoMensagens({
  diario,
  serie,
}: {
  diario: DiaMensagem[];
  serie: "combinado" | "cpm";
}) {
  return (
    <GraficoDiario
      serie={serie}
      rotuloValor="Mensagens"
      rotuloCusto="Custo por mensagem"
      pontos={diario.map((d) => ({
        data: d.data,
        valor: d.mensagens,
        custo: d.custo,
        cpm: d.cpm,
      }))}
    />
  );
}