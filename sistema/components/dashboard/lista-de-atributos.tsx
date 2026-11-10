"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * O que uma ficha precisa saber. O dashboard passa `AtributoDoFiltro`, o
 * Painel Admin passa os dele — a lista só lê estes três campos.
 */
export type FichaDoFiltro = { chave: string; rotulo: string; grupo: string };

/**
 * A lista de atributos do filtro — as fichas do rodapé do diálogo.
 *
 * Mostra o que está escolhido NO RASCUNHO, antes de aplicar. Era o buraco
 * do diálogo antigo: as escolhas ficavam espalhadas por quatro seções, uma
 * de cada vez na tela, e não havia lugar nenhum que mostrasse as quatro
 * juntas. Quem marcava barbeiro, trocava para serviços e voltava não tinha
 * como conferir sem passear pelas abas de novo.
 *
 * Clicar numa ficha tira aquele atributo. É a mesma ação do checkbox lá
 * dentro, só que alcançável sem procurar a seção.
 */
export function ListaDeAtributos<A extends FichaDoFiltro>({
  atributos,
  aoRemover,
  visiveis = 3,
  className,
}: {
  atributos: A[];
  aoRemover: (atributo: A) => void;
  /** Quantas fichas aparecem antes do "+N". */
  visiveis?: number;
  className?: string;
}) {
  if (atributos.length === 0) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        Nenhum filtro escolhido.
      </p>
    );
  }

  const naFrente = atributos.slice(0, visiveis);
  const escondidos = atributos.slice(visiveis);

  return (
    // Sem `ul`/`li` de propósito. A marcação de lista exigiria
    // `display: contents` nos itens para o flex continuar funcionando, e
    // isso apaga a semântica da lista em parte dos navegadores — ficaria o
    // custo sem o benefício. Cada ficha já se anuncia inteira pelo
    // `aria-label`, e o grupo diz o que é.
    <div
      role="group"
      aria-label="Filtros escolhidos"
      className={cn("flex min-w-0 flex-wrap items-center gap-1.5", className)}
    >
      {naFrente.map((a) => (
        <Ficha key={a.chave} atributo={a} aoRemover={aoRemover} />
      ))}

      {escondidos.length > 0 ? (
        <Excedentes atributos={escondidos} aoRemover={aoRemover} />
      ) : null}
    </div>
  );
}

function Ficha<A extends FichaDoFiltro>({
  atributo,
  aoRemover,
}: {
  atributo: A;
  aoRemover: (atributo: A) => void;
}) {
  const inteiro = `${atributo.grupo}: ${atributo.rotulo}`;

  return (
    <button
      type="button"
      onClick={() => aoRemover(atributo)}
      // Nome comprido é cortado na tela; o `title` devolve o nome inteiro
      // no hover, e o `aria-label` no leitor de tela.
      title={inteiro}
      aria-label={`Tirar do filtro — ${inteiro}`}
      className={cn(
        "group inline-flex max-w-44 shrink-0 items-center gap-1 rounded-full border border-border",
        "bg-secondary py-1 pr-1.5 pl-2.5 text-xs font-medium text-secondary-foreground",
        "transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
      )}
    >
      <span className="truncate">{atributo.rotulo}</span>
      <X
        className="size-3 shrink-0 opacity-60 transition-opacity group-hover:opacity-100"
        aria-hidden
      />
    </button>
  );
}

/**
 * O "+N" e o painel com o resto.
 *
 * Abre no hover E no clique de propósito: no computador o hover é o jeito
 * natural de espiar, e no celular ele não existe — lá só o toque abre. O
 * clique também FIXA, senão tirar uma ficha de dentro do painel fecharia
 * tudo no primeiro movimento do mouse para fora.
 */
function Excedentes<A extends FichaDoFiltro>({
  atributos,
  aoRemover,
}: {
  atributos: A[];
  aoRemover: (atributo: A) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [fixado, setFixado] = useState(false);
  const caixaRef = useRef<HTMLDivElement | null>(null);
  const idPainel = useId();

  // Nada de efeito para "fechar quando a lista esvaziar": quem decide é o
  // pai, que só monta este componente enquanto sobra ficha escondida.
  // Tirar a última desmonta tudo, e o estado morre junto.

  // Fechar com Esc e com clique fora — as duas saídas que todo mundo tenta
  // antes de procurar um "x". Só valem com o painel fixado: o que abriu por
  // hover já fecha sozinho ao tirar o mouse.
  useEffect(() => {
    if (!fixado) return;

    function aoTeclar(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // Sem isto o Esc atravessa e fecha o modal inteiro junto.
      e.stopPropagation();
      setAberto(false);
      setFixado(false);
    }

    function aoApontar(e: PointerEvent) {
      if (caixaRef.current?.contains(e.target as Node)) return;
      setAberto(false);
      setFixado(false);
    }

    document.addEventListener("keydown", aoTeclar, true);
    document.addEventListener("pointerdown", aoApontar);
    return () => {
      document.removeEventListener("keydown", aoTeclar, true);
      document.removeEventListener("pointerdown", aoApontar);
    };
  }, [fixado]);

  return (
    <div
      ref={caixaRef}
      className="relative shrink-0"
      onMouseEnter={() => setAberto(true)}
      onMouseLeave={() => {
        if (!fixado) setAberto(false);
      }}
    >
      <button
        type="button"
        aria-expanded={aberto}
        aria-controls={idPainel}
        aria-label={`Mostrar os outros ${atributos.length} filtros`}
        onClick={() => {
          const vai = !fixado;
          setFixado(vai);
          setAberto(vai);
        }}
        // Teclado não tem hover: o foco abre, e sair do grupo fecha.
        onFocus={() => setAberto(true)}
        onBlur={(e) => {
          if (fixado) return;
          if (e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) {
            return;
          }
          setAberto(false);
        }}
        className={cn(
          "inline-flex shrink-0 items-center rounded-full border border-dashed border-border",
          "px-2.5 py-1 text-xs font-medium text-muted-foreground",
          "transition-colors hover:border-ring hover:text-foreground",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          aberto && "border-ring text-foreground",
        )}
      >
        +{atributos.length}
      </button>

      {aberto ? (
        <div
          id={idPainel}
          // Para CIMA: o rodapé do modal é a última linha da tela, e um
          // painel descendo nasceria fora dela.
          className={cn(
            "absolute bottom-full left-0 z-50 mb-2 w-56 rounded-lg border border-border",
            "bg-popover p-2 text-popover-foreground shadow-lg",
          )}
        >
          <p className="px-1 pb-1.5 text-xs text-muted-foreground">
            Mais {atributos.length} — clique para tirar
          </p>
          <div className="barra-fina flex max-h-44 flex-col items-start gap-1 overflow-y-auto">
            {atributos.map((a) => (
              <Ficha key={a.chave} atributo={a} aoRemover={aoRemover} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
