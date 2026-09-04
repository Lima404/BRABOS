import { NextResponse } from "next/server";

import { listarProdutos } from "@/lib/estoque/repositorio";

export async function GET() {
  try {
    const produtos = await listarProdutos();
    return NextResponse.json(produtos);
  } catch (erro) {
    console.error("[BARBOS] GET /api/estoque:", erro);
    return NextResponse.json(
      { erro: "Não foi possível carregar o estoque." },
      { status: 500 },
    );
  }
}
