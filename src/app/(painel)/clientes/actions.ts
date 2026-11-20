"use server";

import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { currentUserHasPermission, requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import {
  clientAddresses,
  clientNotes,
  clients,
  contractAdAccounts,
  contracts,
  CONTRACT_PERIODS,
  CONTRACT_STATUS,
  niches,
} from "@/lib/db/schema";
import { onlyDigits, parseMoney, validarDocumento } from "@/lib/format/masks";
import { getAdAccounts, MetaApiException } from "@/lib/meta/client";
import { getMetaToken } from "@/lib/settings";

export type ClientState = { ok?: boolean; error?: string; id?: number };
export type AdAccountOption = {
  id: string;
  name: string;
  currency?: string;
  accountStatus?: number;
};

const dataIso = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.");

const textoOpcional = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => (v ? v : null));

const urlOpcional = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v ? v : null))
  .refine(
    (v) => !v || /^https?:\/\//i.test(v),
    "Informe uma URL começando com http:// ou https://.",
  );

const telefoneOpcional = z
  .string()
  .optional()
  .transform((v) => onlyDigits(v) || null)
  .refine(
    (v) => !v || v.length === 10 || v.length === 11,
    "Telefone deve ter DDD + número (10 ou 11 dígitos).",
  );

const clienteSchema = z.object({
  businessName: z.string().trim().min(2, "Informe o nome fantasia.").max(120),
  legalName: textoOpcional(160),
  document: z
    .string()
    .optional()
    .transform((v) => onlyDigits(v) || null)
    .refine((v) => validarDocumento(v), "CPF ou CNPJ inválido."),
  contactPerson: textoOpcional(120),
  email: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .refine(
      (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      "E-mail inválido.",
    ),
  phone: telefoneOpcional,
  whatsapp: telefoneOpcional,
  /** Vazio = sem nicho. Só o id é gravado; o nome vem da tabela `niches`. */
  nicheId: z
    .string()
    .optional()
    .transform((v) => {
      const id = Number(v);
      return Number.isInteger(id) && id > 0 ? id : null;
    }),
});

const contratoSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do contrato.").max(120),
  startDate: dataIso,
  status: z.enum(CONTRACT_STATUS),
  period: z.enum(CONTRACT_PERIODS),
  monthlyValue: z.coerce.number().int().min(0, "Valor mensal inválido."),
  /** Dia de vencimento da parcela; vazio = mesmo dia do início do contrato. */
  dueDay: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? Number(v) : null))
    .refine(
      (v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 31),
      "Dia de vencimento deve ficar entre 1 e 31.",
    ),
  instagramUrl: urlOpcional,
  facebookUrl: urlOpcional,
  googleBusinessUrl: urlOpcional,
});

const anotacaoSchema = z.object({
  description: z
    .string()
    .trim()
    .min(2, "Escreva a anotação.")
    .max(4000, "Anotação muito longa."),
});

function refresh(clienteId?: number) {
  revalidatePath("/clientes");
  revalidatePath("/painel");
  if (clienteId) revalidatePath(`/clientes/${clienteId}`);
}

function mensagem(e: unknown, padrao: string): string {
  if (e instanceof Error && e.message) return e.message;
  return padrao;
}

function primeiroErro(resultado: { success: false; error: z.ZodError }): string {
  return resultado.error.issues[0]?.message ?? "Dados inválidos.";
}

/* ------------------------------------------------------------------ */
/* Contas de anúncio da Meta                                           */
/* ------------------------------------------------------------------ */

export async function getMetaAdAccountsAction(): Promise<{
  ok: boolean;
  accounts?: AdAccountOption[];
  message?: string;
}> {
  if (!(await currentUserHasPermission("clientes", "view"))) {
    return { ok: false, message: "Sem permissão para consultar contas." };
  }
  const token = await getMetaToken();
  if (!token) {
    return {
      ok: false,
      message: "Configure o token em Configurações → Meta Ads para carregar as contas.",
    };
  }
  try {
    const result = await getAdAccounts(token);
    return {
      ok: true,
      accounts: (result.data ?? []).map((a) => ({
        id: a.id,
        name: a.name,
        currency: a.currency,
        accountStatus: a.account_status,
      })),
    };
  } catch (error) {
    if (error instanceof MetaApiException && error.code === 190) {
      return {
        ok: false,
        message:
          "O token da Meta expirou ou foi revogado. Gere um novo em Configurações → Meta Ads.",
      };
    }
    return {
      ok: false,
      message:
        "Não foi possível carregar as contas da Meta. Confira o token e tente novamente.",
    };
  }
}

function idsContas(formData: FormData): string[] {
  return [
    ...new Set(
      formData
        .getAll("adAccount")
        .map(String)
        .filter((id) => /^act_?[\w-]+$/.test(id)),
    ),
  ];
}

/**
 * Resolve nome/moeda/status de cada conta escolhida. Contas já vinculadas
 * (`existentes`) valem como snapshot quando a Meta não as devolve mais.
 */
async function snapshots(
  accountIds: string[],
  existentes: { adAccountId: string; name: string; currency: string | null; accountStatus: number | null }[] = [],
) {
  if (!accountIds.length) return [];

  const doBanco = new Map(existentes.map((a) => [a.adAccountId, a]));
  const faltandoNoBanco = accountIds.filter((id) => !doBanco.has(id));

  if (faltandoNoBanco.length === 0) {
    return accountIds.map((id) => {
      const conta = doBanco.get(id)!;
      return {
        adAccountId: conta.adAccountId,
        name: conta.name,
        currency: conta.currency,
        accountStatus: conta.accountStatus,
      };
    });
  }

  const token = await getMetaToken();
  if (!token) {
    throw new Error(
      "Configure o token da Meta antes de relacionar contas de anúncio.",
    );
  }

  const result = await getAdAccounts(token);
  const daMeta = new Map((result.data ?? []).map((a) => [a.id, a]));

  return accountIds.map((id) => {
    const doContrato = doBanco.get(id);
    if (doContrato) {
      return {
        adAccountId: doContrato.adAccountId,
        name: doContrato.name,
        currency: doContrato.currency,
        accountStatus: doContrato.accountStatus,
      };
    }
    const conta = daMeta.get(id);
    if (!conta) {
      throw new Error(
        "Uma das contas selecionadas não está disponível no token da Meta.",
      );
    }
    return {
      adAccountId: conta.id,
      name: conta.name,
      currency: conta.currency ?? null,
      accountStatus: conta.account_status ?? null,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Cliente                                                             */
/* ------------------------------------------------------------------ */

function dadosCliente(formData: FormData) {
  return clienteSchema.safeParse({
    businessName: formData.get("businessName"),
    legalName: formData.get("legalName") ?? "",
    document: formData.get("document") ?? "",
    contactPerson: formData.get("contactPerson") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    whatsapp: formData.get("whatsapp") ?? "",
    nicheId: formData.get("nicheId") ?? "",
  });
}

/** Nicho apontado precisa existir (o refine do zod não pode consultar o banco). */
async function nichoExiste(id: number | null): Promise<boolean> {
  if (id === null) return true;
  const [linha] = await db
    .select({ id: niches.id })
    .from(niches)
    .where(eq(niches.id, id));
  return Boolean(linha);
}

async function documentoEmUso(
  document: string | null,
  ignorarId?: number,
): Promise<boolean> {
  if (!document) return false;
  const condicoes = [eq(clients.document, document)];
  if (typeof ignorarId === "number") condicoes.push(ne(clients.id, ignorarId));
  const [linha] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(...condicoes));
  return Boolean(linha);
}

export async function createClientAction(
  _prev: ClientState,
  formData: FormData,
): Promise<ClientState> {
  try {
    await requirePermission("clientes", "create");
    const parsed = dadosCliente(formData);
    if (!parsed.success) return { error: primeiroErro(parsed) };
    if (await documentoEmUso(parsed.data.document)) {
      return { error: "Já existe um cliente com este CPF/CNPJ." };
    }
    if (!(await nichoExiste(parsed.data.nicheId))) {
      return { error: "Nicho inexistente." };
    }

    const [criado] = await db
      .insert(clients)
      .values({ ...parsed.data, active: true })
      .returning({ id: clients.id })
      ;

    refresh(criado.id);
    return { ok: true, id: criado.id };
  } catch (e) {
    return { error: mensagem(e, "Não foi possível criar o cliente.") };
  }
}

export async function updateClientAction(
  _prev: ClientState,
  formData: FormData,
): Promise<ClientState> {
  try {
    await requirePermission("clientes", "edit");
    const id = Number(formData.get("id"));
    if (!Number.isInteger(id) || id <= 0) return { error: "Cliente inválido." };

    const parsed = dadosCliente(formData);
    if (!parsed.success) return { error: primeiroErro(parsed) };
    if (await documentoEmUso(parsed.data.document, id)) {
      return { error: "Já existe um cliente com este CPF/CNPJ." };
    }
    if (!(await nichoExiste(parsed.data.nicheId))) {
      return { error: "Nicho inexistente." };
    }

    await db.update(clients)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(clients.id, id))
      ;

    refresh(id);
    return { ok: true, id };
  } catch (e) {
    return { error: mensagem(e, "Não foi possível atualizar o cliente.") };
  }
}

export async function saveAddressAction(
  _prev: ClientState,
  formData: FormData,
): Promise<ClientState> {
  try {
    await requirePermission("clientes", "edit");
    const clientId = Number(formData.get("clientId"));
    if (!Number.isInteger(clientId) || clientId <= 0) return { error: "Cliente inválido." };

    const cep = onlyDigits(String(formData.get("cep") ?? ""));
    if (cep && cep.length !== 8) return { error: "CEP deve ter 8 dígitos." };

    const uf = String(formData.get("state") ?? "").trim().toUpperCase();
    if (uf && !/^[A-Z]{2}$/.test(uf)) return { error: "Informe a UF com 2 letras." };

    const valores = {
      cep: cep || null,
      street: String(formData.get("street") ?? "").trim() || null,
      number: String(formData.get("number") ?? "").trim() || null,
      complement: String(formData.get("complement") ?? "").trim() || null,
      district: String(formData.get("district") ?? "").trim() || null,
      city: String(formData.get("city") ?? "").trim() || null,
      state: uf || null,
      updatedAt: new Date(),
    };

    const [existente] = await db
      .select({ id: clientAddresses.id })
      .from(clientAddresses)
      .where(eq(clientAddresses.clientId, clientId))
      ;

    if (existente) {
      await db.update(clientAddresses).set(valores).where(eq(clientAddresses.id, existente.id));
    } else {
      await db.insert(clientAddresses).values({ ...valores, clientId });
    }

    refresh(clientId);
    return { ok: true };
  } catch (e) {
    return { error: mensagem(e, "Não foi possível salvar o endereço.") };
  }
}

export async function setClientActiveAction(
  _prev: ClientState,
  formData: FormData,
): Promise<ClientState> {
  try {
    await requirePermission("clientes", "edit");
    const id = Number(formData.get("id"));
    if (!Number.isInteger(id) || id <= 0) return { error: "Cliente inválido." };
    await db.update(clients)
      .set({ active: formData.get("active") === "true", updatedAt: new Date() })
      .where(eq(clients.id, id))
      ;
    refresh(id);
    return { ok: true };
  } catch (e) {
    return { error: mensagem(e, "Não foi possível alterar o status.") };
  }
}

export async function deleteClientAction(
  _prev: ClientState,
  formData: FormData,
): Promise<ClientState> {
  try {
    await requirePermission("clientes", "delete");
    const id = Number(formData.get("id"));
    if (!Number.isInteger(id) || id <= 0) return { error: "Cliente inválido." };
    await db.delete(clients).where(eq(clients.id, id));
    refresh();
    return { ok: true };
  } catch (e) {
    return { error: mensagem(e, "Não foi possível excluir o cliente.") };
  }
}

/* ------------------------------------------------------------------ */
/* Contratos                                                           */
/* ------------------------------------------------------------------ */

function dadosContrato(formData: FormData) {
  return contratoSchema.safeParse({
    name: formData.get("name"),
    startDate: formData.get("startDate"),
    status: formData.get("status") ?? "active",
    period: formData.get("period") ?? "monthly",
    monthlyValue: parseMoney(String(formData.get("monthlyValue") ?? "")),
    dueDay: String(formData.get("dueDay") ?? ""),
    instagramUrl: String(formData.get("instagramUrl") ?? ""),
    facebookUrl: String(formData.get("facebookUrl") ?? ""),
    googleBusinessUrl: String(formData.get("googleBusinessUrl") ?? ""),
  });
}

export async function createContractAction(
  _prev: ClientState,
  formData: FormData,
): Promise<ClientState> {
  try {
    await requirePermission("clientes", "edit");
    const clientId = Number(formData.get("clientId"));
    if (!Number.isInteger(clientId) || clientId <= 0) return { error: "Cliente inválido." };

    const parsed = dadosContrato(formData);
    if (!parsed.success) return { error: primeiroErro(parsed) };

    const escolhidas = idsContas(formData);
    const contas = await snapshots(escolhidas);

    const [criado] = await db
      .insert(contracts)
      .values({ ...parsed.data, clientId })
      .returning({ id: contracts.id })
      ;

    if (contas.length) {
      await db.insert(contractAdAccounts)
        .values(contas.map((a) => ({ ...a, contractId: criado.id })))
        ;
    }

    refresh(clientId);
    return { ok: true, id: criado.id };
  } catch (e) {
    return { error: mensagem(e, "Não foi possível criar o contrato.") };
  }
}

export async function updateContractAction(
  _prev: ClientState,
  formData: FormData,
): Promise<ClientState> {
  try {
    await requirePermission("clientes", "edit");
    const id = Number(formData.get("id"));
    if (!Number.isInteger(id) || id <= 0) return { error: "Contrato inválido." };

    const [contrato] = await db.select().from(contracts).where(eq(contracts.id, id));
    if (!contrato) return { error: "Contrato não encontrado." };

    const parsed = dadosContrato(formData);
    if (!parsed.success) return { error: primeiroErro(parsed) };

    const existentes = await db
      .select()
      .from(contractAdAccounts)
      .where(eq(contractAdAccounts.contractId, id))
      ;

    const contas = await snapshots(idsContas(formData), existentes);

    await db.update(contracts)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(contracts.id, id))
      ;

    await db.delete(contractAdAccounts).where(eq(contractAdAccounts.contractId, id));
    if (contas.length) {
      await db.insert(contractAdAccounts)
        .values(contas.map((a) => ({ ...a, contractId: id })))
        ;
    }

    refresh(contrato.clientId);
    return { ok: true, id };
  } catch (e) {
    return { error: mensagem(e, "Não foi possível atualizar o contrato.") };
  }
}

export async function setContractStatusAction(
  _prev: ClientState,
  formData: FormData,
): Promise<ClientState> {
  try {
    await requirePermission("clientes", "edit");
    const id = Number(formData.get("id"));
    if (!Number.isInteger(id) || id <= 0) return { error: "Contrato inválido." };

    const [contrato] = await db.select().from(contracts).where(eq(contracts.id, id));
    if (!contrato) return { error: "Contrato não encontrado." };

    await db.update(contracts)
      .set({ status: formData.get("status") === "active" ? "active" : "inactive", updatedAt: new Date() })
      .where(eq(contracts.id, id))
      ;

    refresh(contrato.clientId);
    return { ok: true };
  } catch (e) {
    return { error: mensagem(e, "Não foi possível alterar o status do contrato.") };
  }
}

export async function deleteContractAction(
  _prev: ClientState,
  formData: FormData,
): Promise<ClientState> {
  try {
    await requirePermission("clientes", "delete");
    const id = Number(formData.get("id"));
    if (!Number.isInteger(id) || id <= 0) return { error: "Contrato inválido." };

    const [contrato] = await db.select().from(contracts).where(eq(contracts.id, id));
    if (!contrato) return { error: "Contrato não encontrado." };

    await db.delete(contracts).where(eq(contracts.id, id));
    refresh(contrato.clientId);
    return { ok: true };
  } catch (e) {
    return { error: mensagem(e, "Não foi possível excluir o contrato.") };
  }
}

/* ------------------------------------------------------------------ */
/* Anotações                                                           */
/* ------------------------------------------------------------------ */

/**
 * Anotações: data e hora são gravadas automaticamente pelo servidor no momento
 * do registro e a interface não permite alterá-las.
 */
export async function createNoteAction(
  _prev: ClientState,
  formData: FormData,
): Promise<ClientState> {
  try {
    await requirePermission("clientes", "edit");
    const clientId = Number(formData.get("clientId"));
    if (!Number.isInteger(clientId) || clientId <= 0) return { error: "Cliente inválido." };

    const parsed = anotacaoSchema.safeParse({
      description: formData.get("description"),
    });
    if (!parsed.success) return { error: primeiroErro(parsed) };

    await db.insert(clientNotes)
      .values({ ...parsed.data, clientId, createdAt: new Date() })
      ;
    refresh(clientId);
    return { ok: true };
  } catch (e) {
    return { error: mensagem(e, "Não foi possível salvar a anotação.") };
  }
}

export async function deleteNoteAction(
  _prev: ClientState,
  formData: FormData,
): Promise<ClientState> {
  try {
    await requirePermission("clientes", "delete");
    const id = Number(formData.get("id"));
    if (!Number.isInteger(id) || id <= 0) return { error: "Anotação inválida." };

    const [nota] = await db.select().from(clientNotes).where(eq(clientNotes.id, id));
    if (!nota) return { error: "Anotação não encontrada." };

    await db.delete(clientNotes).where(eq(clientNotes.id, id));
    refresh(nota.clientId);
    return { ok: true };
  } catch (e) {
    return { error: mensagem(e, "Não foi possível excluir a anotação.") };
  }
}

/* ------------------------------------------------------------------ */
/* Consultas                                                           */
/* ------------------------------------------------------------------ */

export async function listClients() {
  const rows = await db.select().from(clients).orderBy(clients.businessName);
  const todosContratos = await db.select().from(contracts);
  const todasContas = await db.select().from(contractAdAccounts);

  return rows.map((cliente) => {
    const doCliente = todosContratos.filter((c) => c.clientId === cliente.id);
    const idsContratos = new Set(doCliente.map((c) => c.id));
    return {
      ...cliente,
      contracts: doCliente.map((contrato) => ({
        ...contrato,
        accounts: todasContas.filter((a) => a.contractId === contrato.id),
      })),
      accounts: todasContas.filter((a) => idsContratos.has(a.contractId)),
    };
  });
}

/**
 * Dados usados pelo módulo Campanhas: cliente, contratos e as contas de
 * anúncio de cada contrato. Só clientes ativos entram na listagem.
 */
export async function listClientsWithContracts() {
  const lista = await db
    .select()
    .from(clients)
    .where(eq(clients.active, true))
    .orderBy(clients.businessName);
  const todosContratos = await db.select().from(contracts);
  const todasContas = await db.select().from(contractAdAccounts);

  return lista.map((cliente) => ({
    ...cliente,
    contracts: todosContratos
      .filter((contrato) => contrato.clientId === cliente.id)
      .map((contrato) => ({
        ...contrato,
        accounts: todasContas.filter((a) => a.contractId === contrato.id),
      })),
  }));
}

export type ClientComContratos = Awaited<
  ReturnType<typeof listClientsWithContracts>
>[number];

export type ClientListItem = Awaited<ReturnType<typeof listClients>>[number];

export async function getClientDetail(clientId: number) {
  const [cliente] = await db.select().from(clients).where(eq(clients.id, clientId));
  if (!cliente) return null;

  const [endereco] =
    (await db
      .select()
      .from(clientAddresses)
      .where(eq(clientAddresses.clientId, clientId))) ?? [];

  const contratos = await db
    .select()
    .from(contracts)
    .where(eq(contracts.clientId, clientId))
    .orderBy(desc(contracts.startDate));

  const idsDosContratos = contratos.map((c) => c.id);
  const contas = idsDosContratos.length
    ? await db
        .select()
        .from(contractAdAccounts)
        .where(inArray(contractAdAccounts.contractId, idsDosContratos))
    : [];

  const anotacoes = await db
    .select()
    .from(clientNotes)
    .where(eq(clientNotes.clientId, clientId))
    .orderBy(desc(clientNotes.createdAt), desc(clientNotes.id));

  return {
    cliente,
    endereco,
    contratos: contratos.map((contrato) => ({
      ...contrato,
      accounts: contas.filter((a) => a.contractId === contrato.id),
    })),
    anotacoes,
  };
}

export type ClientDetail = NonNullable<Awaited<ReturnType<typeof getClientDetail>>>;
export type ContractWithAccounts = ClientDetail["contratos"][number];
