import { Clock, Lock, ShieldCheck, CheckCircle2, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ROTULO_DA_SITUACAO, type SituacaoPagamento } from "@/lib/admin/tipos";
import { cn } from "@/lib/utils";

/**
 * A situação do pagamento de uma barbearia.
 *
 * Texto + ícone + cor, nunca só a cor. As cores são as dos estados da
 * agenda, que já têm o contraste medido nos dois temas: verde de
 * "confirmado", azul de "agendado", âmbar de "atendendo" e vermelho de
 * "faltou" — o que gera prejuízo carrega o vermelho e o cadeado.
 */
const VISUAL: Record<SituacaoPagamento, { icone: LucideIcon; classes: string }> = {
  em_dia: { icone: CheckCircle2, classes: "bg-confirmado-fundo text-confirmado" },
  liberada: { icone: ShieldCheck, classes: "bg-agendado-fundo text-agendado" },
  tolerancia: { icone: Clock, classes: "bg-atendendo-fundo text-atendendo" },
  bloqueada: { icone: Lock, classes: "bg-faltou-fundo text-faltou" },
};

export function SeloDePagamento({
  situacao,
  className,
}: {
  situacao: SituacaoPagamento;
  className?: string;
}) {
  const { icone: Icone, classes } = VISUAL[situacao];

  return (
    <Badge
      variant="secondary"
      className={cn("h-6 px-2.5 text-sm [&>svg]:size-3.5!", classes, className)}
    >
      <Icone aria-hidden="true" />
      {ROTULO_DA_SITUACAO[situacao]}
    </Badge>
  );
}
