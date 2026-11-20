"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/lib/db";
import { users, type UserRole } from "@/lib/db/schema";
import { getAuthorizedUser } from "./permissions";
import { verifyPassword } from "./password";
import { createSessionCookie, destroySession } from "./session";

export type LoginState = {
  error?: string;
  /** Devolvido ao formulário para não perder o que já foi digitado. */
  email?: string;
};

const loginSchema = z.object({
  email: z.string().trim().min(1, "Informe o e-mail.").email("E-mail inválido."),
  password: z.string().min(1, "Informe a senha."),
  next: z.string().optional(),
});

/** Trava simples contra tentativas repetidas (por e-mail, em memória). */
const attempts = new Map<string, { count: number; blockedUntil: number }>();
const MAX_ATTEMPTS = 8;
const BLOCK_MS = 60_000;

function isBlocked(key: string): boolean {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (entry.blockedUntil > Date.now()) return true;
  if (entry.blockedUntil !== 0) attempts.delete(key);
  return false;
}

function registerFailure(key: string) {
  const entry = attempts.get(key) ?? { count: 0, blockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.blockedUntil = Date.now() + BLOCK_MS;
    entry.count = 0;
  }
  attempts.set(key, entry);
}

function clearFailures(key: string) {
  attempts.delete(key);
}

/** Só aceita caminhos internos — evita redirecionamento aberto. */
function safeNext(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/painel";
  return next;
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
      email: String(formData.get("email") ?? ""),
    };
  }

  const email = parsed.data.email.toLowerCase();

  if (isBlocked(email)) {
    return {
      error: "Muitas tentativas. Aguarde um minuto e tente novamente.",
      email: parsed.data.email,
    };
  }

  const user = db.select().from(users).where(eq(users.email, email)).get();

  const senhaOk =
    user && user.active
      ? await verifyPassword(parsed.data.password, user.passwordHash)
      : false;

  if (!user || !user.active || !senhaOk) {
    registerFailure(email);
    return { error: "E-mail ou senha inválidos.", email: parsed.data.email };
  }

  clearFailures(email);

  await createSessionCookie({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
  });

  redirect(safeNext(parsed.data.next ?? undefined));
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

export async function currentUser() {
  return getAuthorizedUser();
}
