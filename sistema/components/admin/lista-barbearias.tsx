"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, RefreshCw, Search } from "lucide-react";

import { listarBarbeariasDoPainel } from "@/app/(sistema)/admin/acoes";
import { SeloDePagamento } from "@/components/admin/selo-pagamento";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Opcao } from "@/components/ui/campo";
import { Esqueleto } from "@/components/ui/esqueleto";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Input } from "@/components/ui/input";
import { RadioGrupo, RadioItem } from "@/components/ui/radio";
import {
  ehAdimplente,
  NOME_DO_PLANO,
  type BarbeariaNoPainel,
} from "@/lib/admin/tipos";
import type { PagamentoDoFiltro } from "@/lib/admin/filtros";
import { dadosOuErro } from "@/lib/consulta";
import {
  dataCurta,
  diaDoMomento,
  linkDoWhatsApp,
  mascararTelefone,
  sanitizarTextoLivre,
  semAcento,
} from "@/lib/formato";
import { chaves } from "@/lib/query";

/**
 * Painel Admin → Barbearias: todas as contas e se pagaram.
 *
 * A pergunta da tela é "quem está devendo?", então o filtro de pagamento
 * vem antes da pesquisa, com a contagem de cada lado escrita na opção — dá
 * para responder sem clicar.
 */
export function ListaDeBarbearias() {
  const [pagamento, setPagamento] = useState<PagamentoDoFiltro>("todas");
  const [busca, setBusca] = useState("");

  const { data, isPending, isError, error, refetch, isRefetching } = useQuery({
    queryKey: chaves.admin.barbearias,
    queryFn: () => dadosOuErro(listarBarbeariasDoPainel()),
  });

  const barbearias = useMemo(() => data ?? [], [data]);

  const contagem = useMemo(() => {
    const adimplentes = barbearias.filter((b) => ehAdimplente(b.situacao)).length;
    return {
      todas: barbearias.length,
      adimplentes,
      inadimplentes: barbearias.length - adimplentes,
    };
  }, [barbearias]);

  const visiveis = useMemo(() => {
    const termo = semAcento(busca.trim()).toLowerCase();
    return barbearias
      .filter((b) =>
        pagamento === "todas"
          ? true
          : pagamento === "adimplentes"
            ? ehAdimplente(b.situacao)
            : !ehAdimplente(b.situacao),
      )
      .filter((b) => {
        if (!termo) return true;
        return [b.nome, b.slug, b.email ?? "", b.telefone ?? ""].some((campo) =>
          semAcento(campo).toLowerCase().includes(termo),
        );
      });
  }, [barbearias, busca, pagamento]);

  const cabecalho = (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Barbearias</h1>
        <p className="text-muted-foreground">
          Todas as contas do BARBOS e o pagamento de cada uma.
        </p>
      </div>
      <Button
        variant="ghost"
        onClick={() => refetch()}
        disabled={isRefetching}
      >
        <RefreshCw className={isRefetching ? "animate-spin" : undefined} />
        Atualizar
      </Button>
    </header>
  );

  if (isError) {
    return (
      <div className="flex flex-col gap-6">
        {cabecalho}
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <p className="font-semibold">A lista de barbearias não carregou</p>
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
      </div>
    );
  }

  if (isPending) {
    return (
      <div role="status" aria-label="Carregando as barbearias" className="flex flex-col gap-6">
        {cabecalho}
        <Esqueleto className="h-24" />
        <Esqueleto className="h-80" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {cabecalho}

      <section
        aria-label="Filtrar barbearias"
        className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
      >
        <RadioGrupo
          value={pagamento}
          onValueChange={(v) => setPagamento(v as PagamentoDoFiltro)}
          aria-label="Pagamento"
          className="grid gap-1 sm:grid-cols-3"
        >
          <Opcao
            htmlFor="barbearias-todas"
            rotulo={`Todas (${contagem.todas})`}
            controle={<RadioItem id="barbearias-todas" value="todas" />}
          />
          <Opcao
            htmlFor="barbearias-adimplentes"
            rotulo={`Adimplentes (${contagem.adimplentes})`}
            ajuda="Em dia ou liberadas à mão"
            controle={<RadioItem id="barbearias-adimplentes" value="adimplentes" />}
          />
          <Opcao
            htmlFor="barbearias-inadimplentes"
            rotulo={`Inadimplentes (${contagem.inadimplentes})`}
            ajuda="Em tolerância ou bloqueadas"
            controle={<RadioItem id="barbearias-inadimplentes" value="inadimplentes" />}
          />
        </RadioGrupo>

        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={busca}
            onChange={(e) => setBusca(sanitizarTextoLivre(e.target.value))}
            placeholder="Nome, apelido, e-mail ou telefone"
            className="pl-9"
            aria-label="Pesquisar barbearia"
          />
        </div>
      </section>

      {visiveis.length === 0 ? (
        <EstadoVazio
          icone={Building2}
          titulo={
            barbearias.length === 0
              ? "Nenhuma barbearia cadastrada ainda"
              : "Nenhuma barbearia neste filtro"
          }
          descricao={
            barbearias.length === 0
              ? "As contas aparecem aqui assim que alguém assina e cria o cadastro."
              : "Troque o filtro de pagamento ou apague a pesquisa."
          }
          acao={
            barbearias.length === 0 ? undefined : (
              <Button
                variant="outline"
                onClick={() => {
                  setPagamento("todas");
                  setBusca("");
                }}
              >
                Mostrar todas
              </Button>
            )
          }
        />
      ) : (
        <TabelaDeBarbearias barbearias={visiveis} />
      )}
    </div>
  );
}

function TabelaDeBarbearias({ barbearias }: { barbearias: BarbeariaNoPainel[] }) {
  return (
    <section
      aria-labelledby="tabela-barbearias"
      className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3">
        <h2 id="tabela-barbearias" className="font-semibold">
          Contas
        </h2>
        <span className="text-sm text-muted-foreground" data-numero>
          {barbearias.length === 1 ? "1 barbearia" : `${barbearias.length} barbearias`}
        </span>
      </header>

      <div className="min-w-0 overflow-x-auto">
        <table className="w-full min-w-[60rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/40 text-muted-foreground">
              <th className="px-4 py-3 font-medium">Barbearia</th>
              <th className="px-4 py-3 font-medium">Pagamento</th>
              <th className="px-4 py-3 font-medium">Plano</th>
              <th className="px-4 py-3 font-medium">Acesso até</th>
              <th className="px-4 py-3 font-medium">Contato</th>
              <th className="px-4 py-3 font-medium">Cadastro</th>
              <th className="px-4 py-3 font-medium">Último acesso</th>
            </tr>
          </thead>
          <tbody>
            {barbearias.map((b) => {
              const whatsapp = linkDoWhatsApp(b.telefone, "");
              return (
                <tr key={b.id} className="border-b border-border last:border-b-0 align-top">
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{b.nome}</span>
                      {b.admin ? <Badge variant="outline">Sua conta</Badge> : null}
                    </div>
                    <span className="text-muted-foreground">{b.slug}</span>
                  </td>
                  <td className="px-4 py-3">
                    <SeloDePagamento situacao={b.situacao} />
                  </td>
                  <td className="px-4 py-3">
                    {b.plano ? (NOME_DO_PLANO[b.plano] ?? b.plano) : "Sem plano"}
                  </td>
                  <td className="px-4 py-3">
                    {b.valeAte ? (
                      <time dateTime={b.valeAte}>{dataCurta(b.valeAte)}</time>
                    ) : (
                      <span className="text-muted-foreground">
                        {b.situacao === "liberada" ? "Sem vencimento" : "—"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      {b.email ? <span className="break-all">{b.email}</span> : null}
                      {b.telefone ? (
                        whatsapp ? (
                          <a
                            href={whatsapp}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-11 items-center text-foreground underline underline-offset-4 hover:no-underline"
                            aria-label={`Abrir conversa no WhatsApp com ${b.nome}`}
                          >
                            {mascararTelefone(b.telefone)}
                          </a>
                        ) : (
                          <span>{mascararTelefone(b.telefone)}</span>
                        )
                      ) : null}
                      {!b.email && !b.telefone ? (
                        <span className="text-muted-foreground">Sem contato</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <time dateTime={b.criadaEm}>{diaDoMomento(b.criadaEm)}</time>
                  </td>
                  <td className="px-4 py-3">
                    {b.ultimoAcesso ? (
                      <time dateTime={b.ultimoAcesso}>{diaDoMomento(b.ultimoAcesso)}</time>
                    ) : (
                      <span className="text-muted-foreground">Nunca entrou</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
