import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";

/**
 * Healthcheck para o painel (readiness e smoke test pós-deploy).
 *
 * Não basta responder 200: o processo pode estar no ar e o banco inacessível,
 * que é justamente o cenário em que as telas quebram. A consulta é trivial
 * (`select 1`) e não toca em tabela nenhuma.
 *
 * Sempre `no-store`: um 200 em cache esconderia a queda do banco.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const inicio = Date.now();
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json(
      { ok: true, banco: "ok", ms: Date.now() - inicio },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (erro) {
    return NextResponse.json(
      {
        ok: false,
        banco: "inacessivel",
        erro: erro instanceof Error ? erro.message : String(erro),
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}