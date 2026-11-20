import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requirePermission, userHasPermission } from "@/lib/auth/permissions";
import { getIaSettings, getMetaSettings, getSettings } from "@/lib/settings";
import { listNiches } from "./nichos-actions";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Configurações" };

export default async function ConfiguracoesPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>;
}) {
  const { aba } = await searchParams;
  const usuario = await requirePermission("configuracoes", "view");
  const podeEditar = userHasPermission(usuario, "configuracoes", "edit");
  const { systemName, logoPath, hasUploadedLogo } = await getSettings();
  const meta = await getMetaSettings();
  const ia = await getIaSettings();
  const { nichos, semNicho } = await listNiches();

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href="/painel"
          className="inline-flex items-center gap-1.5 text-sm text-dim transition-colors hover:text-white"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar ao painel
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Configurações
          </h1>
          <p className="mt-1 text-sm text-dim">
            Sistema, integrações e identidade visual. A IA dos relatórios entra
            aqui nas próximas fases.
          </p>
        </div>
      </div>

      <SettingsForm
        systemName={systemName}
        logoPath={logoPath}
        hasUploadedLogo={hasUploadedLogo}
        podeEditar={podeEditar}
        meta={meta}
        ia={ia}
        nichos={nichos}
        semNicho={semNicho}
        abaInicial={
          aba === "meta-ads" || aba === "ia" || aba === "nichos" ? aba : "sistema"
        }
      />
    </div>
  );
}
