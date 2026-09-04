"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Minus, Plus } from "lucide-react";

import { confirmarCompra } from "@/app/(sistema)/loja/acoes";
import { Alerta } from "@/components/ui/alerta";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Modal } from "@/components/ui/modal";
import {
  Select,
  SelectConteudo,
  SelectGatilho,
  SelectItem,
  SelectSeparador,
  SelectValor,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import type { ClienteDoDia, ProdutoDaLoja } from "@/lib/loja/repositorio";
import { moeda } from "@/lib/formato";

/** Valor do seletor quando a compra não é de ninguém da agenda. */
const AVULSA = "avulsa";

/**
 * Confirma o pedido montado na vitrine.
 *
 * Lista os itens, deixa ajustar quantidade, escolhe "Lançar em" e baixa
 * o estoque de uma vez.
 */
export function DialogoConfirmarCompra({
  aberto,
  aoMudarAberto,
  slug,
  itens,
  aoAlterarQuantidade,
  aoPedidoConfirmado,
  clientes,
}: {
  aberto: boolean;
  aoMudarAberto: (aberto: boolean) => void;
  slug: string;
  itens: { produto: ProdutoDaLoja; quantidade: number }[];
  aoAlterarQuantidade: (produtoId: string, quantidade: number) => void;
  /** Limpa o carrinho depois que o banco aceitou o pedido. */
  aoPedidoConfirmado: () => void;
  /** Agendamentos de hoje. Vazio = seletor não aparece. */
  clientes: ClienteDoDia[];
}) {
  const router = useRouter();
  const { avisar } = useToast();
  const [destino, setDestino] = useState<string>(AVULSA);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, setPendente] = useState(false);

  const totalUnidades = useMemo(
    () => itens.reduce((s, i) => s + i.quantidade, 0),
    [itens],
  );
  const totalCentavos = useMemo(
    () => itens.reduce((s, i) => s + i.produto.precoCentavos * i.quantidade, 0),
    [itens],
  );
  const escolhido = clientes.find((c) => c.id === destino);

  async function confirmar() {
    if (itens.length === 0) return;

    setErro(null);
    setPendente(true);

    try {
      const resultado = await confirmarCompra({
        slug,
        itens: itens.map((i) => ({
          produtoId: i.produto.id,
          quantidade: i.quantidade,
        })),
        agendamentoId: destino === AVULSA ? null : destino,
      });

      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }

      aoMudarAberto(false);
      aoPedidoConfirmado();
      avisar({
        tom: "sucesso",
        titulo: "Pedido confirmado",
        descricao: `${resultado.quantidade} ${
          resultado.quantidade === 1 ? "item" : "itens"
        } · ${moeda(resultado.totalCentavos)} · ${
          escolhido ? `no ${rotuloDoCliente(escolhido)}` : "compra avulsa"
        }. Retire no balcão.`,
      });
      router.refresh();
    } catch (causa) {
      console.error("[BARBOS] o pedido não completou:", causa);
      setErro(
        "Não consegui falar com o servidor. Recarregue a página e tente de novo.",
      );
    } finally {
      setPendente(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoMudarAberto={aoMudarAberto}
      tamanho="medio"
      titulo="Confirmar pedido"
      descricao="Retire no balcão depois de confirmar."
      rodape={
        // Empilha em largura total: lado a lado no `pequeno` cortava os dois
        // rótulos ("Continuar escolhendo" + "Confirmar · R$ …").
        <div className="flex w-full flex-col-reverse gap-2">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => aoMudarAberto(false)}
            disabled={pendente}
          >
            Continuar escolhendo
          </Button>
          <Button
            type="button"
            size="lg"
            className="w-full"
            onClick={confirmar}
            disabled={pendente || itens.length === 0}
          >
            {pendente ? <Loader2 className="animate-spin" /> : null}
            Confirmar · {moeda(totalCentavos)}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {itens.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum item no pedido. Volte e escolha na vitrine.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {itens.map(({ produto, quantidade }) => (
              <li
                key={produto.id}
                className="flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{produto.nome}</p>
                  <p data-numero className="text-sm text-muted-foreground">
                    {moeda(produto.precoCentavos)} / un.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label={`Diminuir ${produto.nome}`}
                    disabled={pendente}
                    onClick={() =>
                      aoAlterarQuantidade(produto.id, quantidade - 1)
                    }
                  >
                    <Minus />
                  </Button>
                  <span
                    data-numero
                    className="min-w-8 text-center font-semibold"
                    aria-live="polite"
                  >
                    {quantidade}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label={`Aumentar ${produto.nome}`}
                    disabled={
                      pendente || quantidade >= Math.min(99, produto.unidades)
                    }
                    onClick={() =>
                      aoAlterarQuantidade(produto.id, quantidade + 1)
                    }
                  >
                    <Plus />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {clientes.length > 0 ? (
          <Campo
            rotulo="Lançar em"
            ajuda="Escolha o horário para o pedido entrar no atendimento. Avulsa é a compra de balcão."
          >
            <Select
              value={destino}
              onValueChange={setDestino}
              disabled={pendente}
            >
              <SelectGatilho>
                <SelectValor />
              </SelectGatilho>
              <SelectConteudo>
                <SelectItem value={AVULSA}>Compra avulsa</SelectItem>
                <SelectSeparador />
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {rotuloDoCliente(c)}
                  </SelectItem>
                ))}
              </SelectConteudo>
            </Select>
          </Campo>
        ) : null}

        <p className="text-sm text-muted-foreground">
          {totalUnidades} {totalUnidades === 1 ? "item" : "itens"} · total{" "}
          <span data-numero className="font-semibold text-foreground">
            {moeda(totalCentavos)}
          </span>
        </p>

        {erro ? <Alerta>{erro}</Alerta> : null}
      </div>
    </Modal>
  );
}

/**
 * Como o agendamento se apresenta na lista: "10:30 · João".
 *
 * Cai no serviço quando não há nome. Isso não é enfeite defensivo: enquanto a
 * migração 0010 não roda, quem abre a loja sem sessão recebe `clienteNome`
 * nulo, e sem essa saída a lista viraria três linhas escritas só "10:30".
 */
function rotuloDoCliente(c: ClienteDoDia): string {
  return c.clienteNome
    ? `${c.horario} · ${c.clienteNome}`
    : `${c.horario} · ${c.servico}`;
}
