"use client";

import { LoaderCircle, Megaphone, Sparkles } from "lucide-react";

export function LoadingOverlay({
  visible,
  message,
}: {
  visible: boolean;
  message: string;
}) {
  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-ink/90 px-5 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Carregando"
    >
      <div className="w-full max-w-sm rounded-2xl border border-ember/30 bg-surface p-7 text-center shadow-2xl shadow-black/50">
        <div className="relative mx-auto mb-5 grid size-24 place-items-center rounded-full border border-line bg-surface-2">
          <span className="loading-orbit absolute inset-1 rounded-full border border-dashed border-ember/60" />
          <span className="grid size-12 place-items-center rounded-2xl bg-ember text-ink shadow-lg shadow-ember/20">
            <Megaphone className="size-6" aria-hidden="true" />
          </span>
          <Sparkles className="absolute -right-1 top-1 size-5 text-ember-2" aria-hidden="true" />
        </div>
        <p className="text-lg font-semibold text-white">Segura esse lead!</p>
        <p className="mt-2 min-h-6 text-sm text-dim">{message}</p>
        <div className="mt-5 flex items-center justify-center gap-2 text-xs text-ember">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          A campanha está a caminho
        </div>
      </div>
    </div>
  );
}
