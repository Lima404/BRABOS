"use client";

import { useEffect } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { FotoDoPatch } from "@/lib/comunicados/tipos";

/**
 * As fotos de uma seção do patch note, ampliadas num modal. Pedido do
 * Gabriel em 10/11/2026: antes a foto abria noutra aba, e a barbearia
 * saía do BARBOS para ver um print.
 *
 * O `Modal` padrão, no tamanho `cheio` — a regra de não montar diálogo na
 * mão vale aqui também. A foto ocupa 65% da altura da tela e fica inteira
 * (`object-contain`): print de celular em pé e de computador deitado
 * cabem sem cortar.
 *
 * Com mais de uma foto, "Anterior" e "Próxima" no rodapé, e as setas do
 * teclado fazem o mesmo. Não dá a volta: na última, "Próxima" desliga, e
 * a pessoa sabe que acabou.
 *
 * `aberto` e `indice` são separados de propósito: ao fechar, o índice
 * continua valendo, e a foto não some no meio da animação de saída.
 */
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
  const primeira = atual === 0;
  const ultima = atual === total - 1;

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
      tamanho="cheio"
      rodape={
        varias ? (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => aoMudarIndice(atual - 1)}
              disabled={primeira}
            >
              <ChevronLeft aria-hidden="true" />
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => aoMudarIndice(atual + 1)}
              disabled={ultima}
            >
              Próxima
              <ChevronRight aria-hidden="true" />
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="relative h-[65vh] w-full overflow-hidden rounded-lg bg-secondary">
        {foto?.url ? (
          <Image
            key={foto.caminho}
            src={foto.url}
            alt={`${titulo}: foto ${atual + 1}`}
            fill
            unoptimized
            sizes="100vw"
            className="object-contain"
          />
        ) : (
          // Assinatura falhou: o quadro diz o que houve em vez de ficar vazio.
          <div className="flex size-full flex-col items-center justify-center gap-1 text-sm text-muted-foreground">
            <ImageOff className="size-5" aria-hidden="true" />
            Foto indisponível. Recarregue a página.
          </div>
        )}
      </div>
    </Modal>
  );
}
