import { cookies } from "next/headers";

import {
  SESSION_COOKIE,
  SESSION_DURATION_SECONDS,
  signSessionToken,
  verifySessionToken,
  type SessionUser,
} from "./token";

export { SESSION_COOKIE, verifySessionToken };
export type { SessionUser };

export async function createSessionCookie(user: SessionUser): Promise<void> {
  const token = await signSessionToken(user);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // Sem `secure` enquanto o acesso for por HTTP na rede local:
    // o navegador descarta cookies "secure" vindos de http://192.168.x.x.
    secure: false,
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
