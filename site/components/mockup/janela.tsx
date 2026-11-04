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

/** A barra lateral do sistema, com os itens entrando em cascata. */
export function Lateral({
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
