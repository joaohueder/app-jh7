import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import type { MenuItem } from "@/components/layout/menu-slot";
import { requireUser } from "@/lib/auth/require-user";
import { userHasPermission } from "@/lib/auth/permissions";
import { MODULE_LABELS, type PermissionModule } from "@/lib/db/schema";
import { getSettings } from "@/lib/settings";

const MODULOS_MENU: { href: string; modulo: PermissionModule }[] = [
  { href: "/clientes", modulo: "clientes" },
  { href: "/campanhas", modulo: "campanhas" },
  { href: "/relatorios", modulo: "relatorios" },
  { href: "/financeiro", modulo: "financeiro" },
  { href: "/usuarios", modulo: "usuarios" },
  { href: "/configuracoes", modulo: "configuracoes" },
];

export default async function PainelLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();
  const { systemName, logoPath } = await getSettings();

  const menuItems: MenuItem[] = [
    // Dashboard abre para todo usuário logado: não é módulo com ACL própria.
    { href: "/painel", label: "Dashboard" },
    ...MODULOS_MENU.filter(({ modulo }) =>
      userHasPermission(user, modulo, "view"),
    ).map(({ href, modulo }) => ({ href, label: MODULE_LABELS[modulo] })),
  ];

  return (
    <AppShell
      user={user}
      logoPath={logoPath}
      systemName={systemName}
      menuItems={menuItems}
    >
      {children}
    </AppShell>
  );
}
