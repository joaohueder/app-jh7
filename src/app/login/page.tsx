import type { Metadata } from "next";

import { Logo } from "@/components/brand/logo";
import { sortearFrase } from "@/lib/frases";
import { getSettings } from "@/lib/settings";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };
export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [{ next }, { systemName, logoPath }] = await Promise.all([
    searchParams,
    getSettings(),
  ]);
  const frase = sortearFrase();
  const ano = new Date().getFullYear();

  return (
    <div className="mx-auto grid min-h-dvh w-full max-w-[1200px] grid-cols-1 lg:grid-cols-2 lg:border-x lg:border-line/60">
      {/* Coluna esquerda — frase motivacional */}
      <aside className="relative flex flex-col justify-between overflow-hidden border-b border-line/60 bg-surface px-6 py-10 sm:px-10 sm:py-12 lg:border-r lg:border-b-0 lg:px-14 lg:py-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 -left-24 size-[26rem] rounded-full bg-ember/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-32 -bottom-40 size-[30rem] rounded-full bg-jade/10 blur-3xl"
        />

        <div className="relative flex items-center gap-3">
          <Logo
            src={logoPath}
            priority
            className="h-10 w-auto drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] sm:h-12"
          />
          <span className="sr-only">{systemName}</span>
        </div>

        <div className="relative mt-10 max-w-md lg:mt-0">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface-2/70 px-3 py-1 text-xs font-medium tracking-wide text-dim uppercase">
            <span className="size-1.5 rounded-full bg-jade" />
            Sistema interno
          </span>
          <blockquote className="text-2xl leading-snug font-medium text-balance text-white sm:text-3xl lg:text-[2rem]">
            <span className="text-ember">“</span>
            {frase}
            <span className="text-ember">”</span>
          </blockquote>
          <div className="mt-6 h-px w-16 bg-linear-to-r from-ember to-transparent" />
        </div>

        <div className="relative mt-10 flex items-center gap-3 text-xs text-dim lg:mt-0">
          <span className="h-px w-6 bg-ember" />
          <span>
            {systemName} · marketing para negócio local · {ano}
          </span>
        </div>
      </aside>

      {/* Coluna direita — formulário */}
      <main className="flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-14">
        <div className="mx-auto w-full max-w-sm">
          <header className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Acesse sua conta
            </h1>
            <p className="mt-2 text-sm text-dim">
              Entre com o e-mail e a senha cadastrados.
            </p>
          </header>

          <LoginForm next={next} />

          <p className="mt-10 text-center text-xs text-dim/70">
            Acesso restrito à equipe {systemName}.
          </p>
        </div>
      </main>
    </div>
  );
}
