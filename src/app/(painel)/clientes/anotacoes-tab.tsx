"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Loader2, Plus, StickyNote, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Label } from "@/components/ui/label";
import { createNoteAction, deleteNoteAction, type ClientState } from "./actions";
import type { ClientNote } from "@/lib/db/schema";

const vazio: ClientState = {};

/** Data e hora completas, no formato brasileiro. */
function formatarDataHora(valor: Date | string | number): string {
  const data = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(data.getTime())) return "";
  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Aba Anotações: histórico cronológico. A data/hora é gravada automaticamente
 * no momento do registro e não pode ser alterada pelo usuário.
 */
export function AnotacoesTab({
  clientId,
  anotacoes,
  podeEditar,
  podeExcluir,
}: {
  clientId: number;
  anotacoes: ClientNote[];
  podeEditar: boolean;
  podeExcluir: boolean;
  /** Reservado para quando anotações passarem a ter edição pendente. */
  registrar?: unknown;
}) {
  const router = useRouter();
  const [salvando, startSalvando] = useTransition();
  const [descricao, setDescricao] = useState("");

  function adicionar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData();
    formData.set("clientId", String(clientId));
    formData.set("description", descricao);

    startSalvando(async () => {
      const resultado = await createNoteAction(vazio, formData);
      if (resultado.ok) {
        toast.success("Anotação registrada.");
        setDescricao("");
        router.refresh();
      } else {
        toast.error(resultado.error ?? "Não foi possível salvar a anotação.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {podeEditar ? (
        <form onSubmit={adicionar} className="space-y-4 rounded-xl border border-line bg-surface p-6">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 text-base font-semibold text-white">
              <StickyNote className="size-4 text-ember" aria-hidden="true" />
              Nova anotação
            </h2>
            <p className="text-sm text-dim">
              A data e a hora são registradas automaticamente no momento de salvar.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nota-descricao">Descrição</Label>
            <textarea
              id="nota-descricao"
              name="description"
              required
              rows={3}
              maxLength={4000}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="O que aconteceu com este cliente?"
              className="w-full rounded-lg border border-input bg-input/30 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-dim/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              size="lg"
              disabled={salvando || descricao.trim().length < 2}
              className="gap-2 px-6"
            >
              {salvando ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <Plus aria-hidden="true" />
              )}
              {salvando ? "Registrando..." : "Adicionar anotação"}
            </Button>
          </div>
        </form>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {anotacoes.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <StickyNote className="size-8 text-dim/50" aria-hidden="true" />
            <p className="text-sm text-dim">Nenhuma anotação registrada ainda.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line/70">
            {anotacoes.map((nota) => (
              <NotaLinha key={nota.id} nota={nota} podeExcluir={podeExcluir} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function NotaLinha({ nota, podeExcluir }: { nota: ClientNote; podeExcluir: boolean }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();

  function excluir() {
    const formData = new FormData();
    formData.set("id", String(nota.id));

    start(async () => {
      const resultado = await deleteNoteAction(vazio, formData);
      if (resultado.ok) {
        toast.success("Anotação excluída.");
        setConfirm(false);
        router.refresh();
      } else {
        toast.error(resultado.error ?? "Não foi possível excluir a anotação.");
      }
    });
  }

  const quando = formatarDataHora(nota.createdAt);

  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="flex items-center gap-1.5 text-xs font-medium text-ember">
          <CalendarDays className="size-3.5" aria-hidden="true" />
          {quando}
        </p>
        <p className="text-sm whitespace-pre-wrap text-white">{nota.description}</p>
      </div>

      {podeExcluir ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => setConfirm(true)}
          className="shrink-0 gap-1.5 text-dim hover:text-destructive"
        >
          {pending ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Trash2 aria-hidden="true" />
          )}
          <span className="hidden md:inline">Excluir</span>
        </Button>
      ) : null}

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        titulo="Excluir anotação?"
        descricao="Esta ação é permanente e a anotação não poderá ser recuperada."
        detalhe={quando}
        confirmLabel="Excluir anotação"
        destructive
        pending={pending}
        onConfirm={excluir}
      />
    </li>
  );
}
