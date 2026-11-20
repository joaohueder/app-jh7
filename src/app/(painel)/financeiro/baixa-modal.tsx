"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, CircleCheck, Loader2, Wallet } from "lucide-react";
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
import {
  FINANCE_PAYMENT_LABELS,
  FINANCE_PAYMENT_METHODS,
  type FinancePaymentMethod,
} from "@/lib/db/schema";
import { baixarLancamentoAction, estornarBaixaAction } from "./actions";
import type { Baixa, Lancamento } from "./comum";

/**
 * Modal de baixa: pagamento integral (o saldo todo) ou parcial, com meio de
 * pagamento. O histórico das baixas fica na mesma tela, com estorno.
 */
export function BaixaModal({
  lancamento,
  baixas,
  hoje,
  onFechar,
}: {
  lancamento: Lancamento;
  baixas: Baixa[];
  hoje: string;
  onFechar: () => void;
}) {
  const router = useRouter();
  const [integral, setIntegral] = useState(true);
  const [valor, setValor] = useState("");
  const [paidOn, setPaidOn] = useState(hoje);
  const [method, setMethod] = useState<FinancePaymentMethod>("pix");
  const [notes, setNotes] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, startEnviar] = useTransition();
  const [estornando, setEstornando] = useState<Baixa | null>(null);
  const [pendingEstorno, startEstorno] = useTransition();

  const saldo = lancamento.saldo;
  const quitado = saldo === 0;
  const validas = baixas.filter((b) => !b.estornadaEm);
  const estornadas = baixas.filter((b) => b.estornadaEm);

  function salvar() {
    const amount = integral ? 0 : parseMoney(valor);
    if (!integral && amount <= 0) {
      setErro("Informe o valor da baixa parcial.");
      return;
    }
    if (!integral && amount > saldo) {
      setErro("O valor informado é maior que o saldo em aberto.");
      return;
    }
    if (!paidOn) {
      setErro("Informe a data do recebimento.");
      return;
    }

    startEnviar(async () => {
      const resposta = await baixarLancamentoAction({
        entryId: lancamento.id,
        amount,
        paidOn,
        method,
        notes,
      });
      if (resposta.ok) {
        toast.success(resposta.message);
        setValor("");
        setNotes("");
        setErro(null);
        router.refresh();
        onFechar();
      } else {
        setErro(resposta.erro ?? "Não foi possível registrar a baixa.");
      }
    });
  }

  function estornar() {
    if (!estornando) return;
    startEstorno(async () => {
      const resposta = await estornarBaixaAction(estornando.id);
      setEstornando(null);
      if (resposta.ok) {
        toast.success(resposta.message);
        router.refresh();
        onFechar();
      } else {
        toast.error(resposta.erro);
      }
    });
  }

  return (
    <>
      <Dialog open onOpenChange={(aberto) => !aberto && !enviando && onFechar()}>
        <DialogContent
          className="max-h-[92dvh] overflow-y-auto sm:max-w-lg"
          onInteractOutside={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="size-4 text-ember" aria-hidden="true" />
              {quitado ? "Pagamentos" : "Baixar parcela"}
            </DialogTitle>
            <DialogDescription>
              {lancamento.descricao}
              {lancamento.cliente ? ` · ${lancamento.cliente}` : ""}
            </DialogDescription>
          </DialogHeader>

          <dl className="grid grid-cols-3 gap-2 rounded-lg border border-line bg-surface-2/40 px-3 py-2 text-xs">
            <div>
              <dt className="text-dim">Valor</dt>
              <dd className="font-semibold text-white">{formatMoney(lancamento.valor)}</dd>
            </div>
            <div>
              <dt className="text-dim">Baixado</dt>
              <dd className="font-semibold text-jade">{formatMoney(lancamento.baixado)}</dd>
            </div>
            <div>
              <dt className="text-dim">Saldo</dt>
              <dd
                className={`font-semibold ${
                  quitado ? "text-jade" : "text-white"
                }`}
              >
                {formatMoney(saldo)}
              </dd>
            </div>
          </dl>

          {!quitado ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo de baixa</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { valor: true, label: `Integral (${formatMoney(saldo)})` },
                    { valor: false, label: "Parcial" },
                  ].map((opcao) => (
                    <button
                      key={String(opcao.valor)}
                      type="button"
                      onClick={() => {
                        setIntegral(opcao.valor);
                        setErro(null);
                      }}
                      aria-pressed={integral === opcao.valor}
                      className={`h-11 rounded-lg border px-2 text-sm font-medium transition-colors ${
                        integral === opcao.valor
                          ? "border-ember/50 bg-ember/15 text-ember"
                          : "border-line bg-surface-2/40 text-dim hover:text-white"
                      }`}
                    >
                      {opcao.label}
                    </button>
                  ))}
                </div>
              </div>

              {!integral ? (
                <div className="space-y-2">
                  <Label htmlFor="baixa-valor">Valor da baixa</Label>
                  <Input
                    id="baixa-valor"
                    inputMode="numeric"
                    value={valor}
                    onChange={(e) => {
                      setValor(maskMoney(e.target.value));
                      setErro(null);
                    }}
                    placeholder="0,00"
                    className="h-11"
                  />
                  <p className="text-xs text-dim">
                    Restam {formatMoney(saldo)} em aberto.
                  </p>
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="baixa-data">Data do recebimento</Label>
                  <Input
                    id="baixa-data"
                    type="date"
                    value={paidOn}
                    onChange={(e) => {
                      setPaidOn(e.target.value);
                      setErro(null);
                    }}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="baixa-meio">Meio de pagamento</Label>
                  <select
                    id="baixa-meio"
                    value={method}
                    onChange={(e) => setMethod(e.target.value as FinancePaymentMethod)}
                    className="h-11 w-full rounded-lg border border-input bg-input/30 px-2.5 text-sm text-white outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {FINANCE_PAYMENT_METHODS.map((meio) => (
                      <option key={meio} value={meio}>
                        {FINANCE_PAYMENT_LABELS[meio]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="baixa-obs">Observações</Label>
                <textarea
                  id="baixa-obs"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Opcional"
                  className="w-full rounded-lg border border-input bg-input/30 px-2.5 py-2 text-sm text-white outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </div>

              {erro ? (
                <p role="alert" className="text-sm text-destructive">
                  {erro}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="flex items-center gap-2 rounded-lg border border-jade/40 bg-jade/10 px-3 py-2 text-sm text-jade">
              <CircleCheck className="size-4" aria-hidden="true" />
              Lançamento quitado.
            </p>
          )}

          {baixas.length > 0 ? (
            <div className="space-y-2 border-t border-line pt-4">
              <p className="text-sm font-semibold text-white">Pagamentos</p>
              <ul className="divide-y divide-line/60 rounded-lg border border-line">
                {[...validas, ...estornadas].map((baixa) => (
                  <li
                    key={baixa.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0">
                      <span
                        className={`block font-medium ${
                          baixa.estornadaEm
                            ? "text-dim line-through"
                            : "text-white"
                        }`}
                      >
                        {formatMoney(baixa.valor)} · {baixa.meioLabel}
                      </span>
                      <span className="block truncate text-xs text-dim">
                        {formatDateIso(baixa.data)}
                        {baixa.estornadaEm
                          ? ` · estornado em ${formatDateIso(baixa.estornadaEm)}`
                          : ""}
                        {baixa.observacoes ? ` · ${baixa.observacoes}` : ""}
                      </span>
                    </span>
                    {!baixa.estornadaEm ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-dim hover:text-destructive"
                        onClick={() => setEstornando(baixa)}
                        aria-label={`Estornar pagamento de ${formatMoney(baixa.valor)}`}
                      >
                        <Ban aria-hidden="true" />
                        Estornar
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <DialogFooter className="border-t border-line pt-4">
            <Button variant="ghost" onClick={onFechar} disabled={enviando} className="h-11">
              Fechar
            </Button>
            {!quitado ? (
              <Button onClick={salvar} disabled={enviando} className="h-11 gap-2">
                {enviando ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                {integral ? "Baixar integral" : "Baixar parcial"}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={estornando !== null}
        onOpenChange={(aberto) => !aberto && !pendingEstorno && setEstornando(null)}
        titulo="Estornar pagamento?"
        descricao="O valor sai do total recebido e a parcela volta a ficar em aberto. O histórico do estorno permanece registrado."
        detalhe={
          estornando
            ? `${formatMoney(estornando.valor)} · ${estornando.meioLabel} · ${formatDateIso(estornando.data)}`
            : undefined
        }
        confirmLabel="Estornar pagamento"
        destructive
        pending={pendingEstorno}
        onConfirm={estornar}
      />
    </>
  );
}