import { Esqueleto, TelaCarregando } from "@/components/ui/esqueleto";

/**
 * Esqueleto da agenda.
 *
 * Copia a estrutura de `agenda.tsx`: barra, legenda e a grade de duas
 * colunas com o painel do dia à direita no desktop. No celular o painel vem
 * primeiro — mesma ordem de DOM da tela real, senão o conteúdo entra e
 * empurra tudo pra baixo.
 */
export default function Carregando() {
  return (
    <TelaCarregando titulo="Agenda" descricao="Os horários da barbearia, mês a mês">
      <Esqueleto className="h-12" />
      <Esqueleto className="h-12" />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
        <div className="lg:order-2">
          <Esqueleto className="h-72" />
        </div>
        <div className="min-w-0 lg:order-1">
          <Esqueleto className="h-[32rem]" />
        </div>
      </div>
    </TelaCarregando>
  );
}
