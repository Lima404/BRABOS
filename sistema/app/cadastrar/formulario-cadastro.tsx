"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Eye, EyeOff, MailCheck, UserPlus } from "lucide-react";

import { criarConta, type EstadoCadastro } from "@/app/cadastrar/acoes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sanitizarNome } from "@/lib/formato";

const INICIAL: EstadoCadastro = {};

export function FormularioCadastro() {
  const [estado, acao, enviando] = useActionState(criarConta, INICIAL);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [nomeBarbearia, setNomeBarbearia] = useState("");
  const idNome = useId();
  const idEmail = useId();
  const idSenha = useId();
  const idErro = useId();
  const idDica = useId();
  const idDicaNome = useId();

  // Cadastro aceito: a tela vira instrução, não formulário.
  if (estado.enviadoPara) {
    return (
      <div className="space-y-4 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-confirmado-fundo">
          <MailCheck className="size-6 text-confirmado" aria-hidden="true" />
        </span>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Confirme seu e-mail</h2>
          <p className="text-sm text-muted-foreground">
            Enviamos um link de confirmação para{" "}
            <strong className="font-semibold text-foreground">
              {estado.enviadoPara}
            </strong>
            . Abra o e-mail e clique no link para ativar a conta.
          </p>
          <p className="text-sm text-muted-foreground">
            Não chegou? Veja no spam ou na lixeira — o e-mail pode levar alguns
            minutos.
          </p>
        </div>

        <Button asChild variant="secondary" size="lg" className="w-full">
          <Link href="/entrar">
            <ArrowLeft />
            Ir para o login
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

      <div className="space-y-2">
        <Label htmlFor={idNome}>Nome da barbearia</Label>
        <Input
          id={idNome}
          name="nomeBarbearia"
          type="text"
          autoComplete="organization"
          required
          maxLength={80}
          value={nomeBarbearia}
          onChange={(e) => setNomeBarbearia(sanitizarNome(e.target.value))}
          aria-describedby={
            estado.erro ? `${idErro} ${idDicaNome}` : idDicaNome
          }
          placeholder="BARBEARIA DO CENTRO"
        />
        <p id={idDicaNome} className="text-sm text-muted-foreground">
          Esse nome vira o endereço da loja pública.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={idEmail}>E-mail da barbearia</Label>
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
          placeholder="contato@suabarbearia.com.br"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={idSenha}>Senha</Label>
        <div className="relative">
          <Input
            id={idSenha}
            name="senha"
            type={mostrarSenha ? "text" : "password"}
            autoComplete="new-password"
            minLength={8}
            required
            aria-describedby={estado.erro ? `${idErro} ${idDica}` : idDica}
            className="pr-14"
          />
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
        <p id={idDica} className="text-sm text-muted-foreground">
          Pelo menos 8 caracteres. Toda a equipe vai usar essa senha.
        </p>
      </div>

      {/* O único botão âmbar da tela. */}
      <Button type="submit" size="lg" className="w-full" disabled={enviando}>
        <UserPlus />
        {enviando ? "Criando conta…" : "Criar conta"}
      </Button>
    </form>
  );
}
