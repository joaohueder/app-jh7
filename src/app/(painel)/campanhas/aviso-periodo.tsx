import { CalendarRange } from "lucide-react";

/**
 * Aviso exibido quando o filtro está em "Personalizado" mas as duas datas
 * ainda não foram informadas. Sem isso não há como consultar a Meta — o
 * período personalizado exige uma janela `since`/`until` completa.
 */
export function AvisoPeriodoPersonalizado() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-surface px-6 py-14 text-center">
      <CalendarRange className="size-8 text-dim/50" aria-hidden="true" />
      <p className="text-sm text-dim">
        Escolha a data inicial e a data final para ver os dados do período
        personalizado.
      </p>
    </div>
  );
}
