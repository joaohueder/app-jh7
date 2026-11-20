export function Footer({ systemName }: { systemName: string }) {
  const ano = new Date().getFullYear();

  return (
    <footer className="sticky bottom-0 z-20 border-t border-line/80 bg-surface/85 backdrop-blur-md">
      <div className="container-app flex h-12 items-center justify-between gap-3 text-xs text-dim">
        <p className="truncate">
          {systemName} © {ano}
        </p>
        <p className="flex shrink-0 items-center gap-2">
          <span className="size-1.5 rounded-full bg-jade" aria-hidden="true" />
          v0.1 · base
        </p>
      </div>
    </footer>
  );
}
