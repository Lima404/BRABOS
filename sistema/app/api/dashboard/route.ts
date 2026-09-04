import { NextResponse } from "next/server";

import type { IntervaloDashboard } from "@/lib/dashboard/filtros";
import { obterResumoDashboard } from "@/lib/dashboard/repositorio";

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** GET /api/dashboard?inicio=&fim=&servicos=&barbeiros=&soLoja= */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const inicio = searchParams.get("inicio");
  const fim = searchParams.get("fim");

  // Compat: ?mes=AAAA-MM ainda funciona (prefetch antigo / favoritos).
  const mes = searchParams.get("mes");
  let intervalo: IntervaloDashboard;

  if (inicio && fim && DATA.test(inicio) && DATA.test(fim) && fim > inicio) {
    intervalo = {
      inicio,
      fim,
      servicoIds: ids(searchParams.get("servicos")),
      barbeiroIds: ids(searchParams.get("barbeiros")),
      produtoIds: ids(searchParams.get("produtos")),
      soLoja: searchParams.get("soLoja") === "1",
    };
  } else if (mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
    const [ano, m] = mes.split("-").map(Number);
    const fimMes = new Date(ano, m, 1);
    intervalo = {
      inicio: `${mes}-01`,
      fim: `${fimMes.getFullYear()}-${String(fimMes.getMonth() + 1).padStart(2, "0")}-01`,
      servicoIds: [],
      barbeiroIds: [],
      produtoIds: [],
      soLoja: false,
    };
  } else {
    return NextResponse.json(
      {
        erro:
          "Informe inicio e fim (AAAA-MM-DD, fim exclusivo) ou mes (AAAA-MM).",
      },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await obterResumoDashboard(intervalo));
  } catch (erro) {
    const mensagem =
      erro instanceof Error ? erro.message : "Falha ao carregar o dashboard.";
    return NextResponse.json({ erro: mensagem }, { status: 500 });
  }
}

function ids(bruto: string | null): string[] {
  if (!bruto) return [];
  return bruto
    .split(",")
    .map((s) => s.trim())
    .filter((s) => UUID.test(s));
}
