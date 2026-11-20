"use client";

import { useState, useTransition } from "react";
import { BrainCircuit, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { LinhaMetricas } from "@/lib/meta/campaigns";
import { analisarAnunciosAction } from "./analise-actions";
import { MetricasLista } from "./metricas-lista";

function dadosParaIa(linha: LinhaMetricas) {
  return {
    id: linha.id,
    nome: linha.nome,
    status: linha.status,
    objetivo: linha.objetivo,
    conversao: linha.conversao,
    investido: linha.investido,
    impressoes: linha.impressoes,
    alcance: linha.alcance,
    frequencia: linha.frequencia,
    cliquesLink: linha.cliquesLink,
    visitasPerfil: linha.visitasPerfil,
    seguidores: linha.seguidores,
    mensagensIniciadas: linha.mensagensIniciadas,
    visitasPaginaDestino: linha.visitasPaginaDestino,
    adicoesCarrinho: linha.adicoesCarrinho,
    finalizacoesCompra: linha.finalizacoesCompra,
    resultadoRotulo: linha.resultadoRotulo,
    resultadoValor: linha.resultadoValor,
    custoPorResultado: linha.custoPorResultado,
    ctr: linha.ctr,
    cpm: linha.cpm,
  };
}

export function AnalisarAnuncios({
  linhas,
  periodo,
}: {
  linhas: LinhaMetricas[];
  periodo: string;
}) {
  const [pendente, start] = useTransition();
  const [resultado, setResultado] = useState<{
    ok: boolean;
    message: string;
    analises?: Record<string, string>;
    analise?: string;
  } | null>(null);

  function analisar() {
    setResultado(null);
    start(async () => {
      const resposta = await analisarAnunciosAction({
        periodo,
        anuncios: linhas.map(dadosParaIa),
      });
      setResultado(resposta);
    });
  }

  return (
    <>
      <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-white">
              <BrainCircuit className="size-4 text-ember" aria-hidden="true" />
              Análise dos anúncios
            </h2>
            <p className="mt-1 text-sm text-dim">
              Gere uma leitura prática do desempenho dos {linhas.length} anúncios exibidos.
            </p>
          </div>
          <Button type="button" onClick={analisar} disabled={pendente || linhas.length === 0} className="h-10 gap-2">
            {pendente ? <Loader2 className="animate-spin" aria-hidden="true" /> : <BrainCircuit aria-hidden="true" />}
            {pendente ? "Analisando..." : "Analisar com IA"}
          </Button>
        </div>
        {resultado && !resultado.ok ? (
          <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {resultado.message}
          </p>
        ) : null}
        {/* Só o texto corrido cai aqui: as análises por anúncio vão para cada card. */}
        {resultado?.analise ? (
          <p className="whitespace-pre-wrap rounded-lg border border-jade/30 bg-jade/5 p-4 text-sm leading-relaxed text-white">
            {resultado.analise}
          </p>
        ) : null}
      </section>

      <MetricasLista
        linhas={linhas}
        vazio="Nenhum anúncio neste período e status."
        analises={resultado?.analises}
        analisando={pendente}
      />
    </>
  );
}
