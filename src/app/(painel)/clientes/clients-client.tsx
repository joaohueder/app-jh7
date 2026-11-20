"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleCheck, CircleOff, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ListaClientes, type ClienteLista } from "./lista-clientes";
import {
  deleteClientAction,
  setClientActiveAction,
  type ClientListItem,
} from "./actions";

export function ClientsClient({
  clients,
  nichos,
  podeCriar,
  podeEditar,
  podeExcluir,
}: {
  clients: ClientListItem[];
  /** Nichos na ordem de exibição; o nome vem daqui, não do cliente. */
  nichos: { id: number; name: string }[];
  podeCriar: boolean;
  podeEditar: boolean;
  podeExcluir: boolean;
}) {
  return (
    <ListaClientes
      clientes={clients}
      nichos={nichos}
      vazio="Nenhum cliente cadastrado ainda."
      acaoTopo={
        podeCriar ? (
          <Button asChild className="h-10 gap-2" size="lg">
            <Link href="/clientes/novo">
              <Plus aria-hidden="true" />
              Novo cliente
            </Link>
          </Button>
        ) : null
      }
      acaoVazio={
        podeCriar ? (
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href="/clientes/novo">
              <Plus aria-hidden="true" />
              Cadastrar primeiro cliente
            </Link>
          </Button>
        ) : null
      }
      renderAcoes={(cliente) => (
        <ClientRowAcoes
          cliente={cliente as ClientListItem}
          podeEditar={podeEditar}
          podeExcluir={podeExcluir}
        />
      )}
    />
  );
}

function ClientRowAcoes({
  cliente,
  podeEditar,
  podeExcluir,
}: {
  cliente: ClientListItem;
  podeEditar: boolean;
  podeExcluir: boolean;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<"active" | "delete" | null>(null);
  const [pending, start] = useTransition();

  function executar(acao: "active" | "delete") {
    const formData = new FormData();
    formData.set("id", String(cliente.id));
    if (acao === "active") formData.set("active", String(!cliente.active));

    start(async () => {
      const resultado =
        acao === "active"
          ? await setClientActiveAction({}, formData)
          : await deleteClientAction({}, formData);
      if (resultado.ok) {
        toast.success(
          acao === "active"
            ? cliente.active
              ? "Cliente desativado."
              : "Cliente reativado."
            : "Cliente excluído.",
        );
        setConfirm(null);
        router.refresh();
      } else {
        toast.error(resultado.error ?? "Não foi possível concluir a operação.");
      }
    });
  }

  if (!podeEditar && !podeExcluir) return null;

  return (
    <>
      {podeEditar ? (
        <>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href={`/clientes/${cliente.id}`}>
              <Pencil aria-hidden="true" />
              Editar
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => setConfirm("active")}
            className={
              cliente.active
                ? "gap-1.5 text-dim hover:text-destructive"
                : "gap-1.5 text-jade hover:text-jade"
            }
          >
            {cliente.active ? (
              <CircleOff aria-hidden="true" />
            ) : (
              <CircleCheck aria-hidden="true" />
            )}
            <span className="hidden md:inline">
              {cliente.active ? "Desativar" : "Reativar"}
            </span>
          </Button>
        </>
      ) : null}
      {podeExcluir ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => setConfirm("delete")}
          className="gap-1.5 text-dim hover:text-destructive"
        >
          <Trash2 aria-hidden="true" />
          <span className="hidden md:inline">Excluir</span>
        </Button>
      ) : null}

      <ConfirmDialog
        open={confirm === "active"}
        onOpenChange={(v) => !v && setConfirm(null)}
        titulo={cliente.active ? "Desativar cliente?" : "Reativar cliente?"}
        descricao={
          cliente.active
            ? "O cadastro permanece salvo, mas deixa de ser considerado ativo no sistema."
            : "O cliente voltará a aparecer como ativo."
        }
        detalhe={cliente.businessName}
        confirmLabel={cliente.active ? "Desativar" : "Reativar"}
        destructive={cliente.active}
        pending={pending}
        onConfirm={() => executar("active")}
      />

      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(v) => !v && setConfirm(null)}
        titulo="Excluir cliente?"
        descricao="Esta ação é permanente: o cadastro e os vínculos locais com as contas de anúncio serão removidos. As contas na Meta não são excluídas."
        detalhe={cliente.businessName}
        confirmLabel="Excluir definitivamente"
        destructive
        pending={pending}
        onConfirm={() => executar("delete")}
      />
    </>
  );
}

export type { ClienteLista };