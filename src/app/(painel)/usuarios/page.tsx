import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requirePermission } from "@/lib/auth/permissions";
import { listUsers } from "./actions";
import { UsersClient } from "./users-client";

export const metadata: Metadata = { title: "Usuários" };
export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const usuario = await requirePermission("usuarios", "view");
  const usuarios = await listUsers();

  const podeCriar =
    usuario.role === "admin" ||
    (usuario.permissions.usuarios?.includes("create") ?? false);
  const podeEditar =
    usuario.role === "admin" ||
    (usuario.permissions.usuarios?.includes("edit") ?? false);
  const podeExcluir =
    usuario.role === "admin" ||
    (usuario.permissions.usuarios?.includes("delete") ?? false);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href="/painel"
          className="inline-flex items-center gap-1.5 text-sm text-dim transition-colors hover:text-white"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar ao painel
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Usuários
          </h1>
          <p className="mt-1 text-sm text-dim">
            Equipe com acesso ao sistema e as permissões de cada pessoa.
          </p>
        </div>
      </div>

      <UsersClient
        usuarios={usuarios}
        currentUserId={usuario.id}
        isAdmin={usuario.role === "admin"}
        podeCriar={podeCriar}
        podeEditar={podeEditar}
        podeExcluir={podeExcluir}
      />
    </div>
  );
}
