"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

import { CabecalhoCadastroProduto } from "@/components/estoque/cabecalho-cadastro";
import { TabelaProdutos } from "@/components/estoque/tabela-produtos";
import { Button } from "@/components/ui/button";
import { buscarProdutos } from "@/lib/estoque/api";
import { NOME_DO_TIPO } from "@/lib/estoque/tipos";
import { chaves } from "@/lib/query";

export function Estoque() {
  const { data, isPending, isError, error, refetch, isRefetching } = useQuery({
    queryKey: chaves.estoque.produtos,
    queryFn: buscarProdutos,
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

      {isPending ? (
        <div className="flex w-full flex-row items-stretch gap-4">
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
        <div className="flex w-full flex-row items-stretch gap-4">
          <TabelaProdutos
            id="mercearia"
            titulo={NOME_DO_TIPO.mercearia}
            descricao="O que se vende no balcão — bebida, snack, acessório."
            produtos={mercearia}
          />
          <TabelaProdutos
            id="salao"
            titulo={NOME_DO_TIPO.salao}
            descricao="O que o salão consome — pomada, lâmina, shampoo."
            produtos={salao}
          />
        </div>
      )}
    </div>
  );
}
