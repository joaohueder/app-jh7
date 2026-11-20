"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CircleCheck,
  CircleOff,
  Loader2,
  Pencil,
  Search,
  Shield,
  Trash2,
  UserPlus,
  Users as UsersIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MODULE_LABELS,
  ROLE_LABELS,
  type PermissionModule,
  type UserRole,
} from "@/lib/db/schema";
import {
  createUserAction,
  deleteUserAction,
  setUserActiveAction,
  updateUserAction,
  type UserActionState,
  type UserListItem,
} from "./actions";

type Props = {
  usuarios: UserListItem[];
  currentUserId: number;
  isAdmin: boolean;
  podeCriar: boolean;
  podeEditar: boolean;
  podeExcluir: boolean;
};

const MODULOS = Object.keys(MODULE_LABELS) as PermissionModule[];
const ACOES = ["view", "create", "edit", "delete"] as const;
const LABELS_ACAO: Record<(typeof ACOES)[number], string> = {
  view: "Ver",
  create: "Criar",
  edit: "Editar",
  delete: "Excluir",
};

const estadoInicial: UserActionState = {};

export function UsersClient({
  usuarios,
  currentUserId,
  isAdmin,
  podeCriar,
  podeEditar,
  podeExcluir,
}: Props) {
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<UserListItem | null>(null);
  const [criando, setCriando] = useState(false);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return usuarios;
    return usuarios.filter(
      (u) =>
        u.name.toLowerCase().includes(termo) ||
        u.email.toLowerCase().includes(termo),
    );
  }, [usuarios, busca]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-dim"
          />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou e-mail..."
            className="h-10 pl-9"
            aria-label="Buscar usuários"
          />
        </div>

        {podeCriar ? (
          <Button
            onClick={() => setCriando(true)}
            className="h-10 gap-2"
            size="lg"
          >
            <UserPlus aria-hidden="true" />
            Novo usuário
          </Button>
        ) : null}
      </div>

      {/* Listagem */}
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {filtrados.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <UsersIcon className="size-8 text-dim/50" aria-hidden="true" />
            <p className="text-sm text-dim">
              {busca
                ? "Nenhum usuário encontrado para esta busca."
                : "Nenhum usuário cadastrado ainda."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line/70">
            {filtrados.map((usuario) => (
              <li
                key={usuario.id}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-white">
                      {usuario.name}
                    </p>
                    <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-dim uppercase">
                      {ROLE_LABELS[usuario.role as UserRole] ?? usuario.role}
                    </span>
                    {usuario.active ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-jade/40 bg-jade/10 px-2 py-0.5 text-[0.65rem] font-medium text-jade">
                        <CircleCheck className="size-3" aria-hidden="true" />
                        Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[0.65rem] font-medium text-destructive">
                        <CircleOff className="size-3" aria-hidden="true" />
                        Inativo
                      </span>
                    )}
                    {usuario.id === currentUserId ? (
                      <span className="rounded-full border border-ember/40 bg-ember/10 px-2 py-0.5 text-[0.65rem] font-medium text-ember">
                        Você
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-sm text-dim">{usuario.email}</p>
                  <PermissoesResumo permissoes={usuario.permissions} />
                </div>

                {podeEditar || podeExcluir ? (
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {podeEditar ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => setEditando(usuario)}
                        >
                          <Pencil aria-hidden="true" />
                          Editar
                        </Button>
                        <ToggleActiveButton
                          usuario={usuario}
                          souEu={usuario.id === currentUserId}
                        />
                      </>
                    ) : null}
                    {podeExcluir ? (
                      <DeleteUserButton
                        usuario={usuario}
                        souEu={usuario.id === currentUserId}
                      />
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal criar */}
      <UserDialog
        open={criando}
        onOpenChange={setCriando}
        titulo="Novo usuário"
        descricao="Defina os dados de acesso e as permissões deste usuário."
        souAdmin={isAdmin}
      />

      {/* Modal editar */}
      <UserDialog
        open={editando !== null}
        onOpenChange={(open) => {
          if (!open) setEditando(null);
        }}
        titulo={`Editar ${editando?.name ?? ""}`}
        descricao="Atualize os dados, a senha e as permissões deste usuário."
        usuario={editando}
        souAdmin={isAdmin}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Resumo das permissões na listagem                                   */
/* ------------------------------------------------------------------ */

function PermissoesResumo({
  permissoes,
}: {
  permissoes: Record<string, string[]>;
}) {
  const modulos = MODULOS.filter((m) => permissoes[m]?.length > 0);
  const total = modulos.reduce(
    (soma, m) => soma + permissoes[m].length,
    0,
  );

  return (
    <p className="flex items-center gap-1.5 text-xs text-dim">
      <Shield className="size-3.5 shrink-0" aria-hidden="true" />
      {total === 0 ? (
        <span className="text-dim/70">Nenhuma permissão concedida</span>
      ) : (
        <span className="truncate">
          {modulos.map((m) => MODULE_LABELS[m]).join(", ")} · {total}{" "}
          {total === 1 ? "permissão" : "permissões"}
        </span>
      )}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Botão ativar/desativar — com confirmação                            */
/* ------------------------------------------------------------------ */

function ToggleActiveButton({
  usuario,
  souEu,
}: {
  usuario: UserListItem;
  souEu: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const proximoEstado = !usuario.active;
  const desativando = usuario.active;

  function confirmar() {
    const formData = new FormData();
    formData.set("id", String(usuario.id));
    formData.set("active", String(proximoEstado));

    startTransition(async () => {
      const resultado = await setUserActiveAction(estadoInicial, formData);
      if (resultado.ok) {
        toast.success(desativando ? "Usuário desativado." : "Usuário reativado.");
        setConfirmOpen(false);
      } else {
        toast.error(resultado.error ?? "Não foi possível atualizar o usuário.");
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending || souEu}
        title={
          souEu
            ? "Você não pode desativar sua própria conta"
            : desativando
              ? "Desativar usuário"
              : "Reativar usuário"
        }
        className={
          desativando
            ? "gap-1.5 text-dim hover:text-destructive"
            : "gap-1.5 text-jade hover:text-jade"
        }
        onClick={() => setConfirmOpen(true)}
      >
        {pending ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : desativando ? (
          <CircleOff aria-hidden="true" />
        ) : (
          <CircleCheck aria-hidden="true" />
        )}
        <span className="hidden md:inline">
          {desativando ? "Desativar" : "Reativar"}
        </span>
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        titulo={desativando ? "Desativar usuário?" : "Reativar usuário?"}
        descricao={
          desativando
            ? "A conta deixará de acessar o sistema imediatamente. Os dados permanecem guardados e ela pode ser reativada depois."
            : "A conta voltará a poder acessar o sistema com o e-mail e a senha atuais."
        }
        detalhe={`${usuario.name} · ${usuario.email}`}
        confirmLabel={desativando ? "Desativar" : "Reativar"}
        destructive={desativando}
        pending={pending}
        onConfirm={confirmar}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Botão excluir — com confirmação                                     */
/* ------------------------------------------------------------------ */

function DeleteUserButton({
  usuario,
  souEu,
}: {
  usuario: UserListItem;
  souEu: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function confirmar() {
    const formData = new FormData();
    formData.set("id", String(usuario.id));

    startTransition(async () => {
      const resultado = await deleteUserAction(estadoInicial, formData);
      if (resultado.ok) {
        toast.success("Usuário excluído.");
        setConfirmOpen(false);
        router.refresh();
      } else {
        toast.error(resultado.error ?? "Não foi possível excluir o usuário.");
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending || souEu}
        title={
          souEu
            ? "Você não pode excluir sua própria conta"
            : "Excluir usuário"
        }
        className="gap-1.5 text-dim hover:text-destructive"
        onClick={() => setConfirmOpen(true)}
      >
        {pending ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : (
          <Trash2 aria-hidden="true" />
        )}
        <span className="hidden md:inline">Excluir</span>
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        titulo="Excluir usuário?"
        descricao="Esta ação é permanente: o registro, as permissões e o acesso da conta serão removidos do sistema. Não é possível desfazer."
        detalhe={`${usuario.name} · ${usuario.email}`}
        confirmLabel="Excluir definitivamente"
        destructive
        pending={pending}
        onConfirm={confirmar}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Modal criar/editar                                                  */
/* ------------------------------------------------------------------ */

function UserDialog({
  open,
  onOpenChange,
  titulo,
  descricao,
  usuario,
  souAdmin,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: string;
  descricao: string;
  usuario?: UserListItem | null;
  souAdmin: boolean;
}) {
  const editando = Boolean(usuario);
  const [state, formAction, pending] = useActionState(
    editando ? updateUserAction : createUserAction,
    estadoInicial,
  );
  // Função selecionada no modal: admin acessa tudo, usuário usa a matriz.
  const [role, setRole] = useState<UserRole>(
    (usuario?.role as UserRole) ?? "user",
  );

  // Estado das permissões: objeto módulo → conjunto de ações marcadas.
  const [marcadas, setMarcadas] = useState<Record<string, Set<string>>>(() => {
    const inicial: Record<string, Set<string>> = {};
    for (const modulo of MODULOS) {
      inicial[modulo] = new Set(usuario?.permissions?.[modulo] ?? []);
    }
    return inicial;
  });

  // Reinicia o formulário quando abre para outro usuário.
  const [chaveUsuario, setChaveUsuario] = useState<number | null>(
    usuario?.id ?? null,
  );
  if (open && usuario && usuario.id !== chaveUsuario) {
    setChaveUsuario(usuario.id);
    const inicial: Record<string, Set<string>> = {};
    for (const modulo of MODULOS) {
      inicial[modulo] = new Set(usuario.permissions?.[modulo] ?? []);
    }
    setMarcadas(inicial);
    setRole(usuario.role as UserRole);
  }

  useEffect(() => {
    if (state.ok) {
      toast.success(editando ? "Usuário atualizado." : "Usuário criado.");
      onOpenChange(false);
    }
    if (state.error) toast.error(state.error);
  }, [state, editando, onOpenChange]);

  function alternar(modulo: PermissionModule, acao: (typeof ACOES)[number]) {
    setMarcadas((atual) => {
      const copia = { ...atual };
      const acoes = new Set(copia[modulo]);
      if (acoes.has(acao)) {
        acoes.delete(acao);
      } else {
        acoes.add(acao);
      }
      copia[modulo] = acoes;
      return copia;
    });
  }

  function alternarModulo(modulo: PermissionModule, marcar: boolean) {
    setMarcadas((atual) => ({
      ...atual,
      [modulo]: new Set(marcar ? ACOES : []),
    }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-5">
          {usuario ? (
            <input type="hidden" name="id" value={usuario.id} />
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="user-name">Nome</Label>
              <Input
                id="user-name"
                name="name"
                required
                minLength={2}
                maxLength={80}
                defaultValue={usuario?.name}
                placeholder="Nome completo"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-email">E-mail</Label>
              <Input
                id="user-email"
                name="email"
                type="email"
                required
                defaultValue={usuario?.email}
                placeholder="nome@jh7.com.br"
                className="h-11"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Somente admins podem promover/rebaixar — campo oculto para demais */}
            {souAdmin ? (
              <div className="space-y-2">
                <Label htmlFor="user-role">Função na agência</Label>
                <select
                  id="user-role"
                  name="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="h-11 w-full rounded-lg border border-input bg-input/30 px-3 text-sm text-white outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {(Object.keys(ROLE_LABELS) as UserRole[]).map((valor) => (
                    <option key={valor} value={valor}>
                      {ROLE_LABELS[valor]}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-dim">
                  {role === "admin"
                    ? "Administrador acessa tudo, sem restrição."
                    : "Usuário acessa apenas o que for marcado abaixo."}
                </p>
              </div>
            ) : (
              <input type="hidden" name="role" value="user" />
            )}
            <div className="space-y-2">
              <Label htmlFor="user-password">
                {editando ? "Nova senha (opcional)" : "Senha"}
              </Label>
              <Input
                id="user-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required={!editando}
                minLength={editando ? 0 : 8}
                placeholder={editando ? "Deixe vazio para manter" : "Mínimo 8 caracteres"}
                className="h-11"
              />
            </div>
          </div>

          {/* Matriz de permissões — só para usuário comum */}
          {role !== "admin" ? (
          <fieldset className="space-y-3 rounded-xl border border-line bg-ink/40 p-4">
            <legend className="px-2 text-sm font-semibold text-white">
              Permissões por módulo
            </legend>

            <div className="hidden grid-cols-[1fr_repeat(4,minmax(3.5rem,1fr))] gap-2 px-1 text-xs font-medium tracking-wide text-dim uppercase sm:grid">
              <span>Módulo</span>
              {ACOES.map((acao) => (
                <span key={acao} className="text-center">
                  {LABELS_ACAO[acao]}
                </span>
              ))}
            </div>

            <div className="space-y-2">
              {MODULOS.map((modulo) => {
                const todas = ACOES.every((a) => marcadas[modulo]?.has(a));
                return (
                  <div
                    key={modulo}
                    className="grid grid-cols-2 items-center gap-2 rounded-lg border border-line/60 bg-surface px-3 py-2.5 sm:grid-cols-[1fr_repeat(4,minmax(3.5rem,1fr))]"
                  >
                    <div className="flex items-center gap-2 sm:contents">
                      <span className="flex items-center gap-2 text-sm font-medium text-white">
                        <input
                          type="checkbox"
                          checked={todas}
                          onChange={(e) => alternarModulo(modulo, e.target.checked)}
                          aria-label={`Marcar todas as permissões de ${MODULE_LABELS[modulo]}`}
                          className="size-3.5 accent-[var(--color-ember)]"
                        />
                        {MODULE_LABELS[modulo]}
                      </span>
                    </div>
                    {ACOES.map((acao) => (
                      <label
                        key={acao}
                        className="flex cursor-pointer items-center justify-center gap-1.5 text-sm text-dim sm:justify-center"
                      >
                        <input
                          type="checkbox"
                          name={`perm_${modulo}_${acao}`}
                          checked={marcadas[modulo]?.has(acao) ?? false}
                          onChange={() => alternar(modulo, acao)}
                          aria-label={`${LABELS_ACAO[acao]} em ${MODULE_LABELS[modulo]}`}
                          className="size-4 accent-[var(--color-ember)]"
                        />
                        <span className="sm:hidden">{LABELS_ACAO[acao]}</span>
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-dim">
              As permissões valem imediatamente: ao retirar um acesso, o usuário
              perde na próxima navegação, sem precisar sair do sistema.
            </p>
          </fieldset>
          ) : (
            <p className="flex items-center gap-2 rounded-lg border border-ember/40 bg-ember/10 px-3 py-2.5 text-sm text-ember">
              <Shield className="size-4 shrink-0" aria-hidden="true" />
              Administrador acessa todos os módulos sem restrição — não há
              permissões individuais a definir.
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={pending} className="px-6">
              {pending ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Salvando...
                </>
              ) : editando ? (
                "Salvar alterações"
              ) : (
                "Criar usuário"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
