"use client";

import { AlertTriangle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Modal de confirmação reutilizável para ações destrutivas.
 *
 * Padrão do sistema: toda ação que altera ou remove um registro de forma
 * relevante (excluir, desativar, sobrescrever) deve abrir esta confirmação
 * antes de executar — nada acontece sem o clique explícito em "Confirmar".
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  titulo,
  descricao,
  detalhe,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive = false,
  pending = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: string;
  descricao: string;
  /** Nome/identificação do registro afetado, destacado no corpo do modal. */
  detalhe?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(value) => !pending && onOpenChange(value)}>
      <DialogContent
        showCloseButton={!pending}
        className="sm:max-w-md"
        onInteractOutside={(event) => {
          if (pending) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className={[
                "grid size-10 shrink-0 place-items-center rounded-full border",
                destructive
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-ember/40 bg-ember/10 text-ember",
              ].join(" ")}
            >
              <AlertTriangle className="size-5" />
            </span>
            <div className="space-y-1.5">
              <DialogTitle>{titulo}</DialogTitle>
              <DialogDescription>{descricao}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {detalhe ? (
          <p className="rounded-lg border border-line bg-surface-2/60 px-3 py-2 text-sm font-medium text-white">
            {detalhe}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={onConfirm}
            disabled={pending}
            className={
              destructive
                ? "gap-2 bg-destructive px-5 text-white hover:bg-destructive/90"
                : "gap-2 px-5"
            }
          >
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {pending ? "Processando..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
