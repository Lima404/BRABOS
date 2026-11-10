"use client";

import { useId } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";

import {
  ROTAS_ADMIN,
  rotasVisiveis,
  type Rota,
} from "@/components/navegacao/rotas";
import { cn } from "@/lib/utils";

/**
 * Os links de navegacao. Usada pela sidebar do desktop e pelo menu do celular.
 *
 * O item ativo e marcado por TRES coisas ao mesmo tempo — fundo, peso da fonte
 * e uma barra ambar a esquerda. Nunca so por cor: sol na vitrine lava cor da
 * tela, e o barbeiro precisa saber onde esta num relance.
 *
 * Cada link carrega um `Indo`, que acende no instante do toque. Toda tela do
 * sistema e dinamica: a navegacao espera o servidor falar com o Supabase, e
 * ate o esqueleto do `loading.tsx` aparecer passa um piscar. Sem esse retorno,
 * quem esta no 4G da rua toca duas vezes achando que nao pegou.
 */
export function ListaRotas({
  logado,
  admin = false,
  aoNavegar,
  className,
}: {
  logado: boolean;
  /** Conta admin (0044): ganha o grupo "Painel Admin" no fim da lista. */
  admin?: boolean;
  /** Chamado ao clicar — o menu do celular usa pra se fechar. */
  aoNavegar?: () => void;
  className?: string;
}) {
  const caminho = usePathname();
  // A sidebar e o menu do celular montam esta lista ao mesmo tempo: id fixo
  // repetiria na página.
  const idDoGrupo = useId();

  // As rotas sao resolvidas AQUI, do lado do cliente, e nao recebidas prontas
  // de um componente de servidor. Cada rota carrega `icone`, que e uma funcao
  // de componente — e funcao nao atravessa a fronteira servidor -> cliente.
  // Passar a lista pronta rende "Only plain objects can be passed" e derruba
  // a pagina inteira com 500. So o booleano cruza.
  const rotas = rotasVisiveis(logado);

  return (
    <nav
      aria-label="Navegação principal"
      className={cn("flex flex-col gap-1", className)}
    >
      {rotas.map((rota) => (
        <ItemDaRota
          key={rota.href}
          rota={rota}
          caminho={caminho}
          aoNavegar={aoNavegar}
        />
      ))}

      {/* O grupo do admin. O título NÃO é link: as três telas são irmãs e
          nenhuma é "a" tela do painel — um título clicável seria um quarto
          link levando para uma delas. */}
      {logado && admin ? (
        <div
          role="group"
          aria-labelledby={idDoGrupo}
          className="mt-4 flex flex-col gap-1 border-t border-border pt-4"
        >
          <p
            id={idDoGrupo}
            className="flex items-center gap-2 px-3 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
          >
            <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
            Painel Admin
          </p>
          {ROTAS_ADMIN.map((rota) => (
            <ItemDaRota
              key={rota.href}
              rota={rota}
              caminho={caminho}
              aoNavegar={aoNavegar}
            />
          ))}
        </div>
      ) : null}
    </nav>
  );
}

function ItemDaRota({
  rota: { href, rotulo, icone: Icone },
  caminho,
  aoNavegar,
}: {
  rota: Rota;
  caminho: string;
  aoNavegar?: () => void;
}) {
  const ativo = caminho === href || caminho.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      onClick={aoNavegar}
      aria-current={ativo ? "page" : undefined}
      className={cn(
        // min-h-11 = 44px, o alvo de toque minimo do design-guide.
        "flex min-h-11 items-center gap-3 rounded-lg border-l-[3px] border-transparent px-3 text-base transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        ativo
          ? "border-l-ambar-500 bg-secondary font-semibold text-foreground"
          : "font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
      )}
    >
      <Icone className="size-5 shrink-0" aria-hidden="true" />
      {rotulo}
      <Indo />
    </Link>
  );
}

/**
 * O rodinha que aparece no link tocado enquanto a rota carrega.
 *
 * Precisa ser um componente separado: `useLinkStatus` so responde DENTRO do
 * `<Link>`, e le o estado daquele link especifico — por isso um por item, e
 * nao um estado no topo da lista.
 *
 * `aria-hidden`: quem usa leitor de tela ja e avisado pelo `role="status"` do
 * `loading.tsx` que a tela esta carregando. Dois anuncios pra mesma espera
 * atrapalham em vez de ajudar.
 */
function Indo() {
  const { pending } = useLinkStatus();

  if (!pending) return null;

  return (
    <Loader2
      aria-hidden="true"
      className="ml-auto size-4 shrink-0 animate-spin text-muted-foreground"
    />
  );
}
