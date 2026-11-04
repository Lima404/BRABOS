"use client";

import Image from "next/image";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useMotionValueEvent,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { COM_MOUSE, MENOS_MOVIMENTO, useMidia } from "@/components/ui/midia";
import { useProgresso } from "@/components/ui/progresso";
import { Revela } from "@/components/ui/revela";
import { Rotulo } from "@/components/ui/rotulo";

type Ferramenta = {
  readonly arquivo: string;
  readonly nome: string;
  readonly titulo: string;
  readonly texto: string;
  /** Onde a peça fica na bancada, em % da caixa das ferramentas. */
  readonly lugar: { x: number; y: number; largura: number; giro: number };
  /** De onde ela vem voando, em vw/vh, e com quanto de giro. */
  readonly origem: { x: number; y: number; giro: number };
  /** O quanto ela anda com o mouse. Mais alto = mais perto do olho. */
  readonly profundidade: number;
};

const FERRAMENTAS: readonly Ferramenta[] = [
  {
    arquivo: "/ferramentas/maquina.webp",
    nome: "Máquina",
    titulo: "Agenda",
    texto:
      "Cada horário no lugar, mês a mês. Quem é o próximo aparece na primeira linha, sem procurar.",
    lugar: { x: 47, y: 52, largura: 48, giro: -18 },
    origem: { x: -80, y: 30, giro: -70 },
    profundidade: 70,
  },
  {
    arquivo: "/ferramentas/tesoura.webp",
    nome: "Tesoura",
    titulo: "Serviços",
    texto:
      "Preço, duração e cor de cada serviço. O valor do dia se soma sozinho, sem calculadora.",
    lugar: { x: 82, y: 20, largura: 30, giro: 16 },
    origem: { x: 70, y: -60, giro: 110 },
    profundidade: 38,
  },
  {
    arquivo: "/ferramentas/navalha.webp",
    nome: "Navalha",
    titulo: "Equipe",
    texto:
      "Cada barbeiro com a própria agenda. Dois cortes no mesmo horário o sistema simplesmente não deixa marcar.",
    lugar: { x: 81, y: 80, largura: 32, giro: -10 },
    origem: { x: 60, y: 70, giro: -90 },
    profundidade: 54,
  },
  {
    arquivo: "/ferramentas/pente.webp",
    nome: "Pente",
    titulo: "Estoque",
    texto:
      "Pomada, gel e bebida saem da prateleira na hora da venda. E o sistema avisa antes de acabar.",
    lugar: { x: 13, y: 28, largura: 15, giro: -22 },
    origem: { x: -60, y: -70, giro: 80 },
    profundidade: 22,
  },
];

/**
 * Os marcos da rolagem dentro do capítulo, de 0 a 1.
 *
 * Primeiro as peças chegam voando. Depois a rolagem acende uma por uma,
 * cada uma com a sua função. No fim elas convergem para o centro e viram o
 * símbolo do BARBOS — quatro ferramentas, uma tela só. É a cena da
 * referência em que as ferramentas voam para dentro da cadeira.
 */
const CHEGADA_FIM = 0.24;
const PASSEIO = { inicio: 0.26, passo: 0.105 };
const CONVERGE = { inicio: 0.7, fim: 0.9 };

/**
 * Capítulo 02 — as ferramentas.
 *
 * - ROLAGEM: a coreografia inteira acima.
 * - AUTOMÁTICO: cada peça flutua no próprio ritmo, e um brilho atravessa
 *   o aço de tempos em tempos.
 * - MOUSE: cada peça anda conforme a sua profundidade (parallax), e passar
 *   o mouse numa peça — ou num item da lista — acende os dois juntos.
 */
export function Ferramentas() {
  const reduzido = useMidia(MENOS_MOVIMENTO);
  return reduzido ? <FerramentasParadas /> : <FerramentasComRolagem />;
}

function FerramentasComRolagem() {
  const secaoRef = useRef<HTMLElement>(null);
  const p = useProgresso(secaoRef);
  return <Palco secaoRef={secaoRef} p={p} animado />;
}

/** Para movimento reduzido: as peças já na bancada, sem prender a tela. */
function FerramentasParadas() {
  const secaoRef = useRef<HTMLElement>(null);
  const p = useMotionValue(PASSEIO.inicio);
  return <Palco secaoRef={secaoRef} p={p} animado={false} />;
}

function Palco({
  secaoRef,
  p,
  animado,
}: {
  secaoRef: React.RefObject<HTMLElement | null>;
  p: MotionValue<number>;
  animado: boolean;
}) {
  const largo = useMidia("(min-width: 1024px)");

  // --- qual peça está acesa ------------------------------------------------
  // A rolagem escolhe uma; o mouse pode escolher outra. A escolha do mouse
  // vale até a rolagem passar para o próximo degrau.
  const [passoDaRolagem, setPassoDaRolagem] = useState<number | null>(
    animado ? null : 0,
  );
  const [escolha, setEscolha] = useState<{ peca: number; passo: number | null } | null>(
    null,
  );

  useMotionValueEvent(p, "change", (avanco) => {
    if (!animado) return;
    let passo: number | null = null;
    if (avanco >= PASSEIO.inicio && avanco < CONVERGE.inicio) {
      passo = Math.min(3, Math.floor((avanco - PASSEIO.inicio) / PASSEIO.passo));
    }
    setPassoDaRolagem(passo);
  });

  const acesa =
    escolha && escolha.passo === passoDaRolagem && passoDaRolagem !== null
      ? escolha.peca
      : passoDaRolagem;

  function escolher(peca: number) {
    if (passoDaRolagem === null) return;
    setEscolha({ peca, passo: passoDaRolagem });
  }

  // --- mouse ---------------------------------------------------------------
  const temMouse = useMidia(COM_MOUSE);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const mola = { stiffness: 90, damping: 18, mass: 0.7 };
  const mxMola = useSpring(mx, mola);
  const myMola = useSpring(my, mola);

  useEffect(() => {
    if (!temMouse || !animado) return;
    function moveu(evento: PointerEvent) {
      mx.set((evento.clientX / window.innerWidth) * 2 - 1);
      my.set((evento.clientY / window.innerHeight) * 2 - 1);
    }
    window.addEventListener("pointermove", moveu, { passive: true });
    return () => window.removeEventListener("pointermove", moveu);
  }, [temMouse, animado, mx, my]);

  // --- o texto sai quando as peças convergem --------------------------------
  const textoOpacidade = useTransform(p, [CONVERGE.inicio, CONVERGE.inicio + 0.1], [1, 0]);
  const textoY = useTransform(p, [CONVERGE.inicio, CONVERGE.fim], [0, -70]);
  const textoDesfoque = useTransform(p, [CONVERGE.inicio, CONVERGE.inicio + 0.1], [0, 12]);
  const textoFiltro = useMotionTemplate`blur(${textoDesfoque}px)`;
  const textoEntra = useTransform(p, [0.02, 0.14], [0, 1]);

  // A caixa das peças anda até o centro da tela durante a convergência —
  // no computador ela mora à direita do texto.
  const caixaX = useTransform(
    p,
    [CONVERGE.inicio, CONVERGE.fim],
    ["0vw", largo ? "-21vw" : "0vw"],
  );

  // O símbolo nasce no ponto onde as peças se encontram.
  const simboloEscala = useTransform(p, [CONVERGE.fim - 0.06, CONVERGE.fim + 0.04], [0.2, 1]);
  const simboloOpacidade = useTransform(p, [CONVERGE.fim - 0.06, CONVERGE.fim], [0, 1]);
  const legendaOpacidade = useTransform(p, [CONVERGE.fim, 0.97], [0, 1]);
  const legendaY = useTransform(p, [CONVERGE.fim, 0.97], [16, 0]);

  return (
    <section
      ref={secaoRef}
      id="ferramentas"
      className={`relative ${animado ? "h-[300vh] lg:h-[340vh]" : ""}`}
      data-cursor-zona
    >
      <div
        className={`${
          animado ? "sticky top-0 h-svh" : "relative py-28"
        } min-h-[640px] overflow-hidden`}
      >
        {/* Fundo: uma poça de luz âmbar onde as peças descansam. */}
        <div
          aria-hidden="true"
          className="luz-ambar pointer-events-none absolute top-[38%] left-1/2 h-[70vh] w-[90vw] -translate-x-1/2 -translate-y-1/2 opacity-40 lg:left-[70%] lg:w-[60vw]"
        />

        {/* As peças. No celular ocupam a metade de cima; no computador, a
            direita. */}
        <motion.div
          className="absolute inset-x-0 top-16 h-[46%] lg:top-0 lg:left-[40%] lg:h-full"
          style={{ x: caixaX, containerType: "size" } as never}
        >
          <div className="absolute inset-[6%] lg:inset-[10%_8%]">
            {FERRAMENTAS.map((peca, i) => (
              <Peca
                key={peca.nome}
                peca={peca}
                indice={i}
                p={p}
                acesa={acesa}
                animado={animado}
                mx={mxMola}
                my={myMola}
                aoEscolher={() => escolher(i)}
              />
            ))}

            {/* O símbolo do BARBOS, onde as quatro se encontram. */}
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
              style={{ scale: simboloEscala, opacity: animado ? simboloOpacidade : 0 }}
            >
              <span className="anel-pulso relative block h-24 w-24 sm:h-28 sm:w-28">
                <Image
                  src="/marca/simbolo.png"
                  alt=""
                  fill
                  sizes="112px"
                  className="drop-shadow-[0_0_40px_color-mix(in_srgb,var(--color-ambar-500)_55%,transparent)]"
                />
              </span>
            </motion.div>
          </div>
        </motion.div>

        {/* A legenda do encontro. Fica fora da caixa que anda, centrada na
            tela de verdade. */}
        <motion.p
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-[calc(50%+5.5rem)] text-center text-2xl font-bold tracking-[-0.02em] text-white uppercase sm:text-3xl"
          style={{ opacity: animado ? legendaOpacidade : 0, y: legendaY }}
        >
          Numa tela só.
          <span className="mt-3 block text-xs font-semibold tracking-[0.22em] text-graf-300">
            Agenda · Serviços · Equipe · Estoque
          </span>
        </motion.p>

        {/* O texto. */}
        <motion.div
          className="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-end px-4 pb-10 sm:px-6 lg:justify-center lg:pb-0"
          style={
            animado
              ? { opacity: textoOpacidade, y: textoY, filter: textoFiltro }
              : undefined
          }
        >
          <motion.div
            className="max-w-md"
            style={animado ? { opacity: textoEntra } : undefined}
          >
            <Rotulo capitulo="ferramentas">O que ele faz</Rotulo>
            <Revela
              texto="Quatro coisas que você faz todo dia — e que o papel não faz direito."
              className="mt-5 text-[clamp(1.6rem,3.2vw,2.75rem)] leading-[1.06] font-bold tracking-[-0.025em] text-balance"
            />

            <ul className="mt-7 flex flex-wrap gap-2 lg:mt-9 lg:flex-col lg:gap-1">
              {FERRAMENTAS.map((peca, i) => (
                <Item
                  key={peca.titulo}
                  peca={peca}
                  indice={i}
                  aceso={acesa === i}
                  aoEscolher={() => escolher(i)}
                />
              ))}
            </ul>

            {/* No celular a explicação da peça acesa fica embaixo dos
                botões; no computador ela abre dentro do próprio item. */}
            <p
              className="mt-4 min-h-[4.5rem] text-sm leading-6 text-graf-300 lg:hidden"
              aria-live="polite"
            >
              {acesa !== null ? FERRAMENTAS[acesa].texto : ""}
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function Item({
  peca,
  indice,
  aceso,
  aoEscolher,
}: {
  peca: Ferramenta;
  indice: number;
  aceso: boolean;
  aoEscolher: () => void;
}) {
  const id = `ferramenta-${indice}`;
  return (
    <li>
      <button
        type="button"
        aria-expanded={aceso}
        aria-controls={id}
        onClick={aoEscolher}
        onPointerEnter={(evento) => {
          if (evento.pointerType === "mouse") aoEscolher();
        }}
        onFocus={aoEscolher}
        className={`group flex min-h-11 w-full items-center gap-3 rounded-lg border px-4 text-left transition-colors duration-300 max-lg:w-auto lg:border-transparent lg:px-0 ${
          aceso
            ? "border-ambar-500/60 bg-ambar-500/10 lg:bg-transparent"
            : "border-graf-700 hover:border-graf-500"
        }`}
      >
        <span
          className={`numeros hidden text-xs font-semibold transition-colors lg:block ${
            aceso ? "text-ambar-500" : "text-graf-400"
          }`}
        >
          {String(indice + 1).padStart(2, "0")}
        </span>
        <span
          aria-hidden="true"
          className={`hidden h-px transition-[width,background-color] duration-500 lg:block ${
            aceso ? "w-10 bg-ambar-500" : "w-4 bg-graf-700"
          }`}
        />
        <span
          className={`text-base font-semibold transition-colors lg:text-lg ${
            aceso ? "text-white" : "text-graf-300 group-hover:text-white"
          }`}
        >
          {peca.titulo}
        </span>
        <span className="hidden text-xs font-semibold tracking-[0.16em] text-graf-400 uppercase lg:ml-auto lg:block">
          {peca.nome}
        </span>
      </button>

      {/* A explicação abre e fecha por altura, sem sumir do leitor de tela:
          quem lê com voz ouve as quatro. */}
      <div
        id={id}
        className={`hidden transition-[grid-template-rows,opacity] duration-500 lg:grid ${
          aceso ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <p className="overflow-hidden pl-[4.75rem] text-sm leading-6 text-graf-300">
          <span className="block pb-3">{peca.texto}</span>
        </p>
      </div>
    </li>
  );
}

function Peca({
  peca,
  indice,
  p,
  acesa,
  animado,
  mx,
  my,
  aoEscolher,
}: {
  peca: Ferramenta;
  indice: number;
  p: MotionValue<number>;
  acesa: number | null;
  animado: boolean;
  mx: MotionValue<number>;
  my: MotionValue<number>;
  aoEscolher: () => void;
}) {
  // 1. A chegada: cada peça com a sua janela, uma depois da outra.
  const chegaInicio = 0.02 + indice * 0.035;
  const chegaFim = Math.min(CHEGADA_FIM, chegaInicio + 0.13);
  const chegada = [chegaInicio, chegaFim];
  const vooX = useTransform(p, chegada, [`${peca.origem.x}vw`, "0vw"]);
  const vooY = useTransform(p, chegada, [`${peca.origem.y}vh`, "0vh"]);
  const vooGiro = useTransform(p, chegada, [peca.origem.giro, 0]);
  const vooEscala = useTransform(p, chegada, [0.55, 1]);
  const vooDesfoque = useTransform(p, chegada, [14, 0]);
  const vooFiltro = useMotionTemplate`blur(${vooDesfoque}px)`;
  const vooOpacidade = useTransform(p, [chegaInicio, chegaInicio + 0.05], [0, 1]);

  // 2. A convergência: todas para o centro da caixa, girando para o zero.
  const convergeX = useTransform(
    p,
    [CONVERGE.inicio, CONVERGE.fim],
    ["0cqw", `${(50 - peca.lugar.x) * 0.88}cqw`],
  );
  const convergeY = useTransform(
    p,
    [CONVERGE.inicio, CONVERGE.fim],
    ["0cqh", `${(50 - peca.lugar.y) * 0.8}cqh`],
  );
  const convergeGiro = useTransform(
    p,
    [CONVERGE.inicio, CONVERGE.fim],
    [peca.lugar.giro, peca.lugar.giro + (indice % 2 ? 90 : -90)],
  );
  const convergeEscala = useTransform(p, [CONVERGE.inicio, CONVERGE.fim], [1, 0.18]);
  const convergeOpacidade = useTransform(
    p,
    [CONVERGE.fim - 0.05, CONVERGE.fim],
    [1, 0],
  );

  // 3. O mouse.
  const mouseX = useTransform(mx, [-1, 1], [peca.profundidade * 0.45, -peca.profundidade * 0.45]);
  const mouseY = useTransform(my, [-1, 1], [peca.profundidade * 0.3, -peca.profundidade * 0.3]);

  const estado = acesa === null ? "livre" : acesa === indice ? "acesa" : "apagada";

  return (
    <motion.div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{
        left: `${peca.lugar.x}%`,
        top: `${peca.lugar.y}%`,
        width: `${peca.lugar.largura}%`,
        ...(animado
          ? {
              x: vooX,
              y: vooY,
              rotate: vooGiro,
              scale: vooEscala,
              opacity: vooOpacidade,
              filter: vooFiltro,
            }
          : {}),
      }}
    >
      <motion.div
        style={
          animado
            ? {
                x: convergeX,
                y: convergeY,
                rotate: convergeGiro,
                scale: convergeEscala,
                opacity: convergeOpacidade,
              }
            : { rotate: peca.lugar.giro }
        }
      >
        <motion.div style={animado ? { x: mouseX, y: mouseY } : undefined}>
          <div
            className="flutua"
            style={
              {
                "--duracao": `${5.2 + indice * 0.9}s`,
                "--fase": `${-indice * 1.3}s`,
              } as CSSProperties
            }
          >
            <div
              className="peca relative"
              data-estado={estado}
              data-cursor={peca.titulo}
              onPointerEnter={(evento) => {
                if (evento.pointerType === "mouse") aoEscolher();
              }}
            >
              <Image
                src={peca.arquivo}
                alt=""
                aria-hidden="true"
                width={900}
                height={900}
                sizes="(min-width: 1024px) 28vw, 45vw"
                className="peca-imagem h-auto w-full"
              />
              {/* O brilho do aço: um degradê que só pinta dentro do
                  recorte da própria peça. */}
              <span
                aria-hidden="true"
                className="peca-brilho"
                style={
                  {
                    maskImage: `url(${peca.arquivo})`,
                    WebkitMaskImage: `url(${peca.arquivo})`,
                    "--atraso-brilho": `${1.2 + indice * 1.7}s`,
                  } as CSSProperties
                }
              />
            </div>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
