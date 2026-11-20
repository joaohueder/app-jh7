"use client";

import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Barra flutuante de ações para formulários.
 *
 * Padrão do sistema: sempre que a tela tiver alterações não salvas, esta barra
 * aparece fixa na parte inferior. Ela é o único lugar com o botão de salvar do
 * formulário — o usuário precisa enxergar claramente que há dados pendentes.
 */
export function SaveBar({
  visible,
  pending = false,
  mensagem = "Você tem alterações não salvas.",
  labelSalvar = "Salvar alterações",
  labelCancelar = "Cancelar",
  onCancel,
  formId,
  onSave,
}: {
  visible: boolean;
  pending?: boolean;
  mensagem?: string;
  labelSalvar?: string;
  labelCancelar?: string;
  onCancel: () => void;
  /** Id do <form> que o botão de salvar deve submeter. */
  formId?: string;
  /** Usado quando a barra dispara a ação diretamente (sem form). */
  onSave?: () => void;
}) {
  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Alterações não salvas"
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[env(safe-area-inset-bottom)] sm:px-6"
    >
      <div className="mx-auto mb-3 flex max-w-4xl flex-col gap-3 rounded-xl border border-ember/40 bg-surface/95 p-3 shadow-lg shadow-black/40 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <p className="flex items-center gap-2 text-sm text-white">
          <span
            aria-hidden="true"
            className="size-2 shrink-0 animate-pulse rounded-full bg-ember"
          />
          {mensagem}
        </p>

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={pending}
          >
            {labelCancelar}
          </Button>
          <Button
            type={formId ? "submit" : "button"}
            form={formId}
            size="sm"
            onClick={formId ? undefined : onSave}
            disabled={pending}
            className="gap-2 px-4"
          >
            {pending ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <Save aria-hidden="true" />
            )}
            {pending ? "Salvando..." : labelSalvar}
          </Button>
        </div>
      </div>
    </div>
  );
}
