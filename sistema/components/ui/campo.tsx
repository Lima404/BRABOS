"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * O invólucro de todo controle de formulário do BARBOS.
 *
 * Ele existe para que ninguém precise lembrar de amarrar `id`, `htmlFor`,
 * `aria-describedby` e `aria-invalid` na mão — errar isso é silencioso: a tela
 * parece certa e o leitor de tela anuncia "campo de edição" sem dizer qual.
 *
 * O controle lá dentro se acha sozinho pelo contexto:
 *
 * ```tsx
 * <Campo rotulo="Valor" ajuda="Sem centavos" erro={erro}>
 *   <Input inputMode="decimal" />
 * </Campo>
 * ```
 *
 * **Marcamos o opcional, não o obrigatório.** Em formulário de barbearia quase
 * tudo é obrigatório; encher a tela de asterisco vermelho é ruído, e asterisco
 * sozinho comunica por símbolo e cor — as duas coisas que o design-guide manda
 * evitar como sinal único.
 */

type ValorDoCampo = {
  id: string;
  descreveIds?: string;
  invalido: boolean;
};

const CampoContexto = React.createContext<ValorDoCampo | null>(null);

export function useCampo(): ValorDoCampo | null {
  return React.useContext(CampoContexto);
}

/**
 * `aria-invalid` sai de `React.AriaAttributes` em vez de um union próprio: o
 * do React inclui "grammar" e "spelling", e um tipo mais estreito aqui faz
 * todo controle recusar as próprias props.
 */
type PropsAcessiveis = {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: React.AriaAttributes["aria-invalid"];
};

/**
 * Props que um controle herda do `Campo` em volta. O que o chamador escreveu
 * explicitamente sempre vence — o contexto só preenche o que está faltando.
 */
export function propsDoCampo(
  campo: ValorDoCampo | null,
  props: PropsAcessiveis,
): PropsAcessiveis {
  if (!campo) return {};

  return {
    id: props.id ?? campo.id,
    "aria-describedby": props["aria-describedby"] ?? campo.descreveIds,
    "aria-invalid": props["aria-invalid"] ?? (campo.invalido || undefined),
  };
}

export function Campo({
  rotulo,
  ajuda,
  erro,
  opcional,
  id: idExterno,
  children,
  className,
}: {
  rotulo: string;
  /** Texto de apoio, sempre visível. Placeholder não é rótulo nem ajuda. */
  ajuda?: string;
  /** Presente = campo inválido. Ele marca `aria-invalid` no controle. */
  erro?: string;
  opcional?: boolean;
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const gerado = React.useId();
  const id = idExterno ?? gerado;
  const idAjuda = ajuda ? `${id}-ajuda` : undefined;
  const idErro = erro ? `${id}-erro` : undefined;
  const descreveIds = [idAjuda, idErro].filter(Boolean).join(" ") || undefined;

  const valor = React.useMemo(
    () => ({ id, descreveIds, invalido: Boolean(erro) }),
    [id, descreveIds, erro],
  );

  return (
    <CampoContexto.Provider value={valor}>
      <div className={cn("flex flex-col gap-2", className)}>
        <Label htmlFor={id}>
          {rotulo}
          {opcional ? (
            <span className="font-normal text-muted-foreground">
              (opcional)
            </span>
          ) : null}
        </Label>

        {children}

        {ajuda ? (
          <p id={idAjuda} className="text-sm text-muted-foreground">
            {ajuda}
          </p>
        ) : null}

        {/* Erro carrega ícone e texto, nunca só a cor vermelha. */}
        {erro ? (
          <p
            id={idErro}
            role="alert"
            className="flex items-start gap-1.5 text-sm font-medium text-destructive"
          >
            <AlertTriangle
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            {erro}
          </p>
        ) : null}
      </div>
    </CampoContexto.Provider>
  );
}

/**
 * Linha de escolha: caixa ou bolinha à esquerda, rótulo e explicação à direita.
 *
 * A linha inteira tem 44px e é clicável — o alvo não é a caixinha de 20px, que
 * ninguém acerta com o dedo sujo de talco.
 */
export function Opcao({
  controle,
  rotulo,
  ajuda,
  htmlFor,
  desabilitado,
  className,
}: {
  /** O `<Checkbox>`, `<RadioItem>` ou `<Switch>`. */
  controle: React.ReactNode;
  rotulo: string;
  ajuda?: string;
  htmlFor: string;
  desabilitado?: boolean;
  className?: string;
}) {
  return (
    <div
      data-desabilitado={desabilitado ? "" : undefined}
      className={cn(
        "flex min-h-11 items-start gap-3 rounded-lg py-2 transition-colors",
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
        desabilitado && "opacity-60",
        className,
      )}
    >
      <div className="flex min-h-6 shrink-0 items-center">{controle}</div>

      <div className="flex flex-col gap-0.5">
        <Label
          htmlFor={htmlFor}
          className={cn("leading-6", !desabilitado && "cursor-pointer")}
        >
          {rotulo}
        </Label>
        {ajuda ? (
          <span className="text-sm text-muted-foreground">{ajuda}</span>
        ) : null}
      </div>
    </div>
  );
}
