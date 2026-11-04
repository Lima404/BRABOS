"use client";

import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
} from "motion/react";

/**
 * A faixa barbearia do topo, que agora mede a leitura.
 *
 * O manual autoriza a faixa diagonal âmbar/grafite em um único papel: no
 * topo da tela e como divisor. Ela continua lá, com os mesmos 5px — só que
 * se enche da esquerda para a direita conforme a página rola. É o único
 * aceno ao ofício, e passa a trabalhar.
 *
 * Com movimento reduzido ela continua medindo, só que sem a mola: a faixa
 * anda junto com a rolagem, sem atraso nem rebote.
 */
export function FaixaProgresso() {
  const reduzido = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const comMola = useSpring(scrollYProgress, {
    stiffness: 180,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <div
      aria-hidden="true"
      className="fixed inset-x-0 top-0 z-[60] h-[5px] bg-graf-900"
    >
      <motion.div
        className="faixa-barbearia h-full origin-left"
        style={{ scaleX: reduzido ? scrollYProgress : comMola }}
      />
    </div>
  );
}
