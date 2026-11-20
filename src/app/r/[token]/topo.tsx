"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

/** Botão flutuante "voltar ao topo"; aparece depois de rolar uma tela. */
export function BotaoTopo() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const aoRolar = () => setVisivel(window.scrollY > 400);
    aoRolar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);

  if (!visivel) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed right-4 bottom-4 z-50 inline-flex h-11 items-center gap-2 rounded-full border border-ember/40 bg-surface px-4 text-sm font-medium text-ember shadow-lg shadow-black/40 transition-colors hover:bg-surface-2 sm:right-6 sm:bottom-6"
    >
      <ArrowUp className="size-4" aria-hidden="true" />
      Topo
    </button>
  );
}