import Link from "next/link";
import { LogOut, Settings } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/lib/auth/actions";
import { userHasPermission } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/session";
import { ROLE_LABELS, type UserRole } from "@/lib/db/schema";

function iniciais(nome: string): string {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");
}

export function Header({
  user,
  logoPath,
  systemName,
}: {
  user: SessionUser;
  logoPath: string;
  systemName: string;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-surface/85 backdrop-blur-md">
      <div className="container-app flex h-16 items-center justify-between gap-3">
        <Link
          href="/painel"
          className="flex min-w-0 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <Logo
            src={logoPath}
            className="h-9 w-auto shrink-0 drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)] sm:h-10"
          />
          <span className="hidden truncate text-sm font-medium text-dim sm:block">
            {systemName}
          </span>
        </Link>

        <div className="flex items-center gap-1.5 sm:gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-xs font-semibold text-ember">
              {iniciais(user.name)}
            </span>
            <div className="hidden leading-tight sm:block">
              <p className="max-w-[16rem] truncate text-sm font-medium text-white">
                {user.name}
              </p>
              <p className="text-xs text-dim">
                {ROLE_LABELS[user.role as UserRole] ?? user.role}
              </p>
            </div>
          </div>

          {userHasPermission(
            { role: user.role, permissions: user.permissions ?? {} },
            "configuracoes",
            "view",
          ) ? (
            <Button
              asChild
              variant="ghost"
              size="icon"
              title="Configurações"
              className="text-dim hover:text-white"
            >
              <Link href="/configuracoes" aria-label="Configurações">
                <Settings />
              </Link>
            </Button>
          ) : null}

          <form action={logoutAction}>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="gap-1.5"
              title="Sair do sistema"
            >
              <LogOut />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
