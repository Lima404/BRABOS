import Link from "next/link";

import { ListaRotas } from "@/components/navegacao/lista-rotas";
import { Logo } from "@/components/marca/logo";

/**
 * Sidebar fixa do desktop. No celular ela nao existe — la o mesmo conteudo
 * vira drawer (components/navegacao/menu-mobile.tsx).
 *
 * Sem sessao ela nao aparece: quem chega pela loja e cliente da barbearia, e
 * uma coluna de links que so levam a tela de login nao serve pra nada.
 */
export function Sidebar({
  logado,
  nomeBarbearia,
}: {
  logado: boolean;
  nomeBarbearia?: string;
}) {
  if (!logado) return null;

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-card lg:flex">
      <div className="border-b border-border p-4">
        <Link
          href="/agenda"
          aria-label="BARBOS — ir para a agenda"
          className="inline-flex rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Logo largura={132} />
        </Link>
        {nomeBarbearia ? (
          <p className="mt-2 truncate text-sm text-muted-foreground">
            {nomeBarbearia}
          </p>
        ) : null}
      </div>

      <ListaRotas className="p-3" logado={logado} />
    </aside>
  );
}
