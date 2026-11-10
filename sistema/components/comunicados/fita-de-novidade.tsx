import { cn } from "@/lib/utils";

/**
 * A fita "Nova" de uma notificação ainda não lida: atravessada na diagonal
 * do canto superior esquerdo do cartão, como a fita de um presente. Pedido
 * do Gabriel em 10/11/2026, no lugar do selo pequeno, para a novidade
 * chamar o olho no meio da lista.
 *
 * Escrita, não só a cor: estado nunca só por cor. Âmbar com texto grafite
 * (9:1), igual nos dois temas, como o botão principal.
 *
 * QUEM USA precisa de duas coisas no cartão:
 *   - `relative overflow-hidden`: a fita é posicionada pelo cartão, e as
 *     pontas que passam da borda são cortadas por ele;
 *   - o canto livre: a fita ocupa a faixa em que x + y (em px, a partir do
 *     canto de dentro do cartão) vai de ~31 a ~63. O conteúdo tem que
 *     começar com x + y de pelo menos 64 — ver o sino e o
 *     `CartaoDeComunicado`, que abrem espaço só quando a fita aparece.
 *
 * `pointer-events-none`: tocar no canto continua abrindo o cartão.
 */
export function FitaDeNovidade({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        // Centro em (24px, 23px) do canto: largura 120 a partir de -36px,
        // altura 22 (linha de 20 + as duas bordas) a partir de 12px.
        "pointer-events-none absolute top-3 -left-9 z-10 w-[120px] -rotate-45 select-none",
        "border-y border-primary-foreground/25 bg-primary text-center text-sm leading-5 font-bold tracking-wider text-primary-foreground uppercase shadow-md",
        className,
      )}
    >
      Nova
    </span>
  );
}
