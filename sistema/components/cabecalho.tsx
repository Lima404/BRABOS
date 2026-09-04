import Link from "next/link";
import { LogOut } from "lucide-react";

import { sair } from "@/app/entrar/acoes";
import { MenuMobile } from "@/components/navegacao/menu-mobile";
import { Logo } from "@/components/marca/logo";
import { TemaToggle } from "@/components/tema-toggle";
import { Button } from "@/components/ui/button";
import { supabaseConfigurado } from "@/lib/supabase/config";

/**
 * Barra superior.
 *
 * No celular carrega o hamburguer e a logo. No desktop a logo vive na sidebar,
 * entao aqui sobra so o nome da barbearia — sem repetir a marca duas vezes na
 * mesma tela.
 *
 * Sem sessao (alguem que abriu a loja pelo QR code) muda de papel: a logo
 * aparece nos dois tamanhos de tela, porque nao ha sidebar pra segura-la, e o
 * botao de sair da lugar ao de entrar.
 */
export function Cabecalho({
  logado,
  nomeBarbearia,
}: {
  logado: boolean;
  nomeBarbearia?: string;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-2 px-2 py-2 sm:px-4 sm:py-3 lg:max-w-none">
        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          <MenuMobile logado={logado} nomeBarbearia={nomeBarbearia} />

          {/* Logado, a logo do topo some no desktop: ela ja esta na sidebar.
              Deslogado nao ha sidebar, entao ela fica em toda largura. */}
          <Link
            href={logado ? "/agenda" : "/"}
            aria-label={
              logado ? "BARBOS — ir para a agenda" : "BARBOS — página inicial"
            }
            className={
              logado
                ? "rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:hidden"
                : "ml-1 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            }
          >
            <Logo largura={116} />
          </Link>

          {logado && nomeBarbearia ? (
            <span className="hidden truncate text-sm font-medium text-muted-foreground lg:inline">
              {nomeBarbearia}
            </span>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <TemaToggle />

          {!supabaseConfigurado ? null : logado ? (
            <form action={sair}>
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                aria-label="Sair da conta"
              >
                <LogOut />
              </Button>
            </form>
          ) : (
            // Discreto de propósito: o cliente que veio comprar não precisa
            // de conta, e o âmbar da tela pertence à ação de comprar.
            <Button asChild variant="outline" size="sm">
              <Link href="/entrar">Entrar</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
