"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ExternalLink, FileText, RefreshCw } from "lucide-react";

import {
  listarPatchNotes,
  marcarComunicadosLidos,
} from "@/app/(sistema)/notificacoes/acoes";
import { useNaoLidos } from "@/components/comunicados/nao-lidos";
import { FotoDoPatch } from "@/components/comunicados/foto-do-patch";
import { FormaDosPatchNotes } from "@/components/comunicados/forma-dos-patch-notes";
import { VisorDeFotos } from "@/components/comunicados/visor-de-fotos";
import { Button } from "@/components/ui/button";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import {
  ancoraDaVersao,
  ehLinkInterno,
  foiEditado,
  linkSeguro,
  ROTULO_PADRAO_DO_LINK,
  type PatchNote,
  type SecaoDoPatch,
} from "@/lib/comunicados/tipos";
import { dadosOuErro } from "@/lib/consulta";
import { diaDoMomento } from "@/lib/formato";
import { chaves } from "@/lib/query";

/**
 * Os patch notes do BARBOS — a história das versões, como um blog.
 *
 * No topo, a versão do sistema (a maior publicada) e o índice das versões.
 * Embaixo, cada versão: o cabeçalho (título e resumo) numa faixa da largura
 * toda e, abaixo dele, UM CARTÃO POR SEÇÃO, em grade. A mais nova em cima.
 *
 * Largura toda, como o dashboard, a pedido do Gabriel (10/11/2026): com
 * cada parte do sistema no seu cartão, a barbearia passa o olho e acha a
 * que interessa, em vez de rolar um texto corrido. O que é texto longo
 * (o resumo) continua com largura de leitura.
 *
 * Abrir a página conta como ler as atualizações: o sino para de contá-las.
 */
export function PatchNotes() {
  const clienteQuery = useQueryClient();
  const { data: naoLidos } = useNaoLidos();
  const marcou = useRef(false);

  const { data, isPending, isError, error, refetch, isRefetching } = useQuery({
    queryKey: chaves.comunicados.patchNotes,
    queryFn: () => dadosOuErro(listarPatchNotes()),
  });

  const temNova = (naoLidos?.quantidade ?? 0) > 0;
  const ids = data?.map((p) => p.id) ?? [];
  const chaveDosIds = ids.join(",");

  useEffect(() => {
    if (!temNova || marcou.current || chaveDosIds === "") return;
    marcou.current = true;

    marcarComunicadosLidos(chaveDosIds.split(","))
      .then(async (resultado) => {
        if (!resultado.ok) return;
        await Promise.all([
          clienteQuery.invalidateQueries({ queryKey: chaves.comunicados.naoLidos }),
          clienteQuery.invalidateQueries({
            queryKey: chaves.comunicados.lista,
            refetchType: "none",
          }),
        ]);
      })
      .catch((causa) => console.error("[BARBOS] marcar patch notes:", causa));
  }, [temNova, chaveDosIds, clienteQuery]);

  if (isError) {
    return (
      <Moldura>
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <p className="font-semibold">Os patch notes não carregaram</p>
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
      </Moldura>
    );
  }

  if (isPending) {
    return (
      <Moldura>
        <div role="status" aria-label="Carregando os patch notes">
          <FormaDosPatchNotes />
        </div>
      </Moldura>
    );
  }

  if (data.length === 0) {
    return (
      <Moldura>
        <EstadoVazio
          icone={FileText}
          titulo="Nenhuma versão publicada ainda"
          descricao="Quando o BARBOS ganhar uma versão nova, o que mudou aparece aqui."
          acao={
            <Button asChild variant="outline">
              <Link href="/agenda">Voltar para a agenda</Link>
            </Button>
          }
        />
      </Moldura>
    );
  }

  const [atual] = data;

  return (
    <Moldura>
      {/* A versão do sistema, em destaque: é a primeira coisa que se lê. */}
      <section
        aria-label="Versão atual"
        className="flex flex-col gap-4 rounded-lg border border-primary/40 bg-primary/5 p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between"
      >
        <div>
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Versão atual do BARBOS
          </p>
          <p data-numero className="text-4xl font-bold tracking-tight sm:text-5xl">
            {atual.versao}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Publicada em <time dateTime={atual.publicadoEm}>{diaDoMomento(atual.publicadoEm)}</time>
          </p>
        </div>

        {data.length > 1 ? (
          <nav aria-label="Versões" className="flex flex-col gap-2 lg:items-end">
            <p className="text-sm font-medium">Todas as versões</p>
            <ul className="flex flex-wrap gap-2 lg:justify-end">
              {data.map((p) => (
                <li key={p.id}>
                  <Button asChild variant="outline">
                    <a href={`#${ancoraDaVersao(p.versao)}`} data-numero>
                      {p.versao}
                    </a>
                  </Button>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </section>

      <div className="flex flex-col gap-10">
        {data.map((p) => (
          <Versao key={p.id} patch={p} />
        ))}
      </div>
    </Moldura>
  );
}

/** Título fixo da página, nos quatro estados. */
function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Patch notes</h1>
        <p className="text-muted-foreground">O que mudou em cada versão do BARBOS.</p>
      </div>
      {children}
    </div>
  );
}

function Versao({ patch }: { patch: PatchNote }) {
  const idDoTitulo = `${ancoraDaVersao(patch.versao)}-titulo`;
  const partes = patch.secoes.length;

  return (
    <article
      id={ancoraDaVersao(patch.versao)}
      aria-labelledby={idDoTitulo}
      // scroll-mt: o cabeçalho é fixo, e o link do sino não pode parar com
      // o número da versão escondido atrás dele.
      className="flex scroll-mt-24 flex-col gap-4"
    >
      <header className="flex flex-col gap-2 rounded-lg border border-border bg-card p-5 sm:p-6">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span
            data-numero
            className="rounded-md bg-secondary px-2 py-0.5 text-base font-bold text-foreground"
          >
            Versão {patch.versao}
          </span>
          <time dateTime={patch.publicadoEm}>{diaDoMomento(patch.publicadoEm)}</time>
          {partes > 0 ? (
            <span data-numero>
              {partes} {partes === 1 ? "parte do sistema" : "partes do sistema"}
            </span>
          ) : null}
          {foiEditado(patch) ? <span>editada</span> : null}
        </p>
        <h2 id={idDoTitulo} className="text-2xl font-bold tracking-tight">
          {patch.titulo}
        </h2>
        {/* Largura de leitura: na tela toda a linha passaria de 150 letras. */}
        <p className="max-w-3xl whitespace-pre-line text-base text-foreground">{patch.texto}</p>
      </header>

      {partes > 0 ? (
        <ul
          aria-label={`O que mudou na versão ${patch.versao}`}
          className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3"
        >
          {patch.secoes.map((secao, i) => (
            // `flex` no item: os cartões da mesma linha ficam da mesma altura.
            <li key={`${patch.id}-${i}`} className="flex">
              <CartaoDaSecao secao={secao} />
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

/**
 * Uma parte do sistema que mudou, no seu cartão. A faixa âmbar à esquerda
 * é a mesma do cartão de seção no editor do admin: quem escreve vê a forma
 * que a barbearia vai ler.
 */
function CartaoDaSecao({ secao }: { secao: SecaoDoPatch }) {
  const [visorAberto, setVisorAberto] = useState(false);
  const [fotoAberta, setFotoAberta] = useState(0);

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-3 rounded-lg border border-l-4 border-border border-l-ambar-500 bg-card p-5">
      <h3 className="text-lg font-bold tracking-wide uppercase">{secao.titulo}</h3>
      <p className="whitespace-pre-line text-base text-foreground">{secao.texto}</p>

      {secao.link ? <BotaoDoLink link={secao.link} rotulo={secao.rotuloDoLink} /> : null}

      {secao.fotos.length > 0 ? (
        // Duas por linha a partir do celular deitado; a última sozinha
        // (ou a única) ocupa a linha inteira em vez de deixar um buraco.
        <ul className="grid gap-2 sm:grid-cols-2 sm:[&>li:last-child:nth-child(odd)]:col-span-2">
          {secao.fotos.map((foto, n) => (
            <li key={foto.caminho}>
              {foto.url ? (
                // O quadro aqui é pequeno para ler um print de tela: tocar
                // amplia num modal, sem sair do BARBOS.
                <button
                  type="button"
                  onClick={() => {
                    setFotoAberta(n);
                    setVisorAberto(true);
                  }}
                  aria-label={`${secao.titulo}: ampliar a foto ${n + 1}`}
                  className="block w-full cursor-zoom-in rounded-lg transition-shadow hover:ring-2 hover:ring-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <FotoDoPatch url={foto.url} alt={`${secao.titulo}: foto ${n + 1}`} />
                </button>
              ) : (
                <FotoDoPatch url="" alt="" />
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {secao.fotos.length > 0 ? (
        <VisorDeFotos
          titulo={secao.titulo}
          fotos={secao.fotos}
          aberto={visorAberto}
          indice={fotoAberta}
          aoFechar={() => setVisorAberto(false)}
          aoMudarIndice={setFotoAberta}
        />
      ) : null}
    </section>
  );
}

/**
 * O botão de uma seção (0046). Tela do sistema abre na mesma aba, como
 * qualquer link do menu; site de fora abre noutra, para a barbearia não
 * perder o BARBOS de vista. `outline`, nunca âmbar: a página é de leitura,
 * e com vários botões âmbar nenhum seria a ação.
 */
function BotaoDoLink({ link, rotulo }: { link: string; rotulo: string | null }) {
  const endereco = linkSeguro(link);
  if (!endereco) return null;

  const texto = rotulo?.trim() || ROTULO_PADRAO_DO_LINK;
  // Rótulo de até 40 letras não cabe numa linha no celular: quebra em vez
  // de vazar do cartão, sem deixar de ter 44px de altura.
  const forma = "h-auto min-h-11 max-w-full self-start py-2 text-left whitespace-normal";

  if (ehLinkInterno(endereco)) {
    return (
      <Button asChild variant="outline" className={forma}>
        <Link href={endereco}>
          {texto}
          <ArrowRight aria-hidden />
        </Link>
      </Button>
    );
  }

  return (
    <Button asChild variant="outline" className={forma}>
      <a href={endereco} target="_blank" rel="noopener noreferrer">
        {texto}
        <ExternalLink aria-hidden />
        <span className="sr-only">(abre noutra aba)</span>
      </a>
    </Button>
  );
}
