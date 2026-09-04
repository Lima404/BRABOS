import { NextResponse } from "next/server";

import { listarItensDoAgendamento } from "@/lib/agenda/repositorio";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/agenda/comanda?agendamento=<uuid>
 *
 * Os itens que o cliente consumiu naquele atendimento. Rota separada da
 * agenda do mês de propósito: a comanda é lida por um atendimento só, na hora
 * em que o modal abre, e carregar produto de trinta agendamentos junto com o
 * calendário gastaria dados que o barbeiro paga no 4G.
 *
 * Quem limita à barbearia logada é o RLS de `vendas`. O formato do id é
 * conferido aqui para o Postgres não receber texto solto e devolver 500 onde
 * cabia um 400.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agendamento = searchParams.get("agendamento");

  if (!agendamento || !UUID.test(agendamento)) {
    return NextResponse.json(
      { erro: "Parâmetro 'agendamento' deve ser um UUID." },
      { status: 400 },
    );
  }

  return NextResponse.json(await listarItensDoAgendamento(agendamento));
}
