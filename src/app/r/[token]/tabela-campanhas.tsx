"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import type { LinhaArvore } from "@/lib/meta/relatorio";

function inteiro(valor: number | null): string {
  if (valor === null) return "—";
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function decimal(valor: number | null, casas = 2): string {
  if (valor === null) return "—";
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

function dinheiro(valor: number | null): string {
  if (valor === null) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const RECUO: Record<LinhaArvore["nivel"], string> = {
  campanha: "",
  conjunto: "pl-4 sm:pl-6",
  anuncio: "pl-8 sm:pl-12",
};

function BotaoAlternar({
  aberto,
  aoAlternar,
  nome,
}: {
  aberto: boolean;
  aoAlternar: () => void;
  nome: string;
}) {
  return (
    <button
      type="button"
      onClick={aoAlternar}
      className="grid size-5 shrink-0 place-items-center rounded text-dim transition-colors hover:text-ember"
      aria-label={`${aberto ? "Recolher" : "Expandir"} ${nome}`}
      aria-expanded={aberto}
    >
      {aberto ? (
        <ChevronDown className="size-4" aria-hidden="true" />
      ) : (
        <ChevronRight className="size-4" aria-hidden="true" />
      )}
    </button>
  );
}

function LinhaTabela({
  linha,
  nivelAberto,
  aoAlternar,
}: {
  linha: LinhaArvore;
  nivelAberto: (id: string) => boolean;
  aoAlternar: (id: string) => void;
}) {
  const filhos = linha.filhos ?? [];
  const temFilhos = filhos.length > 0;
  const aberto = nivelAberto(linha.id);

  return (
    <>
      <tr className="border-t border-line/70 align-middle">
        <td className={`py-2.5 pr-3 ${RECUO[linha.nivel]}`}>
          <div className="flex items-center gap-1.5">
            {temFilhos ? (
              <BotaoAlternar
                aberto={aberto}
                aoAlternar={() => aoAlternar(linha.id)}
                nome={linha.nome}
              />
            ) : (
              <span className="inline-block size-5 shrink-0" aria-hidden="true" />
            )}
            <span
              className={
                linha.nivel === "campanha"
                  ? "min-w-0 text-sm font-semibold text-white"
                  : "min-w-0 text-sm text-dim"
              }
            >
              {linha.nome}
            </span>
          </div>
        </td>
        <td className="px-2 py-2.5 text-right text-sm whitespace-nowrap text-white">{dinheiro(linha.investido)}</td>
        <td className="px-2 py-2.5 text-right text-sm whitespace-nowrap text-dim">{inteiro(linha.impressoes)}</td>
        <td className="px-2 py-2.5 text-right text-sm whitespace-nowrap text-dim">{inteiro(linha.alcance)}</td>
        <td className="px-2 py-2.5 text-right text-sm whitespace-nowrap text-dim">{decimal(linha.frequencia)}</td>
        <td className="px-2 py-2.5 text-right text-sm whitespace-nowrap text-dim">{inteiro(linha.cliquesLink)}</td>
        <td className="px-2 py-2.5 text-right whitespace-nowrap">
          <span className="block text-sm font-medium text-white">{inteiro(linha.resultadoValor)}</span>
          <span className="block text-[0.65rem] text-dim">{linha.resultadoRotulo}</span>
        </td>
        <td className="px-2 py-2.5 text-right text-sm whitespace-nowrap text-dim">
          {dinheiro(linha.custoPorResultado ?? null)}
        </td>
        <td className="px-2 py-2.5 text-right text-sm whitespace-nowrap text-dim">
          {linha.ctr === null ? "—" : `${decimal(linha.ctr)}%`}
        </td>
        <td className="px-2 py-2.5 pr-1 text-right text-sm whitespace-nowrap text-dim">{dinheiro(linha.cpm)}</td>
      </tr>
      {temFilhos && aberto
        ? filhos.map((filho) => (
            <LinhaTabela key={filho.id} linha={filho} nivelAberto={nivelAberto} aoAlternar={aoAlternar} />
          ))
        : null}
    </>
  );
}

/** Cartão de um item no mobile: sem rolagem lateral, métricas em grade. */
function CartaoLinha({
  linha,
  nivelAberto,
  aoAlternar,
}: {
  linha: LinhaArvore;
  nivelAberto: (id: string) => boolean;
  aoAlternar: (id: string) => void;
}) {
  const filhos = linha.filhos ?? [];
  const temFilhos = filhos.length > 0;
  const aberto = nivelAberto(linha.id);
  const campanha = linha.nivel === "campanha";
  const conjunto = linha.nivel === "conjunto";

  return (
    <li
      className={
        campanha
          ? "rounded-lg border border-line bg-surface-2/40 p-3"
          : conjunto
            ? "ml-3 border-l border-line/70 pl-3"
            : "ml-6 border-l border-line/40 pl-3"
      }
    >
      <div className="flex items-start gap-1.5">
        {temFilhos ? (
          <BotaoAlternar
            aberto={aberto}
            aoAlternar={() => aoAlternar(linha.id)}
            nome={linha.nome}
          />
        ) : (
          <span className="inline-block size-5 shrink-0" aria-hidden="true" />
        )}
        <p
          className={
            campanha
              ? "min-w-0 text-sm font-semibold text-white"
              : "min-w-0 text-sm text-dim"
          }
        >
          {linha.nome}
        </p>
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 pl-6 text-xs sm:grid-cols-3">
        <div className="min-w-0">
          <dt className="text-[0.6rem] tracking-wide text-dim uppercase">Invest.</dt>
          <dd className="font-medium text-white">{dinheiro(linha.investido)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[0.6rem] tracking-wide text-dim uppercase">Resultado</dt>
          <dd className="font-medium text-white">{inteiro(linha.resultadoValor)}</dd>
          <dd className="text-[0.6rem] text-dim">{linha.resultadoRotulo}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[0.6rem] tracking-wide text-dim uppercase">Custo/result.</dt>
          <dd className="font-medium text-white">{dinheiro(linha.custoPorResultado ?? null)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[0.6rem] tracking-wide text-dim uppercase">Alcance</dt>
          <dd className="text-white">{inteiro(linha.alcance)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[0.6rem] tracking-wide text-dim uppercase">Impr.</dt>
          <dd className="text-white">{inteiro(linha.impressoes)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[0.6rem] tracking-wide text-dim uppercase">Freq.</dt>
          <dd className="text-white">{decimal(linha.frequencia)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[0.6rem] tracking-wide text-dim uppercase">Cliques</dt>
          <dd className="text-white">{inteiro(linha.cliquesLink)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[0.6rem] tracking-wide text-dim uppercase">CTR</dt>
          <dd className="text-white">{linha.ctr === null ? "—" : `${decimal(linha.ctr)}%`}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[0.6rem] tracking-wide text-dim uppercase">CPM</dt>
          <dd className="text-white">{dinheiro(linha.cpm)}</dd>
        </div>
      </dl>

      {temFilhos && aberto ? (
        <ul className="mt-2 space-y-2">
          {filhos.map((filho) => (
            <CartaoLinha key={filho.id} linha={filho} nivelAberto={nivelAberto} aoAlternar={aoAlternar} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** Tabela campanha → conjunto → anúncio, com linhas recolhíveis. */
export function TabelaCampanhas({ arvore }: { arvore: LinhaArvore[] }) {
  // Campanha e conjunto começam abertos: o relatório mostra tudo que é ativo.
  const [fechados, setFechados] = useState<Set<string>>(new Set());

  function alternar(id: string) {
    setFechados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  if (!arvore.length) {
    return <p className="text-sm text-dim">Nenhuma campanha com gasto no período.</p>;
  }

  const nivelAberto = (id: string) => !fechados.has(id);

  return (
    <>
      {/* Mobile: cartões; a tabela de 900px exigiria rolagem lateral em toda linha. */}
      <ul className="space-y-3 sm:hidden">
        {arvore.map((campanha) => (
          <CartaoLinha
            key={campanha.id}
            linha={campanha}
            nivelAberto={nivelAberto}
            aoAlternar={alternar}
          />
        ))}
      </ul>

      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <caption className="sr-only">
            Campanhas, conjuntos e anúncios que tiveram gasto no período
          </caption>
          <thead>
            <tr className="border-b border-line text-[0.7rem] tracking-wide text-dim uppercase">
              <th scope="col" className="py-2 pr-3 font-medium">Campanha / conjunto / anúncio</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Invest.</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Impr.</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Alcance</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Freq.</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Cliques</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Resultado</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Custo/result.</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">CTR</th>
              <th scope="col" className="py-2 pr-1 text-right font-medium">CPM</th>
            </tr>
          </thead>
          <tbody>
            {arvore.map((campanha) => (
              <LinhaTabela
                key={campanha.id}
                linha={campanha}
                nivelAberto={nivelAberto}
                aoAlternar={alternar}
              />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}