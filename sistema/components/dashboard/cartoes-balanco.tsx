"use client";

import { Scissors, ShoppingBag, Wallet } from "lucide-react";

import type { ResumoDashboard } from "@/lib/dashboard/tipos";
import { moeda } from "@/lib/formato";
import { cn } from "@/lib/utils";

/**
 * O balanço do mês em três cartões: tudo, só serviço, só loja.
 *
 * O total vem primeiro e maior porque é a única pergunta que se faz todo dia
 * ("quanto entrou?"); os outros dois existem para responder a segunda ("de
 * onde veio?"). Por isso os dois trazem a fatia em porcentagem — R$ 300 de
 * serviço só quer dizer alguma coisa ao lado do total.
 *
 * O que entra na conta é decidido no banco (migração 0016): serviço só de
 * agendamento CONCLUÍDO, loja de toda venda confirmada — com filtros de
 * período, serviço, barbeiro e só loja.
 */
export function CartoesBalanco({ resumo }: { resumo: ResumoDashboard }) {
  const total = resumo.servicoCentavos + resumo.lojaCentavos;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Cartao
        destaque
        icone={Wallet}
        rotulo="Total do período"
        valor={total}
        apoio={
          total === 0
            ? "Nada neste recorte ainda"
            : `${frase(resumo.atendimentos, "atendimento", "atendimentos")} · ${frase(resumo.vendas, "venda", "vendas")}`
        }
      />

      <Cartao
        icone={Scissors}
        rotulo="Serviços"
        valor={resumo.servicoCentavos}
        apoio={frase(resumo.atendimentos, "atendimento concluído", "atendimentos concluídos")}
        fatia={fatia(resumo.servicoCentavos, total)}
      />

      <Cartao
        icone={ShoppingBag}
        rotulo="Loja"
        valor={resumo.lojaCentavos}
        apoio={frase(resumo.vendas, "venda confirmada", "vendas confirmadas")}
        fatia={fatia(resumo.lojaCentavos, total)}
      />
    </div>
  );
}

function Cartao({
  icone: Icone,
  rotulo,
  valor,
  apoio,
  fatia,
  destaque,
}: {
  icone: typeof Wallet;
  rotulo: string;
  valor: number;
  apoio: string;
  /** "38% do mês". Ausente no cartão do total, que é o próprio 100%. */
  fatia?: string;
  destaque?: boolean;
}) {
  return (
    <article
      className={cn(
        "flex flex-col gap-1 rounded-lg border p-4 sm:p-5",
        // O total se separa por borda e fundo, não por cor de texto: número
        // grande já é o destaque, e pintá-lo de âmbar brigaria com o botão.
        destaque
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-card",
      )}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icone className="size-4 shrink-0" aria-hidden="true" />
        <h2 className="text-xs font-semibold tracking-wide uppercase">
          {rotulo}
        </h2>
        {fatia ? (
          <span
            data-numero
            className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold"
          >
            {fatia}
          </span>
        ) : null}
      </div>

      <p
        data-numero
        className={cn(
          "font-bold tracking-tight",
          destaque ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl",
        )}
      >
        {moeda(valor)}
      </p>

      <p className="text-sm text-muted-foreground">{apoio}</p>
    </article>
  );
}

function frase(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

function fatia(parte: number, total: number): string | undefined {
  if (total <= 0) return undefined;
  return `${Math.round((parte / total) * 100)}% do total`;
}
