"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, FileText, RefreshCw } from "lucide-react";

import {
  listarMeusComunicados,
  marcarComunicadosLidos,
} from "@/app/(sistema)/notificacoes/acoes";
import { CartaoDeComunicado } from "@/components/comunicados/cartao-comunicado";
import { Button } from "@/components/ui/button";
import { Esqueleto } from "@/components/ui/esqueleto";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { linkDoPatch } from "@/lib/comunicados/tipos";
import { dadosOuErro } from "@/lib/consulta";
import { chaves } from "@/lib/query";

/**
 * As notificações do BARBOS, da mais nova para a mais antiga.
 *
 * Abrir a tela marca tudo como lido — é o jeito de qualquer caixa de
 * entrada, e o sino zera. Mas as que eram novas CONTINUAM com o selo
 * "Nova" nesta visita: a lista na tela não é refeita na hora, só marcada
 * como velha para a próxima vez. Tirar o selo no instante em que a pessoa
 * chega apagaria justamente a pista de onde começar a ler.
 */
export function ListaDeNotificacoes() {
  const clienteQuery = useQueryClient();
  const marcou = useRef(false);

  const { data, isPending, isError, error, refetch, isRefetching } = useQuery({
    queryKey: chaves.comunicados.lista,
    queryFn: () => dadosOuErro(listarMeusComunicados()),
  });

  const temNova = data?.some((c) => c.nova) ?? false;

  useEffect(() => {
    if (!temNova || marcou.current) return;
    marcou.current = true;

    marcarComunicadosLidos()
      .then(async (resultado) => {
        if (!resultado.ok) return; // o sino só continua marcando; nada a avisar
        await Promise.all([
          clienteQuery.invalidateQueries({ queryKey: chaves.comunicados.naoLidos }),
          clienteQuery.invalidateQueries({
            queryKey: chaves.comunicados.lista,
            refetchType: "none",
          }),
        ]);
      })
      .catch((causa) => console.error("[BARBOS] marcar notificações:", causa));
  }, [temNova, clienteQuery]);

  let corpo: React.ReactNode;
  if (isError) {
    corpo = (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <p className="font-semibold">As notificações não carregaram</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Verifique a conexão e tente de novo."}
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
  } else if (isPending) {
    corpo = (
      <div role="status" aria-label="Carregando as notificações" className="flex flex-col gap-4">
        <Esqueleto className="h-40" />
        <Esqueleto className="h-40" />
      </div>
    );
  } else if (data.length === 0) {
    corpo = (
      <EstadoVazio
        icone={Bell}
        titulo="Nenhuma notificação ainda"
        descricao="Quando o BARBOS tiver novidade ou algum aviso importante, ele aparece aqui."
        acao={
          <Button asChild variant="outline">
            <Link href="/agenda">Voltar para a agenda</Link>
          </Button>
        }
      />
    );
  } else {
    corpo = (
      <div className="flex flex-col gap-4">
        {data.map((c) => (
          <CartaoDeComunicado
            key={c.id}
            comunicado={c}
            nova={c.nova}
            rodape={
              // A atualização é só o resumo aqui; o patch note inteiro, com
              // as seções e as fotos, mora em /patch-notes.
              c.versao ? (
                <Button asChild variant="outline">
                  <Link href={linkDoPatch(c.versao)}>
                    <FileText />
                    Ver as notas da versão {c.versao}
                  </Link>
                </Button>
              ) : undefined
            }
          />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notificações</h1>
        <p className="text-muted-foreground">
          Atualizações e alertas do BARBOS. O histórico completo das versões
          está nos{" "}
          <Link
            href="/patch-notes"
            className="text-foreground underline underline-offset-4 hover:no-underline"
          >
            patch notes
          </Link>
          .
        </p>
      </div>
      {corpo}
    </div>
  );
}
