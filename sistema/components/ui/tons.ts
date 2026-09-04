import {
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
  type LucideIcon,
} from "lucide-react";

/**
 * Os quatro tons de recado do sistema, num lugar só.
 *
 * `Alerta` (na página) e `Toast` (flutuante) leem daqui para que "erro" seja a
 * mesma cor e o mesmo ícone nos dois — antes de existir este arquivo eu já
 * tinha escrito o mapa duas vezes, com ícones diferentes.
 *
 * **Todo tom carrega ícone.** Quem não distingue vermelho de verde precisa de
 * outro sinal além da cor.
 */

export type Tom = "erro" | "aviso" | "info" | "sucesso";

export const TONS: Record<
  Tom,
  {
    icone: LucideIcon;
    /** Cor do texto e do ícone. */
    texto: string;
    /** Fundo tingido — usado pelo Alerta, que vive dentro do conteúdo. */
    fundo: string;
    /** Borda lateral — usada pelo Toast, que flutua sobre fundo opaco. */
    barra: string;
  }
> = {
  erro: {
    icone: XCircle,
    texto: "text-destructive",
    fundo: "bg-destructive/10",
    barra: "border-l-destructive",
  },
  aviso: {
    icone: AlertTriangle,
    texto: "text-atendendo",
    fundo: "bg-atendendo-fundo",
    barra: "border-l-atendendo",
  },
  info: {
    icone: Info,
    texto: "text-agendado",
    fundo: "bg-agendado-fundo",
    barra: "border-l-agendado",
  },
  sucesso: {
    icone: CheckCircle2,
    // Mesmo verde de `concluido` / `confirmado` — atendimento fechado com sucesso.
    texto: "text-confirmado",
    fundo: "bg-confirmado-fundo",
    barra: "border-l-confirmado",
  },
};
