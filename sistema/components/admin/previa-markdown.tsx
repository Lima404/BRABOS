"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";

/** Dica curta que vai na ajuda de todo campo de texto das notificações. */
export const DICA_DE_MARKDOWN =
  "Aceita markdown: ### título, **negrito**, *itálico*, - lista, [texto](link).";

/**
 * "Como a barbearia vai ler", logo abaixo do campo de texto.
 *
 * O texto das notificações é escrito em markdown e só vira formatação na
 * tela de quem lê. Sem prévia, um `**` esquecido só seria descoberto
 * depois de publicado — e publicar é imediato, para todas as barbearias.
 *
 * Começa FECHADA: aberta por padrão, o modal dobraria de altura com cada
 * seção do patch note. O campo continua na tela com a prévia aberta, para
 * corrigir olhando o resultado.
 */
export function PreviaMarkdown({ texto }: { texto: string }) {
  const [aberta, setAberta] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="ghost"
        className="self-start"
        aria-expanded={aberta}
        onClick={() => setAberta((v) => !v)}
      >
        {aberta ? <EyeOff /> : <Eye />}
        {aberta ? "Esconder prévia" : "Ver como fica"}
      </Button>

      {aberta ? (
        <div className="rounded-md border border-dashed border-border bg-card p-4">
          {texto.trim() ? (
            <Markdown>{texto}</Markdown>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nada escrito ainda.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
