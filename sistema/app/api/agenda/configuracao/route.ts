import { NextResponse } from "next/server";

import {
  listarServicos,
  obterConfiguracaoAgenda,
} from "@/lib/agenda/repositorio";

/**
 * GET /api/agenda/configuracao
 *
 * Configuração e cardápio numa chamada só: a tela precisa dos dois juntos e
 * eles mudam juntos (salvar um serviço reordena a legenda).
 */
export async function GET() {
  const [configuracao, servicos] = await Promise.all([
    obterConfiguracaoAgenda(),
    listarServicos(),
  ]);

  return NextResponse.json({ configuracao, servicos });
}
