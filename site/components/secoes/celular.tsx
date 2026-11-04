import type { CSSProperties } from "react";

import { Cena } from "@/components/ui/cena";
import { degrau } from "@/lib/coreografia";
import { SERVICOS } from "@/lib/dados";

const ATENDIMENTOS = [
  { hora: "09:00", cliente: "GABRIEL", servico: 2, preco: "R$ 30,00" },
  { hora: "10:00", cliente: "WESLEY VIEIRA", servico: 2, preco: "R$ 30,00" },
  { hora: "11:30", cliente: "ANDRE VIEIRA", servico: 1, preco: "R$ 35,00" },
  { hora: "14:00", cliente: "PAULO DIAS", servico: 0, preco: "R$ 70,00" },
  { hora: "16:00", cliente: "LEVI TEIXEIRA", servico: 3, preco: "R$ 25,00" },
] as const;

/**
 * A seção do celular.
 *
 * As chaves viram uma a uma conforme a página rola — é a interação que o
 * barbeiro mais faz no dia, e é a única do sistema que dá pra demonstrar
 * sem ninguém tocar em nada.
 */
export function Celular() {
  return (
    <section className="relative overflow-hidden border-t border-graf-800 py-24 sm:py-28">
      <Cena>
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-ambar-500 uppercase">
              No celular
            </p>
            <h2 className="mt-5 text-3xl leading-tight font-bold text-balance sm:text-4xl">
              Feito pra uma mão só — porque a outra está segurando a máquina.
            </h2>
            <p className="mt-5 max-w-md text-base leading-7 text-graf-300">
              O barbeiro não abre o sistema sentado numa mesa. Abre de pé,
              com o cliente na cadeira e o celular na mão. Tudo que importa
              fica na metade de baixo da tela, onde o polegar alcança.
            </p>

            <ul className="mt-9 space-y-5">
              {[
                {
                  titulo: "Conclui com um toque",
                  texto:
                    "A chave no cartão fecha o atendimento sem abrir nada. E desfaz, se você errar.",
                },
                {
                  titulo: "Alvo de 44 pixels",
                  texto:
                    "Nenhum botão menor que isso. Dedo com creme e tela riscada continuam acertando.",
                },
                {
                  titulo: "Avisa no celular",
                  texto:
                    "Agendamento novo chega como notificação, mesmo com o sistema fechado.",
                },
              ].map((item, i) => (
                <li
                  key={item.titulo}
                  className="entra flex gap-4"
                  style={degrau(0.15 + i * 0.07, 0.12)}
                >
                  <span
                    aria-hidden="true"
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-ambar-500"
                  />
                  <div>
                    <p className="font-semibold text-white">{item.titulo}</p>
                    <p className="mt-1 text-sm leading-6 text-graf-400">
                      {item.texto}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex justify-center lg:justify-end">
            <Telefone />
          </div>
        </div>
      </Cena>
    </section>
  );
}

function Telefone() {
  return (
    <div
      className="entra relative w-[280px] shrink-0 rounded-[2.2rem] border border-graf-700 bg-graf-900 p-3 shadow-[0_30px_80px_rgba(0,0,0,0.6)] sm:w-[320px]"
      style={{ ...degrau(0.05, 0.14), "--sobe": "28px" } as CSSProperties}
    >
      {/* O halo âmbar atrás do aparelho, o mesmo da cadeira no herói. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-16 -z-10 rounded-full bg-[radial-gradient(circle,rgba(240,169,59,0.16),transparent_68%)]"
      />

      <div className="overflow-hidden rounded-[1.7rem] bg-graf-950">
        <div className="faixa-barbearia" aria-hidden="true" />

        <div className="flex items-center justify-between px-4 pt-4">
          <div>
            <p className="text-[13px] font-bold text-white">Hoje</p>
            <p className="numeros text-[11px] text-graf-400">
              segunda, 26 · 5 atendimentos
            </p>
          </div>
          <span className="rounded-full bg-graf-800 px-2.5 py-1 text-[10px] font-semibold text-graf-300">
            GABRIEL
          </span>
        </div>

        <div className="space-y-2 p-3">
          {ATENDIMENTOS.map((item, i) => {
            const servico = SERVICOS[item.servico];
            return (
              <div
                key={item.hora}
                className="entra entra-pop rounded-lg border border-graf-700 bg-graf-800/80 p-3"
                style={degrau(0.2 + i * 0.045, 0.05)}
              >
                <div className="flex items-center gap-2">
                  <span className="numeros text-[11px] font-semibold text-graf-300">
                    {item.hora}
                  </span>
                  <span className="truncate text-[13px] font-bold text-white">
                    {item.cliente}
                  </span>
                  <ChaveQueVira atraso={0.26 + i * 0.045} />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className="text-[10px] font-semibold"
                    style={{ color: servico.cor }}
                  >
                    {servico.nome}
                  </span>
                  <span className="numeros ml-auto text-[11px] font-bold text-white">
                    {item.preco}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * A chave do cartão, virando sozinha quando a rolagem passa pelo seu
 * degrau. O botão desliza e o trilho acende ao mesmo tempo.
 */
function ChaveQueVira({ atraso }: { atraso: number }) {
  const avanco = `clamp(0, calc((var(--p) - ${atraso}) / 0.04), 1)`;

  return (
    <span
      aria-hidden="true"
      className="relative ml-auto h-[18px] w-[36px] shrink-0 overflow-hidden rounded-full bg-graf-700"
    >
      <span
        className="absolute inset-0 rounded-full"
        style={
          {
            background:
              "linear-gradient(135deg, #f0a93b 0%, #a9660f 100%)",
            opacity: avanco,
          } as CSSProperties
        }
      />
      <span
        className="absolute top-[3px] left-[3px] h-3 w-3 rounded-full bg-white"
        style={
          {
            transform: `translateX(calc(${avanco} * 18px))`,
          } as CSSProperties
        }
      />
    </span>
  );
}
