import Link from "next/link";

export type MenuItem = {
  href: string;
  label: string;
};

/**
 * Menu horizontal do painel.
 *
 * Nesta fase ainda não há módulos, então o componente não renderiza nada —
 * a faixa aparece sozinha quando `items` receber os módulos (clientes,
 * campanhas, relatórios, financeiro).
 */
export function MenuSlot({
  items = [],
  activeHref,
}: {
  items?: MenuItem[];
  activeHref?: string;
}) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Menu principal"
      className="sticky top-16 z-30 border-b border-line/80 bg-ink/90 backdrop-blur-md"
    >
      <div className="container-app">
        <ul className="scrollbar-none flex items-center gap-1 overflow-x-auto py-2">
          {items.map((item) => {
            const active = item.href === activeHref;
            return (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-ember/15 text-ember"
                      : "text-dim hover:bg-surface-2 hover:text-white",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
