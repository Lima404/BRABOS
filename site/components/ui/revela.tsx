"use client";

import { useEffect, useRef, type CSSProperties, type ElementType } from "react";

/**
 * Um título que entra palavra por palavra, saindo do desfoque.
 *
 * É a transição da referência — o texto que chega borrado, como se viesse
 * em movimento, e assenta nítido. Aqui ela dispara uma vez, quando o título
 * entra na tela, e não volta: título que some e reaparece a cada rolada
 * cansa.
 *
 * O texto nasce VISÍVEL no HTML. Quem esconde as palavras é o CSS, e só
 * quando a classe `js` está no <html> (posta por um script de uma linha no
 * layout). Se o JavaScript não rodar, o título está lá, inteiro.
 */
export function Revela({
  texto,
  destaque,
  como: Tag = "h2",
  className = "",
  atraso = 0,
}: {
  texto: string;
  /** Um trecho do texto que sai em âmbar. Tem que existir dentro de `texto`. */
  destaque?: string;
  como?: ElementType;
  className?: string;
  /** Segundos de espera antes da primeira palavra. */
  atraso?: number;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const no = ref.current;
    if (!no) return;
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada.isIntersecting) return;
        no.dataset.visto = "";
        observador.disconnect();
      },
      { threshold: 0.35 },
    );
    observador.observe(no);
    return () => observador.disconnect();
  }, []);

  const palavras = partir(texto, destaque);

  return (
    <Tag
      ref={ref}
      className={`revela ${className}`}
      style={{ "--atraso": `${atraso}s` } as CSSProperties}
    >
      {palavras.map((palavra, i) => (
        <span key={i}>
          <span
            className={`palavra ${palavra.destaque ? "text-ambar-500" : ""}`}
            style={{ "--i": i } as CSSProperties}
          >
            {palavra.texto}
          </span>
          {i < palavras.length - 1 ? " " : ""}
        </span>
      ))}
    </Tag>
  );
}

function partir(texto: string, destaque?: string) {
  const inicio = destaque ? texto.indexOf(destaque) : -1;
  const fim = inicio >= 0 ? inicio + destaque!.length : -1;

  const palavras: { texto: string; destaque: boolean }[] = [];
  let posicao = 0;
  for (const pedaco of texto.split(" ")) {
    palavras.push({
      texto: pedaco,
      destaque: inicio >= 0 && posicao >= inicio && posicao < fim,
    });
    posicao += pedaco.length + 1;
  }
  return palavras;
}
