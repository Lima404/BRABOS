"use client";

import { AnimatePresence, motion, useTransform } from "motion/react";
import { useRef, useState, type CSSProperties } from "react";

import { Botao } from "@/components/ui/botao";
import { MENOS_MOVIMENTO, useMidia } from "@/components/ui/midia";
import { useProgresso } from "@/components/ui/progresso";
import { Revela } from "@/components/ui/revela";
import { Rotulo } from "@/components/ui/rotulo";
import { useVisto } from "@/components/ui/visto";
import { destinoDoPagamento, type FormaDePagar } from "@/lib/checkout";
import { ANUAL_NO_PIX, INCLUI, PLANO, reais } from "@/lib/planos";

type Periodo = "mensal" | "anual";
type Meio = "cartao" | "pix";

/** O anual dividido por 12, e quanto ele economiza perto do mensal. */
const PIX_POR_MES = Math.round(ANUAL_NO_PIX / 12);
const ECONOMIA_NO_PIX = PLANO.mensal * 12 - ANUAL_NO_PIX;
const ECONOMIA_NO_CARTAO = PLANO.mensal * 12 - PLANO.anual;
/** A parcela do anual no cartão. R$ 1.128,00 em 12x dá R$ 94,00 certinho. */
const PARCELA_DO_ANUAL = Math.round(PLANO.anual / PLANO.parcelas);

/** O que o cartão mostra em cada escolha. */
const OFERTAS: Record<
  FormaDePagar,
  {
    preco: number;
    de?: number;
    sufixo: string;
    nota: string;
    botao: string;
  }
> = {
  mensal: {
    preco: PLANO.mensal,
    sufixo: "/mês",
    nota: "Cobrado no cartão, todo mês.",
    botao: "Assinar o plano mensal",
  },
  anualCartao: {
    preco: PLANO.anual,
    sufixo: "/ano",
    nota: `À vista ou em até ${PLANO.parcelas}x de ${reais(PARCELA_DO_ANUAL)} no cartão, ${reais(ECONOMIA_NO_CARTAO)} a menos que no mensal.`,
    botao: "Assinar o anual no cartão",
  },
  anualPix: {
    preco: ANUAL_NO_PIX,
    de: PLANO.anual,
    sufixo: "/ano",
    nota: `À vista no PIX. Sai por ${reais(PIX_POR_MES)} por mês, ${reais(ECONOMIA_NO_PIX)} a menos que no mensal.`,
    botao: "Pagar o anual no PIX",
  },
};

/**
 * Capítulo de planos — um pacote só, e a escolha de como pagar.
 *
 * O pagamento acontece fora do site, na página do Asaas: cada escolha
 * passa pelo `/assinar` do sistema, que abre o checkout (ver
 * `lib/checkout.ts`). O site não vê cartão nem guarda chave nenhuma.
 *
 * - ROLAGEM: o cartão do plano pousa, deitado para trás, conforme chega.
 * - AUTOMÁTICO: uma luz âmbar dá a volta na borda do cartão, sem parar.
 * - MOUSE: uma luz segue o cursor por dentro do cartão.
 * - E o toque: trocar entre mensal e anual, ou cartão e PIX, troca o preço
 *   com o número subindo no lugar do outro.
 */
export function Planos() {
  const [periodo, setPeriodo] = useState<Periodo>("mensal");
  const [meio, setMeio] = useState<Meio>("pix");
  const forma: FormaDePagar =
    periodo === "mensal" ? "mensal" : meio === "pix" ? "anualPix" : "anualCartao";

  const listaRef = useRef<HTMLOListElement>(null);
  useVisto(listaRef);

  return (
    <section id="planos" className="relative overflow-hidden py-28 sm:py-36">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:gap-20">
        <div>
          <Rotulo capitulo="planos">Planos</Rotulo>
          <Revela
            texto="Um plano só, com o sistema inteiro."
            destaque="o sistema inteiro."
            className="mt-5 text-[clamp(1.75rem,3.6vw,3rem)] leading-[1.05] font-bold tracking-[-0.025em] text-balance"
          />
          <p className="mt-5 max-w-md text-base leading-7 text-graf-300">
            Nada de plano básico ou recurso cobrado à parte. É o BARBOS
            completo, com suporte 24h, e você escolhe só como pagar.
          </p>

          <ol ref={listaRef} className="lista-aparece mt-10 space-y-5">
            {[
              "Escolha o mensal ou o anual, e como quer pagar.",
              "Pague na página segura do Asaas, no cartão ou no PIX.",
              "Assim que o pagamento cair, você cria a conta da barbearia na hora.",
            ].map((passo, i) => (
              <li
                key={passo}
                className="flex gap-4"
                style={{ "--ordem": i } as CSSProperties}
              >
                <span className="numeros mt-0.5 text-xs font-semibold text-ambar-500">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-sm leading-6 text-graf-300 sm:text-base">
                  {passo}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <Cartao
          periodo={periodo}
          meio={meio}
          forma={forma}
          aoMudarPeriodo={setPeriodo}
          aoMudarMeio={setMeio}
        />
      </div>
    </section>
  );
}

function Cartao({
  periodo,
  meio,
  forma,
  aoMudarPeriodo,
  aoMudarMeio,
}: {
  periodo: Periodo;
  meio: Meio;
  forma: FormaDePagar;
  aoMudarPeriodo: (periodo: Periodo) => void;
  aoMudarMeio: (meio: Meio) => void;
}) {
  const reduzido = useMidia(MENOS_MOVIMENTO);
  const cartaoRef = useRef<HTMLDivElement>(null);

  // O cartão pousa: chega deitado para trás e abaixo, e assenta.
  const chegada = useProgresso(cartaoRef, ["start end", "start 40%"]);
  const giro = useTransform(chegada, [0, 1], [18, 0]);
  const subida = useTransform(chegada, [0, 1], [90, 0]);
  const opacidade = useTransform(chegada, [0, 0.5], [0, 1]);

  const oferta = OFERTAS[forma];
  const destino = destinoDoPagamento(forma);

  function moveu(evento: React.PointerEvent) {
    const cartao = cartaoRef.current;
    if (!cartao || evento.pointerType !== "mouse") return;
    const caixa = cartao.getBoundingClientRect();
    cartao.style.setProperty("--mx", `${evento.clientX - caixa.left}px`);
    cartao.style.setProperty("--my", `${evento.clientY - caixa.top}px`);
  }

  return (
    <div style={{ perspective: 1400 }}>
      <motion.div
        ref={cartaoRef}
        onPointerMove={moveu}
        className="borda-viva cartao-luz relative rounded-2xl border border-graf-800 bg-graf-900/80 p-6 shadow-[var(--sombra-2)] backdrop-blur-sm sm:p-9"
        style={
          reduzido
            ? { rotateX: 0, y: 0, opacity: 1 }
            : { rotateX: giro, y: subida, opacity: opacidade, transformOrigin: "50% 100%" }
        }
      >
        <span aria-hidden="true" className="cartao-luz-brilho rounded-2xl" />

        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm font-semibold tracking-[0.14em] text-graf-300 uppercase">
            BARBOS completo
          </p>
          <Alternador
            rotulo="Período do plano"
            grupo="periodo"
            valor={periodo}
            aoMudar={aoMudarPeriodo}
            opcoes={[
              { valor: "mensal", rotulo: "Mensal" },
              { valor: "anual", rotulo: "Anual" },
            ]}
          />
        </div>

        {/* A forma de pagar o anual. No mensal ela some, e o cartão encolhe
            junto, sem pular. */}
        <AnimatePresence initial={false}>
          {periodo === "anual" && (
            <motion.div
              key="meio"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
              className="relative overflow-hidden"
            >
              <div className="pt-5">
                <Alternador
                  rotulo="Como pagar o anual"
                  grupo="meio"
                  valor={meio}
                  aoMudar={aoMudarMeio}
                  largo
                  opcoes={[
                    { valor: "pix", rotulo: "PIX", selo: "10% off" },
                    { valor: "cartao", rotulo: `Cartão até ${PLANO.parcelas}x` },
                  ]}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* O preço. Troca subindo no lugar do anterior. */}
        <div className="relative mt-8 min-h-[9.5rem] sm:min-h-[8.5rem]" aria-live="polite">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={forma}
              initial={reduzido ? { opacity: 0 } : { opacity: 0, y: 28, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduzido ? { opacity: 0 } : { opacity: 0, y: -24, filter: "blur(6px)" }}
              transition={{ duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}
            >
              {oferta.de && (
                <p className="numeros text-sm text-graf-400">
                  <span className="sr-only">De </span>
                  <s>{reais(oferta.de)}</s>
                  <span className="sr-only"> por</span>
                </p>
              )}
              <Preco centavos={oferta.preco} sufixo={oferta.sufixo} />
              <p className="mt-3 max-w-sm text-sm leading-6 text-graf-300">
                {oferta.nota}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="relative mt-6">
          <Botao href={destino} novaAba className="w-full">
            {oferta.botao}
            <span className="sr-only"> (abre em outra aba)</span>
          </Botao>
          <p className="mt-3 flex items-center justify-center gap-2 text-center text-xs text-graf-400">
            <Cadeado />
            Você vai para a página de pagamento segura do Asaas.
          </p>
        </div>

        <ul className="relative mt-8 space-y-3 border-t border-graf-800 pt-7">
          {INCLUI.map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm text-white sm:text-base">
              <Certo />
              {item}
            </li>
          ))}
        </ul>
      </motion.div>
    </div>
  );
}

/** "R$" pequeno, o número grande e os centavos pequenos, no alto. */
function Preco({ centavos, sufixo }: { centavos: number; sufixo: string }) {
  const [inteiro, fracao] = reais(centavos).replace(/^R\$\s/, "").split(",");
  return (
    <p className="numeros mt-1 flex items-start text-white">
      <span className="sr-only">{`${reais(centavos)} ${sufixo === "/mês" ? "por mês" : "por ano"}`}</span>
      <span aria-hidden="true" className="mt-2 mr-1.5 text-lg font-semibold text-graf-300">
        R$
      </span>
      <span aria-hidden="true" className="text-6xl leading-none font-bold tracking-[-0.04em] sm:text-7xl">
        {inteiro}
      </span>
      <span aria-hidden="true" className="mt-1.5 ml-1 flex flex-col">
        <span className="text-xl leading-none font-bold">,{fracao}</span>
        <span className="mt-1 text-sm text-graf-300">{sufixo}</span>
      </span>
    </p>
  );
}

function Alternador<T extends string>({
  rotulo,
  grupo,
  valor,
  aoMudar,
  opcoes,
  largo = false,
}: {
  rotulo: string;
  /** Nome do traço que desliza: um por alternador, senão os dois brigam. */
  grupo: string;
  valor: T;
  aoMudar: (valor: T) => void;
  opcoes: { valor: T; rotulo: string; selo?: string }[];
  largo?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={rotulo}
      className={`relative flex rounded-xl border border-graf-700 bg-graf-950/60 p-1 ${largo ? "w-full" : ""}`}
    >
      {opcoes.map((opcao) => {
        const ativo = opcao.valor === valor;
        return (
          <button
            key={opcao.valor}
            type="button"
            aria-pressed={ativo}
            onClick={() => aoMudar(opcao.valor)}
            className={`relative flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ambar-300 ${
              largo ? "flex-1" : ""
            } ${ativo ? "text-white" : "text-graf-300 hover:text-white"}`}
          >
            {ativo && (
              <motion.span
                layoutId={`alternador-${grupo}`}
                aria-hidden="true"
                className="absolute inset-0 rounded-lg bg-graf-700"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative">{opcao.rotulo}</span>
            {opcao.selo && (
              <span className="relative rounded-full bg-ambar-500/15 px-2 py-0.5 text-xs font-bold text-ambar-300">
                {opcao.selo}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Certo() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="mt-0.5 h-5 w-5 flex-none text-ambar-500">
      <path
        d="M5 10.5l3.2 3.2L15 6.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Cadeado() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-3.5 w-3.5 flex-none">
      <rect x="4" y="9" width="12" height="8" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 9V7a3 3 0 016 0v2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
