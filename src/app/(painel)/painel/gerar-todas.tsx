"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { gerarCobrancasAction } from "../financeiro/actions";

/** Geração em lote das mensalidades do mês. Vive só no Dashboard. */
export function GerarTodas({ mes }: { mes: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-9 gap-1.5"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const resposta = await gerarCobrancasAction(mes);
          if (resposta.ok) {
            toast.success(resposta.message ?? "Cobranças geradas.");
            router.refresh();
          } else {
            toast.error(resposta.erro);
          }
        })
      }
    >
      {pending ? (
        <Loader2 className="animate-spin" aria-hidden="true" />
      ) : (
        <RefreshCw aria-hidden="true" />
      )}
      Gerar todas
    </Button>
  );
}