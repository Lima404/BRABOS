import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Logo } from "@/components/marca/logo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Recuperar acesso" };

export default function RecuperarSenhaPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm text-center">
        <Logo largura={168} className="mb-8 justify-center" />
        <div className="rounded-xl border border-border bg-card p-6">
          <h1 className="text-xl font-semibold">Recuperar acesso</h1>
          <p className="mt-2 text-muted-foreground">
            Ainda não implementado. Por enquanto, redefina a senha pelo painel
            do Supabase.
          </p>
          <Button asChild variant="secondary" size="lg" className="mt-6 w-full">
            <Link href="/entrar">
              <ArrowLeft />
              Voltar para o login
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
