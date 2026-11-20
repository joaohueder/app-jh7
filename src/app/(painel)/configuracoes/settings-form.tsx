"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { ImageUp, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  removeLogoAction,
  saveSettingsAction,
  type SettingsState,
} from "./actions";
import { MetaAdsTab } from "./meta-ads-tab";
import { IaTab } from "./ia-tab";
import { NichosTab, type NichoItem } from "./nichos-tab";
import type { IaSettings, MetaSettings } from "@/lib/settings";

const initialState: SettingsState = {};

export function SettingsForm({
  systemName,
  logoPath,
  hasUploadedLogo,
  podeEditar,
  meta,
  ia,
  nichos,
  semNicho,
  abaInicial = "sistema",
}: {
  systemName: string;
  logoPath: string;
  hasUploadedLogo: boolean;
  podeEditar: boolean;
  meta: MetaSettings;
  ia: IaSettings;
  nichos: NichoItem[];
  semNicho: number;
  /** Permite abrir direto numa aba (ex.: vindo do módulo Campanhas). */
  abaInicial?: string;
}) {
  const [state, formAction, pending] = useActionState(
    saveSettingsAction,
    initialState,
  );
  const [preview, setPreview] = useState<string | null>(null);
  const [removendo, startRemover] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const logoAtual = preview ?? logoPath;

  useEffect(() => {
    if (state.ok) toast.success("Configurações salvas.");
  }, [state]);

  return (
    <Tabs defaultValue={abaInicial} className="gap-6">
      <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-xl border border-line bg-surface p-1 sm:h-11 sm:w-auto sm:flex-nowrap">
        <TabsTrigger
          value="sistema"
          className="h-8 shrink-0 flex-1 rounded-lg px-3 data-active:bg-surface-2 data-active:text-white sm:h-full sm:flex-none sm:min-w-28 sm:px-4"
        >
          Sistema
        </TabsTrigger>
        <TabsTrigger
          value="meta-ads"
          className="h-8 shrink-0 flex-1 rounded-lg px-3 data-active:bg-surface-2 data-active:text-white sm:h-full sm:flex-none sm:min-w-28 sm:px-4"
        >
          Meta Ads
        </TabsTrigger>
        <TabsTrigger
          value="ia"
          className="h-8 shrink-0 flex-1 rounded-lg px-3 data-active:bg-surface-2 data-active:text-white sm:h-full sm:flex-none sm:min-w-28 sm:px-4"
        >
          IA
        </TabsTrigger>
        <TabsTrigger
          value="nichos"
          className="h-8 shrink-0 flex-1 rounded-lg px-3 data-active:bg-surface-2 data-active:text-white sm:h-full sm:flex-none sm:min-w-28 sm:px-4"
        >
          Nichos
        </TabsTrigger>
      </TabsList>

      {/* ------------------------------------------------------------ */}
      {/* Aba: Sistema                                                   */}
      {/* ------------------------------------------------------------ */}
      <TabsContent value="sistema" className="outline-none">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <form
            action={formAction}
            className="space-y-6 rounded-xl border border-line bg-surface p-6"
            hidden={!podeEditar}
          >
            <div className="space-y-2">
              <Label htmlFor="systemName">Nome do sistema</Label>
              <Input
                id="systemName"
                name="systemName"
                defaultValue={systemName}
                maxLength={60}
                required
                className="h-11"
              />
              <p className="text-xs text-dim">
                Aparece no header, no login e no rodapé.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="logo">Logotipo</Label>
              <Input
                ref={inputRef}
                id="logo"
                name="logo"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="h-11 cursor-pointer file:mr-3 file:h-7 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:text-xs file:font-medium file:text-white"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  setPreview(file ? URL.createObjectURL(file) : null);
                }}
              />
              <p className="text-xs text-dim">
                PNG, JPG, WEBP ou SVG · até 2 MB. De preferência com fundo
                transparente e pelo menos 400px de largura.
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
                  "Salvar alterações"
                )}
              </Button>

              {hasUploadedLogo ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  disabled={removendo}
                  onClick={() =>
                    startRemover(async () => {
                      await removeLogoAction();
                      setPreview(null);
                      if (inputRef.current) inputRef.current.value = "";
                      toast.success("Logotipo removido.");
                    })
                  }
                  className="h-11 gap-2 text-dim hover:text-destructive"
                >
                  {removendo ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Trash2 aria-hidden="true" />
                  )}
                  Remover logotipo
                </Button>
              ) : null}
            </div>
          </form>

          <aside className="space-y-3">
            <h2 className="text-sm font-semibold text-white">Pré-visualização</h2>
            <div className="grid place-items-center rounded-xl border border-dashed border-line bg-ink p-8">
              {logoAtual ? (
                <Logo src={logoAtual} className="max-h-24 w-auto" />
              ) : null}
            </div>
            <p className="flex items-center gap-2 text-xs text-dim">
              <ImageUp className="size-3.5 shrink-0" aria-hidden="true" />
              {preview
                ? "Prévia do arquivo selecionado. Salve para aplicar."
                : hasUploadedLogo
                  ? "Logotipo atual enviado por você."
                  : "Usando o logotipo padrão da marca."}
            </p>
          </aside>
        </div>
      </TabsContent>

      {/* ------------------------------------------------------------ */}
      {/* Aba: Meta Ads                                                  */}
      {/* ------------------------------------------------------------ */}
      <TabsContent value="meta-ads" className="outline-none">
        <MetaAdsTab meta={meta} podeEditar={podeEditar} />
      </TabsContent>

      <TabsContent value="ia" className="outline-none">
        <IaTab config={ia} podeEditar={podeEditar} />
      </TabsContent>

      <TabsContent value="nichos" className="outline-none">
        <NichosTab nichos={nichos} semNicho={semNicho} podeEditar={podeEditar} />
      </TabsContent>
    </Tabs>
  );
}
