"use client";

import { useEffect, useState } from "react";
import { RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TONS } from "@/components/ui/tons";
import {
  ehErroDeVersaoAntiga,
  podeRecarregar,
  recarregar,
} from "@/lib/erro-de-versao";
import { cn } from "@/lib/utils";

/**
 * O que aparece quando uma tela estoura sem tratamento.
 *
 * Antes dela existir, quem via isso era a página padrão do Next, em
 * inglês ("This page couldn't load"). Usada por `app/global-error.tsx` e
 * `app/(sistema)/error.tsx`.
 *
 * **Erro de versão antiga recarrega sozinho, uma vez** (ver
 * `lib/erro-de-versao.ts`). Enquanto isso a tela diz "Atualizando…" em vez
 * de mostrar o erro: a pessoa não tem nada a fazer, e um aviso de erro
 * piscando meio segundo antes de sumir assusta à toa.
 *
 * **Qualquer outro erro mostra "Tentar de novo"**, que chama o `retry()`
 * do Next: ele busca a tela de novo no servidor e, se der certo, troca
 * esta tela pelo conteúdo. A frase não acusa a internet, porque o
 * problema pode ser o servidor (regra do AGENTS.md).
 */
export function TelaDeErro({
  error,
  retry,
  className,
}: {
  error: Error & { digest?: string };
  retry: () => void;
  className?: string;
}) {
  // Decidido no primeiro desenho, para o erro de versão nunca mostrar a
  // tela de erro antes de recarregar. Se a trava contra laço recusar, o
  // erro não era de versão — e a tela de erro aparece direto.
  const [atualizando] = useState(
    () => ehErroDeVersaoAntiga(error) && podeRecarregar(),
  );

  useEffect(() => {
    // O original vai para o console: em produção a mensagem de erro de
    // componente de servidor chega trocada, e o `digest` é o que liga
    // este erro à linha do log da Vercel.
    console.error("[BARBOS] tela com erro:", error, error.digest ?? "");

    if (atualizando) recarregar();
  }, [error, atualizando]);

  if (atualizando) {
    return (
      <div
        role="status"
        className={cn(
          "flex flex-col items-center justify-center gap-3 px-4 py-16 text-center",
          className,
        )}
      >
        <RotateCw
          className="size-6 animate-spin text-muted-foreground motion-reduce:animate-none"
          aria-hidden="true"
        />
        <p className="text-base font-medium">Atualizando o BARBOS…</p>
      </div>
    );
  }

  const { icone: Icone, texto } = TONS.erro;

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center px-4 py-16 text-center",
        className,
      )}
    >
      <Icone className={cn("size-8", texto)} aria-hidden="true" />

      <h1 className="mt-4 text-xl font-semibold">
        Não foi possível abrir esta tela
      </h1>
      <p className="mt-2 max-w-sm text-base text-muted-foreground">
        Algo falhou ao carregar. Tente de novo; se continuar, feche e abra o
        BARBOS.
      </p>

      <Button size="lg" className="mt-6 w-full sm:w-auto" onClick={retry}>
        <RotateCw />
        Tentar de novo
      </Button>
    </div>
  );
}
