"use client";

import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { COM_MOUSE, MENOS_MOVIMENTO, useMidia } from "@/components/ui/midia";
import { Revela } from "@/components/ui/revela";
import { Rotulo } from "@/components/ui/rotulo";
import { useVisto } from "@/components/ui/visto";
import { emReais, SERVICOS } from "@/lib/dados";

const ATENDIMENTOS = [
  { hora: "09:00", cliente: "GABRIEL", servico: 2, centavos: 3000 },
  { hora: "10:00", cliente: "WESLEY VIEIRA", servico: 2, centavos: 3000 },
  { hora: "11:30", cliente: "ANDRE VIEIRA", servico: 1, centavos: 3500 },
  { hora: "14:00", cliente: "PAULO DIAS", servico: 0, centavos: 7000 },
  { hora: "16:00", cliente: "LEVI TEIXEIRA", servico: 3, centavos: 2500 },
] as const;

const TOTAL_DO_DIA = ATENDIMENTOS.reduce((soma, a) => soma + a.centavos, 0);

/** Quantas chaves viram sozinhas quando o telefone aparece. */
const VIRAM_SOZINHAS = 3;

const AVISOS = [
  { cliente: "CAUA SOUZA", quando: "amanhã, 10:00", servico: 0 },
  { cliente: "THEO CARVALHO", quando: "sexta, 19:00", servico: 2 },
  { cliente: "MATEUS ALVES", quando: "sábado, 17:30", servico: 3 },
] as const;

const ITENS = [
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
];

/**
 * Capítulo 05 — o celular, que dá para usar.
 *
 * Aqui a interação é de verdade, não demonstração:
 *
 * - AUTOMÁTICO: quando o telefone entra na tela, as três primeiras chaves
 *   viram sozinhas, uma depois da outra. E de tempos em tempos chega um
 *   aviso de agendamento novo no alto da tela.
 * - TOQUE: todas as chaves funcionam. Concluir e desfazer muda o total
 *   recebido no dia, como no sistema.
 * - MOUSE: o aparelho inclina na direção do cursor, com o reflexo do vidro
 *   andando junto.
 */
export function Celular() {
  const listaRef = useRef<HTMLUListElement>(null);
  useVisto(listaRef);

  return (
    <section
      id="celular"
      className="relative overflow-hidden py-28 sm:py-36"
    >
      <div
        aria-hidden="true"
        className="luz-ambar pointer-events-none absolute top-1/2 right-[-10%] h-[60rem] w-[60rem] -translate-y-1/2 opacity-30"
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-4 sm:px-6 lg:grid-cols-2">
        <div>
          <Rotulo capitulo="celular">No celular</Rotulo>
          <Revela
            texto="Feito pra uma mão só, porque a outra está segurando a máquina."
            destaque="uma mão só"
            className="mt-5 text-[clamp(1.75rem,3.6vw,3rem)] leading-[1.05] font-bold tracking-[-0.025em] text-balance"
          />
          <p className="mt-5 max-w-md text-base leading-7 text-graf-300">
            O barbeiro não abre o sistema sentado numa mesa. Abre de pé, com
            o cliente na cadeira e o celular na mão. Tudo que importa fica na
            metade de baixo da tela, onde o polegar alcança.
          </p>

          <ul ref={listaRef} className="lista-aparece mt-10 space-y-6">
            {ITENS.map((item, i) => (
              <li
                key={item.titulo}
                className="flex gap-4"
                style={{ "--ordem": i } as CSSProperties}
              >
                <span
                  aria-hidden="true"
                  className="numeros mt-0.5 text-xs font-semibold text-ambar-500"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="font-semibold text-white">{item.titulo}</p>
                  <p className="mt-1 text-sm leading-6 text-graf-300">
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
    </section>
  );
}

function Telefone() {
  const temMouse = useMidia(COM_MOUSE);
  const reduzido = useMidia(MENOS_MOVIMENTO);
  const aparelhoRef = useRef<HTMLDivElement>(null);
  const naTela = useInView(aparelhoRef, { amount: 0.45 });

  const [feitos, setFeitos] = useState<readonly boolean[]>(() =>
    ATENDIMENTOS.map(() => false),
  );
  const [aviso, setAviso] = useState<number | null>(null);

  // --- as chaves que viram sozinhas, uma vez ---------------------------------
  const jaVirouRef = useRef(false);
  useEffect(() => {
    if (!naTela || jaVirouRef.current) return;
    jaVirouRef.current = true;
    if (reduzido) {
      setFeitos(ATENDIMENTOS.map((_, i) => i < VIRAM_SOZINHAS));
      return;
    }
    const relogios = Array.from({ length: VIRAM_SOZINHAS }, (_, i) =>
      window.setTimeout(() => {
        setFeitos((atual) => atual.map((feito, j) => (j === i ? true : feito)));
      }, 700 + i * 650),
    );
    return () => relogios.forEach((r) => window.clearTimeout(r));
  }, [naTela, reduzido]);

  // --- os avisos que chegam de tempos em tempos -------------------------------
  useEffect(() => {
    if (!naTela || reduzido) return;
    let proximo = 0;
    let some = 0;
    const chegar = () => {
      setAviso((atual) => ((atual ?? -1) + 1) % AVISOS.length);
      some = window.setTimeout(() => setAviso(null), 3200);
    };
    proximo = window.setTimeout(function laco() {
      chegar();
      proximo = window.setTimeout(laco, 7000);
    }, 3200);
    return () => {
      window.clearTimeout(proximo);
      window.clearTimeout(some);
      setAviso(null);
    };
  }, [naTela, reduzido]);

  // --- o total do dia ------------------------------------------------------
  const recebido = ATENDIMENTOS.reduce(
    (soma, a, i) => soma + (feitos[i] ? a.centavos : 0),
    0,
  );
  const quantos = feitos.filter(Boolean).length;
  const recebidoAnimado = useMotionValue(0);
  const recebidoTexto = useTransform(recebidoAnimado, (v) => emReais(Math.round(v)));
  const barra = useTransform(recebidoAnimado, [0, TOTAL_DO_DIA], [0, 1]);

  useEffect(() => {
    if (reduzido) {
      recebidoAnimado.set(recebido);
      return;
    }
    const controle = animate(recebidoAnimado, recebido, {
      duration: 0.7,
      ease: [0.2, 0.7, 0.2, 1],
    });
    return () => controle.stop();
  }, [recebido, reduzido, recebidoAnimado]);

  // --- o mouse inclina o aparelho --------------------------------------------
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const mola = { stiffness: 110, damping: 16, mass: 0.6 };
  const giroY = useSpring(useTransform(mx, [-1, 1], [-14, 14]), mola);
  const giroX = useSpring(useTransform(my, [-1, 1], [10, -10]), mola);
  const reflexoX = useTransform(giroY, [-14, 14], ["-30%", "60%"]);
  const reflexo = useMotionTemplate`linear-gradient(105deg, transparent 30%, color-mix(in srgb, white 9%, transparent) 45%, transparent 60%)`;

  useEffect(() => {
    if (!temMouse || reduzido) return;
    function moveu(evento: PointerEvent) {
      const caixa = aparelhoRef.current?.getBoundingClientRect();
      if (!caixa) return;
      const cx = caixa.left + caixa.width / 2;
      const cy = caixa.top + caixa.height / 2;
      mx.set(Math.max(-1, Math.min(1, (evento.clientX - cx) / (window.innerWidth / 2))));
      my.set(Math.max(-1, Math.min(1, (evento.clientY - cy) / (window.innerHeight / 2))));
    }
    window.addEventListener("pointermove", moveu, { passive: true });
    return () => window.removeEventListener("pointermove", moveu);
  }, [temMouse, reduzido, mx, my]);

  function alternar(indice: number) {
    setFeitos((atual) => atual.map((feito, j) => (j === indice ? !feito : feito)));
  }

  const avisoAtual = aviso === null ? null : AVISOS[aviso];

  return (
    <div style={{ perspective: 1200 }}>
      <motion.div
        ref={aparelhoRef}
        className="relative w-[300px] shrink-0 rounded-[2.4rem] border border-graf-700 bg-graf-900 p-3 shadow-[0_40px_90px_color-mix(in_srgb,var(--color-graf-950)_85%,transparent)] sm:w-[330px]"
        style={
          temMouse && !reduzido
            ? { rotateX: giroX, rotateY: giroY }
            : { rotateX: 0, rotateY: 0 }
        }
      >
        <div className="relative overflow-hidden rounded-[1.9rem] bg-graf-950">
          <div className="faixa-barbearia" aria-hidden="true" />

          {/* O aviso que desce do alto da tela. */}
          <AnimatePresence>
            {avisoAtual && (
              <motion.div
                key={aviso}
                aria-hidden="true"
                initial={{ y: "-120%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "-120%", opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 26 }}
                className="absolute inset-x-2 top-3 z-10 rounded-2xl border border-graf-700 bg-graf-800/95 p-3 shadow-[var(--sombra-2)] backdrop-blur"
              >
                <p className="flex items-center gap-2 text-[11px] font-semibold text-estado-agendado">
                  <span className="h-1.5 w-1.5 rounded-full bg-estado-agendado" />
                  Novo agendamento
                </p>
                <p className="numeros mt-1 text-[13px] font-bold text-white">
                  {avisoAtual.cliente}
                </p>
                <p className="numeros text-[11px] text-graf-300">
                  {avisoAtual.quando} · {SERVICOS[avisoAtual.servico].nome}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-between px-4 pt-4">
            <div>
              <p className="text-sm font-bold text-white">Hoje</p>
              <p className="numeros text-[11px] text-graf-300">
                segunda, 26 · {ATENDIMENTOS.length} atendimentos
              </p>
            </div>
            <span className="rounded-full bg-graf-800 px-2.5 py-1 text-[11px] font-semibold text-graf-200">
              GABRIEL
            </span>
          </div>

          {/* O total do dia, que anda conforme as chaves. */}
          <div className="mx-3 mt-3 rounded-xl border border-graf-800 bg-graf-900 p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-semibold tracking-[0.12em] text-graf-300 uppercase">
                Recebido hoje
              </span>
              <span className="numeros text-[11px] text-graf-300">
                {quantos} de {ATENDIMENTOS.length}
              </span>
            </div>
            <p className="numeros mt-1 text-xl font-bold text-white">
              {/* O número que conta fica fora do leitor de tela — ele
                  anunciaria cada centavo do caminho. O leitor ouve só o
                  valor final, uma vez. */}
              <motion.span aria-hidden="true">{recebidoTexto}</motion.span>
              <span className="sr-only" aria-live="polite">
                {emReais(recebido)} recebidos hoje
              </span>
            </p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-graf-800">
              <motion.div
                className="h-full origin-left rounded-full bg-ambar-500"
                style={{ scaleX: barra }}
              />
            </div>
          </div>

          <ul className="space-y-2 p-3">
            {ATENDIMENTOS.map((item, i) => {
              const servico = SERVICOS[item.servico];
              const feito = feitos[i];
              return (
                <li
                  key={item.hora}
                  className={`rounded-xl border p-3 transition-colors duration-300 ${
                    feito ? "border-graf-800 bg-graf-900" : "border-graf-700 bg-graf-800/80"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="numeros text-[11px] font-semibold text-graf-300">
                      {item.hora}
                    </span>
                    <span
                      className={`truncate text-[13px] font-bold transition-colors ${
                        feito ? "text-graf-300" : "text-white"
                      }`}
                    >
                      {item.cliente}
                    </span>
                    <Chave
                      ligada={feito}
                      rotulo={`Concluir o atendimento de ${item.cliente}, ${item.hora}`}
                      aoAlternar={() => alternar(i)}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span
                      className="text-[11px] font-semibold"
                      style={{ color: servico.cor }}
                    >
                      {servico.nome}
                    </span>
                    {feito && (
                      <span className="rounded-full bg-graf-800 px-2 py-0.5 text-[10px] font-semibold text-graf-300">
                        Concluído
                      </span>
                    )}
                    <span className="numeros ml-auto text-[11px] font-bold text-white">
                      {emReais(item.centavos)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* O reflexo do vidro, que anda conforme o aparelho inclina. */}
        {temMouse && !reduzido && (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2.4rem]"
          >
            <motion.div
              className="absolute inset-y-0 w-[120%]"
              style={{ x: reflexoX, background: reflexo }}
            />
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

/**
 * A chave que conclui o atendimento. O desenho é pequeno, como no sistema,
 * mas a área de toque tem 44px — margem negativa para não empurrar o
 * cartão.
 */
function Chave({
  ligada,
  rotulo,
  aoAlternar,
}: {
  ligada: boolean;
  rotulo: string;
  aoAlternar: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligada}
      aria-label={rotulo}
      onClick={aoAlternar}
      className="-my-3 -mr-2 ml-auto grid h-11 w-14 shrink-0 place-items-center rounded-lg focus-visible:outline-2 focus-visible:outline-ambar-300"
    >
      <span
        aria-hidden="true"
        className={`relative block h-5 w-9 rounded-full transition-colors duration-300 ${
          ligada ? "bg-ambar-500" : "bg-graf-700"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full shadow-[var(--sombra-1)] transition-[translate,background-color] duration-300 ease-[cubic-bezier(.3,1.4,.5,1)] ${
            ligada ? "translate-x-4 bg-graf-900" : "translate-x-0 bg-white"
          }`}
        />
      </span>
    </button>
  );
}
