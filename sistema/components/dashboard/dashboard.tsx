"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ListFilter, RefreshCw } from "lucide-react";

import { CartoesBalanco } from "@/components/dashboard/cartoes-balanco";
import { ComparativoMeses } from "@/components/dashboard/comparativo-meses";
import { DialogoFiltrosDashboard } from "@/components/dashboard/dialogo-filtros";
import { Rosca, type Fatia } from "@/components/dashboard/rosca";
import { Button } from "@/components/ui/button";
import { buscarResumoDashboard } from "@/lib/dashboard/api";
import { useCoresDoGrafico } from "@/lib/dashboard/cores";
import {
  chaveDoIntervalo,
  contarCriteriosAtivos,
  filtroPadrao,
  intervaloDoFiltro,
  resumoDoFiltro,
  type FiltroDashboard,
} from "@/lib/dashboard/filtros";
import { RESUMO_VAZIO } from "@/lib/dashboard/tipos";
import { chaves } from "@/lib/query";
import { mesPorExtenso, moeda } from "@/lib/formato";

/**
 * O dashboard.
 *
 * Filtros (período, serviços, barbeiros, só loja) mudam a query — a RPC
 * `resumo_dashboard` (0016) devolve os números do recorte.
 */
export function Dashboard({ mes }: { mes: string }) {
  const cores = useCoresDoGrafico();
  const [filtrosAberto, setFiltrosAberto] = useState(false);
  const [filtro, setFiltro] = useState<FiltroDashboard>(() =>
    filtroPadrao(mes),
  );

  const intervalo = useMemo(
    () => intervaloDoFiltro(filtro, mes),
    [filtro, mes],
  );
  const chaveFiltro = useMemo(() => chaveDoIntervalo(intervalo), [intervalo]);

  const { data, isPending, isError, error, refetch, isRefetching } = useQuery({
    queryKey: chaves.dashboard.resumo(chaveFiltro),
    queryFn: () => buscarResumoDashboard(intervalo),
  });

  const resumo = data ?? RESUMO_VAZIO;
  const criterios = contarCriteriosAtivos(filtro, mes);
  const fraseFiltro = resumoDoFiltro(filtro, mes);

  const rotuloPeriodo = useMemo(() => {
    if (filtro.periodo === "mes" && (!filtro.mes || filtro.mes === mes)) {
      return mesPorExtenso(mes);
    }
    if (fraseFiltro) return fraseFiltro;
    return mesPorExtenso(mes);
  }, [filtro, fraseFiltro, mes]);

  const fatiasDeServico = useMemo<Fatia[]>(
    () =>
      resumo.servicos.map((s) => ({
        nome: s.nome,
        valor: s.quantidade,
        detalhe: moeda(s.totalCentavos),
        cor: cores.porNome[s.cor],
      })),
    [resumo.servicos, cores],
  );

  const fatiasDeProduto = useMemo<Fatia[]>(
    () =>
      resumo.produtos.map((p, i) => ({
        nome: p.nome,
        valor: p.quantidade,
        detalhe: moeda(p.totalCentavos),
        cor: cores.paleta[i % cores.paleta.length],
      })),
    [resumo.produtos, cores],
  );

  if (isError) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <p className="font-semibold">O dashboard não carregou</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
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

  if (isPending) {
    return (
      <div
        role="status"
        aria-label="Carregando o dashboard"
        className="flex flex-col gap-6"
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-lg border border-border bg-card"
            />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="h-80 animate-pulse rounded-lg border border-border bg-card" />
          <div className="h-80 animate-pulse rounded-lg border border-border bg-card" />
        </div>
        <div className="h-96 animate-pulse rounded-lg border border-border bg-card" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            {rotuloPeriodo} — só o que já foi atendido e pago.
            {fraseFiltro && filtro.periodo === "mes" && filtro.mes === mes ? (
              <>
                {" "}
                <span className="text-foreground">Filtro: {fraseFiltro}</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setFiltrosAberto(true)}
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
          <Button
            variant="ghost"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={isRefetching ? "animate-spin" : undefined} />
            Atualizar
          </Button>
        </div>
      </header>

      <CartoesBalanco resumo={resumo} />

      <div className="grid gap-4 xl:grid-cols-2">
        <Rosca
          titulo={filtro.soLoja ? "Serviços" : "Serviços do período"}
          descricao="Qual serviço tem mais procura — e quanto cada um rendeu."
          fatias={fatiasDeServico}
          totalRotulo="atendimentos"
          vazio={
            filtro.soLoja
              ? "Filtro só loja — serviços ficam de fora."
              : "Nenhum atendimento concluído neste recorte."
          }
        />

        <Rosca
          titulo="Produtos vendidos"
          descricao="Do mais saído ao que fica na prateleira."
          fatias={fatiasDeProduto}
          totalRotulo="itens"
          vazio="Nenhum produto vendido neste recorte."
        />
      </div>

      <ComparativoMeses meses={resumo.meses} />

      <DialogoFiltrosDashboard
        aberto={filtrosAberto}
        aoMudarAberto={setFiltrosAberto}
        valor={filtro}
        mesAtual={mes}
        aoAplicar={setFiltro}
      />
    </div>
  );
}
