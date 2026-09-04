import { NextResponse } from "next/server";

import { listarAgendamentosDoMes } from "@/lib/agenda/repositorio";

/** GET /api/agenda?mes=AAAA-MM */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mes = searchParams.get("mes");

  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
    return NextResponse.json(
      { erro: "Parâmetro 'mes' deve estar no formato AAAA-MM." },
      { status: 400 },
    );
  }

  return NextResponse.json(await listarAgendamentosDoMes(mes));
}
