import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db, hostDoBanco } from "@/lib/db";

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
  // Identifica o build em produção. O painel já serviu código antigo depois de
  // um deploy (build não refeito), e o sintoma era um erro que só existia na
  // versão anterior. Com o selo dá para saber, sem adivinhação, qual build está
  // vivo — `BUILD_ID` muda a cada `next build`.
  const build = {
    buildId: process.env.BUILD_ID ?? "desconhecido",
    versao: process.env.npm_package_version ?? "?",
  };

  try {
    await db.execute(sql`select 1`);
    return NextResponse.json(
      { ok: true, banco: "ok", ms: Date.now() - inicio, ...build },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (erro) {
    // A mensagem do driver vem sem detalhe útil ("Failed query: select 1").
    // O host do banco é o que resolve o problema na prática, então vai no corpo.
    const host = hostDoBanco();
    const causa = (erro as { cause?: { message?: string } })?.cause?.message;
    console.error(`[health] banco inacessível em ${host}:`, causa ?? erro);

    return NextResponse.json(
      {
        ok: false,
        banco: "inacessivel",
        host,
        erro: causa ?? "falha ao consultar o banco",
        dica: "Confira se o host responde e se a allowlist do banco aceita o IP deste servidor.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}