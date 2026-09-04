import { Hammer } from "lucide-react";

/**
 * Estado de tela ainda nao construida.
 *
 * Diz o que vai ter e o que falta, em vez de um "em breve" vazio. Toda tela do
 * BARBOS precisa de estado vazio com saida — inclusive as que ainda nao
 * existem.
 */
export function EmConstrucao({
  titulo,
  descricao,
  itens,
}: {
  titulo: string;
  descricao: string;
  itens: string[];
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
        <p className="text-muted-foreground">{descricao}</p>
      </div>

      <div className="rounded-lg border border-dashed border-border bg-card p-6">
        <span className="grid size-11 place-items-center rounded-full bg-secondary">
          <Hammer className="size-5 text-muted-foreground" aria-hidden="true" />
        </span>

        <h2 className="mt-4 font-semibold">
          Esta tela ainda não foi construída
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Quando entrar, vai ter:
        </p>

        <ul className="mt-3 space-y-2">
          {itens.map((item) => (
            <li key={item} className="flex gap-2 text-sm text-muted-foreground">
              <span
                aria-hidden="true"
                className="mt-2 size-1.5 shrink-0 rounded-full bg-ambar-500"
              />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
