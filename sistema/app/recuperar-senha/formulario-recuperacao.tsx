"use client";

import { useActionState, useId } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, MailCheck, Send } from "lucide-react";

import {
  pedirRecuperacao,
  type EstadoRecuperacao,
} from "@/app/recuperar-senha/acoes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INICIAL: EstadoRecuperacao = {};

export function FormularioRecuperacao() {
  const [estado, acao, enviando] = useActionState(pedirRecuperacao, INICIAL);
  const idEmail = useId();
  const idErro = useId();

  // Pedido aceito. A tela TROCA em vez de mostrar um aviso acima do
  // formulário: com o campo ainda ali, a reação natural é achar que não
  // enviou e clicar de novo — e cada clique gasta o limite de e-mail do
  // Supabase, que é por hora.
  if (estado.enviadoPara) {
    return (
      <div className="space-y-5 text-center">
        <MailCheck
          className="mx-auto size-10 text-concluido"
          aria-hidden="true"
        />
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Confira seu e-mail</h2>
          <p className="text-muted-foreground">
            Se existe uma conta em{" "}
            <strong className="break-all text-foreground">
              {estado.enviadoPara}
            </strong>
            , o link para criar uma senha nova acabou de sair.
          </p>
          <p className="text-sm text-muted-foreground">
            O link vale por uma hora e só pode ser usado uma vez. Se não
            chegar, olhe no spam.
          </p>
        </div>
        <Button asChild variant="secondary" size="lg" className="w-full">
          <Link href="/entrar">
            <ArrowLeft />
            Voltar para o login
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={acao} className="space-y-5" noValidate>
      {estado.erro ? (
        <p
          id={idErro}
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-faltou-fundo px-4 py-3 text-sm font-medium text-faltou"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {estado.erro}
        </p>
      ) : null}

      <p className="text-muted-foreground">
        Digite o e-mail da conta. Mandamos um link para você criar uma senha
        nova.
      </p>

      <div className="space-y-2">
        <Label htmlFor={idEmail}>E-mail</Label>
        <Input
          id={idEmail}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          autoFocus
          aria-describedby={estado.erro ? idErro : undefined}
          placeholder="voce@suabarbearia.com.br"
        />
      </div>

      {/* O unico botao ambar da tela. */}
      <Button type="submit" size="lg" className="w-full" disabled={enviando}>
        <Send />
        {enviando ? "Enviando…" : "Enviar link"}
      </Button>
    </form>
  );
}
