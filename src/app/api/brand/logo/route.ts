import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

import { UPLOAD_DIR } from "@/lib/paths";

const TIPOS: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
};

/**
 * Serve o logotipo enviado em /configuracoes.
 * Sem upload, responde 404 e o componente <Logo> usa o padrão de /public.
 */
export async function GET() {
  const dir = UPLOAD_DIR;

  for (const [ext, tipo] of Object.entries(TIPOS)) {
    const arquivo = path.join(dir, `logo.${ext}`);
    if (!existsSync(arquivo)) continue;

    const bytes = readFileSync(arquivo);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": tipo,
        "Cache-Control": "public, max-age=60, must-revalidate",
      },
    });
  }

  return new NextResponse("Logotipo não enviado", { status: 404 });
}
