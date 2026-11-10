"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Building2, CalendarDays, ListFilter, RefreshCw } from "lucide-react";

import {
  listarBarbeariasDoPainel,
  obterMovimentoDoPainel,
} from "@/app/(sistema)/admin/acoes";
import { DialogoFiltrosAdmin } from "@/components/admin/dialogo-filtros-admin";
import { SeloDePagamento } from "@/components/admin/selo-pagamento";
import { CartoesBalanco } from "@/components/dashboard/cartoes-balanco";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Esqueleto } from "@/components/ui/esqueleto";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import {
  atributosDoFiltroAdmin,
  filtroAdminDaBusca,
  filtroAdminParaBusca,
  linhasDoMovimento,
  ROTULO_DO_PAGAMENTO,
  somaDasLinhas,
  type FiltroAdmin,
  type LinhaDoMovimento,
} from "@/lib/admin/filtros";
import { intervaloDoPeriodo, rotuloDoPeriodo } from "@/lib/dashboard/filtros";
import { RESUMO_VAZIO } from "@/lib/dashboard/tipos";
import { dadosOuErro } from "@/lib/consulta";
import { mesPorExtenso, moeda, numero } from "@/lib/formato";
import { chaves } from "@/lib/query";

/**
 * Painel Admin → Movimento: quanto cada barbearia movimentou.
 *
 * Só somas, nunca as linhas: quantos agendamentos, quanto de serviço,
 * quanto de loja. A regra do que conta é a do dashboard de cada uma — o
 * banco lê as mesmas views (`servicos_no_caixa`, `vendas_no_caixa`) — então
 * o número de uma barbearia aqui é o número que ela vê no dashboard dela.
 *
 * O filtro mora na URL, como no dashboard, e aplica com `pushState` pelo
 * mesmo motivo (ver o comentário em `components/dashboard/dashboard.tsx`).
 *
 * Duas consultas e não uma: a lista de barbearias é a MESMA chave da tela
 * Barbearias, então ir de uma tela para a outra não pede a lista de novo, e
 * trocar só o filtro de barbearia ou de pagamento não vai ao banco.
 */
export function Movimento({ mes }: { mes: string }) {
  const [filtrosAberto, setFiltrosAberto] = useState(false);
  // Uma `key` por abertura: o diálogo nasce do filtro aplicado, e um
  // rascunho abandonado não volta na próxima vez.
  const [aberturaDosFiltros, setAberturaDosFiltros] = useState(0);
  function abrirFiltros() {
    setAberturaDosFiltros((n) => n + 1);
    setFiltrosAberto(true);
  }

  const caminho = usePathname();
  const busca = useSearchParams();
  const filtro = useMemo(() => filtroAdminDaBusca(busca, mes), [busca, mes]);
  const { inicio, fim } = useMemo(
    () => intervaloDoPeriodo(filtro, mes),
    [filtro, mes],
  );

  const aplicar = useCallback(
    (novo: FiltroAdmin) => {
      const qs = filtroAdminParaBusca(novo, mes).toString();
      if (qs === busca.toString()) return;
      window.history.pushState(null, "", qs ? `${caminho}?${qs}` : caminho);
    },
    [busca, caminho, mes],
  );

  const barbeariasQ = useQuery({
    queryKey: chaves.admin.barbearias,
    queryFn: () => dadosOuErro(listarBarbeariasDoPainel()),
  });
  const movimentoQ = useQuery({
    queryKey: chaves.admin.movimento(inicio, fim),
    queryFn: () => dadosOuErro(obterMovimentoDoPainel(inicio, fim)),
  });

  const barbearias = useMemo(() => barbeariasQ.data ?? [], [barbeariasQ.data]);
  const linhas = useMemo(
    () => linhasDoMovimento(barbearias, movimentoQ.data ?? [], filtro),
    [barbearias, movimentoQ.data, filtro],
  );
  const soma = useMemo(() => somaDasLinhas(linhas), [linhas]);

  const nomes = useMemo(
    () => new Map(barbearias.map((b) => [b.id, b.nome])),
    [barbearias],
  );
  const criterios = atributosDoFiltroAdmin(filtro, mes, nomes).length;

  const frase = [
    rotuloDoPeriodo(filtro, mes) ?? mesPorExtenso(mes),
    filtro.pagamento !== "todas" ? ROTULO_DO_PAGAMENTO[filtro.pagamento] : null,
    filtro.barbeariaIds.length === 1
      ? (nomes.get(filtro.barbeariaIds[0]) ?? "1 barbearia")
      : filtro.barbeariaIds.length > 1
        ? `${filtro.barbeariaIds.length} barbearias`
        : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const atualizando = barbeariasQ.isRefetching || movimentoQ.isRefetching;
  function atualizar() {
    barbeariasQ.refetch();
    movimentoQ.refetch();
  }

  const cabecalho = (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Movimento</h1>
        <p className="text-muted-foreground">
          {frase} — só o que já foi atendido e pago.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={abrirFiltros}
        >
          <ListFilter />
          Filtros
          {criterios > 0 ? (
            <span
              data-numero
              className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground"
            >
              {criterios}
            </span>
          ) : null}
        </Button>
        <Button variant="ghost" onClick={atualizar} disabled={atualizando}>
          <RefreshCw className={atualizando ? "animate-spin" : undefined} />
          Atualizar
        </Button>
      </div>
    </header>
  );

  const dialogo = (
    <DialogoFiltrosAdmin
      key={aberturaDosFiltros}
      aberto={filtrosAberto}
      aoMudarAberto={setFiltrosAberto}
      valor={filtro}
      mesAtual={mes}
      barbearias={barbearias}
      aoAplicar={aplicar}
    />
  );

  const erro = barbeariasQ.error ?? movimentoQ.error;
  if (barbeariasQ.isError || movimentoQ.isError) {
    return (
      <div className="flex flex-col gap-6">
        {cabecalho}
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <p className="font-semibold">O movimento não carregou</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {erro instanceof Error
              ? erro.message
              : "Verifique a conexão e tente de novo."}
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={atualizar}
            disabled={atualizando}
          >
            <RefreshCw className={atualizando ? "animate-spin" : undefined} />
            Tentar de novo
          </Button>
        </div>
        {dialogo}
      </div>
    );
  }

  if (barbeariasQ.isPending || movimentoQ.isPending) {
    return (
      <div role="status" aria-label="Carregando o movimento" className="flex flex-col gap-6">
        {cabecalho}
        <div className="grid gap-4 lg:grid-cols-3">
          <Esqueleto className="h-28" />
          <Esqueleto className="h-28" />
          <Esqueleto className="h-28" />
        </div>
        <Esqueleto className="h-80" />
        {dialogo}
      </div>
    );
  }

  const comMovimento = linhas.filter(
    (l) => l.agendamentos + l.atendimentos + l.vendas > 0,
  ).length;

  return (
    <div className="flex flex-col gap-6">
      {cabecalho}

      <CartoesBalanco
        resumo={{
          ...RESUMO_VAZIO,
          servicoCentavos: soma.servicoCentavos,
          lojaCentavos: soma.lojaCentavos,
          atendimentos: soma.atendimentos,
          vendas: soma.vendas,
        }}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Numero
          icone={Building2}
          rotulo="Barbearias no recorte"
          valor={linhas.length}
          apoio={
            comMovimento === 1
              ? "1 com movimento no período"
              : `${comMovimento} com movimento no período`
          }
        />
        <Numero
          icone={CalendarDays}
          rotulo="Agendamentos"
          valor={soma.agendamentos}
          apoio="Marcados no período, sem os cancelados"
        />
      </div>

      {linhas.length === 0 ? (
        <EstadoVazio
          icone={Building2}
          titulo="Nenhuma barbearia neste recorte"
          descricao="O filtro de barbearias ou de pagamento deixou a lista vazia."
          acao={
            <Button variant="outline" onClick={() => aplicar({ ...filtro, barbeariaIds: [], pagamento: "todas" })}>
              Mostrar todas as barbearias
            </Button>
          }
        />
      ) : (
        <TabelaDoMovimento linhas={linhas} />
      )}

      {dialogo}
    </div>
  );
}

function Numero({
  icone: Icone,
  rotulo,
  valor,
  apoio,
}: {
  icone: typeof Building2;
  rotulo: string;
  valor: number;
  apoio: string;
}) {
  return (
    <article className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icone className="size-4 shrink-0" aria-hidden="true" />
        <h2 className="text-xs font-semibold tracking-wide uppercase">{rotulo}</h2>
      </div>
      <p data-numero className="text-2xl font-bold tracking-tight sm:text-3xl">
        {numero(valor)}
      </p>
      <p className="text-sm text-muted-foreground">{apoio}</p>
    </article>
  );
}

function TabelaDoMovimento({ linhas }: { linhas: LinhaDoMovimento[] }) {
  return (
    <section
      aria-labelledby="tabela-movimento"
      className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3">
        <h2 id="tabela-movimento" className="font-semibold">
          Por barbearia
        </h2>
        <span className="text-sm text-muted-foreground">Do maior total para o menor</span>
      </header>

      <div className="min-w-0 overflow-x-auto">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/40 text-muted-foreground">
              <th className="px-4 py-3 font-medium">Barbearia</th>
              <th className="px-4 py-3 font-medium">Pagamento</th>
              <th className="px-4 py-3 text-right font-medium">Agendamentos</th>
              <th className="px-4 py-3 text-right font-medium">Atendimentos</th>
              <th className="px-4 py-3 text-right font-medium">Serviços</th>
              <th className="px-4 py-3 text-right font-medium">Loja</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.barbeariaId} className="border-b border-border last:border-b-0">
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{l.barbearia.nome}</span>
                    {l.barbearia.admin ? <Badge variant="outline">Sua conta</Badge> : null}
                  </div>
                  <span className="text-muted-foreground">{l.barbearia.slug}</span>
                </td>
                <td className="px-4 py-3">
                  <SeloDePagamento situacao={l.barbearia.situacao} />
                </td>
                <td className="px-4 py-3 text-right">{numero(l.agendamentos)}</td>
                <td className="px-4 py-3 text-right">{numero(l.atendimentos)}</td>
                <td className="px-4 py-3 text-right">{moeda(l.servicoCentavos)}</td>
                <td className="px-4 py-3 text-right">{moeda(l.lojaCentavos)}</td>
                <td className="px-4 py-3 text-right font-semibold text-foreground">
                  {moeda(l.totalCentavos)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
