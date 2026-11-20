import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";

export type Migalha = { label: string; href?: string };

/**
 * Cabeçalho padrão das telas de campanhas: link de voltar, trilha de
 * navegação (Campanhas / Cliente / Campanha / Conjunto) e título.
 */
export function CabecalhoCampanhas({
  migalhas,
  titulo,
  descricao,
}: {
  migalhas: Migalha[];
  titulo: string;
  descricao?: string;
}) {
  const anterior = [...migalhas].reverse().find((m) => m.href);

  return (
    <div className="space-y-3">
      {anterior?.href ? (
        <Link
          href={anterior.href}
          className="inline-flex items-center gap-1.5 text-sm text-dim transition-colors hover:text-white"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar para {anterior.label}
        </Link>
      ) : null}

      <nav aria-label="Trilha de navegação" className="flex flex-wrap items-center gap-1 text-xs text-dim">
        {migalhas.map((migalha, indice) => (
          <span key={`${migalha.label}-${indice}`} className="flex items-center gap-1">
            {indice > 0 ? <ChevronRight className="size-3" aria-hidden="true" /> : null}
            {migalha.href ? (
              <Link href={migalha.href} className="transition-colors hover:text-ember">
                {migalha.label}
              </Link>
            ) : (
              <span className="text-white/80">{migalha.label}</span>
            )}
          </span>
        ))}
      </nav>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">{titulo}</h1>
        {descricao ? <p className="mt-1 text-sm text-dim">{descricao}</p> : null}
      </div>
    </div>
  );
}
