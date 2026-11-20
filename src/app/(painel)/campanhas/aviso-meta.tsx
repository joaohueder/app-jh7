import Link from "next/link";
import { AlertTriangle, Settings2 } from "lucide-react";

import type { EstadoMeta } from "@/lib/meta/campaigns";

/** Mensagem quando não há token ou a Meta recusou a consulta. */
export function AvisoMeta({ estado }: { estado: EstadoMeta }) {
  if (estado.estado === "ok") return null;

  const semToken = estado.estado === "sem-token";

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-ember/40 bg-ember/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-ember" aria-hidden="true" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-white">
            {semToken
              ? "Nenhum token da Meta configurado"
              : "Não foi possível carregar os dados da Meta"}
          </p>
          <p className="text-sm text-dim">
            {semToken
              ? "Configure o token de acesso para visualizar campanhas, conjuntos e anúncios."
              : estado.mensagem}
          </p>
        </div>
      </div>

      <Link
        href="/configuracoes?aba=meta-ads"
        className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-surface-2 sm:self-center"
      >
        <Settings2 className="size-4" aria-hidden="true" />
        Configurações → Meta Ads
      </Link>
    </div>
  );
}
