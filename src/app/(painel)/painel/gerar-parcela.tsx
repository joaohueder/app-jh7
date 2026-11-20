"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { gerarCobrancaDoContratoAction } from "../financeiro/actions";

export function GerarParcela({
  contratoId,
  mes,
  cliente,
  podeGerar,
}: {
  contratoId: number;
  mes: string;
  cliente: string;
  podeGerar: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [gerada, setGerada] = useState(false);

  if (!podeGerar) {
    return (
      <span
        className="text-xs text-dim"
        title="Cadastre o dia de vencimento no contrato para habilitar a cobrança."
      >
        Sem dia de vencimento
      </span>
    );
  }

  function gerar() {
    start(async () => {
      const resposta = await gerarCobrancaDoContratoAction(contratoId, mes);
      if (resposta.ok) {
        setGerada(true);
        toast.success(resposta.message ?? "Cobrança gerada.");
        router.refresh();
      } else {
        toast.error(resposta.erro ?? "Não foi possível gerar a cobrança.");
      }
    });
  }

  if (gerada) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-jade">
        <CircleCheck className="size-3.5" aria-hidden="true" />
        Gerada
      </span>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5"
      disabled={pending}
      onClick={gerar}
      aria-label={`Gerar cobrança de ${cliente}`}
    >
      {pending ? (
        <Loader2 className="animate-spin" aria-hidden="true" />
      ) : (
        <CircleCheck aria-hidden="true" />
      )}
      Gerar
    </Button>
  );
}