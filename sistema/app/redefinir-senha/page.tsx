import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowLeft, LinkIcon } from "lucide-react";

import { FormularioNovaSenha } from "@/app/redefinir-senha/formulario-nova-senha";
import { Logo } from "@/components/marca/logo";
import { Button } from "@/components/ui/button";
import { COOKIE_RECUPERACAO } from "@/lib/auth/recuperacao";

export const metadata: Metadata = { title: "Criar senha nova" };

/**
 * A segunda metade da recuperação: os dois campos de senha.
 *
 * Fora das rotas abertas do `proxy.ts` de propósito — exige sessão, que o
 * link do e-mail acabou de criar. E exige TAMBÉM o cookie de procedência,
 * porque sessão sozinha não distingue "veio do e-mail" de "estava aberta no
 * balcão" (ver lib/auth/recuperacao.ts).
 */
export default async function RedefinirSenhaPage() {
  const veioDoEmail = Boolean((await cookies()).get(COOKIE_RECUPERACAO));

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Logo largura={168} className="mb-8 justify-center" />

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          {veioDoEmail ? (
            <>
              <h1 className="text-xl font-semibold">Criar senha nova</h1>
              <p className="mt-2 mb-5 text-muted-foreground">
                Depois de salvar, as sessões abertas em outros aparelhos são
                encerradas.
              </p>
              <FormularioNovaSenha />
            </>
          ) : (
            <div className="space-y-5 text-center">
              <LinkIcon
                className="mx-auto size-10 text-muted-foreground"
                aria-hidden="true"
              />
              <div className="space-y-2">
                <h1 className="text-xl font-semibold">
                  Esta página abre pelo e-mail
                </h1>
                <p className="text-muted-foreground">
                  O link de recuperação expirou, já foi usado, ou você chegou
                  aqui por outro caminho. Peça um link novo e clique nele.
                </p>
              </div>
              <Button asChild size="lg" className="w-full">
                <Link href="/recuperar-senha">Pedir um link novo</Link>
              </Button>
              <Button asChild variant="secondary" size="lg" className="w-full">
                <Link href="/agenda">
                  <ArrowLeft />
                  Voltar para a agenda
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
