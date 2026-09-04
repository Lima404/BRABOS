import {
  CalendarDays,
  LayoutDashboard,
  Package,
  ShoppingBag,
  Store,
  type LucideIcon,
} from "lucide-react";

export type Rota = {
  href: string;
  rotulo: string;
  icone: LucideIcon;
  /** Frase curta lida por leitor de tela e usada nas telas em construção. */
  descricao: string;
  /** Abre sem sessão. Hoje só a loja — ver `rotasVisiveis()` abaixo. */
  aberta?: boolean;
};

/**
 * Fonte unica das rotas. A sidebar do desktop e o menu do celular leem daqui —
 * assim nunca divergem, que e o jeito classico de um item sumir so no mobile.
 *
 * A ordem e a do uso real: a agenda e a unica tela aberta todo dia, entao vem
 * primeiro. Configuracao da barbearia e a menos visitada, entao vem por ultimo.
 */
export const ROTAS: Rota[] = [
  {
    href: "/agenda",
    rotulo: "Agenda",
    icone: CalendarDays,
    descricao: "Os horários de hoje, em ordem",
  },
  {
    href: "/estoque",
    rotulo: "Estoque",
    icone: Package,
    descricao: "Produtos, quantidades e o que está acabando",
  },
  {
    href: "/dashboard",
    rotulo: "Dashboard",
    icone: LayoutDashboard,
    descricao: "Faturamento, atendimentos e faltas",
  },
  {
    href: "/barbearia",
    rotulo: "Barbearia",
    icone: Store,
    descricao: "Dados da barbearia, serviços e equipe",
  },
  {
    href: "/loja",
    rotulo: "Loja",
    icone: ShoppingBag,
    descricao: "A vitrine que o cliente abre pelo QR code",
    aberta: true,
  },
];

/**
 * O que aparece na navegação.
 *
 * Sem sessão, nada de sistema: quem chega pelo QR code da parede é cliente da
 * barbearia, não dona dela, e uma lista de links que só levam à tela de login
 * é convite a beco sem saída.
 *
 * Isto é conveniência de tela, **não** é a barreira — quem barra rota privada
 * é o `proxy.ts`, e quem barra dado é o RLS.
 */
export function rotasVisiveis(logado: boolean): Rota[] {
  return logado ? ROTAS : ROTAS.filter((r) => r.aberta);
}

/** A rota que casa com o caminho atual — usada para marcar o item ativo. */
export function rotaAtiva(caminho: string): Rota | undefined {
  return ROTAS.find(
    (r) => caminho === r.href || caminho.startsWith(`${r.href}/`),
  );
}
