import { Esqueleto } from "@/components/ui/esqueleto";

/**
 * Esqueleto do dashboard.
 *
 * Não usa `TelaCarregando`: aqui o cabeçalho é uma linha com o título de um
 * lado e os filtros do outro, e não o par título/subtítulo das outras telas.
 *
 * Sem `max-w` e sem `mx-auto`, como a tela real — é a única em que comparar
 * blocos vale mais que a coluna estreita de leitura.
 */
export default function Carregando() {
  return (
    <div
      role="status"
      aria-label="Carregando dashboard"
      className="flex flex-col gap-6"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          {/* Barra, e não uma frase inventada: o subtítulo real diz o
              período escolhido ("Setembro de 2026 — só o que já foi
              atendido e pago"), e só o servidor sabe qual é. Escrever um
              texto qualquer aqui faria a linha TROCAR de conteúdo na
              chegada, que é pior que ela aparecer. */}
          <Esqueleto className="h-5 w-72 max-w-full" />
        </div>
        <Esqueleto className="h-11 w-44 shrink-0" />
      </header>

      {/* Os três cartões do balanço */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Esqueleto className="h-28" />
        <Esqueleto className="h-28" />
        <Esqueleto className="h-28" />
      </div>

      {/* As duas roscas */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Esqueleto className="h-80" />
        <Esqueleto className="h-80" />
      </div>

      {/* Mês a mês */}
      <Esqueleto className="h-72" />
    </div>
  );
}
