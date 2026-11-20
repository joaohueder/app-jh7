"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleDollarSign,
  CirclePlus,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateIso, formatMoney, maskMoney, parseMoney } from "@/lib/format/masks";
import { FINANCE_CATEGORIES, FINANCE_KIND_LABELS, type FinanceKind } from "@/lib/db/schema";
import {
  createFinanceEntryAction,
  excluirLancamentoAction,
  updateFinanceEntryAction,
} from "./actions";
import { BaixaModal } from "./baixa-modal";
import {
  STATUS_FINANCE_LABELS,
  mesAnterior,
  mesSeguinte,
  nomeDoMes,
  type Baixa,
  type Lancamento,
  type ResumoFinanceiro,
  type StatusFinance,
} from "./comum";

type Filtro = "todos" | "receita" | "despesa" | "vencido" | "aberto";

const FILTROS: { valor: Filtro; label: string }[] = [
  { valor: "todos", label: "Todos" },
  { valor: "receita", label: "Receitas" },
  { valor: "despesa", label: "Despesas" },
  { valor: "aberto", label: "Em aberto" },
  { valor: "vencido", label: "Vencidos" },
];

export function FinanceiroCliente({
  mes,
  hoje,
  lancamentos,
  resumo,
  clientes,
  baixasDoLancamento,
  podeCriar,
  podeEditar,
  podeExcluir,
}: {
  mes: string;
  hoje: string;
  lancamentos: Lancamento[];
  resumo: ResumoFinanceiro;
  /** Histórico de baixas por lançamento, para o modal. */
  baixasDoLancamento: Record<number, Baixa[]>;
  clientes: { id: number; nome: string }[];
  podeCriar: boolean;
  podeEditar: boolean;
  podeExcluir: boolean;
}) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [novoAberto, setNovoAberto] = useState(false);
  const [editando, setEditando] = useState<Lancamento | null>(null);
  const [excluindo, setExcluindo] = useState<Lancamento | null>(null);
  const [baixando, setBaixando] = useState<Lancamento | null>(null);

  const lista = useMemo(() => {
    if (filtro === "todos") return lancamentos;
    if (filtro === "receita" || filtro === "despesa")
      return lancamentos.filter((l) => l.kind === filtro);
    return lancamentos.filter((l) => l.status === filtro);
  }, [lancamentos, filtro]);

  function irParaMes(destino: string) {
    router.push(`/financeiro?mes=${destino}`);
  }


  const cartoes = [
    {
      titulo: "A receber",
      valor: resumo.aReceber,
      icone: ArrowUpRight,
      cor: "text-ember",
      detalhe: "Receitas em aberto no mês",
    },
    {
      titulo: "Recebido",
      valor: resumo.recebido,
      icone: CircleCheck,
      cor: "text-jade",
      detalhe: "Receitas pagas no mês",
    },
    {
      titulo: "Despesas",
      valor: resumo.despesas,
      icone: CircleDollarSign,
      cor: "text-white",
      detalhe: `${formatMoney(resumo.pago)} já pago`,
    },
    {
      titulo: "Vencido",
      valor: resumo.vencido,
      icone: TriangleAlert,
      cor: resumo.vencido > 0 ? "text-destructive" : "text-white",
      detalhe: "Receitas vencidas e não recebidas",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Navegação de mês */}
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Mês anterior: ${nomeDoMes(mesAnterior(mes))}`}
            onClick={() => irParaMes(mesAnterior(mes))}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <span className="min-w-44 text-center text-sm font-semibold text-white">
            {nomeDoMes(mes)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Mês seguinte: ${nomeDoMes(mesSeguinte(mes))}`}
            onClick={() => irParaMes(mesSeguinte(mes))}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
          {mes !== hoje.slice(0, 7) ? (
            <Button variant="ghost" size="sm" onClick={() => irParaMes(hoje.slice(0, 7))}>
              Mês atual
            </Button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {podeCriar ? (
            <Button className="h-10 gap-2" onClick={() => setNovoAberto(true)}>
              <Plus aria-hidden="true" />
              Novo lançamento
            </Button>
          ) : null}
        </div>
      </div>

      {/* Resumo */}
      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cartoes.map(({ titulo, valor, icone: Icone, cor, detalhe }) => (
          <div key={titulo} className="rounded-xl border border-line bg-surface p-4">
            <dt className="flex items-center gap-1.5 text-xs text-dim">
              <Icone className={`size-3.5 ${cor}`} aria-hidden="true" />
              {titulo}
            </dt>
            <dd className={`mt-1 text-lg font-semibold ${cor}`}>{formatMoney(valor)}</dd>
            <dd className="mt-0.5 text-xs text-dim">{detalhe}</dd>
          </div>
        ))}
      </dl>

      <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm">
        <Wallet className="size-4 text-jade" aria-hidden="true" />
        <span className="text-dim">Saldo do mês (recebido − pago)</span>
        <span className={`ml-auto font-semibold ${resumo.saldo < 0 ? "text-destructive" : "text-jade"}`}>
          {formatMoney(resumo.saldo)}
        </span>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-1.5">
        {FILTROS.map(({ valor, label }) => (
          <button
            key={valor}
            type="button"
            onClick={() => setFiltro(valor)}
            aria-pressed={filtro === valor}
            className={`h-8 rounded-full border px-3 text-xs font-medium transition-colors ${
              filtro === valor
                ? "border-ember/50 bg-ember/15 text-ember"
                : "border-line bg-surface text-dim hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {lista.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-surface px-6 py-14 text-center">
          <Wallet className="size-8 text-dim/50" aria-hidden="true" />
          <p className="text-sm text-dim">
            {lancamentos.length === 0
              ? "Nenhum lançamento neste mês. Gere as cobranças no Dashboard ou crie um lançamento manual."
              : "Nenhum lançamento neste filtro."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {lista.map((lancamento) => (
            <li
              key={lancamento.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.65rem] font-medium ${
                      lancamento.kind === "receita"
                        ? "border-jade/40 bg-jade/10 text-jade"
                        : "border-ember/40 bg-ember/10 text-ember"
                    }`}
                  >
                    {lancamento.kind === "receita" ? (
                      <ArrowUpRight className="size-3" aria-hidden="true" />
                    ) : (
                      <ArrowDownRight className="size-3" aria-hidden="true" />
                    )}
                    {FINANCE_KIND_LABELS[lancamento.kind]}
                  </span>
                  <span className="min-w-0 truncate text-sm font-medium text-white">
                    {lancamento.descricao}
                  </span>
                  <StatusBadge status={lancamento.status} />
                </div>
                <p className="mt-1 truncate text-xs text-dim">
                  {lancamento.cliente ? `${lancamento.cliente} · ` : ""}
                  {lancamento.categoria} · Vence {formatDateIso(lancamento.vencimento)}
                  {lancamento.baixado > 0
                    ? ` · Baixado ${formatMoney(lancamento.baixado)}${lancamento.saldo > 0 ? ` (falta ${formatMoney(lancamento.saldo)})` : ""}`
                    : ""}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <span
                  className={`mr-2 text-sm font-semibold ${
                    lancamento.kind === "receita" ? "text-white" : "text-dim"
                  }`}
                >
                  {lancamento.kind === "despesa" ? "−" : ""}
                  {formatMoney(lancamento.valor)}
                </span>

                {podeEditar ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    aria-label={`Baixar ${lancamento.descricao}`}
                    onClick={() => setBaixando(lancamento)}
                  >
                    <Wallet aria-hidden="true" />
                    <span className="hidden md:inline">
                      {lancamento.status === "pago" ? "Pagamentos" : "Baixar"}
                    </span>
                  </Button>
                ) : null}

                {podeEditar ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5"
                    aria-label={`Editar ${lancamento.descricao}`}
                    onClick={() => setEditando(lancamento)}
                  >
                    <Pencil aria-hidden="true" />
                    <span className="hidden md:inline">Editar</span>
                  </Button>
                ) : null}

                {podeExcluir ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-dim hover:text-destructive"
                    aria-label={`Excluir ${lancamento.descricao}`}
                    onClick={() => setExcluindo(lancamento)}
                  >
                    <Trash2 aria-hidden="true" />
                    <span className="hidden md:inline">Excluir</span>
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {novoAberto ? (
        <LancamentoModal
          key="novo"
          clientes={clientes}
          hoje={hoje}
          onFechar={() => setNovoAberto(false)}
        />
      ) : null}

      {baixando ? (
        <BaixaModal
          key={`baixa-${baixando.id}`}
          lancamento={baixando}
          baixas={baixasDoLancamento[baixando.id] ?? []}
          hoje={hoje}
          onFechar={() => setBaixando(null)}
        />
      ) : null}

      {editando ? (
        <LancamentoModal
          key={`editar-${editando.id}`}
          lancamento={editando}
          clientes={clientes}
          hoje={hoje}
          onFechar={() => setEditando(null)}
        />
      ) : null}

      <ConfirmDialog
        open={excluindo !== null}
        onOpenChange={(v) => !v && setExcluindo(null)}
        titulo="Excluir lançamento?"
        descricao="Esta ação é permanente e o valor sai dos totais do mês."
        detalhe={
          excluindo ? `${excluindo.descricao} · ${formatMoney(excluindo.valor)}` : undefined
        }
        confirmLabel="Excluir definitivamente"
        destructive
        onConfirm={async () => {
          if (!excluindo) return;
          const resposta = await excluirLancamentoAction(excluindo.id);
          setExcluindo(null);
          if (resposta.ok) toast.success(resposta.message);
          else toast.error(resposta.erro);
        }}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: StatusFinance }) {
  const Classes: Record<StatusFinance, string> = {
    pago: "border-jade/40 bg-jade/10 text-jade",
    parcial: "border-ember/40 bg-ember/10 text-ember",
    aberto: "border-line bg-surface-2 text-dim",
    vencido: "border-destructive/40 bg-destructive/10 text-destructive",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.65rem] font-medium ${Classes[status]}`}
    >
      {STATUS_FINANCE_LABELS[status]}
    </span>
  );
}

function LancamentoModal({
  lancamento,
  clientes,
  hoje,
  onFechar,
}: {
  lancamento?: Lancamento;
  clientes: { id: number; nome: string }[];
  hoje: string;
  onFechar: () => void;
}) {
  const [kind, setKind] = useState<FinanceKind>(lancamento?.kind ?? "receita");
  const [clientId, setClientId] = useState(
    lancamento?.clientId ? String(lancamento.clientId) : "",
  );
  const [description, setDescription] = useState(lancamento?.descricao ?? "");
  const [category, setCategory] = useState(lancamento?.categoria ?? "Mensalidade");
  const [amount, setAmount] = useState(
    lancamento ? maskMoney(String(lancamento.valor)) : "",
  );
  const [dueDate, setDueDate] = useState(lancamento?.vencimento ?? hoje);
  const [paidAt, setPaidAt] = useState(lancamento?.pagoEm ?? "");
  const [notes, setNotes] = useState(lancamento?.observacoes ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function salvar() {
    setEnviando(true);
    const formData = new FormData();
    if (lancamento) formData.set("id", String(lancamento.id));
    formData.set("kind", kind);
    formData.set("clientId", clientId);
    formData.set("description", description);
    formData.set("category", category);
    formData.set("amount", String(parseMoney(amount)));
    formData.set("dueDate", dueDate);
    formData.set("paidAt", paidAt);
    formData.set("notes", notes);

    const resposta = lancamento
      ? await updateFinanceEntryAction({}, formData)
      : await createFinanceEntryAction({}, formData);
    setEnviando(false);

    if (resposta.ok) {
      toast.success(resposta.message);
      onFechar();
    } else {
      setErro(resposta.erro ?? "Não foi possível salvar o lançamento.");
    }
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && !enviando && onFechar()}>
      <DialogContent
        className="max-h-[92dvh] overflow-y-auto sm:max-w-lg"
        onInteractOutside={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CirclePlus className="size-4 text-ember" aria-hidden="true" />
            {lancamento ? "Editar lançamento" : "Novo lançamento"}
          </DialogTitle>
          <DialogDescription>
            {lancamento
              ? "Altere os dados e salve. Lançamentos gerados do contrato continuam ligados a ele."
              : "Receitas e despesas entram nos totais do mês pelo vencimento."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Tipo</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["receita", "despesa"] as const).map((tipo) => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => setKind(tipo)}
                  aria-pressed={kind === tipo}
                  className={`h-11 rounded-lg border text-sm font-medium transition-colors ${
                    kind === tipo
                      ? "border-ember/50 bg-ember/15 text-ember"
                      : "border-line bg-surface-2/40 text-dim hover:text-white"
                  }`}
                >
                  {FINANCE_KIND_LABELS[tipo]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="fin-desc">Descrição</Label>
            <Input
              id="fin-desc"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setErro(null);
              }}
              placeholder="Mensalidade novembro — Contrato Meta Ads"
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fin-cliente">Cliente</Label>
            <select
              id="fin-cliente"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="h-11 w-full rounded-lg border border-input bg-input/30 px-2.5 text-sm text-white outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Sem cliente (despesa interna)</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fin-categoria">Categoria</Label>
            <select
              id="fin-categoria"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-11 w-full rounded-lg border border-input bg-input/30 px-2.5 text-sm text-white outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {[...new Set([category, ...FINANCE_CATEGORIES])]
                .filter(Boolean)
                .map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fin-valor">Valor</Label>
            <Input
              id="fin-valor"
              inputMode="numeric"
              value={amount}
              onChange={(e) => {
                setAmount(maskMoney(e.target.value));
                setErro(null);
              }}
              placeholder="0,00"
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fin-venc">Vencimento</Label>
            <Input
              id="fin-venc"
              type="date"
              value={dueDate}
              onChange={(e) => {
                setDueDate(e.target.value);
                setErro(null);
              }}
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fin-pago">Pago em</Label>
            <Input
              id="fin-pago"
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className="h-11"
            />
            <p className="text-xs text-dim">Deixe vazio para manter em aberto.</p>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="fin-obs">Observações</Label>
            <textarea
              id="fin-obs"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-input bg-input/30 px-2.5 py-2 text-sm text-white outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              placeholder="Opcional"
            />
          </div>
        </div>

        {erro ? (
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        ) : null}

        <DialogFooter className="border-t border-line pt-4">
          <Button variant="ghost" onClick={onFechar} disabled={enviando} className="h-11">
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={enviando} className="h-11 gap-2">
            {enviando ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {lancamento ? "Salvar alterações" : "Criar lançamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}