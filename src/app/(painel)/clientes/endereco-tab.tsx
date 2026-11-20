"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { maskCep, onlyDigits } from "@/lib/format/masks";
import { saveAddressAction, type ClientState } from "./actions";
import type { RegistrarAba } from "./tab-registry";
import type { ClientAddress } from "@/lib/db/schema";

const vazio: ClientState = {};

type ViaCep = {
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean | string;
};

function iniciais(endereco: ClientAddress | null) {
  return {
    cep: maskCep(endereco?.cep ?? ""),
    street: endereco?.street ?? "",
    number: endereco?.number ?? "",
    complement: endereco?.complement ?? "",
    district: endereco?.district ?? "",
    city: endereco?.city ?? "",
    state: endereco?.state ?? "",
  };
}

/**
 * Aba Endereço. O CEP completo dispara a consulta ao ViaCEP e preenche
 * rua/bairro/cidade/UF; falha na consulta não impede o preenchimento manual.
 * A gravação é feita pela barra flutuante da tela.
 */
export function EnderecoTab({
  clientId,
  endereco,
  podeEditar,
  registrar,
}: {
  clientId: number;
  endereco: ClientAddress | null;
  podeEditar: boolean;
  registrar: RegistrarAba;
}) {
  const router = useRouter();
  const [valores, setValores] = useState(() => iniciais(endereco));
  const [originais, setOriginais] = useState(valores);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [salvando, startSalvando] = useTransition();
  const ultimoCepBuscado = useRef("");

  const alterado =
    podeEditar &&
    (Object.keys(valores) as (keyof typeof valores)[]).some(
      (campo) => valores[campo] !== originais[campo],
    );

  function atualizar(campo: keyof typeof valores, valor: string) {
    setValores((atual) => ({ ...atual, [campo]: valor }));
  }

  useEffect(() => {
    const digits = onlyDigits(valores.cep);
    if (digits.length !== 8 || digits === ultimoCepBuscado.current) return;
    ultimoCepBuscado.current = digits;

    const controller = new AbortController();
    setBuscandoCep(true);

    fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal: controller.signal })
      .then((r) => r.json() as Promise<ViaCep>)
      .then((dados) => {
        if (dados.erro) {
          toast.error("CEP não encontrado. Preencha o endereço manualmente.");
          return;
        }
        setValores((atual) => ({
          ...atual,
          street: dados.logradouro || atual.street,
          district: dados.bairro || atual.district,
          city: dados.localidade || atual.city,
          state: (dados.uf || atual.state).toUpperCase(),
        }));
        toast.success("Endereço preenchido pelo CEP.");
      })
      .catch((erro: unknown) => {
        if ((erro as Error)?.name === "AbortError") return;
        toast.error("Não foi possível consultar o CEP. Preencha manualmente.");
      })
      .finally(() => setBuscandoCep(false));

    return () => controller.abort();
  }, [valores.cep]);

  function salvar() {
    const formData = new FormData();
    Object.entries(valores).forEach(([campo, valor]) => formData.set(campo, valor));
    formData.set("clientId", String(clientId));

    startSalvando(async () => {
      const resultado = await saveAddressAction(vazio, formData);
      if (resultado.ok) {
        toast.success("Endereço salvo.");
        setOriginais(valores);
        router.refresh();
      } else {
        toast.error(resultado.error ?? "Não foi possível salvar o endereço.");
      }
    });
  }

  useEffect(() => {
    if (!podeEditar) return;
    registrar("endereco", {
      sujo: alterado,
      salvando,
      mensagem: "Endereço com alterações não salvas.",
      labelSalvar: "Salvar endereço",
      salvar,
      cancelar: () => {
        setValores(originais);
        ultimoCepBuscado.current = onlyDigits(originais.cep);
      },
    });
    return () => registrar("endereco", null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- registrar é estável
  }, [alterado, salvando, valores, originais, podeEditar]);

  return (
    <section className="space-y-5 rounded-xl border border-line bg-surface p-6">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-base font-semibold text-white">
          <MapPin className="size-4 text-ember" aria-hidden="true" />
          Endereço
        </h2>
        <p className="text-sm text-dim">
          Preencha o CEP para completar automaticamente os demais campos.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-6">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="cep">CEP</Label>
          <div className="relative">
            <Input
              id="cep"
              value={valores.cep}
              onChange={(e) => atualizar("cep", maskCep(e.target.value))}
              placeholder="00000-000"
              inputMode="numeric"
              disabled={!podeEditar}
              className="h-11"
            />
            {buscandoCep ? (
              <Loader2
                className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-dim"
                aria-hidden="true"
              />
            ) : null}
          </div>
          <p className="text-xs text-dim">
            {buscandoCep ? "Buscando endereço..." : "Busca automática pelo ViaCEP."}
          </p>
        </div>

        <div className="space-y-2 sm:col-span-4">
          <Label htmlFor="street">Endereço</Label>
          <Input
            id="street"
            value={valores.street}
            onChange={(e) => atualizar("street", e.target.value)}
            placeholder="Rua, avenida..."
            disabled={!podeEditar}
            className="h-11"
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="number">Número</Label>
          <Input
            id="number"
            value={valores.number}
            onChange={(e) => atualizar("number", e.target.value)}
            placeholder="123"
            disabled={!podeEditar}
            className="h-11"
          />
        </div>

        <div className="space-y-2 sm:col-span-4">
          <Label htmlFor="complement">Complemento</Label>
          <Input
            id="complement"
            value={valores.complement}
            onChange={(e) => atualizar("complement", e.target.value)}
            placeholder="Sala, bloco, andar..."
            disabled={!podeEditar}
            className="h-11"
          />
        </div>

        <div className="space-y-2 sm:col-span-3">
          <Label htmlFor="district">Bairro</Label>
          <Input
            id="district"
            value={valores.district}
            onChange={(e) => atualizar("district", e.target.value)}
            disabled={!podeEditar}
            className="h-11"
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="city">Cidade</Label>
          <Input
            id="city"
            value={valores.city}
            onChange={(e) => atualizar("city", e.target.value)}
            disabled={!podeEditar}
            className="h-11"
          />
        </div>

        <div className="space-y-2 sm:col-span-1">
          <Label htmlFor="state">UF</Label>
          <Input
            id="state"
            value={valores.state}
            onChange={(e) =>
              atualizar("state", e.target.value.toUpperCase().slice(0, 2))
            }
            placeholder="SP"
            maxLength={2}
            disabled={!podeEditar}
            className="h-11"
          />
        </div>
      </div>
    </section>
  );
}
