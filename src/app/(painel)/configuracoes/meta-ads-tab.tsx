"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  BadgeCheck,
  CircleAlert,
  ExternalLink,
  KeyRound,
  Loader2,
  PlugZap,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  removeMetaTokenAction,
  saveMetaTokenAction,
  testMetaConnectionAction,
  type MetaTestState,
  type SettingsState,
} from "./actions";
import type { MetaSettings } from "@/lib/settings";

const initialSaveState: SettingsState = {};
const initialTestState: MetaTestState = {};

const LINK_TOKEN =
  "https://developers.facebook.com/tools/accesstoken/";
const LINK_PERMISSOES =
  "https://developers.facebook.com/apps";
const LINK_DOCUMENTACAO =
  "https://developers.facebook.com/docs/marketing-api/get-started";

export function MetaAdsTab({
  meta,
  podeEditar,
}: {
  meta: MetaSettings;
  podeEditar: boolean;
}) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      {podeEditar ? (
        <TokenCard meta={meta} />
      ) : (
        <p className="rounded-xl border border-line bg-surface p-6 text-sm text-dim">
          Somente usuários com permissão de edição em Configurações podem
          alterar o token da Meta.
        </p>
      )}
      <OrientacoesCard />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Card do token + teste de conexão                                    */
/* ------------------------------------------------------------------ */

function TokenCard({ meta }: { meta: MetaSettings }) {
  const [state, formAction, pending] = useActionState(
    saveMetaTokenAction,
    initialSaveState,
  );
  const [teste, testAction, testando] = useActionState(
    testMetaConnectionAction,
    initialTestState,
  );
  const [removendo, startRemover] = useTransition();
  const [valor, setValor] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  // Limpa o campo quando o servidor confirma o salvamento
  // (state.ok muda de undefined para true).
  if (state.ok && valor !== "") {
    setValor("");
  }

  useEffect(() => {
    if (state.ok) toast.success("Token da Meta salvo.");
  }, [state]);

  useEffect(() => {
    if (teste.ok) toast.success(teste.message ?? "Conectado à Meta.");
  }, [teste]);

  const temToken = meta.hasToken || valor.trim().length > 0;

  return (
    <div className="space-y-6">
      {/* Formulário do token */}
      <form
        action={formAction}
        ref={formRef}
        className="space-y-5 rounded-xl border border-line bg-surface p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 text-base font-semibold text-white">
              <KeyRound className="size-4 text-ember" aria-hidden="true" />
              Token da API da Meta
            </h2>
            <p className="text-sm text-dim">
              Cole o token de acesso gerado na Meta Developers.
            </p>
          </div>
          {meta.hasToken ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-jade/40 bg-jade/10 px-2.5 py-1 text-xs font-medium text-jade">
              <BadgeCheck className="size-3.5" aria-hidden="true" />
              Salvo {meta.tokenHint} ·{" "}
              {meta.updatedAt
                ? new Date(meta.updatedAt).toLocaleDateString("pt-BR")
                : ""}
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs font-medium text-dim">
              <CircleAlert className="size-3.5" aria-hidden="true" />
              Não configurado
            </span>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="metaToken">
            {meta.hasToken ? "Substituir token" : "Token de acesso"}
          </Label>
          <Input
            id="metaToken"
            name="metaToken"
            type="password"
            autoComplete="off"
            placeholder="EAA... (token de longa duração recomendado)"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="h-11 font-mono text-sm"
          />
          <p className="text-xs text-dim">
            Fica salvo apenas no banco local deste computador e nunca é exibido
            por completo na tela.
          </p>
        </div>

        {state.error ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {state.error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" disabled={pending} className="h-11 px-6">
            {pending ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" />
                Salvando...
              </>
            ) : (
              "Salvar token"
            )}
          </Button>

          {meta.hasToken ? (
            <Button
              type="button"
              variant="ghost"
              size="lg"
              disabled={removendo}
              onClick={() =>
                startRemover(async () => {
                  await removeMetaTokenAction();
                  setValor("");
                  toast.success("Token removido.");
                })
              }
              className="h-11 gap-2 text-dim hover:text-destructive"
            >
              {removendo ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 aria-hidden="true" />
              )}
              Remover
            </Button>
          ) : null}
        </div>
      </form>

      {/* Teste de conexão */}
      <form
        action={testAction}
        className="space-y-5 rounded-xl border border-line bg-surface p-6"
      >
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-base font-semibold text-white">
            <PlugZap className="size-4 text-jade" aria-hidden="true" />
            Testar conexão
          </h2>
          <p className="text-sm text-dim">
            Consulta a Graph API com o token{" "}
            {meta.hasToken ? "salvo" : "colado acima"} e lista as contas de
            anúncios acessíveis.
          </p>
        </div>

        {!temToken ? (
          <p className="rounded-lg border border-line bg-surface-2/60 px-3 py-2 text-sm text-dim">
            Salve ou cole um token para poder testar a conexão.
          </p>
        ) : null}

        <Button
          type="submit"
          variant="outline"
          size="lg"
          disabled={testando || !temToken}
          className="h-11 gap-2 border-jade/40 bg-jade/10 text-jade hover:bg-jade/20 hover:text-jade"
        >
          {testando ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              Testando conexão...
            </>
          ) : (
            <>
              <PlugZap aria-hidden="true" />
              Testar agora
            </>
          )}
        </Button>

        {teste.message ? (
          <div
            role="status"
            className={[
              "space-y-3 rounded-lg border px-3 py-3 text-sm",
              teste.ok
                ? "border-jade/40 bg-jade/10 text-jade"
                : "border-destructive/40 bg-destructive/10 text-destructive",
            ].join(" ")}
          >
            <p className="font-medium">
              {teste.ok ? "✓ " : "✕ "}
              {teste.message}
            </p>

            {teste.ok && teste.user ? (
              <p className="text-dim">
                Conectado como <span className="text-white">{teste.user}</span>
                {teste.testedAt ? ` · ${teste.testedAt}` : ""}
              </p>
            ) : null}

            {teste.ok && teste.accounts && teste.accounts.length > 0 ? (
              <div className="rounded-lg border border-line bg-ink/60 p-3">
                <p className="mb-2 text-xs font-semibold tracking-wide text-dim uppercase">
                  {teste.accounts.length} conta
                  {teste.accounts.length > 1 ? "s" : ""} de anúncios
                </p>
                <ul className="space-y-1.5">
                  {teste.accounts.map((conta) => (
                    <li
                      key={conta.id}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="truncate text-white">{conta.name}</span>
                      <span className="shrink-0 text-xs text-dim">
                        {conta.currency ?? ""} · {conta.id.replace("act_", "")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {teste.ok && teste.accounts && teste.accounts.length === 0 ? (
              <p className="text-dim">
                Token válido, mas nenhuma conta de anúncios foi retornada.
                Verifique as permissões (veja as orientações ao lado).
              </p>
            ) : null}
          </div>
        ) : null}
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Card de orientações                                                 */
/* ------------------------------------------------------------------ */

function OrientacoesCard() {
  const passos = [
    {
      titulo: "1. Crie (ou abra) seu app na Meta Developers",
      texto:
        "Acesse developers.facebook.com/apps, clique em “Criar app” e escolha o tipo “Empresa” (Business).",
      link: LINK_PERMISSOES,
      linkLabel: "Abrir Meta Developers",
    },
    {
      titulo: "2. Adicione o produto “Marketing API”",
      texto:
        "Dentro do app, em “Adicionar produto”, clique em adicionar na Marketing API.",
    },
    {
      titulo: "3. Gere o token de acesso",
      texto:
        "Em Marketing API › Ferramentas, selecione as permissões ads_management e ads_read e gere o token.",
      link: LINK_TOKEN,
      linkLabel: "Abrir gerador de tokens",
    },
    {
      titulo: "4. Estenda para 60 dias",
      texto:
        "Tokens curtos expiram em horas. Na mesma tela, estenda o token para longa duração antes de colar aqui.",
    },
    {
      titulo: "5. Cole e teste",
      texto:
        "Volte nesta aba, cole o token, salve e clique em “Testar agora”. As contas de anúncios devem aparecer.",
    },
  ];

  return (
    <aside className="space-y-4 rounded-xl border border-line bg-surface p-6">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-white">
          Como gerar o token na Meta
        </h2>
        <p className="text-sm text-dim">
          Passo a passo resumido. Requer conta na Meta Developers.
        </p>
      </div>

      <ol className="space-y-4">
        {passos.map((passo) => (
          <li key={passo.titulo} className="space-y-1.5">
            <p className="text-sm font-medium text-white">{passo.titulo}</p>
            <p className="text-sm leading-relaxed text-dim">{passo.texto}</p>
            {passo.link ? (
              <a
                href={passo.link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-ember transition-colors hover:text-ember-2"
              >
                {passo.linkLabel}
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            ) : null}
          </li>
        ))}
      </ol>

      <div className="rounded-lg border border-line bg-surface-2/60 p-3 text-xs leading-relaxed text-dim">
        <p className="mb-1 font-semibold text-white">Permissões necessárias</p>
        <p>
          <code className="text-ember">ads_read</code> para ler métricas e{" "}
          <code className="text-ember">ads_management</code> para criar e editar
          campanhas. Ambas precisam estar no token.
        </p>
      </div>

      <a
        href={LINK_DOCUMENTACAO}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-dim transition-colors hover:text-white"
      >
        Documentação oficial da Marketing API
        <ExternalLink className="size-3" aria-hidden="true" />
      </a>
    </aside>
  );
}
