import { notFound } from "next/navigation";

import { obterBarbearia } from "@/lib/conta";

/**
 * Porta do Painel Admin (0044).
 *
 * Quem não é admin recebe 404, e não "acesso negado": a tela não existe
 * para as barbearias, e dizer que ela existe já é contar demais.
 *
 * Isto é a porta da TELA. O dado tem outra porta, que não depende desta:
 * as funções `admin_*` do banco recusam quem não é admin, mesmo que alguém
 * chame as ações de servidor direto.
 */
export default async function LayoutAdmin({
  children,
}: {
  children: React.ReactNode;
}) {
  const barbearia = await obterBarbearia();
  if (!barbearia?.admin) notFound();

  return children;
}
