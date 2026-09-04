import type { Metadata } from "next";
import Link from "next/link";
import { Info } from "lucide-react";

import { FormularioLogin } from "@/app/entrar/formulario-login";
import { Logo } from "@/components/marca/logo";
import { supabaseConfigurado } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Entrar" };

/**
 * Recados vindos do callback de confirmacao (app/auth/confirmar/route.ts).
 * Cada um diz o que houve E o que fazer agora.
 */
const AVISOS: Record<string, string> = {
  "outro-aparelho":
    "Sua conta foi confirmada. Como o link abriu em outro aparelho, entre com e-mail e senha aqui.",
  "link-invalido":
    "Esse link de confirmação expirou ou já foi usado. Se a conta já está ativa, é só entrar.",
  "sem-configuracao":
    "O sistema ainda não está conectado ao banco. Avise o responsável técnico.",
};

export default async function EntrarPage({
  searchParams,
}: PageProps<"/entrar">) {
  const { proximo, aviso } = await searchParams;
  const destino = typeof proximo === "string" ? proximo : "/agenda";
  const mensagem = typeof aviso === "string" ? AVISOS[aviso] : undefined;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo largura={168} />
          <p className="text-muted-foreground">
            A agenda da sua barbearia, sem caderno.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h1 className="mb-6 text-xl font-semibold">Entrar</h1>

          {mensagem ? (
            <p className="mb-5 flex items-start gap-2 rounded-lg bg-agendado-fundo px-4 py-3 text-sm font-medium text-agendado">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {mensagem}
            </p>
          ) : null}

          {supabaseConfigurado ? (
            <FormularioLogin proximo={destino} />
          ) : (
            <div className="space-y-3 rounded-lg bg-atendendo-fundo px-4 py-3 text-sm">
              <p className="font-semibold text-atendendo">
                Supabase ainda não conectado
              </p>
              <p className="text-muted-foreground">
                Crie o arquivo <code className="font-mono">.env.local</code> a
                partir de <code className="font-mono">.env.local.example</code>{" "}
                e preencha as duas chaves do projeto. O login liga sozinho
                depois disso.
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 space-y-2 text-center text-sm text-muted-foreground">
          <p>
            Esqueceu a senha?{" "}
            <Link
              href="/recuperar-senha"
              className="font-semibold text-accent-foreground underline-offset-4 hover:underline"
            >
              Recuperar acesso
            </Link>
          </p>
          <p>
            Ainda não tem conta?{" "}
            <Link
              href="/cadastrar"
              className="font-semibold text-accent-foreground underline-offset-4 hover:underline"
            >
              Cadastrar barbearia
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
