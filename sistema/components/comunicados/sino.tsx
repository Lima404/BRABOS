"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bell, RefreshCw, Sparkles } from "lucide-react";

import {
  listarMeusComunicados,
  marcarComunicadosLidos,
} from "@/app/(sistema)/notificacoes/acoes";
import { useNaoLidos } from "@/components/comunicados/nao-lidos";
import { Button } from "@/components/ui/button";
import { Esqueleto } from "@/components/ui/esqueleto";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  linkDoPatch,
  type ComunicadoDaBarbearia,
} from "@/lib/comunicados/tipos";
import { dadosOuErro } from "@/lib/consulta";
import { diaDoMomento } from "@/lib/formato";
import { chaves } from "@/lib/query";
import { cn } from "@/lib/utils";

/** Quantas aparecem no painel do sino. O resto está em /notificacoes. */
const NO_SINO = 15;

/**
 * O sino do topo: abre o painel com as notificações mais recentes.
 *
 * Tocar numa ATUALIZAÇÃO leva ao patch note daquela versão
 * (`/patch-notes#versao-…`); tocar num ALERTA leva ao texto inteiro dele
 * em /notificacoes.
 *
 * O número some quando o painel FECHA, não quando abre. Abrindo, a lista
 * ainda precisa mostrar quais eram as novas — marcar na abertura apagaria
 * a pista no instante em que a pessoa vai ler. Acima de 9 vira "9+".
 */
export function Sino() {
  const [aberto, setAberto] = useState(false);
  const { data: naoLidos } = useNaoLidos();
  const novas = naoLidos?.quantidade ?? 0;
  const clienteQuery = useQueryClient();

  // Só busca a lista quando o painel abre: o número no canto já vem do
  // `useNaoLidos`, e a lista inteira em toda tela seria desperdício.
  const lista = useQuery({
    queryKey: chaves.comunicados.lista,
    queryFn: () => dadosOuErro(listarMeusComunicados()),
    enabled: aberto,
  });

  function fechar() {
    setAberto(false);
    if (novas === 0) return;
    marcarComunicadosLidos()
      .then(async (resultado) => {
        if (!resultado.ok) return; // o número só continua lá
        await clienteQuery.invalidateQueries({ queryKey: chaves.comunicados.todas });
      })
      .catch((causa) => console.error("[BARBOS] marcar notificações:", causa));
  }

  return (
    <Sheet
      open={aberto}
      onOpenChange={(v) => {
        if (v) setAberto(true);
        else fechar();
      }}
    >
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            novas === 0
              ? "Notificações"
              : `Notificações: ${novas} ${novas === 1 ? "nova" : "novas"}`
          }
        >
          <Bell />
          {novas > 0 ? (
            <span
              aria-hidden="true"
              data-numero
              className="absolute top-1 right-1 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-semibold text-primary-foreground"
            >
              {novas > 9 ? "9+" : novas}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border">
          <SheetTitle>Notificações</SheetTitle>
          <SheetDescription>Atualizações e alertas do BARBOS.</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {lista.isError ? (
            <div className="flex flex-col items-center gap-3 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                {lista.error instanceof Error
                  ? lista.error.message
                  : "As notificações não carregaram."}
              </p>
              <Button
                variant="outline"
                onClick={() => lista.refetch()}
                disabled={lista.isRefetching}
              >
                <RefreshCw className={lista.isRefetching ? "animate-spin" : undefined} />
                Tentar de novo
              </Button>
            </div>
          ) : lista.isPending ? (
            <div role="status" aria-label="Carregando as notificações" className="flex flex-col gap-2 p-2">
              <Esqueleto className="h-20" />
              <Esqueleto className="h-20" />
              <Esqueleto className="h-20" />
            </div>
          ) : lista.data.length === 0 ? (
            <EstadoVazio
              icone={Bell}
              titulo="Nenhuma notificação ainda"
              descricao="Quando o BARBOS tiver versão nova ou algum aviso importante, ele aparece aqui."
              className="m-2"
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {lista.data.slice(0, NO_SINO).map((c) => (
                <li key={c.id}>
                  <ItemDoSino comunicado={c} aoAbrir={fechar} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <SheetFooter className="flex-row flex-wrap border-t border-border">
          <Button asChild variant="outline" className="flex-1">
            <Link href="/notificacoes" onClick={fechar}>
              Ver todas
            </Link>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href="/patch-notes" onClick={fechar}>
              Patch notes
            </Link>
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ItemDoSino({
  comunicado: c,
  aoAbrir,
}: {
  comunicado: ComunicadoDaBarbearia;
  aoAbrir: () => void;
}) {
  const alerta = c.tipo === "alerta";
  const Icone = alerta ? AlertTriangle : Sparkles;
  const destino =
    c.versao ? linkDoPatch(c.versao) : `/notificacoes#notificacao-${c.id}`;

  return (
    <Link
      href={destino}
      onClick={aoAbrir}
      // Borda fina e hover âmbar dizem "dá para tocar". A borda é a mesma do
      // botão `outline` do rodapé: graf-200 no claro, graf-400 no escuro
      // (4,4:1 sobre o painel; a `border` comum some ali, 1,2:1). O hover
      // não pode ser `secondary`: no escuro ela é a MESMA cor do painel.
      // Os `dark:hover:` repetidos existem porque o `dark:` ganharia do
      // `hover:` no tema escuro.
      className={cn(
        "flex gap-3 rounded-lg border border-border p-3 transition-colors dark:border-input",
        "hover:border-primary hover:bg-accent dark:hover:border-primary dark:hover:bg-accent",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        c.nova && "bg-secondary/40 dark:bg-graf-700/40",
      )}
    >
      <Icone
        className={cn("mt-0.5 size-5 shrink-0", alerta ? "text-atendendo" : "text-agendado")}
        aria-hidden="true"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
          <span className="font-medium">
            {alerta ? "Alerta" : `Versão ${c.versao ?? ""}`}
          </span>
          <time dateTime={c.publicadoEm}>{diaDoMomento(c.publicadoEm)}</time>
          {/* "Nova" escrito, não só a bolinha: estado nunca só por cor. */}
          {c.nova ? (
            <span className="inline-flex items-center gap-1 font-semibold text-foreground">
              <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
              Nova
            </span>
          ) : null}
        </p>
        <p className="font-semibold leading-snug text-foreground">{c.titulo}</p>
        <p className="line-clamp-2 text-sm text-muted-foreground">{c.texto}</p>
      </div>
    </Link>
  );
}
