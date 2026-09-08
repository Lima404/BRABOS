"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CLASSES_SERVICO, type Servico } from "@/lib/agenda/tipos";
import { cn } from "@/lib/utils";

/**
 * Legenda dos serviços — e também o filtro.
 *
 * Uma coisa só em vez de duas: no componente de referência a legenda apenas
 * explicava as cores, e havia uma fileira separada de filtros. Aqui clicar na
 * cor filtra por ela, que é o gesto que a pessoa já tenta fazer.
 *
 * Sem serviço nenhum ela vira o primeiro passo da barbearia nova: desde a
 * migração 0021 a conta nasce com o cardápio vazio, e um "Todos" sozinho
 * filtrando nada seria a primeira coisa que o dono veria na vida.
 */
export function Legenda({
  servicos,
  ativos,
  aoAlternar,
  aoLimpar,
  contagens,
  aoConfigurar,
}: {
  servicos: Servico[];
  /** Vazio = mostrando todos. */
  ativos: Set<string>;
  aoAlternar: (id: string) => void;
  aoLimpar: () => void;
  contagens: Record<string, number>;
  /** Abre a configuração — a saída do estado vazio. */
  aoConfigurar: () => void;
}) {
  const filtrando = ativos.size > 0;

  if (servicos.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-card px-3 py-3 sm:flex-row sm:items-center">
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
          Nenhum serviço cadastrado ainda. Sem serviço não dá pra marcar
          horário — comece pelo mais pedido.
        </p>
        <Button
          type="button"
          variant="secondary"
          className="w-full sm:w-auto"
          onClick={aoConfigurar}
        >
          <Plus />
          Cadastrar serviço
        </Button>
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label="Filtrar por serviço"
      className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5"
    >
      <button
        type="button"
        onClick={aoLimpar}
        aria-pressed={!filtrando}
        className={cn(
          "inline-flex min-h-9 items-center rounded-full px-3 text-sm font-semibold transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          !filtrando
            ? "bg-secondary text-foreground"
            : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
        )}
      >
        Todos
      </button>

      {servicos.map((s) => {
        const c = CLASSES_SERVICO[s.cor];
        const ativo = ativos.has(s.id);

        return (
          <button
            key={s.id}
            type="button"
            onClick={() => aoAlternar(s.id)}
            aria-pressed={ativo}
            className={cn(
              "inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              // Selecionado ganha fundo tingido, borda E peso: nunca só cor.
              ativo
                ? cn(c.fundo, c.texto, c.borda, "font-semibold")
                : "border-transparent font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
            )}
          >
            <span
              aria-hidden="true"
              className={cn("size-2.5 shrink-0 rounded-full", c.pontoBg)}
            />
            {s.nome}
            <span data-numero className="opacity-70">
              {contagens[s.id] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}
