"use client";

import { useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { Building2, ChevronRight, CircleAlert, Search, Tags } from "lucide-react";

import { Input } from "@/components/ui/input";
import { maskPhone, onlyDigits } from "@/lib/format/masks";

/** Forma mínima aceita pela lista: vale tanto para `listClients` quanto para
 *  `listClientsWithContracts`. */
export type ClienteLista = {
  id: number;
  businessName: string;
  legalName: string | null;
  document: string | null;
  contactPerson: string | null;
  whatsapp: string | null;
  active: boolean;
  nicheId: number | null;
  contracts: {
    id: number;
    status: string;
    accounts: { id: number; name: string; currency: string | null }[];
  }[];
  /** Lista plana (só `listClients` devolve). Sem ela, usa as contas dos contratos. */
  accounts?: { id: number; name: string; currency: string | null }[];
};

/** Exibe o telefone salvo (só dígitos) já formatado. */
function formatPhone(value: string | null | undefined): string {
  const digits = onlyDigits(value);
  if (!digits) return "";
  return maskPhone(digits);
}

/** Filtro de nicho: "todos", "sem" ou o id do nicho como texto. */
type FiltroNicho = string;

/** Aviso interno quando o nicho escolhido muda (mesma aba). */
const EVENTO_NICHO = "jh7:nicho";

/**
 * Nicho escolhido, lembrado enquanto a aba estiver aberta.
 *
 * `sessionStorage` e não `localStorage`: a escolha vale para a sessão de
 * trabalho, não para sempre. `useSyncExternalStore` (em vez de `useState` +
 * `useEffect`) porque ler o armazenamento no corpo do render daria divergência
 * na hidratação — aqui o servidor sempre entrega "todos" e o valor guardado
 * entra logo depois.
 */
function useNichoPersistido(chave: string | undefined): [FiltroNicho, (valor: FiltroNicho) => void] {
  // Telas sem `chave` (Clientes, Relatórios) seguem com o filtro de sempre,
  // que volta a "todos" ao navegar.
  const [local, setLocal] = useState<FiltroNicho>("todos");

  const subscribe = useCallback(
    (avisar: () => void) => {
      if (!chave) return () => {};
      window.addEventListener(EVENTO_NICHO, avisar);
      window.addEventListener("storage", avisar);
      return () => {
        window.removeEventListener(EVENTO_NICHO, avisar);
        window.removeEventListener("storage", avisar);
      };
    },
    [chave],
  );

  const guardado = useSyncExternalStore(
    subscribe,
    () => (chave ? (sessionStorage.getItem(chave) ?? "todos") : "todos"),
    () => "todos",
  );

  const escolher = useCallback(
    (valor: FiltroNicho) => {
      setLocal(valor);
      if (!chave) return;
      sessionStorage.setItem(chave, valor);
      window.dispatchEvent(new Event(EVENTO_NICHO));
    },
    [chave],
  );

  return [chave ? guardado : local, escolher];
}

/**
 * Lista de clientes em card único, agrupada por nicho, com busca e filtro de
 * nicho. Usada pelo módulo Clientes e pela entrada dos Relatórios para que as
 * duas telas mostrem a mesma lista — muda só a ação à direita de cada linha.
 */
export function ListaClientes({
  clientes,
  nichos,
  renderAcoes,
  hrefBase,
  hrefLabel = "Abrir",
  hrefSufixo = "",
  detalhe,
  acaoTopo,
  vazio,
  iconeVazio,
  acaoVazio,
  lembrarNicho,
  bloqueados,
  bloqueioLabel,
}: {
  clientes: ClienteLista[];
  /** Nichos na ordem de exibição; o nome vem daqui, não do cliente. */
  nichos: { id: number; name: string }[];
  /** Conteúdo à direita da linha (botões, link...). Só a partir de componente
   *  cliente — função não atravessa a fronteira server → cliente. */
  renderAcoes?: (cliente: ClienteLista) => ReactNode;
  /** Alternativa serializável: monta `/hrefBase/<id><hrefSufixo>` em cada linha. */
  hrefBase?: string;
  hrefLabel?: string;
  hrefSufixo?: string;
  /** Bloco extra por cliente (métricas etc.). Elementos prontos, não funções:
   *  assim um Server Component pode montar o conteúdo. */
  detalhe?: Record<number, ReactNode>;
  /** Botão no canto superior direito dos filtros. */
  acaoTopo?: ReactNode;
  vazio?: ReactNode;
  iconeVazio?: ReactNode;
  acaoVazio?: ReactNode;
  /**
   * Chave para lembrar o nicho escolhido, por módulo, enquanto a aba estiver
   * aberta (`sessionStorage`). Sem ela o filtro volta a "Todos os nichos" a
   * cada navegação.
   */
  lembrarNicho?: string;
  /**
   * Clientes sem mensalidade gerada no mês: mostram o aviso e perdem o acesso
   * ao link da linha (campanhas/relatórios). O cadastro continua acessível.
   */
  bloqueados?: number[];
  bloqueioLabel?: string;
}) {
  const [busca, setBusca] = useState("");
  const [nichoGuardado, setNicho] = useNichoPersistido(lembrarNicho);

  const totalSemNicho = clientes.filter((c) => c.nicheId === null).length;

  // O nicho guardado pode não existir mais (nicho excluído) ou "Sem nicho"
  // deixar de valer. Sem esta checagem o <select> ficaria em branco.
  const nicho =
    nichoGuardado === "todos" ||
    (nichoGuardado === "sem" && totalSemNicho > 0) ||
    nichos.some((item) => String(item.id) === nichoGuardado)
      ? nichoGuardado
      : "todos";

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return clientes.filter((c) => {
      if (nicho === "sem" && c.nicheId !== null) return false;
      if (nicho !== "todos" && nicho !== "sem" && String(c.nicheId) !== nicho) {
        return false;
      }
      if (!termo) return true;
      return `${c.businessName} ${c.legalName ?? ""} ${c.document ?? ""} ${c.contactPerson ?? ""}`
        .toLowerCase()
        .includes(termo);
    });
  }, [clientes, busca, nicho]);

  /**
   * Clientes agrupados por nicho. Grupos vazios não aparecem; quem está sem
   * nicho cai no grupo final "Sem nicho", que só existe quando há alguém nele.
   */
  const grupos = useMemo(() => {
    const porNicho = new Map<number, ClienteLista[]>();
    const semNicho: ClienteLista[] = [];
    for (const cliente of filtrados) {
      if (cliente.nicheId === null) {
        semNicho.push(cliente);
      } else {
        const lista = porNicho.get(cliente.nicheId) ?? [];
        lista.push(cliente);
        porNicho.set(cliente.nicheId, lista);
      }
    }

    const ordenados = nichos
      .map((item) => ({
        chave: `n${item.id}`,
        nome: item.name,
        clientes: porNicho.get(item.id) ?? [],
      }))
      .filter((grupo) => grupo.clientes.length > 0);

    if (semNicho.length) {
      ordenados.push({ chave: "sem-nicho", nome: "Sem nicho", clientes: semNicho });
    }
    return ordenados;
  }, [filtrados, nichos]);

  const filtrando = Boolean(busca) || nicho !== "todos";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-dim"
            />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, documento ou responsável..."
              className="h-10 pl-9"
              aria-label="Buscar clientes"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-dim">
            <Tags className="size-4 shrink-0" aria-hidden="true" />
            <select
              value={nicho}
              onChange={(e) => setNicho(e.target.value)}
              aria-label="Filtrar por nicho"
              className="h-10 w-full rounded-lg border border-input bg-input/30 px-2.5 text-sm text-white outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-48"
            >
              <option value="todos">Todos os nichos</option>
              {nichos.map((item) => (
                <option key={item.id} value={String(item.id)}>
                  {item.name}
                </option>
              ))}
              {totalSemNicho > 0 ? <option value="sem">Sem nicho</option> : null}
            </select>
          </label>
        </div>

        {acaoTopo}
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {filtrados.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            {iconeVazio ?? <Building2 className="size-8 text-dim/50" aria-hidden="true" />}
            <p className="text-sm text-dim">
              {filtrando
                ? "Nenhum cliente encontrado para este filtro."
                : (vazio ?? "Nenhum cliente cadastrado ainda.")}
            </p>
            {!filtrando ? acaoVazio : null}
          </div>
        ) : (
          <div className="divide-y divide-line/70">
            {grupos.map((grupo) => (
              <section key={grupo.chave}>
                <header className="flex items-center justify-between gap-3 bg-surface-2/40 px-4 py-2.5 sm:px-6">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Tags className="size-3.5 shrink-0 text-ember" aria-hidden="true" />
                    {grupo.nome}
                  </h2>
                  <span className="shrink-0 rounded-full border border-line bg-surface px-2 py-0.5 text-[0.65rem] text-dim">
                    {grupo.clientes.length}
                  </span>
                </header>
                <ul className="divide-y divide-line/50">
                  {grupo.clientes.map((cliente) => (
                    <ClienteLinha
                      key={cliente.id}
                      cliente={cliente}
                      acoes={renderAcoes?.(cliente)}
                      href={
                        hrefBase
                          ? `${hrefBase}/${cliente.id}${hrefSufixo}`
                          : undefined
                      }
                      hrefLabel={hrefLabel}
                      detalhe={detalhe?.[cliente.id]}
                      bloqueado={bloqueados?.includes(cliente.id)}
                      bloqueioLabel={bloqueioLabel}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ClienteLinha({
  cliente,
  acoes,
  href,
  hrefLabel = "Abrir",
  detalhe,
  bloqueado = false,
  bloqueioLabel,
}: {
  cliente: ClienteLista;
  acoes?: ReactNode;
  href?: string;
  hrefLabel?: string;
  detalhe?: ReactNode;
  bloqueado?: boolean;
  bloqueioLabel?: string;
}) {
  const contas = cliente.accounts ?? cliente.contracts.flatMap((c) => c.accounts);
  const ativos = cliente.contracts.filter((c) => c.status === "active").length;

  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-white">
            {cliente.businessName}
          </p>
          {cliente.active ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-jade/40 bg-jade/10 px-2 py-0.5 text-[0.65rem] font-medium text-jade">
              Ativo
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[0.65rem] font-medium text-destructive">
              Inativo
            </span>
          )}
          {bloqueado ? (
            <span className="saldo-alerta inline-flex items-center gap-1 rounded-full border border-destructive/50 bg-destructive/15 px-2 py-0.5 text-[0.65rem] font-semibold text-destructive">
              <CircleAlert className="size-3" aria-hidden="true" />
              {bloqueioLabel ?? "Sem parcela no mês"}
            </span>
          ) : null}
        </div>

        {acoes || href ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {bloqueado ? (
              <span className="text-xs text-dim">Bloqueado até gerar a parcela</span>
            ) : href ? (
              <Link
                href={href}
                className="inline-flex items-center gap-1 text-sm font-medium text-ember hover:underline"
              >
                {hrefLabel}
                <ChevronRight className="size-3.5" aria-hidden="true" />
              </Link>
            ) : null}
            {acoes}
          </div>
        ) : null}
      </div>

      <div className="min-w-0 space-y-1">
        <p className="truncate text-sm text-dim">
          {[cliente.contactPerson, cliente.document, formatPhone(cliente.whatsapp)]
            .filter(Boolean)
            .join(" · ") || "Sem detalhes informados"}
        </p>
        <p className="text-xs text-dim/80">
          {cliente.contracts.length === 0
            ? "Nenhum contrato cadastrado"
            : `${cliente.contracts.length} ${cliente.contracts.length === 1 ? "contrato" : "contratos"} · ${ativos} ativo${ativos === 1 ? "" : "s"}`}
        </p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {contas.length > 0 ? (
            contas.map((conta) => (
              <span
                key={conta.id}
                className="inline-flex max-w-full items-center gap-1 rounded-md border border-line bg-surface-2 px-2 py-1 text-xs text-dim"
              >
                <span className="truncate">{conta.name}</span>
                <span className="text-ember">{conta.currency}</span>
              </span>
            ))
          ) : (
            <span className="text-xs text-dim/70">
              Nenhuma conta de anúncio vinculada
            </span>
          )}
        </div>
        {detalhe ? <div className="mt-2">{detalhe}</div> : null}
      </div>
    </li>
  );
}