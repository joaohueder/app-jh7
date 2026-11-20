"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createClientAction,
  getMetaAdAccountsAction,
  updateClientAction,
  type AdAccountOption,
  type ClientListItem,
  type ClientState,
} from "./actions";

const vazio: ClientState = {};

type ClientFormValues = Pick<
  ClientListItem,
  | "id"
  | "businessName"
  | "legalName"
  | "document"
  | "contactPerson"
  | "email"
  | "phone"
  | "city"
  | "state"
  | "notes"
  | "accounts"
>;

/**
 * Formulário completo de cliente, usado pelas telas /clientes/novo (criar)
 * e /clientes/[id] (editar). A seleção de contas Meta é carregada do token
 * salvo nas Configurações — a chave nunca chega ao navegador.
 */
export function ClientForm({ client }: { client?: ClientFormValues }) {
  const editando = Boolean(client);
  const router = useRouter();
  // Contas já vinculadas entram como opção desde o início, mesmo que a Meta
  // não as devolva (token revogado, conta removida do Business Manager).
  const [contas, setContas] = useState<AdAccountOption[]>(
    () =>
      client?.accounts.map((a) => ({
        id: a.adAccountId,
        name: a.name,
        currency: a.currency ?? undefined,
      })) ?? [],
  );
  const [selecionadas, setSelecionadas] = useState<string[]>(
    client?.accounts.map((a) => a.adAccountId) ?? [],
  );
  const [carregandoContas, startCarregando] = useTransition();
  const [erroContas, setErroContas] = useState("");
  const [salvando, startSalvando] = useTransition();

  useEffect(() => {
    const vinculadas = client?.accounts ?? [];
    startCarregando(async () => {
      const resultado = await getMetaAdAccountsAction();
      if (resultado.ok) {
        // mescla: contas da Meta + contas vinculadas que não vieram da Meta
        const daMeta = resultado.accounts ?? [];
        const faltando = vinculadas
          .filter((a) => !daMeta.some((c) => c.id === a.adAccountId))
          .map((a) => ({ id: a.adAccountId, name: a.name, currency: a.currency ?? undefined }));
        const ids = new Set(daMeta.map((c) => c.id));
        setContas([...daMeta, ...faltando.filter((f) => !ids.has(f.id))]);
        setErroContas("");
      } else {
        setErroContas(resultado.message ?? "Não foi possível carregar as contas da Meta.");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carrega uma vez ao abrir a tela
  }, []);

  // Mantemos contas vinculadas mesmo que a Meta as tenha removido ou revogado.

  function salvar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    selecionadas.forEach((id) => formData.append("adAccount", id));
    if (client) formData.set("id", String(client.id));

    startSalvando(async () => {
      const resultado = editando
        ? await updateClientAction(vazio, formData)
        : await createClientAction(vazio, formData);
      if (resultado.ok) {
        toast.success(editando ? "Cliente atualizado." : "Cliente criado.");
        router.push("/clientes");
      } else {
        toast.error(resultado.error ?? "Não foi possível salvar o cliente.");
      }
    });
  }

  function alternarConta(id: string) {
    setSelecionadas((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id],
    );
  }

  return (
    <form onSubmit={salvar} className="space-y-6">
      {/* Dados do cliente */}
      <section className="space-y-5 rounded-xl border border-line bg-surface p-6">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-white">Dados do cliente</h2>
          <p className="text-sm text-dim">
            Informações de identificação e contato.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            id="businessName"
            label="Nome fantasia"
            name="businessName"
            required
            maxLength={120}
            defaultValue={client?.businessName}
            placeholder="Como o cliente é conhecido"
          />
          <Campo
            id="legalName"
            label="Razão social"
            name="legalName"
            maxLength={160}
            defaultValue={client?.legalName}
            placeholder="Nome registrado da empresa"
          />
          <Campo
            id="document"
            label="CNPJ ou CPF"
            name="document"
            maxLength={20}
            defaultValue={client?.document}
            placeholder="Somente números"
          />
          <Campo
            id="contactPerson"
            label="Responsável"
            name="contactPerson"
            maxLength={120}
            defaultValue={client?.contactPerson}
            placeholder="Pessoa de contato"
          />
          <Campo
            id="email"
            label="E-mail"
            name="email"
            type="email"
            maxLength={160}
            defaultValue={client?.email}
            placeholder="contato@cliente.com.br"
          />
          <Campo
            id="phone"
            label="Telefone"
            name="phone"
            maxLength={40}
            defaultValue={client?.phone}
            placeholder="(00) 00000-0000"
          />
          <Campo
            id="city"
            label="Cidade"
            name="city"
            maxLength={80}
            defaultValue={client?.city}
          />
          <Campo
            id="state"
            label="UF"
            name="state"
            maxLength={2}
            defaultValue={client?.state}
            placeholder="SP"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Observações</Label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            maxLength={2000}
            defaultValue={client?.notes ?? ""}
            placeholder="Informações adicionais sobre o cliente..."
            className="w-full rounded-lg border border-input bg-input/30 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-dim/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
      </section>

      {/* Contas de anúncio */}
      <section className="space-y-5 rounded-xl border border-line bg-surface p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-white">
              Contas de anúncio Meta
            </h2>
            <p className="text-sm text-dim">
              Marque as contas que serão usadas para este cliente. A lista vem do
              token configurado em Configurações → Meta Ads.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Recarregar contas da Meta"
            disabled={carregandoContas}
            onClick={() => {
              startCarregando(async () => {
                const resultado = await getMetaAdAccountsAction();
                if (resultado.ok) {
                  setContas(resultado.accounts ?? []);
                  setErroContas("");
                } else {
                  setErroContas(resultado.message ?? "Não foi possível carregar as contas.");
                }
              });
            }}
            className="text-dim hover:text-white"
          >
            {carregandoContas ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw aria-hidden="true" />
            )}
          </Button>
        </div>

        {carregandoContas ? (
          <p className="flex items-center gap-2 text-sm text-dim">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Carregando contas da Meta...
          </p>
        ) : contas.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {contas.map((conta) => {
              const marcada = selecionadas.includes(conta.id);
              return (
                <label
                  key={conta.id}
                  className={[
                    "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm transition-colors",
                    marcada
                      ? "border-ember/60 bg-ember/10"
                      : "border-line bg-surface-2/60 hover:border-line/80 hover:bg-surface-2",
                  ].join(" ")}
                >
                  <input
                    type="checkbox"
                    checked={marcada}
                    onChange={() => alternarConta(conta.id)}
                    className="mt-0.5 size-4 accent-[var(--color-ember)]"
                    aria-label={`Usar conta ${conta.name}`}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-white">
                      {conta.name}
                    </span>
                    <span className="block truncate text-xs text-dim">
                      {conta.id} · {conta.currency ?? "moeda não informada"}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="rounded-lg border border-line bg-surface-2/60 px-3 py-3 text-sm text-dim">
            {erroContas ||
              "Nenhuma conta disponível. Configure um token válido em Configurações → Meta Ads."}
          </p>
        )}

        {selecionadas.length > 0 ? (
          <p className="text-xs text-dim">
            {selecionadas.length}{" "}
            {selecionadas.length === 1 ? "conta selecionada" : "contas selecionadas"}.
          </p>
        ) : null}
      </section>

      {/* Ações */}
      <div className="flex flex-wrap justify-end gap-3">
        <Button
          type="button"
          variant="ghost"
          size="lg"
          asChild
          disabled={salvando}
        >
          <Link href="/clientes">Cancelar</Link>
        </Button>
        <Button type="submit" size="lg" disabled={salvando || carregandoContas} className="px-6">
          {salvando ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              Salvando...
            </>
          ) : editando ? (
            "Salvar alterações"
          ) : (
            "Criar cliente"
          )}
        </Button>
      </div>
    </form>
  );
}

function Campo({
  id,
  label,
  ...props
}: {
  id: string;
  label: string;
  name: string;
  defaultValue?: string | null;
  type?: string;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} className="h-11" {...props} defaultValue={props.defaultValue ?? ""} />
    </div>
  );
}
