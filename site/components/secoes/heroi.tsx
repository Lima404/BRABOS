"use client";

import Image from "next/image";
import {
  AnimatePresence,
  motion,
  useMotionTemplate,
  useTransform,
} from "motion/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { Botao } from "@/components/ui/botao";
import { useLuz } from "@/components/ui/luz";
import { Magnetico } from "@/components/ui/magnetico";
import { MENOS_MOVIMENTO, useMidia } from "@/components/ui/midia";
import { useProgresso } from "@/components/ui/progresso";
import { Revela } from "@/components/ui/revela";
import { Rotulo } from "@/components/ui/rotulo";
import { WHATSAPP } from "@/lib/site";

/**
 * Capítulo 01 — a barbearia à noite.
 *
 * Três movimentos, um de cada natureza, e é a soma que dá a sensação de
 * cena de cinema em vez de banner:
 *
 * - AUTOMÁTICO: a cena é um vídeo de 5s gerado no Higgsfield (a câmera
 *   avançando devagar na direção da cadeira), tocado em vai-e-volta para
 *   não ter costura. E os avisos do sistema chegam sozinhos no canto.
 * - MOUSE: uma luz âmbar vai atrás do cursor, e a cena anda um pouco ao
 *   contrário dele — o parallax que dá fundo à foto.
 * - ROLAGEM: a seção fica presa enquanto o texto sai desfocando para cima
 *   e a câmera entra na cadeira. É a transição com borrão de movimento da
 *   referência.
 */
export function Heroi() {
  const secaoRef = useRef<HTMLElement>(null);
  const palcoRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduzido = useMidia(MENOS_MOVIMENTO);

  const p = useProgresso(secaoRef);

  const textoY = useTransform(p, [0, 0.8], [0, -170]);
  const textoOpacidade = useTransform(p, [0.06, 0.62], [1, 0]);
  const textoDesfoque = useTransform(p, [0.06, 0.62], [0, 16]);
  const textoFiltro = useMotionTemplate`blur(${textoDesfoque}px)`;
  const cenaEscala = useTransform(p, [0, 1], [1.05, 1.34]);
  const veu = useTransform(p, [0.4, 1], [0, 0.9]);

  const luz = useLuz(palcoRef, {
    ligado: !reduzido,
    descanso: { x: 0.42, y: 0.05 },
  });
  const cenaX = useTransform(luz.x, [-1, 1], [18, -18]);
  const cenaY = useTransform(luz.y, [-1, 1], [12, -12]);
  const luzX = useTransform(luz.x, [-1, 1], ["-50%", "50%"]);
  const luzY = useTransform(luz.y, [-1, 1], ["-50%", "50%"]);

  // O vídeo só toca enquanto está na tela, e nunca para quem pediu menos
  // movimento — nesse caso fica o primeiro quadro, que é o pôster.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (reduzido) {
      video.pause();
      return;
    }
    const observador = new IntersectionObserver(([entrada]) => {
      if (entrada.isIntersecting) void video.play().catch(() => {});
      else video.pause();
    });
    observador.observe(video);
    return () => observador.disconnect();
  }, [reduzido]);

  return (
    <section
      ref={secaoRef}
      id="topo"
      aria-label="BARBOS"
      className="palco-alto relative h-[170vh]"
    >
      <div
        ref={palcoRef}
        className="palco sticky top-0 h-svh min-h-[620px] overflow-hidden"
      >
        {/* A cena. Fica 4% maior que a tela para o parallax nunca mostrar
            a borda do vídeo. */}
        <motion.div
          aria-hidden="true"
          className="absolute -inset-[4%]"
          style={
            reduzido
              ? { scale: 1.05, x: 0, y: 0 }
              : { scale: cenaEscala, x: cenaX, y: cenaY }
          }
        >
          <video
            ref={videoRef}
            className="h-full w-full object-cover object-[78%_50%] lg:object-[70%_50%]"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster="/heroi/cena.webp"
            disablePictureInPicture
          >
            <source src="/heroi/cena.webm" type="video/webm" />
            <source src="/heroi/cena.mp4" type="video/mp4" />
          </video>
        </motion.div>

        {/* A luz que segue o mouse. É uma camada só, movida por transform —
            o navegador não repinta nada, só arrasta. */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 mix-blend-screen"
          style={{ x: luzX, y: luzY }}
        >
          <div className="luz-ambar absolute top-1/2 left-1/2 h-[52rem] w-[52rem] -translate-x-1/2 -translate-y-1/2" />
        </motion.div>

        {/* Os véus que garantem a leitura: da esquerda no computador, de
            baixo no celular, onde o texto fica sobre a cena. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-linear-to-t from-graf-950 via-graf-950/80 to-graf-950/10 lg:bg-linear-to-r lg:from-graf-950 lg:via-graf-950/70 lg:to-transparent"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-graf-950 to-transparent"
        />
        <motion.div
          aria-hidden="true"
          className="absolute inset-0 bg-graf-950"
          style={{ opacity: reduzido ? 0 : veu }}
        />

        <motion.div
          className="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-end px-4 pb-20 sm:px-6 lg:justify-center lg:pb-0"
          style={
            reduzido
              ? { y: 0, opacity: 1, filter: "none" }
              : { y: textoY, opacity: textoOpacidade, filter: textoFiltro }
          }
        >
          <div className="max-w-2xl">
            <Rotulo capitulo="topo" className="entrada">
              Gestão para barbearias
            </Rotulo>

            <Revela
              como="h1"
              texto="O caderno não avisa quando o cliente não vem."
              destaque="não vem."
              atraso={0.2}
              className="mt-6 text-[clamp(2.35rem,6.4vw,5.6rem)] leading-[0.96] font-bold tracking-[-0.03em] text-balance uppercase"
            />

            <p
              className="entrada mt-7 max-w-md text-base leading-7 text-graf-300 sm:text-lg"
              style={{ "--atraso": "0.95s" } as CSSProperties}
            >
              O BARBOS põe agenda, serviços, equipe e estoque numa tela só —
              feita pra ser aberta com o cliente já sentado na cadeira.
            </p>

            <div
              className="entrada mt-9 flex flex-wrap gap-3"
              style={{ "--atraso": "1.1s" } as CSSProperties}
            >
              <Magnetico>
                <Botao href={WHATSAPP} novaAba>
                  Criar minha conta
                  <span className="sr-only"> (abre o WhatsApp)</span>
                </Botao>
              </Magnetico>
              <Magnetico>
                <Botao href="#telas" tom="contorno">
                  Ver as telas
                </Botao>
              </Magnetico>
            </div>
          </div>
        </motion.div>

        <Avisos ligado={!reduzido} />

        <div
          aria-hidden="true"
          className="entrada pointer-events-none absolute inset-x-0 bottom-7 hidden justify-center lg:flex"
          style={{ "--atraso": "1.6s" } as CSSProperties}
        >
          <span className="flex flex-col items-center gap-3 text-[11px] font-semibold tracking-[0.22em] text-graf-300 uppercase">
            Role
            <span className="relative block h-10 w-px overflow-hidden bg-graf-700">
              <span className="gota absolute inset-x-0 top-0 h-4 bg-ambar-500" />
            </span>
          </span>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------------
   Os avisos que chegam sozinhos
   ---------------------------------------------------------------------------
   Um por vez, a cada 4 segundos, cada um mostrando uma das quatro coisas
   que o sistema faz. São o produto falando antes de a pessoa rolar.

   Ficam fora do leitor de tela: um anúncio novo a cada 4 segundos
   atropelaria a leitura da página. O conteúdo deles está no resto do site.
*/

const AVISOS = [
  {
    tipo: "Novo agendamento",
    estado: "agendado",
    titulo: "WESLEY VIEIRA · amanhã, 10:00",
    detalhe: "BARBA · R$ 30,00",
  },
  {
    tipo: "Horário livre",
    estado: "faltou",
    titulo: "PAULO DIAS desmarcou às 16:00",
    detalhe: "O horário já voltou para a agenda.",
  },
  {
    tipo: "Concluído",
    estado: "confirmado",
    titulo: "ANDRE VIEIRA · CABELO",
    detalhe: "R$ 35,00 somados ao dia.",
  },
  {
    tipo: "Estoque baixo",
    estado: "atendendo",
    titulo: "POMADA · restam 2",
    detalhe: "Avisando antes de zerar.",
  },
] as const;

const COR_DO_ESTADO = {
  agendado: "text-estado-agendado",
  faltou: "text-estado-faltou",
  confirmado: "text-estado-confirmado",
  atendendo: "text-ambar-500",
} as const;

const PONTO_DO_ESTADO = {
  agendado: "bg-estado-agendado",
  faltou: "bg-estado-faltou",
  confirmado: "bg-estado-confirmado",
  atendendo: "bg-ambar-500",
} as const;

const INTERVALO = 4200;

function Avisos({ ligado }: { ligado: boolean }) {
  const [indice, setIndice] = useState(0);
  const caixaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const caixa = caixaRef.current;
    if (!ligado || !caixa) return;

    let visivel = true;
    const observador = new IntersectionObserver(([entrada]) => {
      visivel = entrada.isIntersecting;
    });
    observador.observe(caixa);

    const relogio = window.setInterval(() => {
      if (visivel && !document.hidden) {
        setIndice((atual) => (atual + 1) % AVISOS.length);
      }
    }, INTERVALO);

    return () => {
      window.clearInterval(relogio);
      observador.disconnect();
    };
  }, [ligado]);

  const aviso = AVISOS[indice];

  return (
    <div
      ref={caixaRef}
      aria-hidden="true"
      className="entrada pointer-events-none absolute right-6 bottom-24 z-10 hidden w-[19rem] md:block lg:right-20 lg:bottom-28"
      style={{ "--atraso": "1.8s" } as CSSProperties}
    >
      {/* O cartão de trás, só para dar a ideia de pilha. */}
      <div className="absolute inset-x-4 -top-2 h-full rounded-xl border border-graf-800 bg-graf-900/50" />

      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={indice}
          initial={{ opacity: 0, y: 26, scale: 0.96, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -20, scale: 0.98, filter: "blur(6px)" }}
          transition={{ duration: 0.65, ease: [0.2, 0.7, 0.2, 1] }}
          className="relative overflow-hidden rounded-xl border border-graf-700 bg-graf-900/85 p-4 shadow-[var(--sombra-2)] backdrop-blur-md"
        >
          <div className="flex items-center gap-2">
            <Image
              src="/marca/simbolo.png"
              alt=""
              width={18}
              height={18}
              className="rounded-[5px]"
            />
            <span className="text-xs font-semibold text-white">BARBOS</span>
            <span className="ml-auto text-xs text-graf-400">agora</span>
          </div>

          <p
            className={`mt-3 flex items-center gap-2 text-xs font-semibold ${COR_DO_ESTADO[aviso.estado]}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${PONTO_DO_ESTADO[aviso.estado]}`}
            />
            {aviso.tipo}
          </p>
          <p className="numeros mt-1 text-sm font-semibold text-white">
            {aviso.titulo}
          </p>
          <p className="numeros text-sm text-graf-300">{aviso.detalhe}</p>

          {ligado && (
            <span
              className="tempo absolute inset-x-0 bottom-0 h-0.5 origin-left bg-ambar-500/70"
              style={{ "--duracao": `${INTERVALO}ms` } as CSSProperties}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
