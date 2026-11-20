import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { db } from "@/lib/db";
import {
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  users,
  type PermissionAction,
  type PermissionModule,
} from "@/lib/db/schema";
import { getSession, type SessionUser } from "./session";

export type PermissionSet = Partial<Record<PermissionModule, PermissionAction[]>>;

export const ALL_PERMISSIONS: PermissionSet = Object.fromEntries(
  PERMISSION_MODULES.map((module) => [module, [...PERMISSION_ACTIONS]]),
) as PermissionSet;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parse e allowlist da ACL: valores corrompidos ou desconhecidos negam acesso. */
export function normalizePermissions(value: unknown): PermissionSet {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (!isRecord(parsed)) return {};

  const result: PermissionSet = {};
  for (const modulo of PERMISSION_MODULES) {
    const actions = parsed[modulo];
    if (!Array.isArray(actions)) continue;
    const valid = actions.filter(
      (action): action is PermissionAction =>
        typeof action === "string" &&
        (PERMISSION_ACTIONS as readonly string[]).includes(action),
    );
    if (valid.length > 0) result[modulo] = [...new Set(valid)];
  }
  return result;
}

export function hasPermission(
  permissions: unknown,
  module: PermissionModule,
  action: PermissionAction,
): boolean {
  return normalizePermissions(permissions)[module]?.includes(action) ?? false;
}

export type AuthorizedUser = SessionUser & {
  active: boolean;
  permissions: PermissionSet;
};

/** Sempre lê o estado atual do banco; não usa role/ACL potencialmente stale no JWT. */
export async function getAuthorizedUser(): Promise<AuthorizedUser | null> {
  const session = await getSession();
  if (!session) return null;

  const [row] = await db.select().from(users).where(eq(users.id, session.id));
  if (!row?.active) return null;

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as SessionUser["role"],
    active: row.active,
    permissions: normalizePermissions(row.permissions),
  };
}

export async function requirePermission(
  module: PermissionModule,
  action: PermissionAction,
): Promise<AuthorizedUser> {
  const user = await getAuthorizedUser();
  if (!user) redirect("/login");
  if (user.role === "admin") return user;
  if (!hasPermission(user.permissions, module, action)) notFound();
  return user;
}

/** Preserves strong administrator-only boundary for system administration. */
export async function requireAdmin(): Promise<AuthorizedUser> {
  const user = await getAuthorizedUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") notFound();
  return user;
}

/** Authorization for form/server actions where redirect semantics aren't suitable. */
export async function currentUserHasPermission(
  module: PermissionModule,
  action: PermissionAction,
): Promise<boolean> {
  const user = await getAuthorizedUser();
  return Boolean(
    user && (user.role === "admin" || hasPermission(user.permissions, module, action)),
  );
}

export type PermissionSubject = {
  role: string;
  permissions: unknown;
};

export function userHasPermission(
  user: PermissionSubject,
  module: PermissionModule,
  action: PermissionAction,
): boolean {
  if (user.role === "admin") return true;
  return hasPermission(user.permissions, module, action);
}
