import { Esqueleto, TelaCarregando } from "@/components/ui/esqueleto";

export default function Carregando() {
  return (
    <TelaCarregando
      titulo="Estoque"
      descricao="Mercearia e produtos de salão, lado a lado com o que tem na prateleira"
    >
      <Esqueleto className="h-12" />

      {/* As duas tabelas: empilhadas até `lg`, lado a lado dali pra cima.
          Mesmo ponto de corte da tela real — esqueleto com outra forma faz o
          conteúdo saltar de lugar quando chega. */}
      <div className="flex w-full flex-col gap-4 lg:flex-row">
        <Esqueleto className="h-64 min-w-0 flex-1" />
        <Esqueleto className="h-64 min-w-0 flex-1" />
      </div>
    </TelaCarregando>
  );
}
