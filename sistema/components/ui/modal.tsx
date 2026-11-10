"use client";

import * as React from "react";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * O modal padrão do BARBOS.
 *
 * `dialog.tsx` é o primitivo (Radix + estilo). Este é o formato: cabeçalho
 * fixo, corpo que rola, rodapé colado embaixo. Toda tela que abrir modal usa
 * ESTE componente — assim largura, rolagem, alvo de toque e comportamento no
 * celular são decididos uma vez só, aqui.
 *
 * Regras que ele carrega sozinho:
 *   - No celular ocupa quase a tela inteira; a largura escolhida só vale de
 *     `sm` pra cima. Modal estreito no telefone desperdiça a única tela que o
 *     barbeiro tem na mão.
 *   - O rodapé nunca sai de vista, nem com o corpo cheio: quem rola é o meio.
 *     E respeita a faixa do iPhone (`safe-area-inset-bottom`).
 *   - `aoVoltar` transforma o modal em passo de fluxo: em vez de empilhar um
 *     segundo modal por cima, o conteúdo TROCA e a seta volta. Modal sobre
 *     modal no celular vira armadilha de dois "voltar".
 *   - No celular o rodapé empilha na ordem invertida, então a ação principal
 *     fica embaixo — onde o polegar alcança.
 *
 * Exemplo:
 *
 * ```tsx
 * <Modal
 *   aberto={aberto}
 *   aoMudarAberto={setAberto}
 *   titulo="Configurar agenda"
 *   descricao="Quando a barbearia atende."
 *   tamanho="grande"
 *   rodape={<Button onClick={salvar}>Salvar</Button>}
 * >
 *   …
 * </Modal>
 * ```
 */

/**
 * Largura de `sm` pra cima. Escolher pelo CONTEÚDO, não pela vontade de
 * caber mais coisa: modal largo com formulário de um campo fica vazio.
 */
export type TamanhoModal = "pequeno" | "medio" | "grande" | "cheio" | "imagem";

const LARGURAS: Record<TamanhoModal, string> = {
  /** Confirmar, avisar, uma pergunta só. */
  pequeno: "sm:max-w-sm",
  /** Formulário curto — três ou quatro campos. */
  medio: "sm:max-w-lg",
  /** Formulário com seções, listas curtas. */
  grande: "sm:max-w-2xl",
  /** Tabela, lista longa, comparação lado a lado. */
  cheio: "sm:max-w-4xl",
  /**
   * Uma foto e nada mais (pedido do Gabriel em 10/11/2026): sem padding,
   * sem borda e sem cabeçalho visível — o modal tem o tamanho da imagem,
   * até o limite da tela. O título continua lá para o leitor de tela.
   * Quem desenha a foto e os controles por cima dela é `VisorDeFotos`.
   */
  imagem: "w-auto max-w-[calc(100vw-1.5rem)] border-0 bg-graf-950",
};

/** O "X" sobre a foto: fundo escuro translúcido, que aparece em qualquer imagem. */
const FECHAR_SOBRE_FOTO =
  "rounded-full bg-graf-950/75 text-graf-50 hover:bg-graf-950/90 hover:text-graf-50 dark:hover:bg-graf-950/90";

export function Modal({
  aberto,
  aoMudarAberto,
  titulo,
  descricao,
  tamanho = "medio",
  aoVoltar,
  rodape,
  children,
  className,
  classNameCorpo,
}: {
  aberto: boolean;
  aoMudarAberto: (aberto: boolean) => void;
  titulo: string;
  descricao?: string;
  tamanho?: TamanhoModal;
  /** Presente = mostra a seta de voltar no cabeçalho (modal em etapas). */
  aoVoltar?: () => void;
  /** Botões do rodapé. Ausente = modal sem rodapé. */
  rodape?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  classNameCorpo?: string;
}) {
  const soImagem = tamanho === "imagem";

  return (
    <Dialog open={aberto} onOpenChange={aoMudarAberto}>
      <DialogContent
        className={cn(LARGURAS[tamanho], className)}
        classNameFechar={soImagem ? FECHAR_SOBRE_FOTO : undefined}
      >
        <DialogHeader
          className={
            soImagem
              ? "sr-only"
              : aoVoltar
                ? "flex-row items-start gap-2 pl-2"
                : undefined
          }
        >
          {aoVoltar ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={aoVoltar}
              aria-label="Voltar"
              className="-mt-1 shrink-0"
            >
              <ChevronLeft />
            </Button>
          ) : null}

          <div className="flex min-w-0 flex-col gap-1">
            <DialogTitle>{titulo}</DialogTitle>
            {descricao ? (
              <DialogDescription>{descricao}</DialogDescription>
            ) : null}
          </div>
        </DialogHeader>

        <DialogBody className={cn(soImagem && "overflow-hidden p-0", classNameCorpo)}>
          {children}
        </DialogBody>

        {rodape ? <DialogFooter>{rodape}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}
