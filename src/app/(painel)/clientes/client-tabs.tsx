"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { SaveBar } from "@/components/ui/save-bar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnotacoesTab } from "./anotacoes-tab";
import { ContratosTab } from "./contratos-tab";
import { DadosTab } from "./dados-tab";
import { EnderecoTab } from "./endereco-tab";
import { ORDEM_ABAS, type AbaKey, type RegistroAba, type RegistrarAba } from "./tab-registry";
import type { ClientDetail } from "./actions";
import type { Client, ClientAddress } from "@/lib/db/schema";

type Registros = Partial<Record<AbaKey, RegistroAba>>;

/**
 * Tela do cliente em abas com uma ÚNICA barra flutuante de salvar.
 *
 * - As abas ficam montadas (`forceMount`), então alternar entre elas não perde
 *   o que foi digitado.
 * - Cada aba registra seu estado (dados pendentes + ações) aqui.
 * - A barra aparece enquanto qualquer aba tiver alterações; salvar grava todas
 *   as abas pendentes e cancelar descarta voltando aos dados do banco.
 */
export function ClientTabs({
  cliente,
  endereco,
  contratos,
  anotacoes,
  nichos,
  podeEditar,
  podeExcluir,
}: {
  cliente?: Client;
  endereco: ClientAddress | null;
  contratos: ClientDetail["contratos"];
  anotacoes: ClientDetail["anotacoes"];
  nichos: { id: number; name: string }[];
  podeEditar: boolean;
  podeExcluir: boolean;
}) {
  const router = useRouter();
  const [registros, setRegistros] = useState<Registros>({});
  const [salvandoTudo, setSalvandoTudo] = useState(false);

  // Os mesmos objetos de ação da aba são preservados; só o status muda.
  const registrar = useCallback<RegistrarAba>((chave, registro) => {
    setRegistros((atual) => {
      const anterior = atual[chave];
      if (!registro) {
        if (!anterior) return atual;
        const copia = { ...atual };
        delete copia[chave];
        return copia;
      }
      if (
        anterior &&
        anterior.sujo === registro.sujo &&
        anterior.salvando === registro.salvando &&
        anterior.mensagem === registro.mensagem &&
        anterior.labelSalvar === registro.labelSalvar
      ) {
        // Mantém identidade estável e só troca as ações.
        return { ...atual, [chave]: { ...anterior, ...registro } };
      }
      return { ...atual, [chave]: registro };
    });
  }, []);

  const pendentes = useMemo(
    () =>
      ORDEM_ABAS.map((chave) => registros[chave]).filter((r): r is RegistroAba =>
        Boolean(r?.sujo),
      ),
    [registros],
  );

  const visivel = podeEditar && pendentes.length > 0;
  const mensagem =
    pendentes.length > 1
      ? `Você tem alterações não salvas em ${pendentes.length} abas.`
      : (pendentes[0]?.mensagem ?? "");

  function salvarTudo() {
    if (pendentes.length === 0) return;
    setSalvandoTudo(true);
    pendentes.forEach((registro) => registro.salvar());
    // As abas limpam o próprio estado ao terminar; liberamos o botão em seguida.
    window.setTimeout(() => setSalvandoTudo(false), 900);
  }

  function cancelarTudo() {
    pendentes.forEach((registro) => registro.cancelar());
    setSalvandoTudo(false);
    router.refresh();
  }

  const barraSalvar = (
    <SaveBar
      visible={visivel}
      pending={salvandoTudo}
      mensagem={mensagem || "Você tem alterações não salvas."}
      labelSalvar={
        pendentes.length === 1
          ? (pendentes[0]?.labelSalvar ?? "Salvar")
          : "Salvar tudo"
      }
      onCancel={cancelarTudo}
      onSave={salvarTudo}
    />
  );

  // Sem cliente salvo (/clientes/novo): só a aba Dados + a barra flutuante.
  // Endereço, Contratos e Anotações aparecem depois da primeira gravação.
  if (!cliente) {
    return (
      <>
        <DadosTab nichos={nichos} podeEditar={podeEditar} registrar={registrar} />
        {barraSalvar}
      </>
    );
  }

  return (
    <>
      <Tabs defaultValue="dados" className="gap-6">
        <TabsList className="h-11 w-full justify-start gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1 sm:w-auto">
          <TabsTrigger value="dados" className="shrink-0">
            Dados
          </TabsTrigger>
          <TabsTrigger value="endereco" className="shrink-0">
            Endereço
          </TabsTrigger>
          <TabsTrigger value="contratos" className="shrink-0">
            Contratos
            {contratos.length > 0 ? (
              <span className="ml-1.5 rounded-full bg-surface-2 px-1.5 text-[0.65rem] text-dim">
                {contratos.length}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="anotacoes" className="shrink-0">
            Anotações
            {anotacoes.length > 0 ? (
              <span className="ml-1.5 rounded-full bg-surface-2 px-1.5 text-[0.65rem] text-dim">
                {anotacoes.length}
              </span>
            ) : null}
          </TabsTrigger>
        </TabsList>

        {/* forceMount: alternar de aba não desmonta os formulários */}
        <TabsContent
          value="dados"
          forceMount
          className="outline-none data-[state=inactive]:hidden"
        >
          <DadosTab cliente={cliente} nichos={nichos} podeEditar={podeEditar} registrar={registrar} />
        </TabsContent>

        <TabsContent
          value="endereco"
          forceMount
          className="outline-none data-[state=inactive]:hidden"
        >
          <EnderecoTab
            clientId={cliente.id}
            endereco={endereco}
            podeEditar={podeEditar}
            registrar={registrar}
          />
        </TabsContent>

        <TabsContent
          value="contratos"
          forceMount
          className="outline-none data-[state=inactive]:hidden"
        >
          <ContratosTab
            clientId={cliente.id}
            contratos={contratos}
            podeEditar={podeEditar}
            podeExcluir={podeExcluir}
            registrar={registrar}
          />
        </TabsContent>

        <TabsContent
          value="anotacoes"
          forceMount
          className="outline-none data-[state=inactive]:hidden"
        >
          <AnotacoesTab
            clientId={cliente.id}
            anotacoes={anotacoes}
            podeEditar={podeEditar}
            podeExcluir={podeExcluir}
          />
        </TabsContent>
      </Tabs>

      {barraSalvar}
    </>
  );
}
