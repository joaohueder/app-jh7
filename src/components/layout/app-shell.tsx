import type { ReactNode } from "react";

import type { SessionUser } from "@/lib/auth/session";
import { Footer } from "./footer";
import { Header } from "./header";
import { MenuSlot, type MenuItem } from "./menu-slot";
import { NavigationLoading } from "./navigation-loading";

/**
 * Estrutura fixa do painel:
 * header fixo · menu horizontal fixo (oculto nesta fase) · main · rodapé fixo.
 * O conteúdo do main ocupa 100% da largura útil até 1200px.
 */
export function AppShell({
  user,
  logoPath,
  systemName,
  menuItems = [],
  activeHref,
  children,
}: {
  user: SessionUser;
  logoPath: string;
  systemName: string;
  menuItems?: MenuItem[];
  activeHref?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-ink">
      <Header user={user} logoPath={logoPath} systemName={systemName} />
      <MenuSlot items={menuItems} activeHref={activeHref} />
      <main className="flex-1">
        <div className="container-app py-6 sm:py-8">{children}</div>
      </main>
      <Footer systemName={systemName} />
      <NavigationLoading />
    </div>
  );
}
