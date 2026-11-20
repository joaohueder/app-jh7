"use server";

import { revalidatePath } from "next/cache";

import { currentUserHasPermission } from "@/lib/auth/permissions";
import { getMetaToken } from "@/lib/settings";
import {
  anunciosDoConjunto,
  campanhasDoCliente,
  conjuntosDaCampanha,
  contasDoCliente,
  idsParaCache,
  saldoDaConta,
} from "@/lib/meta/campaigns";
import { limparCacheDasContas } from "@/lib/meta/cache";
import {
  intervaloPersonalizado,
  normalizarPeriodo,
  normalizarStatus,
} from "@/lib/meta/insights";
import { listClientsWithContracts } from "../clientes/actions";

export type AtualizarState = { ok?: boolean; message?: string };

/**
 * Busca de novo na Meta os dados do módulo Campanhas e regrava o cache.
 *
 * Só é chamada pelo botão "Atualizar dados" — as telas nunca consultam a Meta
 * por conta própria. Atualiza exatamente o que está na tela (período e status
 * escolhidos); `clientId` nulo é a tela inicial, que recarrega todos os
 * clientes naquele filtro.
 *
 * O cache do cliente é apagado antes da consulta: se a Meta falhar no meio, a
 * tela não fica mostrando número velho como se fosse recém-atualizado.
 * As consultas são sequenciais porque a Meta limita requisições por conta de
 * anúncio — disparar todas juntas estoura a cota (erro 17).
 */
export async function atualizarCampanhas(input: {
  clientId: number | null;
  periodo?: string;
  status?: string;
  de?: string;
  ate?: string;
  /**
   * Nível aberto. Sem eles o botão atualiza só a lista de campanhas — na tela
   * de conjuntos ou de anúncios isso deixaria o que está visível sem renovar.
   */
  campanhaId?: string;
  conjuntoId?: string;
  /** Objetivo da campanha, necessário para ler conjunto/anúncio na Meta. */
  objetivoCodigo?: string | null;
  /** Destino do conjunto, usado só no nível de anúncios. */
  destino?: string | null;
}): Promise<AtualizarState> {
  if (!(await currentUserHasPermission("campanhas", "view"))) {
    return { message: "Você não tem permissão para atualizar as campanhas." };
  }

  const token = getMetaToken();
  if (!token) {
    return { message: "Configure o token da Meta em Configurações → Meta Ads." };
  }

  const periodo = normalizarPeriodo(input.periodo);
  const status = normalizarStatus(input.status);
  const personalizado = periodo === "custom" ? intervaloPersonalizado(input.de, input.ate) : null;
  if (periodo === "custom" && !personalizado) {
    return { message: "Escolha as datas do período personalizado." };
  }

  const clientes = (await listClientsWithContracts()).filter(
    (cliente) => input.clientId === null || cliente.id === input.clientId,
  );
  if (!clientes.length) return { message: "Cliente não encontrado." };

  let atualizados = 0;
  for (const cliente of clientes) {
    const contas = await contasDoCliente(cliente.contracts);
    if (!contas.length) continue;

    limparCacheDasContas(idsParaCache(contas));

    const resultado = await campanhasDoCliente(
      contas,
      periodo,
      status,
      token,
      personalizado,
      true,
    );
    if (resultado.estado.estado === "erro") return { message: resultado.estado.mensagem };

    const conta = resultado.linhas[0]?.contaId ?? idsParaCache(contas)[0] ?? "";

    // Nível de conjuntos: refaz também o que está aberto naquela campanha.
    if (input.campanhaId) {
      const conjuntos = await conjuntosDaCampanha(
        input.campanhaId,
        conta,
        input.objetivoCodigo ?? null,
        periodo,
        "all",
        token,
        personalizado,
        true,
      );
      if (conjuntos.estado.estado === "erro") return { message: conjuntos.estado.mensagem };

      // Nível de anúncios: refaz o conjunto aberto.
      if (input.conjuntoId) {
        const anuncios = await anunciosDoConjunto(
          input.conjuntoId,
          conta,
          input.objetivoCodigo ?? null,
          periodo,
          status,
          token,
          input.destino ?? null,
          personalizado,
          true,
        );
        if (anuncios.estado.estado === "erro") return { message: anuncios.estado.mensagem };
      }
    }

    if (input.clientId !== null) {
      await Promise.all(contas.map((c) => saldoDaConta(c.id, token, true)));
    }
    atualizados++;
  }

  if (!atualizados) {
    return { message: "Nenhum cliente com conta de anúncio para atualizar." };
  }

  revalidatePath("/campanhas", "layout");
  return {
    ok: true,
    message: atualizados === 1 ? "Dados atualizados." : `${atualizados} clientes atualizados.`,
  };
}