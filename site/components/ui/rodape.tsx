"use client";

import Image from "next/image";
import { motion, useTransform } from "motion/react";
import { useRef } from "react";

import { MENOS_MOVIMENTO, useMidia } from "@/components/ui/midia";
import { useProgresso } from "@/components/ui/progresso";
import { CAPITULOS } from "@/lib/capitulos";
import { ENTRAR, INSTAGRAM, PLANOS, SISTEMA, WHATSAPP } from "@/lib/site";

const NO_SITE = CAPITULOS.filter((capitulo) => capitulo.noMenu);

/**
 * O rodapé, que sobe de baixo da página.
 *
 * O conteúdo começa um pouco abaixo e mais apagado, e assenta conforme a
 * rolagem chega ao fim — como a última cena da referência, em que o rodapé
 * aparece por trás em vez de simplesmente vir na fila.
 */
export function Rodape() {
  const reduzido = useMidia(MENOS_MOVIMENTO);
  const rodapeRef = useRef<HTMLElement>(null);
  const p = useProgresso(rodapeRef, ["start end", "end end"]);
  const y = useTransform(p, [0, 1], ["-28%", "0%"]);
  const opacidade = useTransform(p, [0, 0.8], [0.2, 1]);

  return (
    <footer
      ref={rodapeRef}
      className="relative overflow-hidden border-t border-graf-800 bg-graf-950"
    >
      {/* Valores fixos, e não `undefined`, para movimento reduzido: o
          motion não apaga o que já escreveu no elemento quando o estilo
          animado some — o rodapé ficava preso a 20% de opacidade. */}
      <motion.div
        style={reduzido ? { y: "0%", opacity: 1 } : { y, opacity: opacidade }}
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-12 px-4 py-16 sm:px-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <Image
              src="/marca/logo-escuro.png"
              alt="BARBOS"
              width={132}
              height={30}
            />
            <p className="mt-5 text-sm leading-6 text-graf-300">
              Agenda, serviços, equipe e estoque da barbearia numa tela só.
              O simples bem feito, pro barbeiro e pro cliente dele.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-14 gap-y-8 sm:flex sm:gap-14">
            <div>
              <p className="text-xs font-semibold tracking-[0.14em] text-graf-400 uppercase">
                Sistema
              </p>
              <ul className="mt-3 text-sm">
                <li>
                  <a href={ENTRAR} className="inline-flex min-h-11 items-center text-graf-300 hover:text-white">
                    Entrar
                  </a>
                </li>
                <li>
                  <a href={PLANOS} className="inline-flex min-h-11 items-center text-graf-300 hover:text-white">
                    Criar conta
                  </a>
                </li>
                <li>
                  <a href={SISTEMA} className="inline-flex min-h-11 items-center text-graf-300 hover:text-white">
                    www.barboss.com.br
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold tracking-[0.14em] text-graf-400 uppercase">
                Contato
              </p>
              <ul className="mt-3 text-sm">
                <li>
                  <a
                    href={INSTAGRAM}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center text-graf-300 hover:text-white"
                  >
                    @barboss.oficial
                    <span className="sr-only"> no Instagram</span>
                  </a>
                </li>
                <li>
                  <a
                    href={WHATSAPP}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="numeros inline-flex min-h-11 items-center text-graf-300 hover:text-white"
                  >
                    (84) 99630-8743
                    <span className="sr-only"> no WhatsApp</span>
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold tracking-[0.14em] text-graf-400 uppercase">
                No site
              </p>
              <ul className="mt-3 text-sm">
                {NO_SITE.map((capitulo) => (
                  <li key={capitulo.id}>
                    <a
                      href={`#${capitulo.id}`}
                      className="inline-flex min-h-11 items-center text-graf-300 hover:text-white"
                    >
                      {capitulo.nome}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="faixa-barbearia" aria-hidden="true" />
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <p className="text-xs text-graf-400">
            BARBOS · gestão para barbearias · {new Date().getFullYear()}
          </p>
          <a
            href="#topo"
            className="inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-graf-300 hover:text-white"
          >
            Voltar ao início
            <span aria-hidden="true">↑</span>
          </a>
        </div>
      </motion.div>
    </footer>
  );
}
