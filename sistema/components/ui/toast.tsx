"use client";

import * as React from "react";
import { Toast as ToastPrimitive } from "radix-ui";
import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TONS, type Tom } from "@/components/ui/tons";
import { cn } from "@/lib/utils";

/**
 * Recado flutuante, que aparece e some.
 *
 * Quando usar em vez do `Alerta`: o `Alerta` fica na página, para o que a
 * pessoa precisa reler; o `Toast` confirma (ou recusa) uma ação que ela
 * acabou de fazer, e sai do caminho sozinho.
 *
 * Por baixo é o Toast do Radix, e não uma `<div>` com `setTimeout`: ele traz
 * a região `aria-live` correta, pausa o relógio quando o mouse está em cima
 * ou a janela perde o foco, aceita arrastar para dispensar, e devolve o foco
 * pro lugar certo. Refazer isso à mão é onde mora o toast que some no meio da
 * leitura.
 *
 * ```tsx
 * const { avisar } = useToast();
 * avisar({ tom: "erro", titulo: "Horário ocupado", descricao: "..." });
 * ```
 */

export type Aviso = {
  tom?: Tom;
  titulo: string;
  descricao?: string;
  /** Milissegundos. Erro fica mais tempo: quem errou precisa ler. */
  duracao?: number;
};

type AvisoNaTela = Aviso & { id: number; aberto: boolean };

type ValorDoContexto = { avisar: (aviso: Aviso) => void };

const ToastContexto = React.createContext<ValorDoContexto | null>(null);

export function useToast(): ValorDoContexto {
  const contexto = React.useContext(ToastContexto);
  if (!contexto) {
    throw new Error("useToast() precisa de <ToastProvider> acima na árvore.");
  }
  return contexto;
}

/** Erro dura mais que confirmação: um se lê, o outro só se percebe. */
const DURACAO: Record<Tom, number> = {
  erro: 8000,
  aviso: 7000,
  info: 5000,
  sucesso: 4000,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [avisos, setAvisos] = React.useState<AvisoNaTela[]>([]);
  const proximoId = React.useRef(0);

  const avisar = React.useCallback((aviso: Aviso) => {
    const id = proximoId.current++;
    setAvisos((antes) => [...antes, { ...aviso, id, aberto: true }]);
  }, []);

  const valor = React.useMemo(() => ({ avisar }), [avisar]);

  function fechar(id: number) {
    setAvisos((antes) =>
      antes.map((a) => (a.id === id ? { ...a, aberto: false } : a)),
    );
  }

  /** Só remove da lista depois da animação de saída. */
  function remover(id: number) {
    setAvisos((antes) => antes.filter((a) => a.id !== id));
  }

  return (
    <ToastContexto.Provider value={valor}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}

        {avisos.map((aviso) => (
          <Item
            key={aviso.id}
            aviso={aviso}
            aoFechar={() => fechar(aviso.id)}
            aoSair={() => remover(aviso.id)}
          />
        ))}

        {/* No celular fica acima da barra fixa de "Novo agendamento" — toast
            que cobre o botão principal atrapalha em vez de avisar. */}
        <ToastPrimitive.Viewport className="fixed right-0 bottom-0 left-0 z-100 flex max-h-dvh w-full flex-col-reverse gap-2 p-4 pb-28 outline-none sm:left-auto sm:max-w-sm sm:pb-4" />
      </ToastPrimitive.Provider>
    </ToastContexto.Provider>
  );
}

function Item({
  aviso,
  aoFechar,
  aoSair,
}: {
  aviso: AvisoNaTela;
  aoFechar: () => void;
  aoSair: () => void;
}) {
  const tom = aviso.tom ?? "info";
  const { icone: Icone, texto, barra } = TONS[tom];

  return (
    <ToastPrimitive.Root
      open={aviso.aberto}
      onOpenChange={(aberto) => {
        if (!aberto) aoFechar();
      }}
      // O Radix avisa quando a animação de saída terminou; só então a linha
      // sai da lista, senão o toast desapareceria sem transição.
      onAnimationEnd={() => {
        if (!aviso.aberto) aoSair();
      }}
      duration={aviso.duracao ?? DURACAO[tom]}
      // `foreground` interrompe o leitor de tela na hora; `background` espera
      // a pausa. Erro merece interromper — o resto, não.
      type={tom === "erro" ? "foreground" : "background"}
      className={cn(
        "flex items-start gap-3 rounded-lg border border-border border-l-[3px] bg-popover p-4 pr-2 text-popover-foreground shadow-lg",
        barra,
        "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-4 data-[state=open]:fade-in-0",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-right-4",
        "data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x) data-[swipe=move]:transition-none",
        "data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-transform",
        "data-[swipe=end]:animate-out data-[swipe=end]:fade-out-0",
      )}
    >
      <Icone className={cn("mt-0.5 size-5 shrink-0", texto)} aria-hidden="true" />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <ToastPrimitive.Title className="text-sm font-semibold">
          {aviso.titulo}
        </ToastPrimitive.Title>

        {aviso.descricao ? (
          <ToastPrimitive.Description className="text-sm text-muted-foreground">
            {aviso.descricao}
          </ToastPrimitive.Description>
        ) : null}
      </div>

      <ToastPrimitive.Close asChild>
        <Button variant="ghost" size="icon" aria-label="Fechar aviso">
          <XIcon />
        </Button>
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
}
