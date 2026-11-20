"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { maskDocument, maskPhone, onlyDigits, validarDocumento } from "@/lib/format/masks";
import { createClientAction, updateClientAction, type ClientState } from "./actions";
import type { RegistrarAba } from "./tab-registry";
import type { Client } from "@/lib/db/schema";

const vazio: ClientState = {};

function iniciais(cliente?: Client) {
  return {
    businessName: cliente?.businessName ?? "",
    legalName: cliente?.legalName ?? "",
    document: maskDocument(cliente?.document ?? ""),
    contactPerson: cliente?.contactPerson ?? "",
    email: cliente?.email ?? "",
    phone: maskPhone(cliente?.phone ?? ""),
    whatsapp: maskPhone(cliente?.whatsapp ?? ""),
    /** Vazio = sem nicho; os demais são o id como texto. */
    nicheId: cliente?.nicheId ? String(cliente.nicheId) : "",
  };
}

/**
 * Aba Dados. O botão de salvar NÃO fica aqui: a barra flutuante da tela
 * (`ClientTabs`) é o único ponto de gravação.
 */
export function DadosTab({
  cliente,
  nichos,
  podeEditar,
  registrar,
}: {
  cliente?: Client;
  /** Nichos cadastrados em Configurações, para o seletor. */
  nichos: { id: number; name: string }[];
  podeEditar: boolean;
  registrar: RegistrarAba;
}) {
  const router = useRouter();
  const editando = Boolean(cliente);
  const [salvando, startSalvando] = useTransition();
  const [erroDocumento, setErroDocumento] = useState("");
  const [valores, setValores] = useState(() => iniciais(cliente));
  // Valores como estão no banco — atualizados a cada gravação bem-sucedida.
  const [originais, setOriginais] = useState(valores);

  const alterado =
    podeEditar &&
    (Object.keys(valores) as (keyof typeof valores)[]).some(
      (campo) => valores[campo] !== originais[campo],
    );

  function atualizar(campo: keyof typeof valores, valor: string) {
    setValores((atual) => ({ ...atual, [campo]: valor }));
  }

  /** CPF/CNPJ é validado ao sair do campo, avisando o usuário na hora. */
  function validarDocumentoAoSair(): boolean {
    const digitos = onlyDigits(valores.document);
    if (!digitos) {
      setErroDocumento("");
      return true;
    }
    if (validarDocumento(digitos)) {
      setErroDocumento("");
      return true;
    }
    const mensagem =
      digitos.length === 11
        ? "CPF inválido. Confira os dígitos verificadores."
        : digitos.length === 14
          ? "CNPJ inválido. Confira os dígitos verificadores."
          : "CPF ou CNPJ incompleto. Informe 11 ou 14 dígitos.";
    setErroDocumento(mensagem);
    toast.error(mensagem);
    return false;
  }

  function salvar() {
    if (!validarDocumentoAoSair()) return;

    const formData = new FormData();
    Object.entries(valores).forEach(([campo, valor]) => formData.set(campo, valor));
    if (cliente) formData.set("id", String(cliente.id));

    startSalvando(async () => {
      const resultado = editando
        ? await updateClientAction(vazio, formData)
        : await createClientAction(vazio, formData);

      if (!resultado.ok) {
        toast.error(resultado.error ?? "Não foi possível salvar o cliente.");
        return;
      }

      toast.success(editando ? "Cliente atualizado." : "Cliente criado.");
      setOriginais(valores);

      if (!editando && resultado.id) router.push(`/clientes/${resultado.id}`);
      else router.refresh();
    });
  }

  useEffect(() => {
    if (!podeEditar) return;
    registrar("dados", {
      sujo: alterado,
      salvando,
      mensagem: editando
        ? "Dados do cliente com alterações não salvas."
        : "Novo cliente ainda não salvo.",
      labelSalvar: editando ? "Salvar alterações" : "Criar cliente",
      salvar,
      cancelar: () => {
        setValores(originais);
        setErroDocumento("");
        if (!editando) router.push("/clientes");
      },
    });
    return () => registrar("dados", null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- registrar é estável
  }, [alterado, salvando, valores, originais, podeEditar]);

  return (
    <section className="space-y-5 rounded-xl border border-line bg-surface p-6">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-white">Dados do cliente</h2>
        <p className="text-sm text-dim">
          Identificação da empresa e contatos principais.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          id="businessName"
          name="businessName"
          label="Nome fantasia"
          required
          maxLength={120}
          value={valores.businessName}
          onChange={(v) => atualizar("businessName", v)}
          placeholder="Como o cliente é conhecido"
          disabled={!podeEditar}
        />
        <Campo
          id="legalName"
          name="legalName"
          label="Razão social"
          maxLength={160}
          value={valores.legalName}
          onChange={(v) => atualizar("legalName", v)}
          placeholder="Nome registrado da empresa"
          disabled={!podeEditar}
        />
        <div className="space-y-2">
          <Label htmlFor="document">CNPJ ou CPF</Label>
          <Input
            id="document"
            name="document"
            value={valores.document}
            onChange={(e) => {
              atualizar("document", maskDocument(e.target.value));
              if (erroDocumento) setErroDocumento("");
            }}
            onBlur={validarDocumentoAoSair}
            placeholder="00.000.000/0000-00"
            inputMode="numeric"
            disabled={!podeEditar}
            aria-invalid={Boolean(erroDocumento)}
            aria-describedby={erroDocumento ? "document-erro" : undefined}
            className={
              erroDocumento
                ? "h-11 border-destructive focus-visible:ring-destructive/40"
                : "h-11"
            }
          />
          {erroDocumento ? (
            <p id="document-erro" role="alert" className="text-xs text-destructive">
              {erroDocumento}
            </p>
          ) : (
            <p className="text-xs text-dim">Validado ao sair do campo.</p>
          )}
        </div>
        <Campo
          id="contactPerson"
          name="contactPerson"
          label="Responsável"
          maxLength={120}
          value={valores.contactPerson}
          onChange={(v) => atualizar("contactPerson", v)}
          placeholder="Pessoa de contato"
          disabled={!podeEditar}
        />
        <Campo
          id="email"
          name="email"
          label="E-mail"
          type="email"
          maxLength={160}
          value={valores.email}
          onChange={(v) => atualizar("email", v)}
          placeholder="contato@cliente.com.br"
          disabled={!podeEditar}
        />
        <div className="space-y-2">
          <Label htmlFor="phone">Telefone</Label>
          <Input
            id="phone"
            name="phone"
            value={valores.phone}
            onChange={(e) => atualizar("phone", maskPhone(e.target.value))}
            placeholder="(00) 00000-0000"
            inputMode="tel"
            disabled={!podeEditar}
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="whatsapp">WhatsApp</Label>
          <Input
            id="whatsapp"
            name="whatsapp"
            value={valores.whatsapp}
            onChange={(e) => atualizar("whatsapp", maskPhone(e.target.value))}
            placeholder="(00) 00000-0000"
            inputMode="tel"
            disabled={!podeEditar}
            className="h-11"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="nicheId">Nicho</Label>
          <select
            id="nicheId"
            name="nicheId"
            value={valores.nicheId}
            onChange={(e) => atualizar("nicheId", e.target.value)}
            disabled={!podeEditar}
            className="h-11 w-full rounded-lg border border-input bg-input/30 px-3 text-sm text-white outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
          >
            <option value="">Sem nicho</option>
            {nichos.map((nicho) => (
              <option key={nicho.id} value={nicho.id}>
                {nicho.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-dim">
            Agrupa o cliente na lista por segmento.
            {nichos.length === 0
              ? " Cadastre nichos em Configurações → Nichos."
              : ""}
          </p>
        </div>
      </div>
    </section>
  );
}

function Campo({
  id,
  label,
  value,
  onChange,
  disabled,
  ...props
}: {
  id: string;
  label: string;
  name: string;
  value: string;
  onChange: (valor: string) => void;
  type?: string;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11"
        disabled={disabled}
        {...props}
      />
    </div>
  );
}
