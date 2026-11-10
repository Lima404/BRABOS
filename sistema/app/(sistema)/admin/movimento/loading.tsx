import { Esqueleto } from "@/components/ui/esqueleto";

/** Mesma forma da tela: cabeçalho, três cartões, dois números e a tabela. */
export default function Carregando() {
  return (
    <div role="status" aria-label="Carregando o movimento" className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Movimento</h1>
          {/* Barra e não frase: o subtítulo real diz o período escolhido. */}
          <Esqueleto className="h-5 w-72 max-w-full" />
        </div>
        <Esqueleto className="h-11 w-44 shrink-0" />
      </header>
      <div className="grid gap-4 lg:grid-cols-3">
        <Esqueleto className="h-28" />
        <Esqueleto className="h-28" />
        <Esqueleto className="h-28" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Esqueleto className="h-28" />
        <Esqueleto className="h-28" />
      </div>
      <Esqueleto className="h-80" />
    </div>
  );
}
