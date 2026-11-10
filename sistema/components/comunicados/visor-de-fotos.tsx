"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { FotoDoPatch } from "@/lib/comunicados/tipos";
import { cn } from "@/lib/utils";

/**
 * As fotos de uma seção do patch note, ampliadas num modal. Pedidos do
 * Gabriel em 10/11/2026: primeiro, abrir no modal em vez de outra aba (a
 * barbearia saía do BARBOS para ver um print); depois, o modal SEM padding
 * nem margem, do tamanho da foto.
 *
 * É o `Modal` padrão no modo `imagem`: o modal encolhe até caber a foto,
 * e a foto aparece no tamanho dela — só diminui se passar da tela, sem
 * cortar e sem esticar. Os controles ficam POR CIMA da foto, num fundo
 * escuro translúcido que aparece em qualquer imagem: o "X" (do próprio
 * modal), as setas nas laterais e o contador embaixo.
 *
 * Setas do teclado também passam. Não dá a volta: na primeira e na última
 * a seta daquele lado some, e a pessoa sabe que acabou.
 *
 * `aberto` e `indice` são separados de propósito: ao fechar, o índice
 * continua valendo, e a foto não some no meio da animação de saída.
 */

/** O fundo dos controles sobre a foto. Grafite a 75% dá 7:1 mesmo sobre foto branca. */
const SOBRE_A_FOTO =
  "bg-graf-950/75 text-graf-50 hover:bg-graf-950/90 hover:text-graf-50 dark:hover:bg-graf-950/90";

/** Enquanto a foto não chega (ou se ela falhar), um quadro de tamanho fixo. */
const QUADRO_DE_ESPERA =
  "flex h-[min(50dvh,24rem)] w-[min(calc(100vw-1.5rem),36rem)] flex-col items-center justify-center gap-1 text-sm text-graf-300";

export function VisorDeFotos({
  titulo,
  fotos,
  aberto,
  indice,
  aoFechar,
  aoMudarIndice,
}: {
  /** O nome da seção: "Agenda", "Notificações"… */
  titulo: string;
  fotos: FotoDoPatch[];
  aberto: boolean;
  indice: number;
  aoFechar: () => void;
  aoMudarIndice: (indice: number) => void;
}) {
  const total = fotos.length;
  const atual = Math.min(Math.max(indice, 0), Math.max(total - 1, 0));
  const foto = fotos[atual];
  const varias = total > 1;
  const temAnterior = atual > 0;
  const temProxima = atual < total - 1;

  // Qual foto já carregou e qual falhou, pelo caminho: trocar de foto
  // volta para o quadro de espera até a nova chegar.
  const [carregada, setCarregada] = useState<string | null>(null);
  const [falhou, setFalhou] = useState<string | null>(null);
  const pronta = foto !== undefined && carregada === foto.caminho;
  const quebrada = foto !== undefined && (!foto.url || falhou === foto.caminho);

  useEffect(() => {
    if (!aberto || !varias) return;
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "ArrowLeft" && atual > 0) aoMudarIndice(atual - 1);
      if (evento.key === "ArrowRight" && atual < total - 1) aoMudarIndice(atual + 1);
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberto, varias, atual, total, aoMudarIndice]);

  return (
    <Modal
      aberto={aberto && total > 0}
      aoMudarAberto={(v) => {
        if (!v) aoFechar();
      }}
      titulo={titulo}
      descricao={varias ? `Foto ${atual + 1} de ${total}` : undefined}
      tamanho="imagem"
    >
      <div className="relative">
        {foto && !quebrada ? (
          <Image
            key={foto.caminho}
            src={foto.url}
            alt={`${titulo}: foto ${atual + 1}`}
            // Tamanho natural: largura e altura `auto` no CSS, com o teto da
            // tela. `width/height` 0 só calam o next/image, que exige os dois.
            width={0}
            height={0}
            sizes="100vw"
            unoptimized
            // Escondida não pode ser preguiçosa: o navegador nem baixaria.
            loading="eager"
            onLoad={() => setCarregada(foto.caminho)}
            onError={() => setFalhou(foto.caminho)}
            className={cn(
              "h-auto max-h-[calc(100dvh-1.5rem)] w-auto max-w-[calc(100vw-1.5rem)]",
              pronta ? "block" : "hidden",
            )}
          />
        ) : null}

        {quebrada ? (
          <div className={QUADRO_DE_ESPERA}>
            <ImageOff className="size-5" aria-hidden="true" />
            Foto indisponível. Recarregue a página.
          </div>
        ) : !pronta ? (
          <div className={QUADRO_DE_ESPERA} role="status">
            Carregando a foto…
          </div>
        ) : null}

        {varias && temAnterior ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => aoMudarIndice(atual - 1)}
            aria-label="Foto anterior"
            className={cn("absolute top-1/2 left-2 -translate-y-1/2 rounded-full", SOBRE_A_FOTO)}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
        ) : null}
        {varias && temProxima ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => aoMudarIndice(atual + 1)}
            aria-label="Próxima foto"
            className={cn("absolute top-1/2 right-2 -translate-y-1/2 rounded-full", SOBRE_A_FOTO)}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        ) : null}

        {varias ? (
          <p
            data-numero
            aria-hidden="true"
            className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-graf-950/75 px-3 py-1 text-sm text-graf-50"
          >
            {atual + 1} de {total}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
