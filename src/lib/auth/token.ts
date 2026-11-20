import { SignJWT, jwtVerify, type JWTPayload } from "jose";

import type { UserRole } from "@/lib/db/schema";

export const SESSION_COOKIE = "jh7_session";
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 dias

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  /** Resumo informativo; a autorização sempre vem do banco (ver permissions.ts). */
  permissions?: Record<string, string[]>;
};

type SessionPayload = JWTPayload & {
  name: string;
  email: string;
  role: UserRole;
};

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET ausente ou curto demais. Defina em .env.local (32+ caracteres).",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ name: user.name, email: user.email, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecret());
}

/** Verifica o token sem tocar em cookies/banco — seguro no proxy. */
export async function verifySessionToken(
  token: string,
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, getSecret(), {
      algorithms: ["HS256"],
    });
    const id = Number(payload.sub);
    if (!Number.isFinite(id) || !payload.email || !payload.role) return null;
    return {
      id,
      name: payload.name,
      email: payload.email,
      role: payload.role,
    };
  } catch {
    return null;
  }
}
