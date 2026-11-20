"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Check, Loader2, Pencil, Plus, Tags, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createNicheAction,
  deleteNicheAction,
  renameNicheAction,
  type NichoState,
} from "./nichos-actions";

export type NichoItem = {
  id: number;
  name: string;
  position: number;
  clientes: number;
};

const vazio: NichoState = {};

export function NichosTab({
  nichos,
  semNicho,
  podeEditar,
}: {
  nichos: NichoItem[];
  semNicho: number;
  podeEditar: boolean;
}) {
  const [criar, criarAction, criando] = useActionState(createNicheAction, vazio);
  const [renomear, renomearAction, renomeando] = useActionState(renameNicheAction, vazio);
  const [editando, setEditando] = useState<number | null>(null);
  /** Nicho aguardando confirmação de exclusão. */
  const [confirmando, setConfirmando] = useState<NichoItem | null>(null);
  const [removendo, startRemover] = useTransition();

  useEffect(() => {
    if (criar.ok) toast.success("Nicho criado.");
  }, [criar]);
  useEffect(() => {
    if (renomear.ok) toast.success("Nicho atualizado.");
  }, [renomear]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-line bg-surface p-6">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-base font-semibold text-white">
            <Tags className="size-4 text-ember" aria-hidden="true" />
            Grupos de nicho
          </h2>
          <p className="text-sm text-dim">
            Agrupam os clientes por segmento (Bar e Restaurantes, Loja de Veículo,
            Fotografia...). O cliente escolhe o nicho no cadastro, e a lista de
            clientes passa a exibir os grupos.
          </p>
        </div>

        {podeEditar ? (
          <form action={criarAction} className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="w-full space-y-2 sm:max-w-xs">
              <Label htmlFor="nicho-nome">Novo nicho</Label>
              <Input
                id="nicho-nome"
                name="name"
                required
                maxLength={60}
                placeholder="Bar e Restaurantes"
                className="h-11"
              />
            </div>
            <Button type="submit" size="lg" disabled={criando} className="h-11 gap-2 px-5">
              {criando ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <Plus aria-hidden="true" />
              )}
              Adicionar
            </Button>
          </form>
        ) : (
          <p className="mt-5 text-sm text-dim">
            Somente usuários com permissão de edição em Configurações podem
            alterar os nichos.
          </p>
        )}

        {criar.error ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {criar.error}
          </p>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="border-b border-line px-6 py-4">
          <h3 className="text-sm font-semibold text-white">Nichos cadastrados</h3>
          <p className="mt-1 text-xs text-dim">
            {nichos.length} {nichos.length === 1 ? "nicho" : "nichos"}
            {semNicho > 0
              ? ` · ${semNicho} ${semNicho === 1 ? "cliente sem nicho" : "clientes sem nicho"}`
              : ""}
          </p>
        </div>

        {nichos.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-dim">
            Nenhum nicho cadastrado ainda.
          </p>
        ) : (
          <ul className="divide-y divide-line/70">
            {nichos.map((nicho) => (
              <li key={nicho.id} className="flex items-center gap-3 px-4 py-3 sm:px-6">
                {editando === nicho.id ? (
                  <form
                    action={renomearAction}
                    // Fecha o editor já no envio: esperar a resposta exigiria
                    // setState dentro de um efeito, que o lint bloqueia.
                    onSubmit={() => setEditando(null)}
                    className="flex flex-1 items-center gap-2"
                  >
                    <input type="hidden" name="id" value={nicho.id} />
                    <Input
                      name="name"
                      defaultValue={nicho.name}
                      maxLength={60}
                      required
                      autoFocus
                      className="h-9 max-w-xs"
                      aria-label="Novo nome do nicho"
                    />
                    <Button
                      type="submit"
                      size="icon"
                      variant="ghost"
                      disabled={renomeando}
                      aria-label="Salvar novo nome"
                      className="size-9 text-jade hover:text-jade"
                    >
                      {renomeando ? (
                        <Loader2 className="animate-spin" aria-hidden="true" />
                      ) : (
                        <Check aria-hidden="true" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditando(null)}
                      aria-label="Cancelar"
                      className="size-9 text-dim hover:text-white"
                    >
                      <X aria-hidden="true" />
                    </Button>
                  </form>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">{nicho.name}</p>
                      <p className="text-xs text-dim">
                        {nicho.clientes}{" "}
                        {nicho.clientes === 1 ? "cliente" : "clientes"}
                      </p>
                    </div>
                    {podeEditar ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => setEditando(nicho.id)}
                          aria-label={`Renomear ${nicho.name}`}
                          className="size-9 text-dim hover:text-white"
                        >
                          <Pencil aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          disabled={removendo}
                          onClick={() => setConfirmando(nicho)}
                          aria-label={`Excluir ${nicho.name}`}
                          className="size-9 text-dim hover:text-destructive"
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>
                    ) : null}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {renomear.error ? (
        <p role="alert" className="text-sm text-destructive">
          {renomear.error}
        </p>
      ) : null}

      <ConfirmDialog
        open={confirmando !== null}
        onOpenChange={(aberto) => !aberto && setConfirmando(null)}
        titulo="Excluir nicho?"
        descricao="O nicho sai da lista; os clientes que estavam nele ficam sem nicho. Nenhum cliente é apagado."
        detalhe={confirmando?.name}
        confirmLabel="Excluir"
        destructive
        pending={removendo}
        onConfirm={() => {
          const alvo = confirmando;
          if (!alvo) return;
          startRemover(async () => {
            const r = await deleteNicheAction(alvo.id);
            if (r.ok) toast.success("Nicho excluído.");
            else toast.error(r.error ?? "Não foi possível excluir.");
            setConfirmando(null);
          });
        }}
      />
    </div>
  );
}