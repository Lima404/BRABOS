import { Esqueleto, TelaCarregando } from "@/components/ui/esqueleto";

export default function Carregando() {
  return (
    <TelaCarregando
      titulo="Patch notes"
      descricao="O que mudou em cada versão do BARBOS."
      className="mx-auto max-w-3xl gap-6"
    >
      <Esqueleto className="h-32" />
      <Esqueleto className="h-96" />
    </TelaCarregando>
  );
}
