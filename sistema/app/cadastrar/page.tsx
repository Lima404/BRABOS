import type { Metadata } from "next";
import Link from "next/link";

import { FormularioCadastro } from "@/app/cadastrar/formulario-cadastro";
import { Logo } from "@/components/marca/logo";
import { supabaseConfigurado } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Criar conta" };

export default function CadastrarPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo largura={168} />
          <p className="text-muted-foreground">
            Crie a conta da sua barbearia. Leva um minuto.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          {supabaseConfigurado ? (
            <>
              <h1 className="mb-6 text-xl font-semibold">Criar conta</h1>
              <FormularioCadastro />
            </>
          ) : (
            <div className="space-y-3 rounded-lg bg-atendendo-fundo px-4 py-3 text-sm">
              <p className="font-semibold text-atendendo">
                Supabase ainda não conectado
              </p>
              <p className="text-muted-foreground">
                Preencha <code className="font-mono">.env.local</code> com a URL
                e a chave do projeto para liberar o cadastro.
              </p>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link
            href="/entrar"
            className="font-semibold text-accent-foreground underline-offset-4 hover:underline"
          >
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
