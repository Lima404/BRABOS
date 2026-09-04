"use client";

import { useActionState, useId, useState } from "react";
import { AlertTriangle, Eye, EyeOff, LogIn } from "lucide-react";

import { entrar, type EstadoLogin } from "@/app/entrar/acoes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INICIAL: EstadoLogin = {};

export function FormularioLogin({ proximo }: { proximo: string }) {
  const [estado, acao, enviando] = useActionState(entrar, INICIAL);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const idEmail = useId();
  const idSenha = useId();
  const idErro = useId();

  return (
    <form action={acao} className="space-y-5" noValidate>
      <input type="hidden" name="proximo" value={proximo} />

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
          aria-describedby={estado.erro ? idErro : undefined}
          placeholder="voce@suabarbearia.com.br"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={idSenha}>Senha</Label>
        <div className="relative">
          <Input
            id={idSenha}
            name="senha"
            type={mostrarSenha ? "text" : "password"}
            autoComplete="current-password"
            required
            aria-describedby={estado.erro ? idErro : undefined}
            className="pr-14"
          />
          {/* Ver a senha importa: tela suja, dedo molhado, senha longa. */}
          <button
            type="button"
            onClick={() => setMostrarSenha((v) => !v)}
            aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
            className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {mostrarSenha ? (
              <EyeOff className="size-5" />
            ) : (
              <Eye className="size-5" />
            )}
          </button>
        </div>
      </div>

      {/* O unico botao ambar da tela. */}
      <Button type="submit" size="lg" className="w-full" disabled={enviando}>
        <LogIn />
        {enviando ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
