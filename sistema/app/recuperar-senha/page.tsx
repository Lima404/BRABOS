import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { FormularioRecuperacao } from "@/app/recuperar-senha/formulario-recuperacao";
import { Logo } from "@/components/marca/logo";
import { Button } from "@/components/ui/button";
import { supabaseConfigurado } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Recuperar acesso" };

export default function RecuperarSenhaPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Logo largura={168} className="mb-8 justify-center" />

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h1 className="mb-5 text-xl font-semibold">Recuperar acesso</h1>

          {supabaseConfigurado ? (
            <FormularioRecuperacao />
          ) : (
            <div className="space-y-3 rounded-lg bg-atendendo-fundo px-4 py-3 text-sm">
              <p className="font-semibold text-atendendo">
                Supabase ainda não conectado
              </p>
              <p className="text-muted-foreground">
                Sem as chaves do projeto não há como enviar e-mail. Preencha o{" "}
                <code className="font-mono">.env.local</code> e recarregue.
              </p>
            </div>
          )}
        </div>

        {!supabaseConfigurado ? (
          <Button asChild variant="secondary" size="lg" className="mt-6 w-full">
            <Link href="/entrar">
              <ArrowLeft />
              Voltar para o login
            </Link>
          </Button>
        ) : (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Lembrou a senha?{" "}
            <Link
              href="/entrar"
              className="font-semibold text-accent-foreground underline-offset-4 hover:underline"
            >
              Voltar para o login
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
