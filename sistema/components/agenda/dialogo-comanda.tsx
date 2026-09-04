"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";

import { Alerta } from "@/components/ui/alerta";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { buscarComanda } from "@/lib/agenda/api";
import { chaves } from "@/lib/query";
import {
  totalDaComanda,
  type Agendamento,
  type ItemDaComanda,
} from "@/lib/agenda/tipos";
import { moeda } from "@/lib/formato";
import { cn } from "@/lib/utils";

/**
 * A comanda do atendimento: o serviço, o que o cliente consumiu e o total.
 *
 * Abre no lugar de concluir direto. Concluir era um toque só; agora é um
 * toque, uma conferida e um toque — e essa conferida é o ponto: é o momento
 * em que o barbeiro diz o valor em voz alta para o cliente. Fechar sem ver o
 * consumo é como o refrigerante deixa de ser cobrado.
 *
 * O consumo vem da loja, das compras lançadas neste agendamento. Serviço e
 * produtos carregam preço congelado, então a comanda de ontem continua
 * batendo depois de qualquer reajuste.
 */
export function DialogoComanda({
  aberto,
  aoMudarAberto,
  agendamento,
  aoConcluir,
  concluindo,
}: {
  aberto: boolean;
  aoMudarAberto: (aberto: boolean) => void;
  agendamento: Agendamento | null;
  aoConcluir: () => void;
  concluindo: boolean;
}) {
  if (!agendamento) return null;

  return (
    <Conteudo
      key={agendamento.id}
      aberto={aberto}
      aoMudarAberto={aoMudarAberto}
      agendamento={agendamento}
      aoConcluir={aoConcluir}
      concluindo={concluindo}
    />
  );
}

function Conteudo({
  aberto,
  aoMudarAberto,
  agendamento: a,
  aoConcluir,
  concluindo,
}: {
  aberto: boolean;
  aoMudarAberto: (aberto: boolean) => void;
  agendamento: Agendamento;
  aoConcluir: () => void;
  concluindo: boolean;
}) {
  const {
    data: itens,
    isPending,
    isError,
  } = useQuery({
    queryKey: chaves.agenda.comanda(a.id),
    queryFn: () => buscarComanda(a.id),
    enabled: aberto,
    // Sem cache aqui: o cliente pode ter pedido a bebida trinta segundos
    // atrás, e comanda desatualizada é dinheiro que não entra no caixa.
    staleTime: 0,
    refetchOnMount: "always",
  });

  const lista = itens ?? [];
  const { produtosCentavos, totalCentavos } = totalDaComanda(
    a.precoCentavos,
    lista,
  );

  // Enquanto o consumo não chegou, o total mostrado seria só o do serviço — e
  // um número que pula de R$ 30 para R$ 35 depois de lido em voz alta é pior
  // que um número que ainda não apareceu.
  const somandoAinda = isPending;

  return (
    <Modal
      aberto={aberto}
      aoMudarAberto={aoMudarAberto}
      tamanho="medio"
      titulo="Comanda"
      descricao={`${a.clienteNome} · ${a.horario}`}
      rodape={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => aoMudarAberto(false)}
            disabled={concluindo}
          >
            Voltar
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={aoConcluir}
            disabled={concluindo || somandoAinda}
          >
            {concluindo ? <Loader2 className="animate-spin" /> : <Check />}
            {somandoAinda ? "Somando…" : `Concluir · ${moeda(totalCentavos)}`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Secao titulo="Serviço">
          <Linha nome={a.servico.nome} valor={a.precoCentavos} />
        </Secao>

        <Secao titulo="Consumo">
          {isPending ? (
            <div
              role="status"
              aria-label="Carregando o consumo"
              className="h-11 animate-pulse rounded-lg bg-secondary"
            />
          ) : isError ? (
            <Alerta tom="aviso" titulo="Não carreguei o consumo">
              O atendimento pode ser concluído assim mesmo — mas confira no
              balcão se o cliente levou algum produto.
            </Alerta>
          ) : lista.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              Nenhum produto lançado neste atendimento.
            </p>
          ) : (
            <ul className="flex flex-col">
              {lista.map((item) => (
                <li key={item.id}>
                  <LinhaDeItem item={item} />
                </li>
              ))}
            </ul>
          )}
        </Secao>

        {/* O total é o que o barbeiro fala em voz alta — então é a única
            coisa grande da tela. */}
        <div className="flex items-baseline justify-between gap-3 border-t border-border pt-4">
          <div className="flex flex-col">
            <span className="font-semibold">Total</span>
            {produtosCentavos > 0 ? (
              <span className="text-sm text-muted-foreground">
                Serviço <span data-numero>{moeda(a.precoCentavos)}</span> +
                produtos <span data-numero>{moeda(produtosCentavos)}</span>
              </span>
            ) : null}
          </div>

          {somandoAinda ? (
            <span
              aria-hidden="true"
              className="h-7 w-24 animate-pulse rounded-md bg-secondary"
            />
          ) : (
            <span data-numero className="text-2xl font-bold">
              {moeda(totalCentavos)}
            </span>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Secao({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {titulo}
      </h3>
      {children}
    </section>
  );
}

function Linha({
  nome,
  detalhe,
  valor,
  className,
}: {
  nome: string;
  detalhe?: string;
  valor: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-11 items-center justify-between gap-3 py-1",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col">
        <span className="truncate">{nome}</span>
        {detalhe ? (
          <span className="text-sm text-muted-foreground">{detalhe}</span>
        ) : null}
      </div>
      <span data-numero className="shrink-0 font-semibold">
        {moeda(valor)}
      </span>
    </div>
  );
}

function LinhaDeItem({ item }: { item: ItemDaComanda }) {
  return (
    <Linha
      nome={`${item.quantidade}× ${item.nome}`}
      // O unitário só aparece quando há mais de um: com quantidade 1 ele
      // repetiria o número da direita.
      detalhe={
        item.quantidade > 1 ? `${moeda(item.precoCentavos)} cada` : undefined
      }
      valor={item.precoCentavos * item.quantidade}
    />
  );
}
