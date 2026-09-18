"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
} from "lucide-react";

import {
  redefinirSenha,
  type EstadoNovaSenha,
} from "@/app/redefinir-senha/acoes";
import { SENHA_MINIMA } from "@/lib/auth/senha";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INICIAL: EstadoNovaSenha = {};

export function FormularioNovaSenha() {
  const [estado, acao, enviando] = useActionState(redefinirSenha, INICIAL);
  const [mostrar, setMostrar] = useState(false);
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const idSenha = useId();
  const idConfirmacao = useId();
  const idErro = useId();
  const idAjuda = useId();
  const idDiferentes = useId();

  const curta = senha.length > 0 && senha.length < SENHA_MINIMA;
  // Só reclama depois que a segunda senha começou a ser digitada — avisar
  // "não conferem" na primeira tecla é ruído, não ajuda.
  const diferentes = confirmacao.length > 0 && senha !== confirmacao;

  if (estado.pronto) {
    return (
      <div className="space-y-5 text-center">
        <ShieldCheck
          className="mx-auto size-10 text-concluido"
          aria-hidden="true"
        />
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Senha trocada</h2>
          <p className="text-muted-foreground">
            É essa que você vai usar da próxima vez que entrar. As sessões
            abertas em outros aparelhos foram encerradas.
          </p>
        </div>
        <Button asChild size="lg" className="w-full">
          <Link href="/agenda">Ir para a agenda</Link>
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
        <Label htmlFor={idSenha}>Senha nova</Label>
        <div className="relative">
          <Input
            id={idSenha}
            name="senha"
            type={mostrar ? "text" : "password"}
            autoComplete="new-password"
            required
            autoFocus
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            aria-describedby={idAjuda}
            aria-invalid={curta || undefined}
            className="pr-14"
          />
          {/* Um botão só para os dois campos: o olho é a mesma decisão
              ("quero ver o que estou digitando"), e dois controles iguais
              lado a lado fariam a pessoa achar que são coisas diferentes. */}
          <button
            type="button"
            onClick={() => setMostrar((v) => !v)}
            aria-label={mostrar ? "Ocultar senhas" : "Mostrar senhas"}
            className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {mostrar ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
        <p
          id={idAjuda}
          className={
            curta ? "text-sm font-medium text-faltou" : "text-sm text-muted-foreground"
          }
        >
          Pelo menos {SENHA_MINIMA} caracteres.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={idConfirmacao}>Repita a senha nova</Label>
        <Input
          id={idConfirmacao}
          name="confirmacao"
          type={mostrar ? "text" : "password"}
          autoComplete="new-password"
          required
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
          aria-describedby={diferentes ? idDiferentes : undefined}
          aria-invalid={diferentes || undefined}
        />
        {diferentes ? (
          <p id={idDiferentes} className="text-sm font-medium text-faltou">
            As duas senhas não são iguais.
          </p>
        ) : confirmacao.length > 0 ? (
          <p className="flex items-center gap-1.5 text-sm font-medium text-concluido">
            <Check className="size-4 shrink-0" aria-hidden="true" />
            As senhas conferem.
          </p>
        ) : null}
      </div>

      {/* O unico botao ambar da tela. */}
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={enviando || curta || diferentes || senha.length === 0}
      >
        <KeyRound />
        {enviando ? "Salvando…" : "Salvar senha nova"}
      </Button>
    </form>
  );
}
