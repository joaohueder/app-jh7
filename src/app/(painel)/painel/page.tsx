import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  BarChart3,
  Megaphone,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";

import { requireUser } from "@/lib/auth/require-user";
import { hojeIso } from "@/lib/format/masks";
import { dadosDoPainel } from "./dados";
import { Dashboard } from "./dashboard";

export const metadata: Metadata = { title: "Painel" };

const MODULOS = [
  {
    nome: "Clientes",
    descricao: "Cadastro completo, contatos, contratos e histórico.",
    href: "/clientes",
    icon: Users,
    cor: "text-ember",
    fundo: "from-ember/15",
  },
  {
    nome: "Campanhas",
    descricao: "Meta Ads conectado: campanhas, conjuntos e anúncios.",
    href: "/campanhas",
    icon: Megaphone,
    cor: "text-ember",
    fundo: "from-ember/15",
  },
  {
    nome: "Relatórios",
    descricao: "Relatórios por cliente com link público e análise de IA.",
    href: "/relatorios",
    icon: BarChart3,
    cor: "text-jade",
    fundo: "from-jade/15",
  },
  {
    nome: "Financeiro",
    descricao: "Receitas, despesas, vencimentos e inadimplência.",
    href: "/financeiro",
    icon: Wallet,
    cor: "text-jade",
    fundo: "from-jade/15",
  },
] as const;

function saudacao(): string {
  const hora = new Date().getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

export default async function PainelPage() {
  const user = await requireUser();
  const dados = await dadosDoPainel(hojeIso());

  const hoje = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
    .format(new Date())
    .replace(/^./, (letra) => letra.toUpperCase());

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <section className="relative overflow-hidden rounded-2xl border border-line bg-surface p-6 sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-ember/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-28 left-1/3 size-64 rounded-full bg-jade/10 blur-3xl"
        />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-2/70 px-3 py-1 text-xs font-medium tracking-wide text-dim uppercase">
              <span className="size-1.5 rounded-full bg-jade" />
              Painel
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {saudacao()}, {primeiroNome(user.name)}.
            </h1>
            <p className="text-sm text-dim">{hoje}</p>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/60 px-4 py-3 text-sm">
            <Sparkles className="size-4 shrink-0 text-ember" aria-hidden="true" />
            <span className="text-dim">
              <strong className="font-semibold text-white">{dados.clientesAtivos}</strong>{" "}
              clientes ativos ·{" "}
              <strong className="font-semibold text-white">{dados.contratosAtivos}</strong>{" "}
              contratos
            </span>
          </div>
        </div>
      </section>

      <Dashboard
        dados={dados}
        podeGerarCobranca={
          user.role === "admin" ||
          (user.permissions?.financeiro?.includes("create") ?? false)
        }
      />

      {/* Módulos */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-white">Módulos</h2>
            <p className="text-sm text-dim">
              Atalhos para cada área do sistema.
            </p>
          </div>
          <span className="shrink-0 text-xs font-medium tracking-wide text-dim/70 uppercase">
            4 módulos
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {MODULOS.map(({ nome, descricao, href, icon: Icon, cor, fundo }) => (
            <Link
              key={nome}
              href={href}
              className="group relative flex flex-col gap-4 overflow-hidden rounded-xl border border-line bg-surface p-5 transition-colors hover:border-ember/50 hover:bg-surface-2/40"
            >
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute inset-x-0 -top-16 h-32 bg-gradient-to-b ${fundo} to-transparent opacity-60`}
              />
              <div className="relative flex items-start justify-between">
                <span className="grid size-10 place-items-center rounded-lg border border-line bg-surface-2">
                  <Icon className={`size-5 ${cor}`} aria-hidden="true" />
                </span>
                <ArrowUpRight
                  className="size-4 text-dim/50 transition-colors group-hover:text-ember"
                  aria-hidden="true"
                />
              </div>

              <div className="relative space-y-1.5">
                <h3 className="text-sm font-semibold text-white">{nome}</h3>
                <p className="text-sm leading-relaxed text-dim">{descricao}</p>
              </div>

              <span className="relative mt-auto inline-flex items-center gap-1 text-xs font-medium text-ember">
                Abrir módulo
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
