"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, RefreshCw } from "lucide-react";

import { BarraSuperior } from "@/components/agenda/barra-superior";
import { CalendarioFC } from "@/components/agenda/calendario-fc";
import { DialogoComanda } from "@/components/agenda/dialogo-comanda";
import { DialogoConfiguracao } from "@/components/agenda/dialogo-configuracao";
import { DialogoLinkAgendamento } from "@/components/agenda/dialogo-link-agendamento";
import { DialogoNovoAgendamento } from "@/components/agenda/dialogo-novo-agendamento";
import { mudarEstadoAgendamento } from "@/app/(sistema)/agenda/acoes";
import { Legenda } from "@/components/agenda/legenda";
import { PainelDia } from "@/components/agenda/painel-dia";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { buscarAgendaDoMes, buscarConfiguracao } from "@/lib/agenda/api";
import {
  lerBarbeiroSalvo,
  salvarBarbeiroEscolhido,
} from "@/lib/agenda/barbeiro-salvo";
import { buscarBarbeiros } from "@/lib/barbearia/api";
import { chaves } from "@/lib/query";
import {
  CONFIGURACAO_PADRAO,
  datasDeFolga,
  type Agendamento,
} from "@/lib/agenda/tipos";
import { hojeNaBarbearia, mesISO } from "@/lib/formato";

export function Agenda({
  mesInicial,
  slug,
}: {
  mesInicial: string;
  /** Apelido público da barbearia. Ausente = conta sem linha em `barbearias`. */
  slug?: string;
}) {
  const [mes, setMes] = useState(mesInicial);
  // `hojeNaBarbearia()` e nao `new Date()`: o servidor renderiza esta tela
  // antes do navegador, e em producao ele roda em UTC. Com dois relogios
  // diferentes, servidor e cliente escreviam datas diferentes no painel do
  // dia — que e exatamente o erro de hidratacao "server rendered text didn't
  // match". Com o fuso fixado, os dois chegam na mesma string.
  const [dia, setDia] = useState(hojeNaBarbearia);
  const [servicosAtivos, setServicosAtivos] = useState<Set<string>>(new Set());
  /**
   * Agenda própria: quem está selecionado na barra.
   *
   * Começa em `null` nas DUAS pontas, mesmo havendo escolha salva. Ler o
   * localStorage aqui era o erro de hidratação: no servidor não existe
   * `window`, então vinha `null` e o seletor renderizava "Barbeiro"; no
   * navegador vinha "Pablo" já no primeiro render. Textos diferentes no mesmo
   * nó = React joga fora a árvore e refaz tudo no cliente.
   *
   * Quem lê o que ficou salvo é o efeito lá embaixo, depois da hidratação.
   */
  const [barbeiroId, setBarbeiroId] = useState<string | null>(null);

  // `sessao` sobe a cada abertura e vira `key` do conteudo do modal: assim os
  // campos renascem com o que esta no banco, sem efeito colateral.
  const [config, setConfig] = useState({ aberto: false, sessao: 0 });
  const [linkAberto, setLinkAberto] = useState(false);
  // `emEdicao` presente = o mesmo modal abre no modo editar. Um modal só
  // para os dois: o formulário é o mesmo, e duplicá-lo seria duplicar também
  // a linha do tempo e a checagem de conflito.
  const [novo, setNovo] = useState<{
    aberto: boolean;
    sessao: number;
    emEdicao?: Agendamento;
  }>({ aberto: false, sessao: 0 });
  // A comanda guarda o agendamento inteiro, e não só o id: o modal mostra
  // nome, horário e o preço congelado do serviço, que já vieram na lista.
  const [comanda, setComanda] = useState<{
    aberto: boolean;
    agendamento: Agendamento | null;
  }>({ aberto: false, agendamento: null });

  const { avisar } = useToast();
  const clienteQuery = useQueryClient();

  function abrirConfiguracao() {
    setConfig((c) => ({ aberto: true, sessao: c.sessao + 1 }));
  }

  function abrirNovoAgendamento() {
    setNovo((n) => ({
      aberto: true,
      sessao: n.sessao + 1,
      emEdicao: undefined,
    }));
  }

  function abrirEdicao(agendamento: Agendamento) {
    setNovo((n) => ({
      aberto: true,
      sessao: n.sessao + 1,
      emEdicao: agendamento,
    }));
  }

  // Concluir deixou de ser um toque só: primeiro abre a comanda, o barbeiro
  // confere com o cliente o que ele consumiu, e só então fecha. É ali que o
  // valor é dito em voz alta.
  function abrirComanda(agendamento: Agendamento) {
    setComanda({ aberto: true, agendamento });
  }

  const concluir = useMutation({
    mutationFn: (a: Agendamento) => mudarEstadoAgendamento(a.id, "concluido"),
    onSuccess: (resultado, a) => {
      if (!resultado.ok) {
        avisar({
          tom: "erro",
          titulo: "Não consegui concluir",
          descricao: resultado.erro,
        });
        return;
      }
      setComanda((c) => ({ ...c, aberto: false }));
      clienteQuery.invalidateQueries({ queryKey: chaves.agenda.todas });
      avisar({
        tom: "sucesso",
        titulo: "Atendimento concluído",
        descricao: `${a.clienteNome} · ${a.horario}`,
      });
    },
    onError: (causa) => {
      console.error("[BARBOS] a ação não completou:", causa);
      avisar({
        tom: "erro",
        titulo: "Não consegui concluir",
        descricao: "Recarregue a página e tente de novo.",
      });
    },
  });

  const { data, isPending, isError, error, refetch, isRefetching } = useQuery({
    queryKey: chaves.agenda.mes(mes),
    queryFn: () => buscarAgendaDoMes(mes),
  });

  const { data: ajustes } = useQuery({
    queryKey: chaves.agenda.configuracao,
    queryFn: buscarConfiguracao,
  });

  const { data: barbeirosData } = useQuery({
    queryKey: chaves.barbearia.barbeiros,
    queryFn: buscarBarbeiros,
  });

  const barbeiros = useMemo(() => barbeirosData ?? [], [barbeirosData]);

  // Preferência salva: se o id ainda existe na equipe, usa; senão o primeiro.
  // Não zera o storage enquanto a lista carrega — isso apagava a escolha no F5.
  useEffect(() => {
    if (barbeiros.length === 0) return;

    setBarbeiroId((atual) => {
      const preferido = atual ?? lerBarbeiroSalvo();
      if (preferido && barbeiros.some((b) => b.id === preferido)) {
        return preferido;
      }
      return barbeiros[0].id;
    });
  }, [barbeiros]);

  function escolherBarbeiro(id: string) {
    setBarbeiroId(id);
    salvarBarbeiroEscolhido(id);
  }

  const configuracao = ajustes?.configuracao ?? CONFIGURACAO_PADRAO;
  const servicos = useMemo(() => ajustes?.servicos ?? [], [ajustes]);
  const folgas = useMemo(() => ajustes?.folgas ?? [], [ajustes]);
  const diasDeFolga = useMemo(() => datasDeFolga(folgas), [folgas]);

  // Desativado nao entra na legenda nem no filtro; o agendamento antigo dele
  // continua aparecendo no calendario, com a cor que tinha.
  const servicosVisiveis = useMemo(
    () => servicos.filter((s) => s.ativo),
    [servicos],
  );

  const agendamentos = useMemo(() => data ?? [], [data]);

  const visiveis = useMemo(() => {
    let lista = agendamentos;
    if (barbeiroId) {
      lista = lista.filter(
        (a) => !a.barbeiroId || a.barbeiroId === barbeiroId,
      );
    }
    if (servicosAtivos.size > 0) {
      lista = lista.filter((a) => servicosAtivos.has(a.servico.id));
    }
    return lista;
  }, [agendamentos, barbeiroId, servicosAtivos]);

  const doDia = useMemo(
    () => visiveis.filter((a) => a.data === dia),
    [visiveis, dia],
  );

  // Contagem sempre sobre o mês inteiro, não sobre o filtro: senão o número
  // de cada chip zeraria assim que outro chip fosse selecionado.
  const contagens = useMemo(() => {
    const c: Record<string, number> = {};
    for (const a of agendamentos) {
      c[a.servico.id] = (c[a.servico.id] ?? 0) + 1;
    }
    return c;
  }, [agendamentos]);

  function mudarMes(passo: -1 | 1) {
    const [ano, m] = mes.split("-").map(Number);
    setMes(mesISO(new Date(ano, m - 1 + passo, 1)));
  }

  function irParaHoje() {
    // Mesmo relógio do estado inicial — senão "Hoje" levaria para outro dia
    // depois das 21h em produção, que é justamente o fim do expediente.
    const hoje = hojeNaBarbearia();
    setMes(hoje.slice(0, 7));
    setDia(hoje);
  }

  function alternarServico(id: string) {
    setServicosAtivos((antes) => {
      const novo = new Set(antes);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <p className="font-semibold">A agenda não carregou</p>
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
    <div className="flex flex-col gap-4">
      <BarraSuperior
        mes={mes}
        aoIrParaHoje={irParaHoje}
        aoMudarMes={mudarMes}
        aoConfigurar={abrirConfiguracao}
        aoCriarLink={slug ? () => setLinkAberto(true) : undefined}
        aoNovoAgendamento={abrirNovoAgendamento}
        totalNoMes={visiveis.length}
        barbeiros={barbeiros}
        barbeiroId={barbeiroId}
        aoMudarBarbeiro={escolherBarbeiro}
      />

      {isPending ? (
        <div
          role="status"
          aria-label="Carregando agenda"
          className="h-12 animate-pulse rounded-lg border border-border bg-card"
        />
      ) : (
        <Legenda
          servicos={servicosVisiveis}
          ativos={servicosAtivos}
          aoAlternar={alternarServico}
          aoLimpar={() => setServicosAtivos(new Set())}
          contagens={contagens}
          aoConfigurar={abrirConfiguracao}
        />
      )}

      {/* No celular o painel do dia vem PRIMEIRO, e o calendário embaixo. A
          lista de hoje é o que o barbeiro consulta entre um cliente e outro;
          o calendário é navegação, usada quando ele quer outro dia. Deixar a
          navegação na frente obrigava a rolar a grade inteira do mês pra
          chegar no trabalho.

          No desktop cabem os dois lado a lado e a ordem volta ao normal, com
          o calendário na coluna larga — daí o `order` só a partir de `lg`.
          A ordem do DOM é a do celular de propósito: `order` muda o desenho,
          não a leitura, e é o celular que tem que bater. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
        <div className="lg:order-2">
          <PainelDia
            dia={dia}
            agendamentos={doDia}
            aoNovoAgendamento={abrirNovoAgendamento}
            aoEditar={abrirEdicao}
            aoConcluir={abrirComanda}
          />
        </div>

        <div className="min-w-0 lg:order-1">
          <CalendarioFC
            mes={mes}
            agendamentos={visiveis}
            diaSelecionado={dia}
            aoSelecionarDia={setDia}
            aoMudarMes={setMes}
            configuracao={configuracao}
            folgas={diasDeFolga}
          />
        </div>
      </div>

      {/* Alcance do polegar: no celular a ação principal fica no rodapé. */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:hidden">
        <Button size="lg" className="w-full" onClick={abrirNovoAgendamento}>
          <CalendarPlus />
          Novo agendamento
        </Button>
      </div>

      <DialogoConfiguracao
        aberto={config.aberto}
        sessao={config.sessao}
        aoMudarAberto={(aberto) => setConfig((c) => ({ ...c, aberto }))}
        configuracao={configuracao}
        servicos={servicos}
        folgas={folgas}
      />

      {slug ? (
        <DialogoLinkAgendamento
          aberto={linkAberto}
          aoMudarAberto={setLinkAberto}
          slug={slug}
          semEquipe={barbeiros.length === 0}
          semServico={servicosVisiveis.length === 0}
        />
      ) : null}

      <DialogoComanda
        aberto={comanda.aberto}
        aoMudarAberto={(aberto) => setComanda((c) => ({ ...c, aberto }))}
        agendamento={comanda.agendamento}
        aoConcluir={() => {
          if (comanda.agendamento) concluir.mutate(comanda.agendamento);
        }}
        concluindo={concluir.isPending}
      />

      <DialogoNovoAgendamento
        aberto={novo.aberto}
        sessao={novo.sessao}
        aoMudarAberto={(aberto) => setNovo((n) => ({ ...n, aberto }))}
        diaInicial={dia}
        emEdicao={novo.emEdicao}
        servicos={servicosVisiveis}
        barbeiros={barbeiros}
        barbeiroIdInicial={barbeiroId}
        agendamentos={agendamentos}
        configuracao={configuracao}
        folgas={diasDeFolga}
      />
    </div>
  );
}
