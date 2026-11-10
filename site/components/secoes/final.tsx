"use client";

import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useSpring,
  useTransform,
} from "motion/react";
import { useEffect, useRef } from "react";

import { Botao } from "@/components/ui/botao";
import { Magnetico } from "@/components/ui/magnetico";
import { COM_MOUSE, MENOS_MOVIMENTO, useMidia } from "@/components/ui/midia";
import { useProgresso } from "@/components/ui/progresso";
import { Revela } from "@/components/ui/revela";
import { Rotulo } from "@/components/ui/rotulo";
import { useSequencia } from "@/components/ui/sequencia";
import { PLANOS } from "@/lib/site";

/**
 * Os 61 quadros da cadeira girando de três-quartos até de frente. Saíram de
 * um giro de 5s gerado no Higgsfield — ver `scripts/quadros-da-cadeira.sh`.
 */
const QUADROS_DA_CADEIRA = Array.from(
  { length: 61 },
  (_, i) => `/cadeira/q${String(i + 1).padStart(3, "0")}.webp`,
);

/**
 * Capítulo 09 — a cadeira volta, e o convite.
 *
 * A página abre com uma cadeira numa barbearia à noite e fecha com ela de
 * novo, agora sozinha dentro de um anel de luz — o fecho da referência.
 *
 * - MOUSE: a cadeira gira acompanhando o cursor na horizontal (cada
 *   posição do mouse é um quadro do giro), e o anel inclina junto.
 * - AUTOMÁTICO: sem mouse, ou com ele parado, a cadeira gira sozinha, bem
 *   devagar, de um lado para o outro. Uma faísca corre pelo anel sem parar.
 * - ROLAGEM: o anel se desenha conforme a seção chega ao centro da tela.
 */
export function Final() {
  const secaoRef = useRef<HTMLElement>(null);
  const palcoRef = useRef<HTMLDivElement>(null);
  const telaRef = useRef<HTMLCanvasElement>(null);
  const temMouse = useMidia(COM_MOUSE);
  const reduzido = useMidia(MENOS_MOVIMENTO);

  const { pronto, desenhar } = useSequencia(QUADROS_DA_CADEIRA, secaoRef);

  // --- o anel, desenhado pela rolagem -----------------------------------------
  const chegada = useProgresso(secaoRef, ["start end", "center center"]);
  const anelBruto = useTransform(chegada, [0.3, 1], [0, 1]);
  const anelMola = useSpring(anelBruto, { stiffness: 70, damping: 20 });
  // Movimento reduzido: o anel já nasce fechado.
  const anelFechado = useMotionValue(1);
  const anel = reduzido ? anelFechado : anelMola;
  const faiscaOpacidade = useTransform(anel, [0.9, 1], [0, 1]);
  const halo = useTransform(anel, [0.4, 1], [0, 0.55]);

  // --- o giro: o mouse manda, e quando ele para a cadeira passeia sozinha --------
  const giro = useMotionValue(0.55);
  const giroMola = useSpring(giro, { stiffness: 45, damping: 15, mass: 0.8 });
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const anelGiroY = useSpring(useTransform(mx, [-1, 1], [-16, 16]), { stiffness: 80, damping: 16 });
  const anelGiroX = useSpring(useTransform(my, [-1, 1], [12, -12]), { stiffness: 80, damping: 16 });

  const atualRef = useRef(-1);
  useMotionValueEvent(giroMola, "change", (valor) => {
    const indice = Math.round(
      Math.min(1, Math.max(0, valor)) * (QUADROS_DA_CADEIRA.length - 1),
    );
    if (indice === atualRef.current) return;
    atualRef.current = indice;
    desenhar(telaRef.current, indice);
  });

  useEffect(() => {
    if (!pronto) return;
    atualRef.current = Math.round(giroMola.get() * (QUADROS_DA_CADEIRA.length - 1));
    desenhar(telaRef.current, atualRef.current);
    const redesenhar = () => desenhar(telaRef.current, Math.max(0, atualRef.current));
    window.addEventListener("resize", redesenhar);
    return () => window.removeEventListener("resize", redesenhar);
  }, [pronto, desenhar, giroMola]);

  useEffect(() => {
    const palco = palcoRef.current;
    if (!palco || reduzido) return;

    let visivel = false;
    let pedido = 0;
    let ultimoMouse = -Infinity;

    function quadro(agora: number) {
      pedido = 0;
      if (!visivel) return;
      // Dois segundos e meio sem mouse: a cadeira volta a passear sozinha.
      if (agora - ultimoMouse > 2500) {
        giro.set(0.55 + 0.4 * Math.sin(agora / 2400));
        mx.set(0.5 * Math.sin(agora / 2400));
        my.set(0.3 * Math.cos(agora / 3100));
      }
      pedido = requestAnimationFrame(quadro);
    }

    function moveu(evento: PointerEvent) {
      if (evento.pointerType !== "mouse" || !visivel) return;
      giro.set(evento.clientX / window.innerWidth);
      const caixa = palco!.getBoundingClientRect();
      mx.set(Math.max(-1, Math.min(1, ((evento.clientX - caixa.left) / caixa.width) * 2 - 1)));
      my.set(Math.max(-1, Math.min(1, ((evento.clientY - caixa.top) / caixa.height) * 2 - 1)));
      ultimoMouse = performance.now();
    }

    const observador = new IntersectionObserver(([entrada]) => {
      visivel = entrada.isIntersecting;
      if (visivel && !pedido) pedido = requestAnimationFrame(quadro);
    });
    observador.observe(palco);
    if (temMouse) window.addEventListener("pointermove", moveu, { passive: true });

    return () => {
      observador.disconnect();
      cancelAnimationFrame(pedido);
      window.removeEventListener("pointermove", moveu);
    };
  }, [reduzido, temMouse, giro, mx, my]);

  return (
    <section
      ref={secaoRef}
      id="comecar"
      className="relative overflow-hidden py-24 sm:py-32"
    >
      <div className="mx-auto grid max-w-7xl items-center gap-6 px-4 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:gap-10">
        <div className="relative z-10 order-2 lg:order-1">
          <Rotulo capitulo="comecar">Começar</Rotulo>
          <Revela
            texto="Abre a sua agenda de amanhã já organizada."
            destaque="já organizada."
            className="mt-6 text-[clamp(2.1rem,5vw,4.4rem)] leading-[0.98] font-bold tracking-[-0.03em] text-balance uppercase"
          />
          <p className="mt-6 max-w-md text-base leading-7 text-graf-300 sm:text-lg">
            Dá pra cadastrar a barbearia agora e marcar o primeiro horário
            ainda hoje.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Magnetico>
              <Botao href={PLANOS}>Criar minha conta</Botao>
            </Magnetico>
          </div>
        </div>

        {/* O palco: anel atrás, cadeira na frente. */}
        <div
          ref={palcoRef}
          data-cursor={temMouse && !reduzido ? "Gire" : undefined}
          className="relative order-1 mx-auto aspect-square w-full max-w-[34rem] lg:order-2 lg:max-w-none"
          style={{ perspective: 1000 }}
        >
          <motion.div
            aria-hidden="true"
            className="luz-ambar pointer-events-none absolute inset-[-10%]"
            style={{ opacity: halo }}
          />

          <motion.div
            aria-hidden="true"
            className="absolute inset-[6%]"
            style={
              reduzido
                ? { rotateX: 0, rotateY: 0 }
                : { rotateX: anelGiroX, rotateY: anelGiroY, transformStyle: "preserve-3d" }
            }
          >
            <svg viewBox="0 0 200 200" className="h-full w-full overflow-visible">
              <defs>
                <filter id="anel-brilho" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="largo" />
                  <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="curto" />
                  <feMerge>
                    <feMergeNode in="largo" />
                    <feMergeNode in="largo" />
                    <feMergeNode in="curto" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* O anel de fora: tracejado, girando devagar ao contrário. */}
              <g className="gira-lento-contra" style={{ transformOrigin: "100px 100px" }}>
                <circle
                  cx="100"
                  cy="100"
                  r="97"
                  fill="none"
                  className="stroke-graf-700"
                  strokeWidth="0.4"
                  strokeDasharray="1 4"
                />
              </g>

              {/* O anel de luz, desenhado pela rolagem. Começa embaixo,
                  onde a cadeira encosta no chão. */}
              <motion.circle
                cx="100"
                cy="100"
                r="86"
                fill="none"
                className="stroke-ambar-300"
                strokeWidth="1.6"
                strokeLinecap="round"
                filter="url(#anel-brilho)"
                transform="rotate(90 100 100)"
                style={{ pathLength: anel }}
              />

              {/* A faísca que corre pelo anel quando ele está fechado. */}
              <motion.g style={{ opacity: reduzido ? 0 : faiscaOpacidade }}>
                <g className="gira-faisca" style={{ transformOrigin: "100px 100px" }}>
                  <circle cx="100" cy="14" r="2.2" className="fill-ambar-300" filter="url(#anel-brilho)" />
                  <circle cx="100" cy="14" r="1" fill="white" />
                </g>
              </motion.g>
            </svg>
          </motion.div>

          {/* A cadeira. A máscara apaga a borda do quadro: o halo âmbar
              está gravado nas imagens, e o canto delas não é exatamente a
              cor do fundo da página. */}
          <canvas
            ref={telaRef}
            aria-hidden="true"
            className="absolute inset-[8%] h-[84%] w-[84%] transition-opacity duration-700 [mask-image:radial-gradient(ellipse_70%_72%_at_50%_50%,black_55%,transparent_100%)]"
            style={{ opacity: pronto ? 1 : 0 }}
          />
        </div>
      </div>
    </section>
  );
}
