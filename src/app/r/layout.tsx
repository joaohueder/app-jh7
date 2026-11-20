import type { ReactNode } from "react";

/**
 * Área pública dos relatórios (`/r/<token>`): sem login e sem o shell do painel.
 * O conteúdo é montado por página; aqui só garantimos o tema escuro.
 */
export default function RelatorioPublicoLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-ink text-white">{children}</div>;
}