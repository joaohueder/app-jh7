import { redirect } from "next/navigation";

import { getAuthorizedUser, requireAdmin } from "./permissions";
import type { AuthorizedUser } from "./permissions";

export { requireAdmin };

/** Garante sessão válida, conta ativa e carrega ACL atualizada do banco. */
export async function requireUser(): Promise<AuthorizedUser> {
  const user = await getAuthorizedUser();
  if (!user) redirect("/login");
  return user;
}
