"use client";

import { useState } from "react";
import { Check } from "lucide-react";

import type { DadosServico } from "@/app/(sistema)/agenda/acoes";
import { Alerta } from "@/components/ui/alerta";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Input } from "@/components/ui/input";
import {
  CLASSES_SERVICO,
  CORES_SERVICO,
  DURACAO_MAX,
  DURACAO_MIN,
  NOME_DA_COR,
  type CorServico,
  type Servico,
} from "@/lib/agenda/tipos";
import {
  centavosDeTexto,
  duracaoPorExtenso,
  sanitizarNomeDeItem,
  textoDeCentavos,
} from "@/lib/formato";
import { cn } from "@/lib/utils";

/**
 * O botão de salvar mora no rodapé do modal, fora deste `<form>`, e se liga a
 * ele por `form={ID_FORMULARIO_SERVICO}`. Se mudar aqui, muda lá.
 */
export const ID_FORMULARIO_SERVICO = "formulario-servico";

/** Atalhos de duração. Cobrem quase todo cardápio de barbearia. */
const DURACOES_COMUNS = [20, 30, 45, 60, 90];

/**
 * Cadastro e edição de serviço.
 *
 * Vive dentro do modal de configuração como etapa, não como segundo modal: o
 * conteúdo troca e a seta de voltar acende no cabeçalho.
 */
export function FormularioServico({
  servico,
  aoSalvar,
}: {
  /** Ausente = cadastro novo. */
  servico?: Servico;
  aoSalvar: (dados: DadosServico) => void;
}) {
  const [nome, setNome] = useState(servico?.nome ?? "");
  const [preco, setPreco] = useState(
    servico ? textoDeCentavos(servico.precoCentavos) : "",
  );
  const [duracao, setDuracao] = useState(String(servico?.duracaoMin ?? 30));
  const [cor, setCor] = useState<CorServico>(servico?.cor ?? "azul");
  const [erro, setErro] = useState<string | null>(null);

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();

    const centavos = centavosDeTexto(preco);
    if (centavos === null) {
      setErro("Informe o valor como 45,00.");
      return;
    }

    const minutos = Number(duracao);
    if (
      !Number.isInteger(minutos) ||
      minutos < DURACAO_MIN ||
      minutos > DURACAO_MAX
    ) {
      setErro(
        `O intervalo vai de ${DURACAO_MIN} minutos a ${DURACAO_MAX / 60} horas.`,
      );
      return;
    }

    setErro(null);
    aoSalvar({
      id: servico?.id,
      nome,
      precoCentavos: centavos,
      duracaoMin: minutos,
      cor,
    });
  }

  return (
    <form
      id={ID_FORMULARIO_SERVICO}
      onSubmit={enviar}
      className="flex flex-col gap-5"
    >
      {/* O <Campo> amarra rótulo, ajuda e erro ao controle sozinho — o
          <Input> lá dentro se acha pelo contexto. */}
      <Campo id="servico-nome" rotulo="Nome do serviço">
        <Input
          value={nome}
          onChange={(e) => setNome(sanitizarNomeDeItem(e.target.value))}
          placeholder="CABELO + BARBA"
          maxLength={60}
          required
          autoFocus
        />
      </Campo>

      <div className="grid gap-5 sm:grid-cols-2">
        <Campo id="servico-preco" rotulo="Valor">
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
              R$
            </span>
            <Input
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
              placeholder="45,00"
              inputMode="decimal"
              className="pl-10"
              required
            />
          </div>
        </Campo>

        <Campo
          id="servico-duracao"
          rotulo="Intervalo (minutos)"
          ajuda="Quanto tempo da cadeira esse serviço ocupa. É o que define o fim do horário no calendário."
        >
          <Input
            value={duracao}
            onChange={(e) => setDuracao(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder="30"
            required
          />
        </Campo>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {DURACOES_COMUNS.map((m) => (
            <Button
              key={m}
              type="button"
              variant={Number(duracao) === m ? "secondary" : "outline"}
              size="sm"
              aria-pressed={Number(duracao) === m}
              onClick={() => setDuracao(String(m))}
            >
              {duracaoPorExtenso(m)}
            </Button>
          ))}
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm leading-none font-medium">
          Cor no calendário
        </legend>
        <div className="flex flex-wrap gap-2">
          {CORES_SERVICO.map((c) => {
            const classes = CLASSES_SERVICO[c];
            const escolhida = c === cor;

            return (
              <button
                key={c}
                type="button"
                onClick={() => setCor(c)}
                aria-pressed={escolhida}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  // Escolhida ganha fundo, borda, peso E marca de seleção:
                  // a cor sozinha não pode ser o único sinal.
                  escolhida
                    ? cn(
                        classes.fundo,
                        classes.texto,
                        classes.borda,
                        "font-semibold",
                      )
                    : "border-border text-muted-foreground hover:bg-secondary/60",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-3 shrink-0 rounded-full",
                    classes.pontoBg,
                  )}
                />
                {NOME_DA_COR[c]}
                {escolhida ? (
                  <Check className="size-4" aria-hidden="true" />
                ) : null}
              </button>
            );
          })}
        </div>
      </fieldset>

      {erro ? <Alerta>{erro}</Alerta> : null}
    </form>
  );
}
