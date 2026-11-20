"use server";

import { eq, ne, and, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { hashPassword } from "@/lib/auth/password";
import { currentUserHasPermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import {
  users,
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  USER_ROLES,
  type PermissionAction,
  type PermissionModule,
} from "@/lib/db/schema";

export type UserActionState = {
  ok?: boolean;
  error?: string;
};

/** Converte o FormData de checkboxes num mapa validado módulo → ações. */
function parsePermissions(formData: FormData): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const modulo of PERMISSION_MODULES) {
    const acoes = PERMISSION_ACTIONS.filter(
      (action) => formData.get(`perm_${modulo}_${action}`) === "on",
    );
    if (acoes.length > 0) result[modulo] = acoes;
  }
  return result;
}

const userFields = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe o nome completo.")
    .max(80, "Nome muito longo."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("E-mail inválido."),
  role: z.enum(USER_ROLES),
  password: z
    .string()
    .min(8, "A senha deve ter no mínimo 8 caracteres.")
    .max(72, "Senha muito longa."),
});

const userUpdateSchema = userFields.extend({
  password: z
    .string()
    .max(72, "Senha muito longa.")
    .refine((senha) => senha.length === 0 || senha.length >= 8, {
      message: "A senha deve ter no mínimo 8 caracteres.",
    }),
});

async function ensurePermission(
  module: "usuarios",
  action: "view" | "create" | "edit" | "delete",
): Promise<void> {
  const permitido = await currentUserHasPermission(module, action);
  if (!permitido) {
    throw new Error("Você não tem permissão para esta operação.");
  }
}

function revalidarUsuarios() {
  revalidatePath("/usuarios");
  revalidatePath("/painel");
}

/* ------------------------------------------------------------------ */
/* Criação                                                             */
/* ------------------------------------------------------------------ */

export async function createUserAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  try {
    await ensurePermission("usuarios", "create");

    const parsed = userFields.safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      role: formData.get("role"),
      password: formData.get("password"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    }

    const [existente] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, parsed.data.email));
    if (existente) {
      return { error: "Já existe um usuário com este e-mail." };
    }

    // Só um admin pode criar outro admin; operador não-admin cria sempre "user".
    const operadorAdmin = await isAdmin();
    const role = operadorAdmin ? parsed.data.role : "user";

    const passwordHash = await hashPassword(parsed.data.password);

    await db.insert(users)
      .values({
        name: parsed.data.name,
        email: parsed.data.email,
        role,
        permissions: parsePermissions(formData),
        passwordHash,
        active: true,
      })
      ;

    revalidarUsuarios();
    return { ok: true };
  } catch (error) {
    return { error: mensagemDeErro(error) };
  }
}

/* ------------------------------------------------------------------ */
/* Edição                                                              */
/* ------------------------------------------------------------------ */

export async function updateUserAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  try {
    await ensurePermission("usuarios", "edit");

    const id = Number(formData.get("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return { error: "Usuário inválido." };
    }

    const [alvo] = await db.select().from(users).where(eq(users.id, id));
    if (!alvo) return { error: "Usuário não encontrado." };

    const parsed = userUpdateSchema.safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      role: formData.get("role"),
      password: formData.get("password") ?? "",
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    }

    // Regras de função: só admin define ou altera a função de qualquer conta.
    const souAdmin = await isAdmin();
    if (!souAdmin) {
      if (alvo.role === "admin") {
        return { error: "Somente um administrador pode editar outro administrador." };
      }
      if (parsed.data.role !== "user") {
        return { error: "Somente um administrador pode definir a função de administrador." };
      }
    }
    if (alvo.role === "admin" && parsed.data.role !== "admin" && (await eUnicoAdmin(id))) {
      return { error: "O sistema precisa de pelo menos um administrador." };
    }
    if (alvo.id === (await currentUserId()) && parsed.data.role !== "admin") {
      return { error: "Você não pode remover seu próprio papel de administrador." };
    }

    const roleFinal = souAdmin ? parsed.data.role : "user";

    const updates: Record<string, unknown> = {
      name: parsed.data.name,
      email: parsed.data.email,
      role: roleFinal,
      permissions: parsePermissions(formData),
      updatedAt: new Date(),
    };

    if (parsed.data.password.length > 0) {
      updates.passwordHash = await hashPassword(parsed.data.password);
    }

    await db.update(users).set(updates).where(eq(users.id, id));

    revalidarUsuarios();
    return { ok: true };
  } catch (error) {
    return { error: mensagemDeErro(error) };
  }
}

/* ------------------------------------------------------------------ */
/* Ativar / desativar                                                  */
/* ------------------------------------------------------------------ */

export async function setUserActiveAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  try {
    await ensurePermission("usuarios", "edit");

    const id = Number(formData.get("id"));
    const ativo = formData.get("active") === "true";
    if (!Number.isInteger(id) || id <= 0) {
      return { error: "Usuário inválido." };
    }

    const [alvo] = await db.select().from(users).where(eq(users.id, id));
    if (!alvo) return { error: "Usuário não encontrado." };

    if (alvo.id === (await currentUserId())) {
      return { error: "Você não pode desativar sua própria conta." };
    }
    if (alvo.role === "admin" && !ativo && (await eUnicoAdmin(id))) {
      return { error: "O sistema precisa de pelo menos um administrador ativo." };
    }
    if (alvo.role === "admin" && !(await isAdmin())) {
      return { error: "Somente um administrador pode desativar outro administrador." };
    }

    await db.update(users)
      .set({ active: ativo, updatedAt: new Date() })
      .where(eq(users.id, id))
      ;

    revalidarUsuarios();
    return { ok: true };
  } catch (error) {
    return { error: mensagemDeErro(error) };
  }
}

/* ------------------------------------------------------------------ */
/* Exclusão                                                            */
/* ------------------------------------------------------------------ */

export async function deleteUserAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  try {
    await ensurePermission("usuarios", "delete");

    const id = Number(formData.get("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return { error: "Usuário inválido." };
    }

    const [alvo] = await db.select().from(users).where(eq(users.id, id));
    if (!alvo) return { error: "Usuário não encontrado." };

    if (alvo.id === (await currentUserId())) {
      return { error: "Você não pode excluir sua própria conta." };
    }
    if (alvo.role === "admin") {
      if (!(await isAdmin())) {
        return { error: "Somente um administrador pode excluir outro administrador." };
      }
      if (await eUnicoAdmin(id)) {
        return { error: "O sistema precisa de pelo menos um administrador." };
      }
    }

    await db.delete(users).where(eq(users.id, id));

    revalidarUsuarios();
    return { ok: true };
  } catch (error) {
    return { error: mensagemDeErro(error) };
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

async function isAdmin(): Promise<boolean> {
  const { getAuthorizedUser } = await import("@/lib/auth/permissions");
  const user = await getAuthorizedUser();
  return user?.role === "admin";
}

async function currentUserId(): Promise<number | null> {
  const { getAuthorizedUser } = await import("@/lib/auth/permissions");
  return (await getAuthorizedUser())?.id ?? null;
}

async function eUnicoAdmin(idExcluido?: number): Promise<boolean> {
  const condicoes = [eq(users.role, "admin"), eq(users.active, true)];
  if (typeof idExcluido === "number") {
    condicoes.push(ne(users.id, idExcluido));
  }
  const [total] = await db
    .select({ total: count() })
    .from(users)
    .where(and(...condicoes));
  return (total?.total ?? 0) === 0;
}

function mensagemDeErro(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Falha inesperada. Tente novamente.";
}

export type UserListItem = {
  id: number;
  name: string;
  email: string;
  role: string;
  active: boolean;
  permissions: Record<string, string[]>;
  createdAt: Date;
};

/** Lista completa para a tela (campos sensíveis ficam fora). */
export async function listUsers(): Promise<UserListItem[]> {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      active: users.active,
      permissions: users.permissions,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(users.name);

  return rows.map((row) => ({
    ...row,
    permissions: normalize(row.permissions),
  }));
}

function normalize(value: unknown): Record<string, string[]> {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Record<string, string[]>;
    } catch {
      return {};
    }
  }
  if (value && typeof value === "object") return value as Record<string, string[]>;
  return {};
}

export type { PermissionAction, PermissionModule };
