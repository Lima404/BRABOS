"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Loader2 } from "lucide-react";

import {
  ajustarComanda,
  atualizarAgendamento,
  criarAgendamento,
  type DadosAgendamento,
  type Resultado,
} from "@/app/(sistema)/agenda/acoes";
import { ConsumoDoAtendimento } from "@/components/agenda/consumo-do-atendimento";
import {
  FormularioAgendamento,
  ID_FORMULARIO_AGENDAMENTO,
} from "@/components/agenda/formulario-agendamento";
import { LinhaDoTempoDia } from "@/components/agenda/linha-do-tempo-dia";
import { Alerta } from "@/components/ui/alerta";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import {
  linhaDoItem,
  mudancasDoConsumo,
  type LinhaConsumo,
} from "@/lib/agenda/comanda";
import { conflitoCom, mensagemDeConflito } from "@/lib/agenda/conflitos";
import {
  cabeNoExpediente,
  mensagemForaDoExpediente,
  proximoHorarioLivre,
} from "@/lib/agenda/horarios";
import { buscarComanda } from "@/lib/agenda/api";
import { buscarProdutos } from "@/lib/estoque/api";
import { chaves } from "@/lib/query";
import type {
  Agendamento,
  ConfiguracaoAgenda,
  Servico,
} from "@/lib/agenda/tipos";
import type { Barbeiro } from "@/lib/barbearia/tipos";
import {
  agoraNaBarbearia,
  diaComSemana,
  ehHoje,
  sanitizarNome,
} from "@/lib/formato";

/**
 * Modal de novo agendamento em duas colunas (referência tipo CRM/Outlook):
 * formulário à esquerda, linha do tempo do dia à direita.
 *
 * `sessao` remonta o conteúdo a cada abertura — data e horário nascem do
 * contexto da agenda, sem efeito colateral. E o horário nasce no PRÓXIMO
 * VAGO, não na abertura da loja: às 15h com a manhã cheia, "09:00" seria só
 * uma correção a mais para quem está atendendo.
 */
export function DialogoNovoAgendamento({
  aberto,
  sessao,
  aoMudarAberto,
  diaInicial,
  emEdicao,
  servicos,
  barbeiros,
  barbeiroIdInicial,
  agendamentos,
  configuracao,
  folgas,
}: {
  aberto: boolean;
  sessao: number;
  aoMudarAberto: (aberto: boolean) => void;
  /** AAAA-MM-DD — pré-preenche a data com o dia do painel. */
  diaInicial: string;
  /** Presente = editando esse agendamento; ausente = marcando um novo. */
  emEdicao?: Agendamento;
  servicos: Servico[];
  barbeiros: Barbeiro[];
  /** Barbeiro selecionado na barra da agenda — pré-preenche o form. */
  barbeiroIdInicial: string | null;
  /** Do mês carregado — a linha do tempo filtra pelo dia escolhido. */
  agendamentos: Agendamento[];
  configuracao: ConfiguracaoAgenda;
  /** Datas AAAA-MM-DD em que a barbearia não abre (migração 0020). */
  folgas: Set<string>;
}) {
  return (
    <Conteudo
      key={sessao}
      aberto={aberto}
      aoMudarAberto={aoMudarAberto}
      diaInicial={diaInicial}
      emEdicao={emEdicao}
      servicos={servicos}
      barbeiros={barbeiros}
      barbeiroIdInicial={barbeiroIdInicial}
      agendamentos={agendamentos}
      configuracao={configuracao}
      folgas={folgas}
    />
  );
}

function Conteudo({
  aberto,
  aoMudarAberto,
  diaInicial,
  emEdicao,
  servicos,
  barbeiros,
  barbeiroIdInicial,
  agendamentos,
  configuracao,
  folgas,
}: {
  aberto: boolean;
  aoMudarAberto: (aberto: boolean) => void;
  diaInicial: string;
  emEdicao?: Agendamento;
  servicos: Servico[];
  barbeiros: Barbeiro[];
  barbeiroIdInicial: string | null;
  agendamentos: Agendamento[];
  configuracao: ConfiguracaoAgenda;
  folgas: Set<string>;
}) {
  const clienteQuery = useQueryClient();
  const { avisar } = useToast();

  const [clienteNome, setClienteNome] = useState(
    sanitizarNome(emEdicao?.clienteNome ?? ""),
  );
  const [barbeiroId, setBarbeiroId] = useState(
    emEdicao?.barbeiroId ??
      barbeiroIdInicial ??
      barbeiros[0]?.id ??
      "",
  );
  const [servicoId, setServicoId] = useState(
    emEdicao?.servico.id ?? servicos[0]?.id ?? "",
  );
  const [data, setData] = useState(emEdicao?.data ?? diaInicial);
  const [horario, setHorario] = useState(() => {
    if (emEdicao) return emEdicao.horario;

    // Só lê o relógio com o modal ABERTO. Este conteúdo existe no render do
    // servidor com `aberto` falso, e ali `agoraNaBarbearia()` daria uma hora
    // que o navegador não repete um instante depois — hidratação quebrada
    // pelo mesmo motivo do seletor de barbeiro. Como a `key={sessao}` remonta
    // tudo a cada abertura, o cálculo acontece na hora certa: quando a pessoa
    // clica em "Novo agendamento".
    if (!aberto) return configuracao.abre;

    const duracaoMin =
      servicos.find((s) => s.id === servicoId)?.duracaoMin ?? 30;

    // Sem vaga hoje (dia cheio ou já passou de fechar) o campo volta para a
    // abertura: o dia escolhido é que está errado, e trocar a data é o
    // conserto — sugerir 18:45 num expediente que acabou seria pior.
    return (
      proximoHorarioLivre({
        data: diaInicial,
        duracaoMin,
        barbeiroId,
        agendamentos,
        configuracao,
        agora: ehHoje(diaInicial) ? agoraNaBarbearia() : null,
      }) ?? configuracao.abre
    );
  });
  const [observacao, setObservacao] = useState(emEdicao?.observacao ?? "");
  const [erro, setErro] = useState<string | null>(null);

  // ---- consumo (só na edição) ----
  const consulta = useQuery({
    queryKey: chaves.agenda.comanda(emEdicao?.id ?? ""),
    queryFn: () => buscarComanda(emEdicao!.id),
    enabled: Boolean(emEdicao) && aberto,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: produtos } = useQuery({
    queryKey: chaves.estoque.produtos,
    queryFn: buscarProdutos,
    enabled: Boolean(emEdicao) && aberto,
  });

  const originais = useMemo(() => consulta.data ?? [], [consulta.data]);

  // `null` = ninguém mexeu ainda, então a tela mostra o que veio do banco.
  // Sem efeito de sincronia: não dá para editar antes de carregar (o bloco
  // mostra esqueleto), então o rascunho nunca nasce de dado velho.
  const [rascunho, setRascunho] = useState<LinhaConsumo[] | null>(null);
  const linhas = useMemo(
    () => rascunho ?? originais.map(linhaDoItem),
    [rascunho, originais],
  );

  const vendaveis = useMemo(
    () => (produtos ?? []).filter((p) => p.precoCentavos > 0 && p.unidades >= 1),
    [produtos],
  );

  const servico = useMemo(
    () => servicos.find((s) => s.id === servicoId),
    [servicos, servicoId],
  );

  function aoEscrever(resultado: Resultado) {
    if (!resultado.ok) {
      setErro(resultado.erro);

      // Horário ocupado sobe como toast além do rodapé: este modal é alto e
      // tem duas colunas, e o recado do rodapé pode estar fora da vista de
      // quem acabou de mexer na faixa de horários do lado direito.
      if (resultado.motivo === "conflito") {
        avisar({
          tom: "erro",
          titulo: "Horário ocupado",
          descricao: resultado.erro,
        });
      }
      return;
    }

    setErro(null);
    clienteQuery.invalidateQueries({ queryKey: chaves.agenda.todas });
    // O consumo mexe em estoque: sem isto a tela de Estoque continuaria
    // mostrando a unidade que acabou de sair da prateleira.
    clienteQuery.invalidateQueries({ queryKey: chaves.estoque.todas });
    aoMudarAberto(false);
    avisar({
      tom: "sucesso",
      titulo: emEdicao ? "Agendamento atualizado" : "Agendamento marcado",
      descricao: `${clienteNome.trim()} · ${data.split("-").reverse().join("/")} às ${horario}`,
    });
  }

  const semRede = (causa: unknown) => {
    console.error("[BARBOS] a ação não completou:", causa);
    setErro(
      "Não consegui falar com o servidor. Recarregue a página e tente de novo.",
    );
  };

  const gravar = useMutation({
    mutationFn: async (dados: DadosAgendamento): Promise<Resultado> => {
      if (!emEdicao) return criarAgendamento(dados);

      const salvo = await atualizarAgendamento(emEdicao.id, dados);
      if (!salvo.ok) return salvo;

      const mudancas = mudancasDoConsumo(originais, linhas);
      if (mudancas.length === 0) return salvo;

      const consumo = await ajustarComanda(emEdicao.id, mudancas);

      // Os dois lados não são uma transação só: o agendamento já foi gravado
      // quando o consumo falha. Dizer isso é melhor que um "não consegui
      // salvar" que faria a pessoa refazer o que já está salvo.
      if (!consumo.ok) {
        return {
          ok: false,
          erro: `O agendamento foi salvo, mas o consumo não: ${consumo.erro}`,
        };
      }

      return consumo;
    },
    onSuccess: aoEscrever,
    onError: semRede,
  });

  function tentarSalvar(dados: DadosAgendamento) {
    if (dados.clienteNome.trim().length === 0) {
      setErro("Informe o nome do cliente.");
      return;
    }
    if (!dados.barbeiroId) {
      setErro("Escolha o barbeiro.");
      return;
    }
    if (!dados.servicoId) {
      setErro("Escolha o serviço.");
      return;
    }
    if (!dados.data) {
      setErro("Informe a data.");
      return;
    }
    if (!dados.horario) {
      setErro("Informe o horário.");
      return;
    }
    // Aviso antes do servidor, que recusa de novo: aqui dá pra dizer ONDE
    // desmarcar, e o servidor só sabe que o dia está fechado.
    if (folgas.has(dados.data)) {
      const frase =
        "Esse dia está marcado como folga. Desmarque em Configurar agenda ou escolha outra data.";
      setErro(frase);
      avisar({ tom: "erro", titulo: "Dia de folga", descricao: frase });
      return;
    }

    const duracao = servico?.duracaoMin ?? 30;
    if (!cabeNoExpediente(dados.horario, duracao, configuracao)) {
      const frase = mensagemForaDoExpediente(configuracao);
      setErro(frase);
      avisar({
        tom: "erro",
        titulo: "Fora do expediente",
        descricao: frase,
      });
      return;
    }

    // Aviso antes de ir ao servidor: aqui dá pra dizer QUEM ocupa o horário,
    // coisa que o erro do banco não conta. A barreira de verdade continua
    // sendo a restrição `agendamento_sem_sobreposicao` — esta checagem é
    // conveniência, e some quando a data escolhida está fora do mês
    // carregado, caso em que o servidor recusa do mesmo jeito.
    const jaOcupado = conflitoCom(
      {
        data: dados.data,
        horario: dados.horario,
        duracaoMin: duracao,
        barbeiroId: dados.barbeiroId,
      },
      agendamentos,
      // Editando, o agendamento não pode conflitar consigo mesmo: sem isto,
      // trocar só a observação seria recusado pelo próprio horário.
      emEdicao?.id,
    );

    if (jaOcupado) {
      const frase = mensagemDeConflito(jaOcupado);
      setErro(frase);
      avisar({ tom: "erro", titulo: "Horário ocupado", descricao: frase });
      return;
    }

    setErro(null);
    gravar.mutate(dados);
  }

  const semServico = servicos.length === 0;
  const semBarbeiro = barbeiros.length === 0;

  const doBarbeiro = useMemo(
    () =>
      barbeiroId
        ? agendamentos.filter((a) => a.barbeiroId === barbeiroId)
        : agendamentos,
    [agendamentos, barbeiroId],
  );

  return (
    <Modal
      aberto={aberto}
      aoMudarAberto={aoMudarAberto}
      tamanho="cheio"
      titulo={emEdicao ? "Editar agendamento" : "Novo agendamento"}
      descricao="Quem vem, o que faz e a que horas — a faixa da direita mostra o dia."
      classNameCorpo="p-0 overflow-hidden flex flex-col"
      rodape={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => aoMudarAberto(false)}
            disabled={gravar.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            size="lg"
            form={ID_FORMULARIO_AGENDAMENTO}
            disabled={gravar.isPending || semServico || semBarbeiro}
          >
            {gravar.isPending ? <Loader2 className="animate-spin" /> : null}
            <CalendarPlus />
            {emEdicao ? "Salvar" : "Agendar"}
          </Button>
        </>
      }
    >
      <div className="grid min-h-[min(28rem,55dvh)] flex-1 lg:grid-cols-[minmax(0,1fr)_17.5rem] xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
          <FormularioAgendamento
            clienteNome={clienteNome}
            aoMudarClienteNome={setClienteNome}
            barbeiroId={barbeiroId}
            aoMudarBarbeiroId={setBarbeiroId}
            barbeiros={barbeiros}
            servicoId={servicoId}
            aoMudarServicoId={setServicoId}
            data={data}
            aoMudarData={setData}
            horario={horario}
            aoMudarHorario={setHorario}
            observacao={observacao}
            aoMudarObservacao={setObservacao}
            servicos={servicos}
            erro={erro}
            aoSalvar={tentarSalvar}
          />

          {/* Fica visível enquanto a data estiver na folga — não some com o
              próximo toque, porque o motivo continua valendo. */}
          {folgas.has(data) ? (
            <div className="mt-4">
              <Alerta tom="aviso" titulo="Esse dia é folga">
                A barbearia não abre em {diaComSemana(data)}. Escolha outra
                data, ou desmarque a folga em Configurar agenda.
              </Alerta>
            </div>
          ) : null}

          {/* Fora do <form>: os botões de quantidade são do rascunho, e
              dentro do formulário eles disputariam o Enter com o Salvar. */}
          {emEdicao ? (
            <div className="mt-5">
              <ConsumoDoAtendimento
                linhas={linhas}
                aoMudarLinhas={setRascunho}
                produtos={vendaveis}
                carregando={consulta.isPending}
                erro={consulta.isError}
                desabilitado={gravar.isPending}
              />
            </div>
          ) : null}
        </div>

        <div className="flex min-h-0 max-h-[min(22rem,40dvh)] flex-col overflow-hidden border-t border-border lg:max-h-none lg:border-t-0">
          <LinhaDoTempoDia
            data={data}
            horario={horario}
            duracaoMin={servico?.duracaoMin ?? 30}
            agendamentos={
              emEdicao
                ? doBarbeiro.filter((x) => x.id !== emEdicao.id)
                : doBarbeiro
            }
            configuracao={configuracao}
            servico={servico}
            aoEscolherHorario={setHorario}
          />
        </div>
      </div>
    </Modal>
  );
}
