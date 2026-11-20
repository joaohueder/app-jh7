"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Filter } from "lucide-react";

import type { LinhaArvore } from "@/lib/meta/relatorio";

// No mobile cada select divide a linha ao meio; a partir de sm ficam compactos.
const CLASSE_SELECT =
  "h-8 min-w-0 flex-1 truncate rounded-lg border border-line bg-surface-2 px-2 text-xs text-white outline-none focus-visible:border-ember sm:max-w-[11rem] sm:flex-none";

/**
 * Filtro do cabeçalho: escolhida a campanha, a lista de conjuntos passa a
 * mostrar só os dela. Vale como recorte da tabela de campanhas do relatório.
 */
export function FiltroCampanhas({
  arvore,
  campanha,
  conjunto,
}: {
  arvore: LinhaArvore[];
  campanha: string;
  conjunto: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pendente, start] = useTransition();

  function ir(campanhaId: string, conjuntoId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (campanhaId) params.set("c", campanhaId);
    else params.delete("c");
    if (conjuntoId) params.set("a", conjuntoId);
    else params.delete("a");
    const query = params.toString();
    start(() => router.replace(query ? `${pathname}?${query}` : pathname));
  }

  const conjuntos =
    arvore.find((c) => c.id === campanha)?.filhos ??
    arvore.flatMap((c) => c.filhos ?? []);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none" aria-busy={pendente}>
      <Filter className="hidden size-3.5 shrink-0 text-dim sm:block" aria-hidden="true" />
      <label className="sr-only" htmlFor="filtroCampanha">
        Filtrar por campanha
      </label>
      <select
        id="filtroCampanha"
        className={CLASSE_SELECT}
        value={campanha}
        onChange={(e) => ir(e.target.value, "")}
      >
        <option value="">Todas as campanhas</option>
        {arvore.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor="filtroConjunto">
        Filtrar por conjunto
      </label>
      <select
        id="filtroConjunto"
        className={CLASSE_SELECT}
        value={conjunto}
        onChange={(e) => ir(campanha, e.target.value)}
      >
        <option value="">Todos os conjuntos</option>
        {conjuntos.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nome}
          </option>
        ))}
      </select>
    </div>
  );
}