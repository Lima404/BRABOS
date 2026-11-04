"use client";

import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useMotionValueEvent,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useEffect, useRef, type CSSProperties } from "react";

import { COM_MOUSE, MENOS_MOVIMENTO, useMidia } from "@/components/ui/midia";
import { useProgresso } from "@/components/ui/progresso";
import { Revela } from "@/components/ui/revela";
import { Rotulo } from "@/components/ui/rotulo";
import { useSequencia } from "@/components/ui/sequencia";
import { useVisto } from "@/components/ui/visto";
import { degrau } from "@/lib/coreografia";
import { OUTUBRO, SERVICOS } from "@/lib/dados";

/**
 * Os 25 quadros da tesoura: um ciclo inteiro, de fechada a aberta e de
 * volta a fechada. Saíram de um vídeo do Higgsfield, recortados e com o
 * fundo preto tirado por `scripts/quadros-da-tesoura.py`.
 */
const QUADROS_DA_TESOURA = Array.from(
  { length: 25 },
  (_, i) => `/tesoura/t${String(i + 1).padStart(2, "0")}.webp`,
);

/** Quantas vezes a tesoura abre e fecha enquanto atravessa o caderno. */
const CORTES = 4;

/** Os marcos da rolagem dentro do capítulo, de 0 a 1. */
const CORTE = { inicio: 0.04, fim: 0.56 };
const ABRE = { inicio: 0.56, fim: 0.8 };

/**
 * Capítulo 04 — o caderno, cortado ao meio.
 *
 * O manual de marca abre dizendo que o concorrente do BARBOS é o caderno.
 * Aqui essa frase vira cena: a tesoura do capítulo das ferramentas volta e
 * corta o caderno de ponta a ponta enquanto a pessoa rola, as duas metades
 * se soltam, e por baixo está o mesmo mês, organizado.
 *
 * - ROLAGEM: o corte inteiro, e a tesoura abrindo e fechando quadro a
 *   quadro (é a rolagem que escolhe o quadro, não um relógio).
 * - MOUSE: o quadro inclina na direção do cursor, com um reflexo que anda
 *   por cima, como uma foto segurada na mão.
 * - AUTOMÁTICO: logo abaixo, a comparação risca o caderno item a item
 *   sozinha quando entra na tela.
 */
export function Caderno() {
  const reduzido = useMidia(MENOS_MOVIMENTO);

  return (
    <section id="caderno" className="relative pt-28 pb-24 sm:pt-36 sm:pb-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <Rotulo capitulo="caderno">Por que trocar</Rotulo>
          <Revela
            texto="O caderno é o concorrente. A burocracia é o inimigo."
            destaque="A burocracia é o inimigo."
            className="mt-5 text-[clamp(1.75rem,3.6vw,3rem)] leading-[1.05] font-bold tracking-[-0.025em] text-balance"
          />
          <p className="mt-5 max-w-xl text-base leading-7 text-graf-300">
            O caderno funciona — até o dia em que molha, some ou fica na
            outra loja. E o sistema complicado, cheio de cadastro e de
            configuração, só troca uma dor de cabeça por outra. O BARBOS fica
            no simples bem feito. Role e veja o mesmo mês dos dois jeitos.
          </p>
        </div>
      </div>

      {reduzido ? <CenaParada /> : <CenaComRolagem />}

      <Comparacao />
    </section>
  );
}

function CenaComRolagem() {
  const trilhoRef = useRef<HTMLDivElement>(null);
  const p = useProgresso(trilhoRef);
  return (
    <div ref={trilhoRef} className="relative h-[260vh]">
      <div className="sticky top-0 flex h-svh items-center justify-center px-4 pt-12 sm:px-6">
        <Quadro p={p} animado vigiaRef={trilhoRef} />
      </div>
    </div>
  );
}

/** Movimento reduzido: o quadro já cortado, mostrando o mês organizado. */
function CenaParada() {
  const vigiaRef = useRef<HTMLDivElement>(null);
  const p = useMotionValue(1);
  return (
    <div ref={vigiaRef} className="mt-14 flex justify-center px-4 sm:px-6">
      <Quadro p={p} animado={false} vigiaRef={vigiaRef} />
    </div>
  );
}

function Quadro({
  p,
  animado,
  vigiaRef,
}: {
  p: MotionValue<number>;
  animado: boolean;
  vigiaRef: React.RefObject<HTMLDivElement | null>;
}) {
  const telaRef = useRef<HTMLCanvasElement>(null);
  const quadroRef = useRef<HTMLDivElement>(null);
  const { pronto, desenhar } = useSequencia(QUADROS_DA_TESOURA, vigiaRef);
  const atualRef = useRef(-1);

  // --- o corte -------------------------------------------------------------
  const corte = useTransform(p, [CORTE.inicio, CORTE.fim], [0, 1]);
  // Depois do corte ela sai pela direita. Vai até 200% porque no celular
  // ela ocupa 62% da largura do quadro, e em 140% os aros ainda apareciam.
  const tesouraX = useTransform(
    p,
    [CORTE.inicio, CORTE.fim, ABRE.inicio + 0.1],
    ["0%", "100%", "200%"],
  );
  const rasgoOpacidade = useTransform(p, [ABRE.inicio, ABRE.inicio + 0.06], [1, 0]);

  // A tesoura abre e fecha CORTES vezes durante a travessia.
  function quadroDa(avanco: number) {
    const t = Math.min(1, Math.max(0, (avanco - CORTE.inicio) / (CORTE.fim - CORTE.inicio)));
    const ciclo = (t * CORTES) % 1;
    return t >= 1 ? 0 : Math.round(ciclo * (QUADROS_DA_TESOURA.length - 1));
  }

  useMotionValueEvent(p, "change", (avanco) => {
    const indice = quadroDa(avanco);
    if (indice === atualRef.current) return;
    atualRef.current = indice;
    desenhar(telaRef.current, indice);
  });

  useEffect(() => {
    if (!pronto) return;
    atualRef.current = quadroDa(p.get());
    desenhar(telaRef.current, atualRef.current);
    const redesenhar = () => desenhar(telaRef.current, Math.max(0, atualRef.current));
    window.addEventListener("resize", redesenhar);
    return () => window.removeEventListener("resize", redesenhar);
  }, [pronto, desenhar, p]);

  // --- as metades se soltam -------------------------------------------------
  const cimaY = useTransform(p, [ABRE.inicio, ABRE.fim], ["0%", "-62%"]);
  const cimaGiro = useTransform(p, [ABRE.inicio, ABRE.fim], [0, -5]);
  const baixoY = useTransform(p, [ABRE.inicio, ABRE.fim], ["0%", "64%"]);
  const baixoGiro = useTransform(p, [ABRE.inicio, ABRE.fim], [0, 4]);
  const papelDesfoque = useTransform(p, [ABRE.inicio + 0.1, ABRE.fim], [0, 6]);
  const papelFiltro = useMotionTemplate`blur(${papelDesfoque}px)`;

  // O mês se monta por baixo, peça por peça, com a mesma `--p` dos mockups.
  const mesP = useTransform(p, [ABRE.inicio, 1], [0, 1]);
  const etiquetaCaderno = useTransform(p, [ABRE.inicio, ABRE.inicio + 0.08], [1, 0]);
  const etiquetaBarbos = useTransform(p, [ABRE.fim - 0.04, ABRE.fim + 0.06], [0, 1]);

  // --- o mouse inclina o quadro ---------------------------------------------
  const temMouse = useMidia(COM_MOUSE);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const mola = { stiffness: 120, damping: 20 };
  const giroY = useSpring(useTransform(mx, [-1, 1], [-5, 5]), mola);
  const giroX = useSpring(useTransform(my, [-1, 1], [4, -4]), mola);
  const reflexoX = useTransform(mx, [-1, 1], ["0%", "100%"]);
  const reflexoY = useTransform(my, [-1, 1], ["0%", "100%"]);
  const reflexo = useMotionTemplate`radial-gradient(40rem circle at ${reflexoX} ${reflexoY}, color-mix(in srgb, white 9%, transparent), transparent 60%)`;

  useEffect(() => {
    if (!temMouse || !animado) return;
    function moveu(evento: PointerEvent) {
      const caixa = quadroRef.current?.getBoundingClientRect();
      if (!caixa) return;
      mx.set(Math.max(-1, Math.min(1, ((evento.clientX - caixa.left) / caixa.width) * 2 - 1)));
      my.set(Math.max(-1, Math.min(1, ((evento.clientY - caixa.top) / caixa.height) * 2 - 1)));
    }
    window.addEventListener("pointermove", moveu, { passive: true });
    return () => window.removeEventListener("pointermove", moveu);
  }, [temMouse, animado, mx, my]);

  return (
    <div style={{ perspective: 1400 }}>
      <motion.div
        ref={quadroRef}
        data-cursor={animado ? "Role para cortar" : undefined}
        className="relative aspect-[4/5] w-[min(92vw,calc(70svh*0.8))] overflow-hidden sm:aspect-[3/2] sm:w-[min(64rem,92vw,calc(72svh*1.5))] rounded-xl border border-graf-700 bg-graf-950 shadow-[0_30px_90px_color-mix(in_srgb,var(--color-graf-950)_80%,transparent)]"
        style={animado ? { rotateX: giroX, rotateY: giroY } : undefined}
      >
        {/* Embaixo de tudo: o mês organizado. */}
        <motion.div
          className="absolute inset-0 p-3 sm:p-6"
          style={{ "--p": mesP } as never}
        >
          <MesOrganizado />
        </motion.div>

        {/* As duas metades do caderno. O recorte de cada uma viaja junto
            com ela, por isso elas se soltam sem trocar de imagem. */}
        <motion.div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center [clip-path:inset(0_0_50%_0)]"
          style={{
            backgroundImage: "url(/caderno.webp)",
            y: cimaY,
            rotate: cimaGiro,
            filter: papelFiltro,
            transformOrigin: "15% 50%",
          }}
        />
        <motion.div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center [clip-path:inset(50%_0_0_0)]"
          style={{
            backgroundImage: "url(/caderno.webp)",
            y: baixoY,
            rotate: baixoGiro,
            filter: papelFiltro,
            transformOrigin: "85% 50%",
          }}
        />

        {/* O rasgo que a tesoura deixa: uma fenda escura com luz âmbar. */}
        <motion.div
          aria-hidden="true"
          className="rasgo absolute top-1/2 left-0 h-[3px] w-full origin-left -translate-y-1/2"
          style={{ scaleX: corte, opacity: rasgoOpacidade }}
        />

        {/* A tesoura. A ponta das lâminas fica sempre na frente do rasgo. */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ x: tesouraX }}
        >
          <div className="absolute top-1/2 left-0 w-[62%] -translate-x-[94%] -translate-y-[41%] sm:w-[34%]">
            <canvas
              ref={telaRef}
              className="tesoura-sombra aspect-[640/261] w-full transition-opacity duration-500"
              style={{ opacity: pronto ? 1 : 0 }}
            />
          </div>
        </motion.div>

        {/* Reflexo que anda com o mouse, como luz batendo numa foto. */}
        {animado && (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{ background: reflexo }}
          />
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-3 sm:p-5">
          <motion.span
            className="rounded-md bg-graf-950/85 px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-graf-200 uppercase"
            style={{ opacity: etiquetaCaderno }}
          >
            O caderno
          </motion.span>
          <motion.span
            className="rounded-md bg-ambar-500 px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-graf-900 uppercase"
            style={{ opacity: etiquetaBarbos }}
          >
            O BARBOS
          </motion.span>
        </div>
      </motion.div>
    </div>
  );
}

/**
 * Quantos chips já entraram antes de cada dia — decide o atraso de cada um
 * na cascata. Calculado uma vez, fora do render: contador que avança
 * durante a renderização é o que o compilador do React proíbe.
 */
const CHIPS_ANTES = OUTUBRO.map((_, i) =>
  OUTUBRO.slice(0, i).reduce(
    (soma, dia) => soma + (dia ? Math.min(3, dia.agendamentos.length) : 0),
    0,
  ),
);

/** O mês de outubro em miniatura, só com os chips coloridos. */
function MesOrganizado() {
  return (
    <div className="flex h-full flex-col">
      <div className="entra mb-2 flex items-center gap-3 sm:mb-3" style={degrau(0, 0.1)}>
        <span className="text-xs font-bold text-white sm:text-sm">Outubro 2026</span>
        <span className="numeros text-[11px] text-graf-300 sm:text-xs">
          234 atendimentos · R$ 9.966,00
        </span>
      </div>

      <div className="grid flex-1 grid-cols-7 gap-0.5 sm:gap-1">
        {OUTUBRO.map((dia, i) => (
          <div
            key={i}
            className="entra flex flex-col gap-0.5 rounded-sm border border-graf-800 bg-graf-900/70 p-0.5 sm:p-1"
            style={degrau(0.04 + i * 0.006, 0.08)}
          >
            <span className="numeros self-end text-[8px] text-graf-400 sm:text-[9px]">
              {dia?.numero ?? ""}
            </span>
            {dia?.agendamentos.slice(0, 3).map((agendamento, j) => (
              <span
                key={agendamento.hora + agendamento.cliente}
                className="entra entra-pop h-1 w-full rounded-full"
                style={{
                  ...degrau(0.3 + (CHIPS_ANTES[i] + j) * 0.007, 0.06),
                  background: SERVICOS[agendamento.servico].cor,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   A comparação, item a item
   ---------------------------------------------------------------------------
   Cada linha é um par: o problema do caderno e a resposta do BARBOS. Quando
   a lista entra na tela, o caderno é riscado sozinho, uma linha por vez, e
   a seta acende até o lado do BARBOS. Passar o mouse numa linha refaz o
   gesto naquela linha — e no toque, o automático já mostrou tudo.
*/

const PARES = [
  [
    "Quem desmarcou continua ocupando o horário.",
    "O horário volta a aparecer livre no mesmo instante.",
  ],
  [
    "O fechamento do mês é uma soma feita à mão.",
    "O mês já está somado quando você abre.",
  ],
  [
    "A pomada acaba no meio do corte.",
    "O estoque baixa na venda e avisa antes de zerar.",
  ],
  [
    "Só existe um, e ele está na outra loja.",
    "Abre no celular de qualquer um da equipe.",
  ],
] as const;

function Comparacao() {
  const listaRef = useRef<HTMLUListElement>(null);
  useVisto(listaRef, 0.4);

  return (
    <div className="mx-auto mt-20 max-w-5xl px-4 sm:px-6">
      <div className="hidden grid-cols-[1fr_4rem_1fr] gap-x-6 pb-4 text-xs font-semibold tracking-[0.18em] uppercase sm:grid">
        <span className="text-graf-400">No caderno</span>
        <span />
        <span className="text-ambar-500">No BARBOS</span>
      </div>

      <ul ref={listaRef} className="comparacao border-t border-graf-800">
        {PARES.map(([caderno, barbos], i) => (
          <li
            key={caderno}
            className="par group grid gap-x-6 gap-y-2 border-b border-graf-800 py-5 sm:grid-cols-[1fr_4rem_1fr] sm:items-center"
            style={{ "--ordem": i } as CSSProperties}
          >
            <span className="par-caderno text-sm leading-6 text-graf-300 sm:text-base">
              <span className="mr-2 text-xs font-semibold tracking-[0.14em] text-graf-400 uppercase sm:hidden">
                Caderno
              </span>
              <span className="risco">{caderno}</span>
            </span>
            <span aria-hidden="true" className="par-seta hidden h-px sm:block" />
            <span className="par-barbos text-sm leading-6 font-semibold text-white sm:text-base">
              <span className="mr-2 text-xs font-semibold tracking-[0.14em] text-ambar-500 uppercase sm:hidden">
                BARBOS
              </span>
              {barbos}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
