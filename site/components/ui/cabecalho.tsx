"use client";

import Image from "next/image";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { useState } from "react";

import { Botao } from "@/components/ui/botao";
import { useCapituloAtivo } from "@/components/ui/capitulo-ativo";
import { Magnetico } from "@/components/ui/magnetico";
import { CAPITULOS } from "@/lib/capitulos";
import { PLANOS } from "@/lib/site";

const ATALHOS = CAPITULOS.filter((capitulo) => capitulo.noMenu);

/**
 * A barra do topo.
 *
 * - Nasce transparente sobre o herói e ganha fundo quando a página rola.
 * - Some quando a pessoa rola para baixo — a coreografia dos capítulos
 *   precisa da tela inteira — e volta no primeiro movimento para cima.
 * - O menu marca o capítulo em que a pessoa está, com um traço âmbar que
 *   desliza de um item para o outro.
 */
export function Cabecalho() {
  const ativo = useCapituloAtivo();
  const { scrollY } = useScroll();
  const [rolou, setRolou] = useState(false);
  const [escondido, setEscondido] = useState(false);

  useMotionValueEvent(scrollY, "change", (atual) => {
    const anterior = scrollY.getPrevious() ?? 0;
    setRolou(atual > 24);
    // Uma folga de 6px para o tremor do trackpad não fazer a barra piscar.
    if (atual > anterior + 6 && atual > 160) setEscondido(true);
    else if (atual < anterior - 6) setEscondido(false);
  });

  return (
    <motion.header
      className={`fixed inset-x-0 top-[5px] z-50 transition-[background-color,border-color] duration-300 ${
        rolou
          ? "border-b border-graf-800 bg-graf-950/80 backdrop-blur-md"
          : "border-b border-transparent"
      }`}
      animate={{ y: escondido ? "-115%" : "0%" }}
      transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
      // Quem navega por teclado e entra no menu sempre o encontra visível.
      onFocusCapture={() => setEscondido(false)}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-8 px-4 sm:px-6">
        <a href="#topo" className="flex shrink-0 items-center" aria-label="BARBOS, voltar ao início">
          <Image
            src="/marca/logo-escuro.png"
            alt="BARBOS"
            width={116}
            height={26}
            priority
          />
        </a>

        {/* Só a partir de 1024px: abaixo disso os cinco itens e o botão não
            cabem numa linha, e o texto quebrava em duas. */}
        <nav aria-label="Seções" className="hidden items-center gap-1 lg:flex">
          {ATALHOS.map((atalho) => {
            const eAtivo = atalho.id === ativo;
            return (
              <a
                key={atalho.id}
                href={`#${atalho.id}`}
                aria-current={eAtivo ? "true" : undefined}
                className={`relative flex h-11 items-center px-3 text-sm font-medium whitespace-nowrap transition-colors ${
                  eAtivo ? "text-white" : "text-graf-300 hover:text-white"
                }`}
              >
                {atalho.nome}
                {eAtivo && (
                  <motion.span
                    layoutId="traco-do-menu"
                    aria-hidden="true"
                    className="absolute inset-x-3 bottom-1.5 h-px bg-ambar-500"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
              </a>
            );
          })}
        </nav>

        {/* O botão padrão do BARBOS, em âmbar, que desliza até os planos:
            a conta só nasce depois do pagamento. */}
        <div className="ml-auto flex items-center">
          <Magnetico>
            <Botao href={PLANOS} className="whitespace-nowrap">
              Abra sua conta!
            </Botao>
          </Magnetico>
        </div>
      </div>
    </motion.header>
  );
}
