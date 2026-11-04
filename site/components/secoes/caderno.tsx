import type { CSSProperties } from "react";

import { Cena } from "@/components/ui/cena";
import { degrau } from "@/lib/coreografia";
import { OUTUBRO, SERVICOS } from "@/lib/dados";

/**
 * O caderno virando sistema.
 *
 * O manual de marca abre dizendo que "o concorrente do BARBOS é o caderno
 * físico, não outro software". Esta seção é essa frase, feita de pixel: a
 * foto de um caderno de verdade some da esquerda para a direita conforme a
 * pessoa rola, e por baixo dela aparece o mês organizado.
 *
 * O corte é um `clip-path` comandado pela mesma variável `--p` de todas as
 * outras seções — nenhuma imagem é trocada, nenhum opacity pisca.
 */
export function Caderno() {
  return (
    <section
      id="caderno"
      className="relative border-t border-graf-800 py-24 sm:py-28"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.2em] text-ambar-500 uppercase">
            Por que trocar
          </p>
          <h2 className="mt-5 text-3xl leading-tight font-bold text-balance sm:text-4xl">
            O concorrente do BARBOS não é outro aplicativo. É o caderno.
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-graf-300">
            Ele funciona — até o dia em que molha, some, fica na outra loja
            ou tem o horário escrito com a letra do colega. Role e veja o
            mesmo mês dos dois jeitos.
          </p>
        </div>
      </div>

      <Cena className="relative mt-14 h-[160vh] lg:h-[210vh]" modo="presa">
        <div className="sticky top-24">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="relative aspect-[3/2] overflow-hidden rounded-xl border border-graf-700 shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
              {/* Em baixo, sempre: o mês organizado. */}
              <div className="absolute inset-0 bg-graf-950 p-4 sm:p-7">
                <MesOrganizado />
              </div>

              {/* Em cima: a foto do caderno, que encolhe para a esquerda.
                  `background-image` em vez de <img> porque aqui a imagem é
                  cenário, não conteúdo — e assim o corte e o recorte da
                  foto ficam na mesma declaração. */}
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={
                  {
                    backgroundImage: "url(/caderno.webp)",
                    clipPath:
                      "inset(0 calc(var(--p) * 100%) 0 0)",
                  } as CSSProperties
                }
                aria-hidden="true"
              />

              {/* A linha âmbar que corta — é ela que diz "isto está sendo
                  substituído agora". */}
              <div
                className="absolute inset-y-0 w-px bg-ambar-500 shadow-[0_0_24px_4px_rgba(240,169,59,0.55)]"
                style={
                  {
                    left: "calc((1 - var(--p)) * 100%)",
                    opacity: "calc(min(var(--p), 1 - var(--p)) * 4)",
                  } as CSSProperties
                }
                aria-hidden="true"
              />

              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-linear-to-t from-graf-950 to-transparent p-4 sm:p-6">
                <span className="rounded-md bg-graf-950/80 px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-graf-300 uppercase">
                  O caderno
                </span>
                <span className="rounded-md bg-ambar-500 px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-graf-900 uppercase">
                  O BARBOS
                </span>
              </div>
            </div>

          </div>
        </div>
      </Cena>

      {/*
        As duas listas ficam FORA da cena presa de propósito. Dentro dela,
        a imagem e as listas somavam mais que a altura da tela, e o pé da
        comparação ficava cortado durante toda a rolagem — só aparecia
        quando o `sticky` soltava, que é tarde demais para servir de
        argumento.
      */}
      <Cena className="mx-auto mt-16 max-w-5xl px-4 sm:px-6">
        <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
          <Lado
            titulo="No caderno"
            itens={[
              "Quem desmarcou continua ocupando o horário.",
              "O fechamento do mês é uma soma feita à mão.",
              "A pomada acaba no meio do corte.",
              "Só existe um, e ele está na outra loja.",
            ]}
          />
          <Lado
            titulo="No BARBOS"
            acento
            itens={[
              "O horário volta a aparecer livre no mesmo instante.",
              "O mês já está somado quando você abre.",
              "O estoque baixa na venda e avisa antes de zerar.",
              "Abre no celular de qualquer um da equipe.",
            ]}
          />
        </div>
      </Cena>
    </section>
  );
}

function Lado({
  titulo,
  itens,
  acento = false,
}: {
  titulo: string;
  itens: readonly string[];
  acento?: boolean;
}) {
  return (
    <div>
      <p
        className={`text-xs font-semibold tracking-[0.16em] uppercase ${
          acento ? "text-ambar-500" : "text-graf-500"
        }`}
      >
        {titulo}
      </p>
      <ul className="mt-4 space-y-3">
        {itens.map((item, i) => (
          <li
            key={item}
            className="entra flex gap-3 text-sm leading-6 text-graf-300"
            style={degrau(0.1 + i * 0.09, 0.14)}
          >
            <span
              aria-hidden="true"
              className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${
                acento ? "bg-ambar-500" : "bg-graf-600"
              }`}
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Uma versão enxuta do calendário, só com os chips coloridos. */
function MesOrganizado() {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center gap-3">
        <span className="text-sm font-bold text-white">Outubro 2026</span>
        <span className="numeros text-xs text-graf-400">
          34 dias de atendimento
        </span>
      </div>

      <div className="grid flex-1 grid-cols-7 gap-1">
        {OUTUBRO.map((dia, i) => (
          <div
            key={i}
            className="flex flex-col gap-0.5 rounded-sm border border-graf-800 bg-graf-900/70 p-1"
          >
            <span className="numeros self-end text-[9px] text-graf-600">
              {dia?.numero ?? ""}
            </span>
            {dia?.agendamentos.slice(0, 3).map((agendamento) => (
              <span
                key={agendamento.hora + agendamento.cliente}
                className="h-1 w-full rounded-full"
                style={{
                  background: SERVICOS[agendamento.servico].cor,
                  opacity: 0.85,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
