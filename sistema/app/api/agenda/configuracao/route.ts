import { NextResponse } from "next/server";

import {
  listarFolgas,
  listarServicos,
  obterConfiguracaoAgenda,
} from "@/lib/agenda/repositorio";

/**
 * GET /api/agenda/configuracao
 *
 * Configuração, cardápio e folgas numa chamada só: a tela precisa dos três
 * juntos e eles mudam juntos (salvar um serviço reordena a legenda; marcar
 * uma folga sombreia um dia do calendário). Na cabeça da dona é tudo "como
 * minha agenda funciona", e é o mesmo modal que edita os três.
 */
export async function GET() {
  const [configuracao, servicos, folgas] = await Promise.all([
    obterConfiguracaoAgenda(),
    listarServicos(),
    listarFolgas(),
  ]);

  return NextResponse.json({ configuracao, servicos, folgas });
}
