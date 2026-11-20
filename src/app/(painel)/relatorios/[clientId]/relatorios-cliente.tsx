"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarPlus, Copy, ExternalLink, FileText, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
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
import { formatDateIso, hojeIso } from "@/lib/format/masks";
import type { RelatorioListaItem } from "../dados";
import {
  criarRelatorioAction,
  excluirRelatorioAction,
  regerarRelatorioAction,
} from "../actions";

export function RelatoriosCliente({
  clientId,
  relatorios,
  podeCriar,
  podeExcluir,
}: {
  clientId: number;
  relatorios: RelatorioListaItem[];
  podeCriar: boolean;
  podeExcluir: boolean;
}) {
  const [novoAberto, setNovoAberto] = useState(false);
  const [excluindo, setExcluindo] = useState<RelatorioListaItem | null>(null);
  const [regerando, setRegerando] = useState<number | null>(null);

  async function regerar(relatorio: RelatorioListaItem) {
    setRegerando(relatorio.id);
    const resposta = await regerarRelatorioAction(clientId, relatorio.id);
    setRegerando(null);
    if (resposta.ok) toast.success(resposta.message);
    else toast.error(resposta.erro);
  }

  /** Link público absoluto — é o que o cliente abre, então precisa da origem. */
  async function copiarLink(token: string) {
    const link = `${window.location.origin}/r/${token}`;

    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copiado.");
      return;
    } catch {
      // Sem permissão de clipboard: cai no método antigo (textarea + execCommand).
    }

    // `navigator.clipboard` exige contexto seguro e permissão; este caminho
    // funciona em navegador comum e é o que resta quando ela é negada.
    const area = document.createElement("textarea");
    area.value = link;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const copiou = document.execCommand("copy");
    document.body.removeChild(area);

    if (copiou) toast.success("Link copiado.");
    else toast.error(`Não foi possível copiar. Link: ${link}`, { duration: 15000 });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Relatórios gerados</h2>
          <p className="text-sm text-dim">
            {relatorios.length === 0
              ? "Nenhum relatório gerado ainda."
              : `${relatorios.length} ${relatorios.length === 1 ? "relatório" : "relatórios"}`}
          </p>
        </div>
        {podeCriar ? (
          <Button onClick={() => setNovoAberto(true)} className="h-10 gap-2" size="lg">
            <Plus aria-hidden="true" />
            Novo relatório
          </Button>
        ) : null}
      </div>

      {relatorios.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-surface px-6 py-14 text-center">
          <FileText className="size-8 text-dim/50" aria-hidden="true" />
          <p className="text-sm text-dim">
            Gere o primeiro relatório informando o período de início e fim.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {relatorios.map((relatorio) => (
            <li
              key={relatorio.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">
                  {formatDateIso(relatorio.inicio)} a {formatDateIso(relatorio.fim)}
                </p>
                <p className="text-xs text-dim">
                  Gerado em {relatorio.criadoEm.toLocaleString("pt-BR")}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <Link href={`/r/${relatorio.token}`} target="_blank">
                    <ExternalLink aria-hidden="true" />
                    Abrir
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  aria-label={`Copiar link do relatório de ${formatDateIso(relatorio.inicio)} a ${formatDateIso(relatorio.fim)}`}
                  onClick={() => copiarLink(relatorio.token)}
                >
                  <Copy aria-hidden="true" />
                  <span className="hidden md:inline">Copiar link</span>
                </Button>
                {podeCriar ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={regerando === relatorio.id}
                    aria-label={`Regerar relatório de ${formatDateIso(relatorio.inicio)} a ${formatDateIso(relatorio.fim)}`}
                    onClick={() => regerar(relatorio)}
                  >
                    {regerando === relatorio.id ? (
                      <Loader2 className="animate-spin" aria-hidden="true" />
                    ) : (
                      <RefreshCw aria-hidden="true" />
                    )}
                    <span className="hidden md:inline">
                      {regerando === relatorio.id ? "Regerando…" : "Regerar"}
                    </span>
                  </Button>
                ) : null}
                {podeExcluir ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExcluindo(relatorio)}
                    className="gap-1.5 text-dim hover:text-destructive"
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
        <NovoRelatorioModal clientId={clientId} onFechar={() => setNovoAberto(false)} />
      ) : null}

      <ConfirmDialog
        open={excluindo !== null}
        onOpenChange={(v) => !v && setExcluindo(null)}
        titulo="Excluir relatório?"
        descricao="Esta ação é permanente: o relatório e o link público deixam de funcionar. Nenhum dado do cliente é afetado."
        detalhe={
          excluindo ? `${formatDateIso(excluindo.inicio)} a ${formatDateIso(excluindo.fim)}` : undefined
        }
        confirmLabel="Excluir definitivamente"
        destructive
        onConfirm={async () => {
          if (!excluindo) return;
          const resposta = await excluirRelatorioAction(clientId, excluindo.id);
          setExcluindo(null);
          if (resposta.ok) toast.success(resposta.message);
          else toast.error(resposta.erro);
        }}
      />
    </div>
  );
}

function NovoRelatorioModal({
  clientId,
  onFechar,
}: {
  clientId: number;
  onFechar: () => void;
}) {
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function gerar() {
    if (!inicio || !fim) {
      setErro("Informe as datas de início e fim.");
      return;
    }
    setEnviando(true);
    const formData = new FormData();
    formData.set("clientId", String(clientId));
    formData.set("inicio", inicio);
    formData.set("fim", fim);
    const resposta = await criarRelatorioAction({}, formData);
    setEnviando(false);
    if (resposta.ok) {
      toast.success(resposta.message);
      onFechar();
    } else {
      setErro(resposta.erro ?? "Não foi possível gerar o relatório.");
    }
  }

  return (
    <Dialog open onOpenChange={(v) => v || onFechar()}>
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="size-4 text-ember" aria-hidden="true" />
            Novo relatório
          </DialogTitle>
          <DialogDescription>
            Escolha o período que o relatório vai cobrir.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="relInicio">Início</Label>
            <Input
              id="relInicio"
              type="date"
              value={inicio}
              max={fim || hojeIso()}
              onChange={(e) => {
                setInicio(e.target.value);
                setErro(null);
              }}
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="relFim">Fim</Label>
            <Input
              id="relFim"
              type="date"
              value={fim}
              min={inicio || undefined}
              onChange={(e) => {
                setFim(e.target.value);
                setErro(null);
              }}
              className="h-11"
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
          <Button onClick={gerar} disabled={enviando} className="h-11 gap-2">
            {enviando ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Gerar relatório
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}