"use client";

import { useMemo, useState } from "react";
import { Minus, Plus, ShoppingBag } from "lucide-react";

import { DialogoConfirmarCompra } from "@/components/loja/dialogo-confirmar-compra";
import { Button } from "@/components/ui/button";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { NOME_DO_TIPO, type TipoProduto } from "@/lib/estoque/tipos";
import type { ClienteDoDia, ProdutoDaLoja } from "@/lib/loja/repositorio";
import { moeda } from "@/lib/formato";
import { cn } from "@/lib/utils";

/**
 * A prateleira que o cliente vê depois de ler o QR code.
 *
 * Toque adiciona ao pedido. A barra fixa no fim mostra quantos itens e o
 * total — aí confirma e retira no balcão.
 */
export function Vitrine({
  produtos,
  nomeDaBarbearia,
  ehDona,
  slug,
  clientes,
}: {
  produtos: ProdutoDaLoja[];
  nomeDaBarbearia: string;
  ehDona: boolean;
  slug: string;
  /** Agendamentos de hoje, para o seletor "Lançar em" da compra. */
  clientes: ClienteDoDia[];
}) {
  /** produtoId → quantidade no pedido. */
  const [carrinho, setCarrinho] = useState<Record<string, number>>({});
  const [modalAberto, setModalAberto] = useState(false);

  const mercearia = useMemo(
    () => produtos.filter((p) => p.tipo === "mercearia"),
    [produtos],
  );
  const salao = useMemo(
    () => produtos.filter((p) => p.tipo === "salao"),
    [produtos],
  );

  const porId = useMemo(() => {
    const mapa = new Map<string, ProdutoDaLoja>();
    for (const p of produtos) mapa.set(p.id, p);
    return mapa;
  }, [produtos]);

  const itensDoPedido = useMemo(() => {
    return Object.entries(carrinho)
      .map(([id, quantidade]) => {
        const produto = porId.get(id);
        if (!produto || quantidade < 1) return null;
        return { produto, quantidade };
      })
      .filter((i): i is { produto: ProdutoDaLoja; quantidade: number } => !!i);
  }, [carrinho, porId]);

  const totalUnidades = useMemo(
    () => itensDoPedido.reduce((s, i) => s + i.quantidade, 0),
    [itensDoPedido],
  );
  const totalCentavos = useMemo(
    () =>
      itensDoPedido.reduce(
        (s, i) => s + i.produto.precoCentavos * i.quantidade,
        0,
      ),
    [itensDoPedido],
  );

  function definirQuantidade(produtoId: string, quantidade: number) {
    const produto = porId.get(produtoId);
    if (!produto) return;

    const max = Math.min(99, produto.unidades);
    const proxima = Math.max(0, Math.min(max, quantidade));

    setCarrinho((atual) => {
      if (proxima === 0) {
        const resto = { ...atual };
        delete resto[produtoId];
        return resto;
      }
      return { ...atual, [produtoId]: proxima };
    });
  }

  function adicionar(produto: ProdutoDaLoja) {
    if (!produto.disponivel) return;
    definirQuantidade(produto.id, (carrinho[produto.id] ?? 0) + 1);
  }

  if (produtos.length === 0) {
    return (
      <EstadoVazio
        icone={ShoppingBag}
        titulo="Nenhum produto à venda ainda"
        descricao={
          ehDona
            ? "A vitrine mostra itens do estoque com preço e pelo menos 1 unidade. Cadastre ou edite lá."
            : `A ${nomeDaBarbearia} ainda não colocou produtos à venda por aqui. Pergunte no balcão.`
        }
      />
    );
  }

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-6",
        totalUnidades > 0 && "pb-28",
      )}
    >
      <div className="flex w-full flex-col gap-6">
        <Prateleira
          tipo="mercearia"
          titulo={NOME_DO_TIPO.mercearia}
          descricao="Bebida, snack e o que se leva no balcão."
          produtos={mercearia}
          carrinho={carrinho}
          aoAdicionar={adicionar}
          aoAlterar={definirQuantidade}
        />
        <Prateleira
          tipo="salao"
          titulo={NOME_DO_TIPO.salao}
          descricao="Pomada, lâmina e o que o salão também vende."
          produtos={salao}
          carrinho={carrinho}
          aoAdicionar={adicionar}
          aoAlterar={definirQuantidade}
        />
      </div>

      {totalUnidades > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto max-w-3xl">
            <Button
              type="button"
              size="lg"
              className="w-full justify-between gap-3"
              onClick={() => setModalAberto(true)}
            >
              <span className="inline-flex items-center gap-2">
                <ShoppingBag />
                Ver pedido
              </span>
              <span data-numero className="tabular-nums">
                {totalUnidades} {totalUnidades === 1 ? "item" : "itens"} ·{" "}
                {moeda(totalCentavos)}
              </span>
            </Button>
          </div>
        </div>
      ) : null}

      <DialogoConfirmarCompra
        aberto={modalAberto}
        aoMudarAberto={setModalAberto}
        slug={slug}
        itens={itensDoPedido}
        aoAlterarQuantidade={definirQuantidade}
        aoPedidoConfirmado={() => setCarrinho({})}
        clientes={clientes}
      />
    </div>
  );
}

function Prateleira({
  tipo,
  titulo,
  descricao,
  produtos,
  carrinho,
  aoAdicionar,
  aoAlterar,
}: {
  tipo: TipoProduto;
  titulo: string;
  descricao: string;
  produtos: ProdutoDaLoja[];
  carrinho: Record<string, number>;
  aoAdicionar: (p: ProdutoDaLoja) => void;
  aoAlterar: (produtoId: string, quantidade: number) => void;
}) {
  return (
    <section
      aria-labelledby={`loja-${tipo}`}
      className="flex min-w-0 flex-1 flex-col gap-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 id={`loja-${tipo}`} className="font-semibold">
            {titulo}
          </h2>
          <p className="text-sm text-muted-foreground">{descricao}</p>
        </div>
        <p className="text-sm text-muted-foreground">
          <span data-numero>{produtos.length}</span>{" "}
          {produtos.length === 1 ? "item" : "itens"}
        </p>
      </div>

      {produtos.length === 0 ? (
        <EstadoVazio
          icone={ShoppingBag}
          titulo="Nenhum item aqui"
          descricao="Quando houver produto com preço e estoque, aparece nesta prateleira."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {produtos.map((p) => (
            <li key={p.id}>
              <ItemDaVitrine
                produto={p}
                quantidade={carrinho[p.id] ?? 0}
                aoAdicionar={() => aoAdicionar(p)}
                aoAlterar={(q) => aoAlterar(p.id, q)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ItemDaVitrine({
  produto,
  quantidade,
  aoAdicionar,
  aoAlterar,
}: {
  produto: ProdutoDaLoja;
  quantidade: number;
  aoAdicionar: () => void;
  aoAlterar: (quantidade: number) => void;
}) {
  const disponivel = produto.disponivel;
  const noPedido = quantidade > 0;
  const noLimite = quantidade >= Math.min(99, produto.unidades);

  return (
    <div
      className={cn(
        "flex h-full min-h-11 w-full flex-col gap-3 rounded-lg border border-border bg-card p-4 text-left transition-colors",
        noPedido && "border-primary/40 bg-secondary/30",
        !disponivel && "opacity-70",
      )}
    >
      <button
        type="button"
        onClick={aoAdicionar}
        disabled={!disponivel || noLimite}
        aria-label={
          disponivel
            ? noPedido
              ? `Adicionar mais ${produto.nome}`
              : `Adicionar ${produto.nome}, ${moeda(produto.precoCentavos)}`
            : `${produto.nome}, esgotado`
        }
        className={cn(
          "flex w-full items-start justify-between gap-3 text-left",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          disponivel && !noLimite
            ? "cursor-pointer"
            : "cursor-not-allowed",
        )}
      >
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="truncate font-semibold">{produto.nome}</h3>

          {!disponivel ? (
            <span className="w-fit rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">
              Esgotado
            </span>
          ) : (
            <span className="text-xs font-medium text-muted-foreground">
              {noPedido ? "No pedido" : "Toque para adicionar"}
            </span>
          )}
        </div>

        <span
          data-numero
          className={cn(
            "shrink-0 text-base font-semibold",
            !disponivel && "line-through",
          )}
        >
          {moeda(produto.precoCentavos)}
        </span>
      </button>

      {noPedido ? (
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={`Diminuir ${produto.nome}`}
            onClick={() => aoAlterar(quantidade - 1)}
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
            disabled={noLimite}
            onClick={() => aoAlterar(quantidade + 1)}
          >
            <Plus />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
