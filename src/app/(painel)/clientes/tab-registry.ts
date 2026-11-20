"use client";

/** Chaves das abas do cadastro de cliente, na ordem exibida. */
export const ORDEM_ABAS = ["dados", "endereco", "contratos", "anotacoes"] as const;
export type AbaKey = (typeof ORDEM_ABAS)[number];

/** O que uma aba informa para a barra flutuante única da tela. */
export type RegistroAba = {
  /** Existem dados digitados ainda não gravados. */
  sujo: boolean;
  /** Gravação em andamento. */
  salvando: boolean;
  /** Texto exibido na barra. */
  mensagem: string;
  /** Rótulo do botão salvar quando só esta aba está pendente. */
  labelSalvar: string;
  /** Grava os dados desta aba. */
  salvar: () => void;
  /** Descarta o que foi digitado e volta ao estado do banco. */
  cancelar: () => void;
};

export type RegistrarAba = (chave: AbaKey, registro: RegistroAba | null) => void;
