"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ChevronDown,
  ChevronUp,
  CircleCheck,
  CircleOff,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CONTRACT_PERIOD_LABELS,
  CONTRACT_PERIODS,
  type ContractPeriod,
} from "@/lib/db/schema";
import { formatDateIso, formatMoney, hojeIso, maskMoney, parseMoney } from "@/lib/format/masks";
import {
  createContractAction,
  deleteContractAction,
  getMetaAdAccountsAction,
  setContractStatusAction,
  updateContractAction,
  type AdAccountOption,
  type ClientState,
  type ContractWithAccounts,
} from "./actions";

const vazio: ClientState = {};

type ContaDoContrato = { adAccountId: string; name: string; currency: string | null };

/** Aba Contratos: lista na aba e formulário sempre em modal. */
export function ContratosTab({
  clientId,
  contratos,
  podeEditar,
  podeExcluir,
}: {
  clientId: number;
  contratos: ContractWithAccounts[];
  podeEditar: boolean;
  podeExcluir: boolean;
  registrar?: unknown;
}) {
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<ContractWithAccounts | null>(null);

  function abrirNovo() {
    setEditando(null);
    setFormAberto(true);
  }

  function abrirEdicao(contrato: ContractWithAccounts) {
    setEditando(contrato);
    setFormAberto(true);
  }

  const ativos = contratos.filter((c) => c.status === "active").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Contratos</h2>
          <p className="text-sm text-dim">
            {contratos.length === 0
              ? "Nenhum contrato cadastrado."
              : `${contratos.length} ${contratos.length === 1 ? "contrato" : "contratos"} · ${ativos} ativo${ativos === 1 ? "" : "s"}`}
          </p>
        </div>
        {podeEditar ? (
          <Button onClick={abrirNovo} className="h-10 gap-2" size="lg">
            <Plus aria-hidden="true" />
            Novo contrato
          </Button>
        ) : null}
      </div>

      {contratos.length === 0 && !formAberto ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-surface px-6 py-14 text-center">
          <FileText className="size-8 text-dim/50" aria-hidden="true" />
          <p className="text-sm text-dim">
            Cada contrato tem suas próprias contas de anúncio. Crie o primeiro para
            começar.
          </p>
          {podeEditar ? (
            <Button onClick={abrirNovo} variant="outline" size="sm" className="gap-1.5">
              <Plus aria-hidden="true" />
              Cadastrar contrato
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-3">
          {contratos.map((contrato) => (
            <ContratoCard
              key={contrato.id}
              contrato={contrato}
              podeEditar={podeEditar}
              podeExcluir={podeExcluir}
              onEditar={() => abrirEdicao(contrato)}
            />
          ))}
        </ul>
      )}

      {/*
        Montado apenas com o modal aberto: assim cada abertura recria o estado
        a partir do contrato selecionado (valor mensal, contas marcadas, etc.).
        Manter montado fazia o useState inicial rodar uma vez só, com contrato
        nulo, e o valor nunca era carregado na edição.
      */}
      {formAberto ? (
        <ContratoModal
          key={editando?.id ?? "novo"}
          open
          clientId={clientId}
          contrato={editando}
          onFechar={() => setFormAberto(false)}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Card do contrato                                                    */
/* ------------------------------------------------------------------ */

function ContratoCard({
  contrato,
  podeEditar,
  podeExcluir,
  onEditar,
}: {
  contrato: ContractWithAccounts;
  podeEditar: boolean;
  podeExcluir: boolean;
  onEditar: () => void;
}) {
  const [confirm, setConfirm] = useState<"status" | "delete" | null>(null);
  const [pending, start] = useTransition();

  const ativo = contrato.status === "active";

  function executar(acao: "status" | "delete") {
    const formData = new FormData();
    formData.set("id", String(contrato.id));
    if (acao === "status") formData.set("status", ativo ? "inactive" : "active");

    start(async () => {
      const resultado =
        acao === "status"
          ? await setContractStatusAction({}, formData)
          : await deleteContractAction({}, formData);
      if (resultado.ok) {
        toast.success(
          acao === "status"
            ? ativo
              ? "Contrato desativado."
              : "Contrato reativado."
            : "Contrato excluído.",
        );
        setConfirm(null);
      } else {
        toast.error(resultado.error ?? "Não foi possível concluir a operação.");
      }
    });
  }

  return (
    <li className="rounded-xl border border-line bg-surface p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-white">{contrato.name}</p>
            {ativo ? (
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
            <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-dim uppercase">
              {CONTRACT_PERIOD_LABELS[contrato.period as ContractPeriod] ?? contrato.period}
            </span>
          </div>

          <p className="text-sm text-dim">
            Início {formatDateIso(contrato.startDate)} · {formatMoney(contrato.monthlyValue)} / mês
          </p>

          <div className="flex flex-wrap gap-3 text-xs">
            {contrato.instagramUrl ? (
              <a
                href={contrato.instagramUrl}
                target="_blank"
                rel="noreferrer"
                className="text-dim transition-colors hover:text-ember"
              >
                Instagram
              </a>
            ) : null}
            {contrato.facebookUrl ? (
              <a
                href={contrato.facebookUrl}
                target="_blank"
                rel="noreferrer"
                className="text-dim transition-colors hover:text-ember"
              >
                Facebook
              </a>
            ) : null}
            {contrato.googleBusinessUrl ? (
              <a
                href={contrato.googleBusinessUrl}
                target="_blank"
                rel="noreferrer"
                className="text-dim transition-colors hover:text-ember"
              >
                Google Meu Negócio
              </a>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {contrato.accounts.length > 0 ? (
              contrato.accounts.map((conta) => (
                <span
                  key={conta.id}
                  className="inline-flex max-w-full items-center gap-1 rounded-md border border-line bg-surface-2 px-2 py-1 text-xs text-dim"
                >
                  <span className="truncate">{conta.name}</span>
                  <span className="text-ember">{conta.currency}</span>
                </span>
              ))
            ) : (
              <span className="text-xs text-dim/70">
                Nenhuma conta de anúncio vinculada
              </span>
            )}
          </div>
        </div>

        {podeEditar || podeExcluir ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {podeEditar ? (
              <>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={onEditar}>
                  <Pencil aria-hidden="true" />
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => setConfirm("status")}
                  className={
                    ativo
                      ? "gap-1.5 text-dim hover:text-destructive"
                      : "gap-1.5 text-jade hover:text-jade"
                  }
                >
                  {ativo ? <CircleOff aria-hidden="true" /> : <CircleCheck aria-hidden="true" />}
                  <span className="hidden md:inline">{ativo ? "Desativar" : "Reativar"}</span>
                </Button>
              </>
            ) : null}
            {podeExcluir ? (
              <Button
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
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirm === "status"}
        onOpenChange={(v) => !v && setConfirm(null)}
        titulo={ativo ? "Desativar contrato?" : "Reativar contrato?"}
        descricao={
          ativo
            ? "O contrato deixa de ser considerado ativo, mas o histórico e as contas vinculadas permanecem salvos."
            : "O contrato voltará a aparecer como ativo."
        }
        detalhe={contrato.name}
        confirmLabel={ativo ? "Desativar" : "Reativar"}
        destructive={ativo}
        pending={pending}
        onConfirm={() => executar("status")}
      />

      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(v) => !v && setConfirm(null)}
        titulo="Excluir contrato?"
        descricao="Esta ação é permanente: o contrato e os vínculos locais com as contas de anúncio serão removidos. As contas na Meta não são excluídas."
        detalhe={contrato.name}
        confirmLabel="Excluir definitivamente"
        destructive
        pending={pending}
        onConfirm={() => executar("delete")}
      />
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Modal do contrato                                                   */
/* ------------------------------------------------------------------ */

/**
 * Cadastro/edição do contrato em modal. O fechamento só acontece pelo X,
 * pelo botão Cancelar ou depois de salvar — clique fora e ESC não fecham,
 * justamente para não perder o que foi digitado.
 */
function ContratoModal({
  open,
  clientId,
  contrato,
  onFechar,
}: {
  open: boolean;
  clientId: number;
  contrato: ContractWithAccounts | null;
  onFechar: () => void;
}) {
  const editando = Boolean(contrato);
  const [salvando, startSalvando] = useTransition();
  const [buscandoContas, setBuscandoContas] = useState(false);
  const [erroContas, setErroContas] = useState("");
  const [valor, setValor] = useState(() =>
    typeof contrato?.monthlyValue === "number"
      ? maskMoney(String(contrato.monthlyValue))
      : "",
  );
  const [contas, setContas] = useState<AdAccountOption[]>(() =>
    (contrato?.accounts ?? []).map((a) => ({
      id: a.adAccountId,
      name: a.name,
      currency: a.currency ?? undefined,
    })),
  );
  const [selecionadas, setSelecionadas] = useState<string[]>(
    () => (contrato?.accounts ?? []).map((a) => a.adAccountId),
  );
  const carregou = useRef(false);
  const formId = `contrato-form-${contrato?.id ?? "novo"}`;
  const [buscaConta, setBuscaConta] = useState("");
  // As contas não vinculadas só aparecem depois de clicar em "Mostrar todas".
  const [mostrarTodas, setMostrarTodas] = useState(false);

  // Selecionadas primeiro; a ordem original é preservada dentro de cada grupo.
  const contasSelecionadas = useMemo(
    () => contas.filter((conta) => selecionadas.includes(conta.id)),
    [contas, selecionadas],
  );

  // Contas disponíveis para vincular (ainda não selecionadas).
  const disponiveis = useMemo(
    () => contas.filter((conta) => !selecionadas.includes(conta.id)),
    [contas, selecionadas],
  );

  // Mesmas contas, já filtradas pelo termo digitado na busca.
  const disponiveisFiltradas = useMemo(() => {
    const termo = buscaConta.trim().toLowerCase();
    if (!termo) return disponiveis;
    return disponiveis.filter(
      (conta) =>
        conta.name.toLowerCase().includes(termo) ||
        conta.id.toLowerCase().includes(termo) ||
        (conta.currency ?? "").toLowerCase().includes(termo),
    );
  }, [disponiveis, buscaConta]);


  useEffect(() => {
    if (carregou.current) return;
    carregou.current = true;

    const vinculadas: ContaDoContrato[] = contrato?.accounts ?? [];
    setBuscandoContas(true);
    getMetaAdAccountsAction()
      .then((resultado) => {
        if (!resultado.ok) {
          setErroContas(resultado.message ?? "Não foi possível carregar as contas.");
          return;
        }
        const daMeta = resultado.accounts ?? [];
        const faltando = vinculadas
          .filter((a) => !daMeta.some((c) => c.id === a.adAccountId))
          .map((a) => ({ id: a.adAccountId, name: a.name, currency: a.currency ?? undefined }));
        const ids = new Set(daMeta.map((c) => c.id));
        setContas([...daMeta, ...faltando.filter((f) => !ids.has(f.id))]);
        setErroContas("");
      })
      .finally(() => setBuscandoContas(false));
  }, [contrato]);

  function alternarConta(id: string) {
    setSelecionadas((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id],
    );
  }

  function salvar() {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;

    const formData = new FormData(form);
    formData.set("clientId", String(clientId));
    formData.set("monthlyValue", String(parseMoney(valor)));
    formData.set("status", String(formData.get("status") ?? "active"));
    formData.set("period", String(formData.get("period") ?? "monthly"));
    selecionadas.forEach((id) => formData.append("adAccount", id));
    if (contrato) formData.set("id", String(contrato.id));

    startSalvando(async () => {
      const resultado = editando
        ? await updateContractAction(vazio, formData)
        : await createContractAction(vazio, formData);
      if (resultado.ok) {
        toast.success(editando ? "Contrato atualizado." : "Contrato criado.");
        onFechar();
      } else {
        toast.error(resultado.error ?? "Não foi possível salvar o contrato.");
      }
    });
  }

  function tentarFechar() {
    // Só sai pelo X, Cancelar ou depois de salvar — nada de perder digitação.
    if (!salvando) onFechar();
  }

  return (
    <Dialog open={open} onOpenChange={(aberto) => !aberto && tentarFechar()}>
      <DialogContent
        className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl"
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{editando ? "Editar contrato" : "Novo contrato"}</DialogTitle>
          <DialogDescription>
            Defina as condições e as contas de anúncio deste contrato.
          </DialogDescription>
        </DialogHeader>

        <form
          id={formId}
          onSubmit={(event) => {
            event.preventDefault();
            salvar();
          }}
          className="space-y-5"
        >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="contrato-name">Nome do contrato</Label>
            <Input
              id="contrato-name"
              name="name"
              required
              maxLength={120}
              defaultValue={contrato?.name}
              placeholder="Ex.: Gestão de tráfego 2026"
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contrato-start">Data de início</Label>
            <Input
              id="contrato-start"
              name="startDate"
              type="date"
              required
              defaultValue={contrato?.startDate ?? hojeIso()}
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contrato-value">Valor mensal</Label>
            <Input
              id="contrato-value"
              name="monthlyValue"
              value={valor}
              onChange={(e) => setValor(maskMoney(e.target.value))}
              placeholder="0,00"
              inputMode="numeric"
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contrato-dueday">Dia de vencimento da parcela</Label>
            <Input
              id="contrato-dueday"
              name="dueDay"
              type="number"
              min={1}
              max={31}
              step={1}
              defaultValue={contrato?.dueDay ?? ""}
              placeholder={contrato ? undefined : "Ex.: 10"}
              className="h-11"
            />
            <p className="text-xs text-dim">
              De 1 a 31. Em meses mais curtos vale o último dia. Em branco, vence
              no dia do início do contrato.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contrato-status">Status</Label>
            <select
              id="contrato-status"
              name="status"
              defaultValue={contrato?.status ?? "active"}
              className="h-11 w-full rounded-lg border border-input bg-input/30 px-3 text-sm text-white outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contrato-period">Período</Label>
            <select
              id="contrato-period"
              name="period"
              defaultValue={contrato?.period ?? "monthly"}
              className="h-11 w-full rounded-lg border border-input bg-input/30 px-3 text-sm text-white outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {CONTRACT_PERIODS.map((periodo) => (
                <option key={periodo} value={periodo}>
                  {CONTRACT_PERIOD_LABELS[periodo]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="contrato-instagram">Instagram</Label>
            <Input
              id="contrato-instagram"
              name="instagramUrl"
              type="url"
              defaultValue={contrato?.instagramUrl ?? ""}
              placeholder="https://instagram.com/cliente"
              className="h-11"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="contrato-facebook">Facebook</Label>
            <Input
              id="contrato-facebook"
              name="facebookUrl"
              type="url"
              defaultValue={contrato?.facebookUrl ?? ""}
              placeholder="https://facebook.com/cliente"
              className="h-11"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="contrato-google">Google Meu Negócio</Label>
            <Input
              id="contrato-google"
              name="googleBusinessUrl"
              type="url"
              defaultValue={contrato?.googleBusinessUrl ?? ""}
              placeholder="https://g.page/cliente"
              className="h-11"
            />
          </div>
        </div>

        <fieldset className="space-y-3 rounded-xl border border-line bg-ink/40 p-4">
          <legend className="px-2 text-sm font-semibold text-white">
            Contas de anúncio Meta
          </legend>

          {buscandoContas ? (
            <p className="flex items-center gap-2 text-sm text-dim">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Carregando contas da Meta...
            </p>
          ) : contas.length === 0 ? (
            <p className="text-sm text-dim">
              {erroContas ||
                "Nenhuma conta disponível. Configure um token válido em Configurações → Meta Ads."}
            </p>
          ) : (
            <>
              {/* As selecionadas ficam sempre visíveis */}
              {contasSelecionadas.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {contasSelecionadas.map((conta) => (
                    <CartaoConta
                      key={conta.id}
                      conta={conta}
                      marcada
                      onAlternar={() => alternarConta(conta.id)}
                    />
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-line px-3 py-2.5 text-sm text-dim">
                  Nenhuma conta escolhida ainda neste contrato.
                </p>
              )}

              {selecionadas.length > 0 ? (
                <p className="text-xs text-dim">
                  {selecionadas.length}{" "}
                  {selecionadas.length === 1
                    ? "conta selecionada"
                    : "contas selecionadas"}
                  .
                </p>
              ) : null}

              {/* Demais contas só aparecem quando o usuário pede */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/70 pt-3">
                <p className="text-xs text-dim">
                  {disponiveis.length === 0
                    ? "Todas as contas disponíveis já estão vinculadas."
                    : `${disponiveis.length} ${
                        disponiveis.length === 1
                          ? "outra conta disponível"
                          : "outras contas disponíveis"
                      }.`}
                </p>
                {disponiveis.length > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      setMostrarTodas((atual) => {
                        if (atual) setBuscaConta("");
                        return !atual;
                      });
                    }}
                    aria-expanded={mostrarTodas}
                  >
                    {mostrarTodas ? (
                      <ChevronUp aria-hidden="true" />
                    ) : (
                      <ChevronDown aria-hidden="true" />
                    )}
                    {mostrarTodas ? "Ocultar contas" : "Mostrar todas as contas"}
                  </Button>
                ) : null}
              </div>

              {mostrarTodas && disponiveis.length > 0 ? (
                <div className="space-y-3">
                  <div className="relative">
                    <Search
                      aria-hidden="true"
                      className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-dim"
                    />
                    <Input
                      value={buscaConta}
                      onChange={(e) => setBuscaConta(e.target.value)}
                      placeholder="Buscar conta por nome, ID ou moeda..."
                      aria-label="Buscar contas de anúncio"
                      className="h-10 pl-9"
                    />
                  </div>

                  {disponiveisFiltradas.length === 0 ? (
                    <p className="text-sm text-dim">
                      Nenhuma conta encontrada para &quot;{buscaConta}&quot;.
                    </p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {disponiveisFiltradas.map((conta) => (
                        <CartaoConta
                          key={conta.id}
                          conta={conta}
                          marcada={false}
                          onAlternar={() => alternarConta(conta.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </>
          )}
        </fieldset>

          {/* Ações do modal: salvar só grava; cancelar e X descartam */}
          <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-4">
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={tentarFechar}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={salvando} className="gap-2 px-6">
              {salvando ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : null}
              {salvando
                ? "Salvando..."
                : editando
                  ? "Salvar contrato"
                  : "Criar contrato"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CartaoConta({
  conta,
  marcada,
  onAlternar,
}: {
  conta: AdAccountOption;
  marcada: boolean;
  onAlternar: () => void;
}) {
  return (
    <label
      className={[
        "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm transition-colors",
        marcada
          ? "border-ember/60 bg-ember/10"
          : "border-line bg-surface-2/60 hover:bg-surface-2",
      ].join(" ")}
    >
      <input
        type="checkbox"
        checked={marcada}
        onChange={onAlternar}
        className="mt-0.5 size-4 accent-[var(--color-ember)]"
        aria-label={`Usar conta ${conta.name} neste contrato`}
      />
      <span className="min-w-0">
        <span className="block truncate font-medium text-white">{conta.name}</span>
        <span className="block truncate text-xs text-dim">
          {conta.id} · {conta.currency ?? "moeda não informada"}
        </span>
      </span>
    </label>
  );
}
