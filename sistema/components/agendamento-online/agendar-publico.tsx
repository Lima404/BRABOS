"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, CalendarPlus, Loader2 } from "lucide-react";

import {
  agendarPeloLink,
  buscarDiaPublico,
} from "@/app/(sistema)/agendar/acoes";
import {
  FormularioAgendamento,
  ID_FORMULARIO_AGENDAMENTO,
} from "@/components/agenda/formulario-agendamento";
import { LinhaDoTempoDia } from "@/components/agenda/linha-do-tempo-dia";
import { Alerta } from "@/components/ui/alerta";
import { Button } from "@/components/ui/button";
import { conflitoCom } from "@/lib/agenda/conflitos";
import type { DadosAgendamento } from "@/app/(sistema)/agenda/acoes";
import {
  ocupadoComoAgendamento,
  type AgendaPublica,
} from "@/lib/agendamento-online/tipos";
import { chaves } from "@/lib/query";
import { diaComSemana, hojeNaBarbearia } from "@/lib/formato";

/**
 * A tela que o cliente abre pelo link — sem conta, sem senha.
 *
 * Usa o MESMO `FormularioAgendamento` e a MESMA `LinhaDoTempoDia` do modal
 * interno. Duplicar os dois aqui significaria manter duas checagens de
 * conflito e dois desenhos de faixa horária, que divergem no primeiro ajuste.
 *
 * A diferença está nos dados, não na tela: a faixa mostra blocos escritos
 * "Ocupado", porque a RPC pública não devolve nome de cliente nenhum.
 */
export function AgendarPublico({
  inicial,
  slug,
}: {
  inicial: AgendaPublica;
  slug: string;
}) {
  const [data, setData] = useState(() => hojeNaBarbearia());
  const [clienteNome, setClienteNome] = useState("");
  const [barbeiroId, setBarbeiroId] = useState(inicial.barbeiros[0]?.id ?? "");
  const [servicoId, setServicoId] = useState(inicial.servicos[0]?.id ?? "");
  const [horario, setHorario] = useState(inicial.configuracao.abre);
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, setPendente] = useState(false);
  const [pronto, setPronto] = useState<{ data: string; horario: string } | null>(
    null,
  );

  // O dia muda quando o cliente troca a data; o resto (serviços, equipe,
  // expediente) não muda, então o `inicial` cobre enquanto a busca não volta.
  const { data: dia, isFetching } = useQuery({
    queryKey: chaves.agendarPublico.dia(slug, data),
    queryFn: () => buscarDiaPublico(slug, data),
    initialData: data === hojeNaBarbearia() ? inicial : undefined,
    staleTime: 0,
  });

  const agenda = dia ?? inicial;

  const servico = useMemo(
    () => agenda.servicos.find((s) => s.id === servicoId),
    [agenda.servicos, servicoId],
  );

  // Só os horários DESTE barbeiro viram bloco: o dia do colega não impede
  // ninguém, e mostrar tudo faria a faixa parecer lotada sem estar.
  const ocupados = useMemo(
    () =>
      agenda.ocupados
        .filter((o) => o.barbeiroId === barbeiroId)
        .map((o, i) => ocupadoComoAgendamento(o, data, i)),
    [agenda.ocupados, barbeiroId, data],
  );

  async function enviar(dados: DadosAgendamento) {
    setErro(null);

    if (dados.clienteNome.trim().length < 2) {
      setErro("Informe seu nome.");
      return;
    }
    if (!dados.barbeiroId) {
      setErro("Escolha com quem você quer se atender.");
      return;
    }
    if (!dados.servicoId) {
      setErro("Escolha o serviço.");
      return;
    }

    // Aviso antes de ir ao servidor. A barreira de verdade continua sendo a
    // trava do banco — entre desenhar a faixa e tocar em confirmar, alguém
    // pode ter pegado o mesmo horário.
    const choque = conflitoCom(
      {
        data: dados.data,
        horario: dados.horario,
        duracaoMin: servico?.duracaoMin ?? 30,
      },
      ocupados,
    );

    if (choque) {
      setErro("Esse horário já está ocupado. Escolha outro na faixa ao lado.");
      return;
    }

    setPendente(true);
    try {
      const resultado = await agendarPeloLink({
        slug,
        clienteNome: dados.clienteNome,
        barbeiroId: dados.barbeiroId,
        servicoId: dados.servicoId,
        data: dados.data,
        horario: dados.horario,
        observacao: dados.observacao,
      });

      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }

      setPronto({ data: resultado.data, horario: resultado.horario });
    } catch (causa) {
      console.error("[BARBOS] o agendamento não completou:", causa);
      setErro(
        "Não consegui falar com o servidor. Recarregue a página e tente de novo.",
      );
    } finally {
      setPendente(false);
    }
  }

  // Confirmação fica NA PÁGINA, não em toast: o cliente precisa reler o dia e
  // a hora, e um recado que some em quatro segundos não serve pra isso.
  if (pronto) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-lg border border-confirmado/40 bg-confirmado-fundo p-6 text-center">
        <CalendarCheck className="size-10 text-confirmado" aria-hidden="true" />
        <div>
          <h2 className="text-xl font-bold">Horário marcado</h2>
          <p className="mt-1 text-muted-foreground">
            {diaComSemana(pronto.data)} às{" "}
            <span data-numero className="font-semibold text-foreground">
              {pronto.horario}
            </span>
            {" — "}
            {agenda.barbearia.nome}.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Anote aí: não enviamos confirmação por mensagem ainda. Se precisar
          desmarcar, fale com a barbearia.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setPronto(null);
            setClienteNome("");
            setObservacao("");
          }}
        >
          <CalendarPlus />
          Marcar outro horário
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
      <div className="min-w-0">
        <FormularioAgendamento
          clienteNome={clienteNome}
          aoMudarClienteNome={setClienteNome}
          barbeiroId={barbeiroId}
          aoMudarBarbeiroId={setBarbeiroId}
          barbeiros={agenda.barbeiros.map((b) => ({
            ...b,
            // O formulário pede `Barbeiro` completo, mas a tela pública não
            // recebe telefone — e não deve mesmo. Campo vazio, não inventado.
            telefone: "",
          }))}
          servicoId={servicoId}
          aoMudarServicoId={setServicoId}
          data={data}
          aoMudarData={setData}
          horario={horario}
          aoMudarHorario={setHorario}
          observacao={observacao}
          aoMudarObservacao={setObservacao}
          servicos={agenda.servicos}
          erro={erro}
          aoSalvar={enviar}
        />

        <Button
          type="submit"
          size="lg"
          form={ID_FORMULARIO_AGENDAMENTO}
          className="mt-5 w-full sm:w-auto"
          disabled={pendente || agenda.servicos.length === 0}
        >
          {pendente ? <Loader2 className="animate-spin" /> : <CalendarPlus />}
          Confirmar horário
        </Button>

        {agenda.servicos.length === 0 ? (
          <Alerta tom="aviso" className="mt-4">
            Esta barbearia ainda não cadastrou serviços. Fale com ela pelo
            balcão.
          </Alerta>
        ) : null}
      </div>

      <div className="flex max-h-[28rem] min-h-72 flex-col overflow-hidden rounded-lg border border-border lg:max-h-[34rem]">
        <LinhaDoTempoDia
          data={data}
          horario={horario}
          duracaoMin={servico?.duracaoMin ?? 30}
          agendamentos={ocupados}
          configuracao={agenda.configuracao}
          servico={servico}
          aoEscolherHorario={setHorario}
        />
        {isFetching ? (
          <p
            role="status"
            className="border-t border-border px-4 py-2 text-xs text-muted-foreground"
          >
            Atualizando os horários deste dia…
          </p>
        ) : null}
      </div>
    </div>
  );
}
