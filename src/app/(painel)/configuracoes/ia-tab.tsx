"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { BadgeCheck, ExternalLink, ListRestart, Loader2, PlugZap, Trash2, BrainCircuit } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { IaSettings } from "@/lib/settings";
import {
  listarModelosIaAction,
  removeIaApiKeyAction,
  saveIaSettingsAction,
  testIaConnectionAction,
  type IaModelsState,
  type IaTestState,
  type SettingsState,
} from "./actions";

const emptySave: SettingsState = {};
const emptyTest: IaTestState = {};
const emptyModels: IaModelsState = {};

export function IaTab({
  config,
  podeEditar,
}: {
  config: IaSettings;
  podeEditar: boolean;
}) {
  const [state, saveAction, saving] = useActionState(saveIaSettingsAction, emptySave);
  const [test, testAction, testing] = useActionState(testIaConnectionAction, emptyTest);
  const [models, modelsAction, loadingModels] = useActionState(listarModelosIaAction, emptyModels);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(config.baseUrl);
  const [modelo, setModelo] = useState(config.model);
  const [removing, startRemoving] = useTransition();

  if (state.ok && apiKey) setApiKey("");

  useEffect(() => {
    if (state.ok) toast.success("Configuração da IA salva.");
  }, [state]);
  useEffect(() => {
    if (test.ok) toast.success("Teste do endpoint concluído.");
  }, [test]);

  if (!podeEditar) {
    return (
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <p className="rounded-xl border border-line bg-surface p-6 text-sm text-dim">
          Somente usuários com permissão de edição em Configurações podem
          alterar o endpoint da IA.
        </p>
      </div>
    );
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        <form action={saveAction} className="space-y-5 rounded-xl border border-line bg-surface p-6">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 text-base font-semibold text-white">
              <BrainCircuit className="size-4 text-ember" aria-hidden="true" />
              Endpoint da IA
            </h2>
            <p className="text-sm text-dim">Configure a URL base e o modelo usado nas análises.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="iaBaseUrl">URL base do endpoint</Label>
            <Input id="iaBaseUrl" name="baseUrl" type="url" required value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.exemplo.com/v1" className="h-11 font-mono text-sm" />
            <p className="text-xs text-dim">O sistema envia requisições para <code className="text-ember">URL/chat/completions</code>.</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="iaModel">Modelo</Label>
              {/* Lista os modelos do endpoint informado (formato OpenAI).
                  formAction no botão: não pode haver form dentro de form. */}
              <Button
                type="submit"
                formAction={modelsAction}
                variant="outline"
                size="sm"
                disabled={loadingModels || !baseUrl}
                className="h-7 gap-1.5 px-2.5 text-xs">
                {loadingModels ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ListRestart aria-hidden="true" />}
                {loadingModels ? "Carregando..." : "Carregar modelos"}
              </Button>
            </div>
            <Input id="iaModel" name="model" required value={modelo}
              onChange={(e) => setModelo(e.target.value)} list="ia-modelos"
              placeholder="Digite ou escolha da lista carregada" className="h-11 font-mono text-sm" />
            <datalist id="ia-modelos">
              {(models.models ?? []).map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            {models.models && models.models.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {models.models.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setModelo(m)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-mono transition-colors ${
                      modelo === m
                        ? "border-ember/60 bg-ember/10 text-ember"
                        : "border-line bg-surface-2/60 text-dim hover:border-ember/40 hover:text-white"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            ) : null}
            {models.message ? (
              <p role="status" className={`text-xs ${models.ok ? "text-jade" : "text-destructive"}`}>
                {models.ok ? "✓ " : "✕ "}
                {models.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="iaApiKey">Chave de API (opcional)</Label>
            <Input id="iaApiKey" name="apiKey" type="password" autoComplete="new-password"
              value={apiKey} onChange={(event) => setApiKey(event.target.value)}
              placeholder={config.hasApiKey ? `Chave salva ${config.apiKeyHint} · deixe vazio para manter` : "sk-..."}
              className="h-11 font-mono text-sm" />
            <p className="text-xs text-dim">Não é exibida novamente. Campo vazio mantém a chave já salva.</p>
          </div>

          {state.error ? <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p> : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" disabled={saving} className="h-11 px-6">
              {saving ? <><Loader2 className="animate-spin" aria-hidden="true" /> Salvando...</> : "Salvar configuração"}
            </Button>
            {config.hasApiKey ? (
              <Button type="button" variant="ghost" size="lg" disabled={removing}
                onClick={() => startRemoving(async () => { await removeIaApiKeyAction(); toast.success("Chave removida."); })}
                className="h-11 gap-2 text-dim hover:text-destructive">
                {removing ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
                Remover chave
              </Button>
            ) : null}
          </div>
        </form>

        <form action={testAction} className="space-y-5 rounded-xl border border-line bg-surface p-6">
          <input type="hidden" name="baseUrl" value={baseUrl} />
          <input type="hidden" name="model" value={modelo} />
          <input type="hidden" name="apiKey" value={apiKey} />
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 text-base font-semibold text-white">
              <PlugZap className="size-4 text-jade" aria-hidden="true" /> Testar conexão
            </h2>
            <p className="text-sm text-dim">Envia uma mensagem curta ao modelo e confirma que o endpoint respondeu.</p>
          </div>
          <Button type="submit" variant="outline" size="lg" disabled={testing || !baseUrl || !modelo}
            className="h-11 gap-2 border-jade/40 bg-jade/10 text-jade hover:bg-jade/20 hover:text-jade">
            {testing ? <><Loader2 className="animate-spin" aria-hidden="true" /> Testando endpoint...</> : <><PlugZap aria-hidden="true" /> Testar endpoint</>}
          </Button>
          {test.message ? (
            <div role="status" className={["space-y-2 rounded-lg border px-3 py-3 text-sm", test.ok ? "border-jade/40 bg-jade/10 text-jade" : "border-destructive/40 bg-destructive/10 text-destructive"].join(" ")}>
              <p className="font-medium">{test.ok ? "✓ " : "✕ "}{test.message}</p>
              {test.reply ? <p className="rounded-md border border-line bg-ink/60 p-3 font-mono text-xs text-white">Resposta: {test.reply}</p> : null}
            </div>
          ) : null}
        </form>
      </div>

      <aside className="space-y-4 rounded-xl border border-line bg-surface p-6">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-white">Compatibilidade do endpoint</h2>
          <p className="text-sm text-dim">O endpoint precisa seguir o formato de chat completions compatível com a API da OpenAI.</p>
        </div>
        <div className="space-y-3 text-sm leading-relaxed text-dim">
          <p><span className="font-medium text-white">URL base:</span> informe a parte antes de <code className="text-ember">/chat/completions</code>, incluindo versão quando aplicável (por exemplo, <code className="text-ember">/v1</code>).</p>
          <p><span className="font-medium text-white">Modelo:</span> use o identificador exato esperado pelo seu provedor.</p>
          <p><span className="font-medium text-white">Chave:</span> necessária para provedores hospedados; opcional para serviços locais sem autenticação.</p>
        </div>
        <div className="rounded-lg border border-line bg-surface-2/60 p-3 text-xs leading-relaxed text-dim">
          <p className="mb-1 font-semibold text-white">Exemplos de URL base</p>
          <ul className="space-y-1 font-mono">
            <li>https://api.openai.com/v1</li>
            <li>https://openrouter.ai/api/v1</li>
            <li>http://localhost:11434/v1</li>
          </ul>
        </div>
        <a href="https://platform.openai.com/docs/api-reference/chat/create" target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-dim transition-colors hover:text-white">
          Referência do formato Chat Completions <ExternalLink className="size-3" aria-hidden="true" />
        </a>
        <div className="inline-flex items-center gap-2 text-xs text-jade">
          <BadgeCheck className="size-3.5" aria-hidden="true" /> A chave fica apenas no banco SQLite local.
        </div>
      </aside>
    </div>
  );
}
