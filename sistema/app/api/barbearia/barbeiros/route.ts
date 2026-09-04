import { NextResponse } from "next/server";

import { listarBarbeiros } from "@/lib/barbearia/repositorio";

export async function GET() {
  try {
    const barbeiros = await listarBarbeiros();
    return NextResponse.json(barbeiros);
  } catch (erro) {
    console.error("[BARBOS] GET /api/barbearia/barbeiros:", erro);
    return NextResponse.json(
      { erro: "Não foi possível carregar a equipe." },
      { status: 500 },
    );
  }
}
