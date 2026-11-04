"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";

type Ferramenta = {
  readonly arquivo: string;
  readonly nome: string;
  readonly titulo: string;
  readonly texto: string;
  /** A que distância a peça flutua. Muda o quanto ela anda com o mouse. */
  readonly profundidade: number;
  readonly giroInicial: number;
};

const FERRAMENTAS: readonly Ferramenta[] = [
  {
    arquivo: "/ferramentas/maquina.webp",
    nome: "Máquina",
    titulo: "Agenda",
    texto:
      "Cada horário no lugar, mês a mês. Quem é o próximo aparece na primeira linha, sem procurar.",
    profundidade: 70,
    giroInicial: -6,
  },
  {
    arquivo: "/ferramentas/tesoura.webp",
    nome: "Tesoura",
    titulo: "Serviços",
    texto:
      "Preço, duração e cor de cada serviço. O valor do dia se soma sozinho, sem calculadora.",
    profundidade: 30,
    giroInicial: 5,
  },
  {
    arquivo: "/ferramentas/navalha.webp",
    nome: "Navalha",
    titulo: "Equipe",
    texto:
      "Cada barbeiro com a própria agenda. Dois cortes no mesmo horário o sistema simplesmente não deixa marcar.",
    profundidade: 54,
    giroInicial: -3,
  },
  {
    arquivo: "/ferramentas/pente.webp",
    nome: "Pente",
    titulo: "Estoque",
    texto:
      "Pomada, gel e bebida saem da prateleira na hora da venda. E o sistema avisa antes de acabar.",
    profundidade: 18,
    giroInicial: 7,
  },
];

/**
 * As ferramentas que seguem o mouse.
 *
 * Duas coisas acontecendo juntas, e é a soma delas que dá a sensação de
 * profundidade — nenhuma das duas sozinha convence:
 *
 * 1. O PALCO inteiro gira na direção do cursor (o "3D tilt" do
 *    MazyOS/jquery.html, demo 6).
 * 2. Cada peça anda uma distância DIFERENTE, conforme o quanto ela está
 *    "longe" (o parallax multicamada, demo 11). Sem isso o conjunto
 *    inclina como um bloco de madeira só.
 *
 * Por cima de tudo passa um reflexo (demo 14) — é ele que faz o aço
 * parecer aço, e não adesivo.
 */
export function Ferramentas() {
  const palcoRef = useRef<HTMLDivElement>(null);

  // -1 a 1 nos dois eixos, medidos a partir do centro do palco.
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mola = { stiffness: 110, damping: 18, mass: 0.7 };
  const xSuave = useSpring(x, mola);
  const ySuave = useSpring(y, mola);

  const giroY = useTransform(xSuave, [-1, 1], [11, -11]);
  const giroX = useTransform(ySuave, [-1, 1], [-8, 8]);

  useEffect(() => {
    const palco = palcoRef.current;
    if (!palco) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    function moveu(evento: PointerEvent) {
      const caixa = palco!.getBoundingClientRect();
      const centroX = caixa.left + caixa.width / 2;
      const centroY = caixa.top + caixa.height / 2;
      // Dividido por uma distância maior que o palco: assim a peça continua
      // reagindo quando o cursor passa por fora, em vez de travar na borda.
      x.set(Math.max(-1, Math.min(1, (evento.clientX - centroX) / (caixa.width * 0.75))));
      y.set(Math.max(-1, Math.min(1, (evento.clientY - centroY) / (caixa.height * 0.9))));
    }

    function saiu() {
      x.set(0);
      y.set(0);
    }

    window.addEventListener("pointermove", moveu, { passive: true });
    window.addEventListener("pointerleave", saiu);
    return () => {
      window.removeEventListener("pointermove", moveu);
      window.removeEventListener("pointerleave", saiu);
    };
  }, [x, y]);

  return (
    <section
      id="ferramentas"
      className="relative overflow-hidden border-t border-graf-800 py-24 sm:py-32"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.2em] text-ambar-500 uppercase">
            O que ele faz
          </p>
          <h2 className="mt-5 text-3xl leading-tight font-bold text-balance sm:text-4xl">
            Quatro coisas que você faz todo dia — e que o papel não faz
            direito.
          </h2>
          <p className="mt-5 max-w-lg text-base leading-7 text-graf-300">
            Nada de módulo, nada de configuração de três horas. É a
            barbearia do jeito que ela já funciona, só que ela não esquece
            nada.
          </p>
        </div>

        <motion.div
          ref={palcoRef}
          className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
          style={{
            perspective: 1100,
            transformStyle: "preserve-3d",
            rotateX: giroX,
            rotateY: giroY,
          }}
        >
          {FERRAMENTAS.map((peca) => (
            <Peca key={peca.nome} peca={peca} xSuave={xSuave} ySuave={ySuave} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function Peca({
  peca,
  xSuave,
  ySuave,
}: {
  peca: Ferramenta;
  xSuave: ReturnType<typeof useSpring>;
  ySuave: ReturnType<typeof useSpring>;
}) {
  // É aqui que mora o parallax: cada peça anda proporcionalmente à sua
  // profundidade, então elas se descolam umas das outras em vez de
  // inclinarem juntas.
  const deslocaX = useTransform(
    xSuave,
    [-1, 1],
    [peca.profundidade * 0.5, -peca.profundidade * 0.5],
  );
  const deslocaY = useTransform(
    ySuave,
    [-1, 1],
    [peca.profundidade * 0.26, -peca.profundidade * 0.26],
  );

  return (
    <div className="group relative rounded-xl border border-graf-800 bg-graf-900/60 p-6 transition-colors duration-300 hover:border-ambar-700/70">
      {/* A peça flutua ACIMA do cartão, não dentro dele. */}
      <motion.div
        className="relative mx-auto flex h-36 w-full items-center justify-center"
        style={{
          x: deslocaX,
          y: deslocaY,
          rotate: peca.giroInicial,
          transformStyle: "preserve-3d",
        }}
      >
        <Image
          src={peca.arquivo}
          alt=""
          aria-hidden="true"
          width={300}
          height={300}
          className="h-full w-auto object-contain drop-shadow-[0_18px_28px_rgba(0,0,0,0.65)] transition-transform duration-500 group-hover:scale-[1.07]"
        />
      </motion.div>

      {/* O reflexo que atravessa o aço. Só aparece no hover, e nunca para
          quem pediu movimento reduzido. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl motion-reduce:hidden"
      >
        <span className="absolute -inset-y-10 -left-1/3 w-1/3 rotate-12 bg-linear-to-r from-transparent via-white/8 to-transparent transition-transform duration-[900ms] ease-out group-hover:translate-x-[420%]" />
      </span>

      <div className="relative mt-6">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-graf-500 uppercase">
          {peca.nome}
        </p>
        <h3 className="mt-2 text-xl font-bold text-white">{peca.titulo}</h3>
        <p className="mt-2 text-sm leading-6 text-graf-400">{peca.texto}</p>
      </div>
    </div>
  );
}
