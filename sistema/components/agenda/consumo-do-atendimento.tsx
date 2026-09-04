"use client";

import { useState } from "react";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import {
  Select,
  SelectConteudo,
  SelectGatilho,
  SelectItem,
  SelectValor,
} from "@/components/ui/select";
import { totalDoConsumo, type LinhaConsumo } from "@/lib/agenda/comanda";
import type { Produto } from "@/lib/estoque/tipos";
import { moeda } from "@/lib/formato";

/**
 * O bloco "Consumo" dentro do modal de editar agendamento.
 *
 * Mexe num rascunho, não no banco: o modal promete "Cancelar", e se cada
 * toque no `+` já baixasse estoque, cancelar não cancelaria nada. Quem grava
 * é o "Salvar", numa chamada só (`ajustar_comanda`, migração 0011).
 *
 * Só aparece na edição. Agendamento que ainda não existe não tem o que
 * consumir, e o campo vazio ali seria um convite a preencher antes da hora.
 */
export function ConsumoDoAtendimento({
  linhas,
  aoMudarLinhas,
  produtos,
  carregando,
  erro,
  desabilitado,
}: {
  linhas: LinhaConsumo[];
  aoMudarLinhas: (linhas: LinhaConsumo[]) => void;
  /** Vendáveis: com preço e com estoque. Vazio = só dá pra tirar. */
  produtos: Produto[];
  carregando: boolean;
  erro: boolean;
  desabilitado: boolean;
}) {
  const [aAcrescentar, setAAcrescentar] = useState("");

  const total = totalDoConsumo(linhas);

  function mudarQuantidade(chave: string, passo: 1 | -1) {
    aoMudarLinhas(
      linhas.map((l) =>
        l.chave === chave
          ? { ...l, quantidade: Math.min(99, Math.max(1, l.quantidade + passo)) }
          : l,
      ),
    );
  }

  function remover(chave: string) {
    aoMudarLinhas(linhas.filter((l) => l.chave !== chave));
  }

  function acrescentar() {
    const produto = produtos.find((p) => p.id === aAcrescentar);
    if (!produto) return;

    aoMudarLinhas([
      ...linhas,
      {
        // Sufixo de tempo: o mesmo produto pode ser lançado duas vezes antes
        // de salvar, e duas linhas com a mesma chave o React funde numa só.
        chave: `novo-${produto.id}-${Date.now()}`,
        produtoId: produto.id,
        nome: produto.nome,
        precoCentavos: produto.precoCentavos,
        quantidade: 1,
      },
    ]);
    setAAcrescentar("");
  }

  return (
    <section className="flex flex-col gap-3 border-t border-border pt-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-semibold">Consumo</h3>
        {total > 0 ? (
          <span data-numero className="text-sm font-semibold">
            {moeda(total)}
          </span>
        ) : null}
      </div>

      {carregando ? (
        <div
          role="status"
          aria-label="Carregando o consumo"
          className="h-12 animate-pulse rounded-lg bg-secondary"
        />
      ) : erro ? (
        <p className="text-sm text-muted-foreground">
          Não consegui carregar o consumo. O resto do agendamento pode ser
          salvo normalmente.
        </p>
      ) : (
        <>
          {linhas.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShoppingBag className="size-4 shrink-0" aria-hidden="true" />
              Nada lançado neste atendimento.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {linhas.map((l) => (
                <li
                  key={l.chave}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2"
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{l.nome}</span>
                    <span data-numero className="text-sm text-muted-foreground">
                      {moeda(l.precoCentavos)} cada
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={`Diminuir ${l.nome}`}
                      disabled={desabilitado || l.quantidade <= 1}
                      onClick={() => mudarQuantidade(l.chave, -1)}
                    >
                      <Minus />
                    </Button>
                    <span
                      data-numero
                      aria-label={`${l.quantidade} de ${l.nome}`}
                      className="min-w-8 text-center font-semibold"
                    >
                      {l.quantidade}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={`Aumentar ${l.nome}`}
                      disabled={desabilitado || l.quantidade >= 99}
                      onClick={() => mudarQuantidade(l.chave, 1)}
                    >
                      <Plus />
                    </Button>
                  </div>

                  <span
                    data-numero
                    className="w-20 shrink-0 text-right font-semibold"
                  >
                    {moeda(l.precoCentavos * l.quantidade)}
                  </span>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Tirar ${l.nome} da comanda`}
                    disabled={desabilitado}
                    onClick={() => remover(l.chave)}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {produtos.length > 0 ? (
            <div className="flex flex-wrap items-end gap-2">
              <Campo rotulo="Lançar produto" className="min-w-48 flex-1">
                <Select
                  value={aAcrescentar}
                  onValueChange={setAAcrescentar}
                  disabled={desabilitado}
                >
                  <SelectGatilho>
                    <SelectValor placeholder="Escolha um produto" />
                  </SelectGatilho>
                  <SelectConteudo>
                    {produtos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome} · {moeda(p.precoCentavos)}
                      </SelectItem>
                    ))}
                  </SelectConteudo>
                </Select>
              </Campo>

              <Button
                type="button"
                variant="secondary"
                disabled={desabilitado || !aAcrescentar}
                onClick={acrescentar}
              >
                <Plus />
                Acrescentar
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum produto com preço e estoque para lançar. Cadastre no
              Estoque.
            </p>
          )}

          <p className="text-sm text-muted-foreground">
            O estoque só muda quando você salvar.
          </p>
        </>
      )}
    </section>
  );
}
