import { AlertTriangle, Sparkles, type LucideIcon } from "lucide-react";

import { FitaDeNovidade } from "@/components/comunicados/fita-de-novidade";
import { Badge } from "@/components/ui/badge";
import {
  foiEditado,
  TIPOS_DE_COMUNICADO,
  type Comunicado,
  type TipoDeComunicado,
} from "@/lib/comunicados/tipos";
import { momentoPorExtenso } from "@/lib/formato";
import { cn } from "@/lib/utils";

/**
 * Uma notificação do sistema, como a barbearia lê e como o admin confere.
 *
 * O alerta se separa por TRÊS coisas: ícone de aviso, a palavra "Alerta" e
 * a borda âmbar à esquerda. Uma lista de recados iguais esconderia o
 * "sistema fora do ar" no meio das notas de versão.
 */
const VISUAL: Record<TipoDeComunicado, { icone: LucideIcon; selo: string; borda: string }> = {
  atualizacao: {
    icone: Sparkles,
    selo: "bg-agendado-fundo text-agendado",
    borda: "border-l-border",
  },
  alerta: {
    icone: AlertTriangle,
    selo: "bg-atendendo-fundo text-atendendo",
    borda: "border-l-atendendo",
  },
};

export function SeloDoComunicado({ tipo }: { tipo: TipoDeComunicado }) {
  const { icone: Icone, selo } = VISUAL[tipo];

  return (
    <Badge
      variant="secondary"
      className={cn("h-6 px-2.5 text-sm [&>svg]:size-3.5!", selo)}
    >
      <Icone aria-hidden="true" />
      {TIPOS_DE_COMUNICADO[tipo].rotulo}
    </Badge>
  );
}

export function CartaoDeComunicado({
  comunicado,
  nova = false,
  rodape,
}: {
  comunicado: Comunicado;
  /** Ainda não lida por esta barbearia. */
  nova?: boolean;
  /** O que vem embaixo: no admin, quantos leram e os botões. */
  rodape?: React.ReactNode;
}) {
  const { borda } = VISUAL[comunicado.tipo];

  return (
    <article
      id={`notificacao-${comunicado.id}`}
      className={cn(
        // scroll-mt: o cabeçalho é fixo, e o link com #notificacao-… não
        // pode parar com o título escondido atrás dele.
        "relative flex scroll-mt-24 flex-col gap-3 overflow-hidden rounded-lg border border-l-4 border-border bg-card p-4 sm:p-5",
        borda,
      )}
    >
      {nova ? <FitaDeNovidade /> : null}

      {/* Com a fita, a primeira linha anda para a direita e sai do canto
          (ver `FitaDeNovidade`). As de baixo já começam fora dele. */}
      <div className={cn("flex flex-wrap items-center gap-2", nova && "pl-9")}>
        <SeloDoComunicado tipo={comunicado.tipo} />
        {comunicado.versao ? (
          <Badge variant="outline" className="h-6 px-2.5 text-sm" data-numero>
            Versão {comunicado.versao}
          </Badge>
        ) : null}
        <p className="text-sm text-muted-foreground">
          <time dateTime={comunicado.publicadoEm}>
            {momentoPorExtenso(comunicado.publicadoEm)}
          </time>
          {foiEditado(comunicado) ? " · editada" : null}
        </p>
      </div>

      <h2 className="text-lg font-semibold leading-snug">{comunicado.titulo}</h2>

      {/* As quebras de linha que o admin digitou são os parágrafos. */}
      <p className="whitespace-pre-line text-base text-foreground">
        {comunicado.texto}
      </p>

      {rodape ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          {rodape}
        </div>
      ) : null}
    </article>
  );
}
