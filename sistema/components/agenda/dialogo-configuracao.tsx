"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  Clock,
  EyeOff,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";

import {
  alternarServicoAtivo,
  excluirServico,
  salvarConfiguracao,
  salvarServico,
  type DadosServico,
  type Resultado,
} from "@/app/(sistema)/agenda/acoes";
import {
  FormularioServico,
  ID_FORMULARIO_SERVICO,
} from "@/components/agenda/formulario-servico";
import { Alerta } from "@/components/ui/alerta";
import { Button } from "@/components/ui/button";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { chaves } from "@/lib/query";
import {
  CLASSES_SERVICO,
  DIAS_SEMANA,
  type ConfiguracaoAgenda,
  type Servico,
} from "@/lib/agenda/tipos";
import { duracaoPorExtenso, moeda } from "@/lib/formato";
import { cn } from "@/lib/utils";

/**
 * Modal de configuração da agenda. Usa o `Modal` padrão do projeto — largura,
 * rolagem e comportamento no celular vêm de lá, não daqui.
 *
 * Duas coisas convivem neste modal de propósito, porque na cabeça do dono são
 * uma só ("como minha agenda funciona"): dias e horário de atendimento, que
 * salvam juntos no rodapé, e o cardápio de serviços, onde cada serviço é um
 * registro que salva sozinho.
 *
 * O cadastro de serviço TROCA o conteúdo do modal e acende a seta de voltar,
 * em vez de abrir um segundo modal por cima.
 */
export function DialogoConfiguracao({
  aberto,
  sessao,
  aoMudarAberto,
  configuracao,
  servicos,
}: {
  aberto: boolean;
  /** Muda a cada abertura: remonta o conteúdo com os valores do banco. */
  sessao: number;
  aoMudarAberto: (aberto: boolean) => void;
  configuracao: ConfiguracaoAgenda;
  servicos: Servico[];
}) {
  return (
    <Conteudo
      key={sessao}
      aberto={aberto}
      aoMudarAberto={aoMudarAberto}
      configuracao={configuracao}
      servicos={servicos}
    />
  );
}

/** `null` = cadastrando um serviço novo; `undefined` = nenhum em edição. */
type EmEdicao = Servico | null | undefined;

function Conteudo({
  aberto,
  aoMudarAberto,
  configuracao,
  servicos,
}: {
  aberto: boolean;
  aoMudarAberto: (aberto: boolean) => void;
  configuracao: ConfiguracaoAgenda;
  servicos: Servico[];
}) {
  const clienteQuery = useQueryClient();

  const [dias, setDias] = useState<number[]>(configuracao.diasAtendimento);
  const [abre, setAbre] = useState(configuracao.abre);
  const [fecha, setFecha] = useState(configuracao.fecha);
  const [erro, setErro] = useState<string | null>(null);
  const [emEdicao, setEmEdicao] = useState<EmEdicao>(undefined);

  /** Toda escrita recarrega configuração e agenda: a cor e a duração do
   *  serviço mudam o desenho dos eventos já na tela. */
  function aoEscrever(resultado: Resultado, depois?: () => void) {
    if (!resultado.ok) {
      setErro(resultado.erro);
      return;
    }
    setErro(null);
    clienteQuery.invalidateQueries({ queryKey: chaves.agenda.configuracao });
    clienteQuery.invalidateQueries({ queryKey: chaves.agenda.todas });
    depois?.();
  }

  /**
   * A ação já devolve erro traduzido em vez de estourar (ver `protegido()` em
   * `acoes.ts`). Chegar aqui significa que a REQUISIÇÃO não completou — rede
   * caiu, ou o servidor recompilou e o identificador da ação que esta aba
   * carregou não existe mais. O segundo caso é comum em desenvolvimento e a
   * saída é recarregar, então a mensagem diz isso.
   *
   * E registra o erro cru: mensagem traduzida sem log foi o que transformou o
   * caso do antivírus numa caçada às cegas.
   */
  const semRede = (causa: unknown) => {
    console.error("[BARBOS] a ação não completou:", causa);
    setErro(
      "Não consegui falar com o servidor. Recarregue a página e tente de novo.",
    );
  };

  const gravarConfiguracao = useMutation({
    mutationFn: salvarConfiguracao,
    onSuccess: (r) => aoEscrever(r, () => aoMudarAberto(false)),
    onError: semRede,
  });

  const gravarServico = useMutation({
    mutationFn: salvarServico,
    onSuccess: (r) => aoEscrever(r, () => setEmEdicao(undefined)),
    onError: semRede,
  });

  const alternarAtivo = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) =>
      alternarServicoAtivo(id, ativo),
    onSuccess: (r) => aoEscrever(r, () => setEmEdicao(undefined)),
    onError: semRede,
  });

  const apagar = useMutation({
    mutationFn: excluirServico,
    onSuccess: (r) => aoEscrever(r, () => setEmEdicao(undefined)),
    onError: semRede,
  });

  function alternarDia(numero: number) {
    setDias((antes) =>
      antes.includes(numero)
        ? antes.filter((d) => d !== numero)
        : [...antes, numero].sort((a, b) => a - b),
    );
  }

  function voltarParaLista() {
    setErro(null);
    setEmEdicao(undefined);
  }

  // ---------------- etapa: cadastro / edição de serviço ----------------

  if (emEdicao !== undefined) {
    const servico = emEdicao ?? undefined;

    return (
      <Modal
        aberto={aberto}
        aoMudarAberto={aoMudarAberto}
        tamanho="grande"
        titulo={servico ? "Editar serviço" : "Novo serviço"}
        descricao="Nome, valor e quanto tempo ocupa a cadeira."
        aoVoltar={voltarParaLista}
        rodape={
          <>
            <Button type="button" variant="outline" onClick={voltarParaLista}>
              Cancelar
            </Button>
            {/* Fora do <form>, ligado a ele pelo atributo `form`: assim o
                botão principal mora no rodapé fixo, junto dos outros. */}
            <Button
              type="submit"
              size="lg"
              form={ID_FORMULARIO_SERVICO}
              disabled={gravarServico.isPending}
            >
              {gravarServico.isPending ? (
                <Loader2 className="animate-spin" />
              ) : null}
              {servico ? "Salvar serviço" : "Cadastrar serviço"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-6">
          <FormularioServico
            servico={servico}
            aoSalvar={(dados: DadosServico) => gravarServico.mutate(dados)}
          />

          {erro ? <Alerta>{erro}</Alerta> : null}

          {servico ? (
            <div className="flex flex-col gap-3 border-t border-border pt-5">
              <p className="text-sm text-muted-foreground">
                Serviço que já foi agendado não pode ser apagado — o histórico
                aponta pra ele. Nesse caso, desative: ele some da agenda e dos
                filtros, mas o passado continua de pé.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="sm:flex-1"
                  disabled={alternarAtivo.isPending}
                  onClick={() =>
                    alternarAtivo.mutate({
                      id: servico.id,
                      ativo: !servico.ativo,
                    })
                  }
                >
                  <EyeOff />
                  {servico.ativo ? "Desativar serviço" : "Reativar serviço"}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="sm:flex-1"
                  disabled={apagar.isPending}
                  onClick={() => apagar.mutate(servico.id)}
                >
                  <Trash2 />
                  Excluir
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </Modal>
    );
  }

  // ---------------- etapa: configuração da agenda ----------------

  const ativos = servicos.filter((s) => s.ativo);
  const desativados = servicos.filter((s) => !s.ativo);

  return (
    <Modal
      aberto={aberto}
      aoMudarAberto={aoMudarAberto}
      tamanho="grande"
      titulo="Configurar agenda"
      descricao="Quando a barbearia atende e quanto tempo cada serviço ocupa."
      rodape={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => aoMudarAberto(false)}
            disabled={gravarConfiguracao.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="lg"
            disabled={gravarConfiguracao.isPending}
            onClick={() =>
              gravarConfiguracao.mutate({ diasAtendimento: dias, abre, fecha })
            }
          >
            {gravarConfiguracao.isPending ? (
              <Loader2 className="animate-spin" />
            ) : null}
            Salvar configuração
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-7">
        {/* Dias e horário empilhados, e não lado a lado: em duas colunas os
            sete dias não cabem numa linha só e quebram no meio da semana —
            a fileira contínua é justamente o que faz a semana ser lida de
            relance. */}
        <div className="flex flex-col gap-7">
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-sm leading-none font-semibold">
              Dias de atendimento
            </legend>
            <div className="flex flex-wrap gap-2">
              {DIAS_SEMANA.map((d) => {
                const atende = dias.includes(d.numero);
                return (
                  <button
                    key={d.numero}
                    type="button"
                    onClick={() => alternarDia(d.numero)}
                    aria-pressed={atende}
                    aria-label={d.nome}
                    className={cn(
                      "min-h-11 min-w-14 rounded-lg border px-3 text-sm font-medium transition-colors",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                      atende
                        ? "border-primary bg-primary font-semibold text-primary-foreground"
                        : "border-border text-muted-foreground hover:bg-secondary/60",
                    )}
                  >
                    {d.curto}
                  </button>
                );
              })}
            </div>
            <p className="text-sm text-muted-foreground">
              Os dias sem atendimento aparecem sombreados no calendário.
            </p>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-sm leading-none font-semibold">
              Horário de atendimento
            </legend>
            {/* Os dois campos são curtos: presos a `max-w-sm` eles ficam do
                tamanho do dado, em vez de esticados de ponta a ponta. */}
            <div className="grid max-w-sm grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="config-abre">Abre</Label>
                <Input
                  id="config-abre"
                  type="time"
                  value={abre}
                  onChange={(e) => setAbre(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="config-fecha">Fecha</Label>
                <Input
                  id="config-fecha"
                  type="time"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  required
                />
              </div>
            </div>
          </fieldset>
        </div>

        <section className="flex flex-col gap-3 border-t border-border pt-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Serviços e intervalos</h3>
            <span className="text-sm text-muted-foreground">
              <span data-numero>{ativos.length}</span> ativo
              {ativos.length === 1 ? "" : "s"}
            </span>
          </div>

          {servicos.length === 0 ? (
            <EstadoVazio
              icone={Clock}
              titulo="Nenhum serviço cadastrado"
              descricao="Sem serviço não dá pra marcar horário. Comece pelo mais pedido."
            />
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {[...ativos, ...desativados].map((s) => (
                <li key={s.id}>
                  <LinhaServico servico={s} aoEditar={() => setEmEdicao(s)} />
                </li>
              ))}
            </ul>
          )}

          <Button
            type="button"
            variant="secondary"
            className="sm:self-start"
            onClick={() => {
              setErro(null);
              setEmEdicao(null);
            }}
          >
            <Plus />
            Cadastrar serviço
          </Button>
        </section>

        {erro ? <Alerta>{erro}</Alerta> : null}
      </div>
    </Modal>
  );
}

function LinhaServico({
  servico,
  aoEditar,
}: {
  servico: Servico;
  aoEditar: () => void;
}) {
  const c = CLASSES_SERVICO[servico.cor];

  return (
    <button
      type="button"
      onClick={aoEditar}
      className={cn(
        "flex min-h-11 w-full items-center gap-3 rounded-lg border border-border border-l-[3px] p-3 text-left transition-colors",
        "hover:bg-secondary/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        c.borda,
        !servico.ativo && "opacity-70",
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-2.5 shrink-0 rounded-full", c.pontoBg)}
      />

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate font-semibold">{servico.nome}</span>
          {/* Desativado nunca é dito só pelo cinza. */}
          {!servico.ativo ? (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">
              Desativado
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-sm text-muted-foreground">
          <span data-numero>{moeda(servico.precoCentavos)}</span>
          {" · "}
          <span data-numero>{duracaoPorExtenso(servico.duracaoMin)}</span>
        </span>
      </span>

      <ChevronRight
        className="size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
    </button>
  );
}
