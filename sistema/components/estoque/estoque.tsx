"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";

import { excluirProduto } from "@/app/(sistema)/estoque/acoes";
import { CabecalhoCadastroProduto } from "@/components/estoque/cabecalho-cadastro";
import { TabelaProdutos } from "@/components/estoque/tabela-produtos";
import { Alerta } from "@/components/ui/alerta";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { buscarProdutos } from "@/lib/estoque/api";
import { NOME_DO_TIPO, type Produto } from "@/lib/estoque/tipos";
import { moeda } from "@/lib/formato";
import { chaves } from "@/lib/query";

export function Estoque() {
  const clienteQuery = useQueryClient();
  const { avisar } = useToast();

  // O produto que está na mira. Um só, e no `Estoque` e não na tabela:
  // as duas prateleiras compartilham esta confirmação.
  const [aExcluir, setAExcluir] = useState<Produto | null>(null);
  const [erroAoExcluir, setErroAoExcluir] = useState<string | null>(null);

  const { data, isPending, isError, error, refetch, isRefetching } = useQuery({
    queryKey: chaves.estoque.produtos,
    queryFn: buscarProdutos,
  });

  const apagar = useMutation({
    mutationFn: (produto: Produto) => excluirProduto(produto.id),
    onSuccess: (resultado, produto) => {
      if (!resultado.ok) {
        // O modal FICA ABERTO com o erro. A recusa mais comum ("já foi
        // vendido") vem com uma instrução do que fazer, e fechar a janela
        // levaria a instrução junto.
        setErroAoExcluir(resultado.erro);
        return;
      }

      clienteQuery.invalidateQueries({ queryKey: chaves.estoque.todas });
      setAExcluir(null);
      setErroAoExcluir(null);
      avisar({
        tom: "sucesso",
        titulo: "Produto excluído",
        descricao: produto.nome,
      });
    },
    onError: (causa) => {
      console.error("[BARBOS] a exclusão não completou:", causa);
      setErroAoExcluir(
        "Não consegui falar com o servidor. Recarregue a página e tente de novo.",
      );
    },
  });

  const produtos = useMemo(() => data ?? [], [data]);

  const mercearia = useMemo(
    () => produtos.filter((p) => p.tipo === "mercearia"),
    [produtos],
  );
  const salao = useMemo(
    () => produtos.filter((p) => p.tipo === "salao"),
    [produtos],
  );

  function pedirExclusao(produto: Produto) {
    setErroAoExcluir(null);
    setAExcluir(produto);
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <p className="font-semibold">O estoque não carregou</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          {error instanceof Error
            ? error.message
            : "Verifique a conexão e tente de novo."}
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          <RefreshCw className={isRefetching ? "animate-spin" : undefined} />
          Tentar de novo
        </Button>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CabecalhoCadastroProduto produtos={produtos} />

      {/* Empilhadas até `lg`, lado a lado dali pra cima.
          Antes era `flex-row` sem ponto de corte, e no celular as duas tabelas
          de três colunas (nome, unidades, preço) dividiam ~180px cada — o nome
          do produto virava uma letra por linha.
          `lg` e não `md` porque é o mesmo ponto em que a sidebar aparece e a
          agenda vira duas colunas: o sistema inteiro troca de forma de uma vez
          só, e não uma tela por vez. */}
      {isPending ? (
        <div className="flex w-full flex-col items-stretch gap-4 lg:flex-row">
          <div
            role="status"
            aria-label="Carregando estoque"
            className="h-48 min-w-0 flex-1 animate-pulse rounded-lg border border-border bg-card"
          />
          <div
            aria-hidden="true"
            className="h-48 min-w-0 flex-1 animate-pulse rounded-lg border border-border bg-card"
          />
        </div>
      ) : (
        <div className="flex w-full flex-col items-stretch gap-4 lg:flex-row">
          <TabelaProdutos
            id="mercearia"
            titulo={NOME_DO_TIPO.mercearia}
            descricao="O que se vende no balcão — bebida, snack, acessório."
            produtos={mercearia}
            aoExcluir={pedirExclusao}
            excluindoId={apagar.isPending ? (aExcluir?.id ?? null) : null}
          />
          <TabelaProdutos
            id="salao"
            titulo={NOME_DO_TIPO.salao}
            descricao="O que o salão consome — pomada, lâmina, shampoo."
            produtos={salao}
            aoExcluir={pedirExclusao}
            excluindoId={apagar.isPending ? (aExcluir?.id ?? null) : null}
          />
        </div>
      )}

      <Modal
        aberto={aExcluir !== null}
        aoMudarAberto={(aberto) => {
          if (!aberto && !apagar.isPending) {
            setAExcluir(null);
            setErroAoExcluir(null);
          }
        }}
        tamanho="pequeno"
        titulo="Excluir produto?"
        descricao="O registro some do estoque e não tem como voltar atrás."
        rodape={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={apagar.isPending}
              onClick={() => {
                setAExcluir(null);
                setErroAoExcluir(null);
              }}
            >
              Manter produto
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={apagar.isPending}
              onClick={() => aExcluir && apagar.mutate(aExcluir)}
            >
              {apagar.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Trash2 />
              )}
              Excluir
            </Button>
          </>
        }
      >
        {aExcluir ? (
          <div className="flex flex-col gap-3">
            <p>
              <strong>{aExcluir.nome}</strong> — {NOME_DO_TIPO[aExcluir.tipo]},{" "}
              <span data-numero>{aExcluir.unidades}</span>{" "}
              {aExcluir.unidades === 1 ? "unidade" : "unidades"} a{" "}
              <span data-numero>{moeda(aExcluir.precoCentavos)}</span> cada.
            </p>

            {/* Estoque com unidade é dinheiro parado na prateleira, e some
                do relatório junto com o produto. Vale ser dito antes. */}
            {aExcluir.unidades > 0 ? (
              <p className="text-sm text-muted-foreground">
                Ainda tem unidade em estoque. Se o produto acabou de verdade,
                editar para zero conta a mesma história sem apagar o cadastro.
              </p>
            ) : null}

            {erroAoExcluir ? (
              <Alerta tom="erro" titulo="Não deu para excluir">
                {erroAoExcluir}
              </Alerta>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
