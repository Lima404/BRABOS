import type { CSSProperties, ReactNode } from "react";

import { degrau } from "@/lib/coreografia";

/**
 * A moldura de janela que envolve cada tela do sistema.
 *
 * Ela entra primeiro, abrindo de dentro para fora, e só então o conteúdo
 * começa a se montar — é a ordem que o olho espera de uma tela ligando.
 */
export function Janela({
  endereco,
  inicio,
  children,
}: {
  endereco: string;
  inicio: number;
  children: ReactNode;
}) {
  return (
    <div className="janela entra-moldura" style={degrau(inicio, 0.07)}>
      <div className="janela-barra">
        <span className="janela-bolinha" />
        <span className="janela-bolinha" />
        <span className="janela-bolinha" />
        <span className="janela-endereco">{endereco}</span>
      </div>
      {children}
    </div>
  );
}

const ITENS = ["Agenda", "Estoque", "Dashboard", "Barbearia", "Loja"] as const;

/**
 * A barra lateral do sistema, com os itens entrando em cascata.
 *
 * Vem junto com o topo do celular: o CSS mostra um ou outro conforme a
 * largura do mockup, como o sistema de verdade faz (no telefone a lateral
 * vira um menu atrás do botão de três traços).
 */
export function Lateral({
  ativo,
  inicio,
}: {
  ativo: (typeof ITENS)[number];
  inicio: number;
}) {
  return (
    <>
      <div className="topo-celular entra" style={degrau(inicio, 0.05)}>
        <svg viewBox="0 0 20 20" className="topo-celular-menu" aria-hidden="true">
          <path
            d="M3 5.5h14M3 10h14M3 14.5h14"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        <span className="lateral-simbolo">B</span>
        <span className="lateral-nome">BARBOS</span>
      </div>
      <Barra ativo={ativo} inicio={inicio} />
    </>
  );
}

function Barra({
  ativo,
  inicio,
}: {
  ativo: (typeof ITENS)[number];
  inicio: number;
}) {
  return (
    <aside className="lateral">
      <div className="lateral-marca entra" style={degrau(inicio, 0.05)}>
        <span className="lateral-simbolo">B</span>
        <span className="lateral-nome">BARBOS</span>
      </div>

      {ITENS.map((item, i) => (
        <div
          key={item}
          className="lateral-item entra"
          data-ativo={item === ativo ? "sim" : "nao"}
          style={{ ...degrau(inicio + 0.015 + i * 0.012, 0.05), "--sobe": "8px" } as CSSProperties}
        >
          <span className="lateral-ponto" />
          {item}
        </div>
      ))}
    </aside>
  );
}
