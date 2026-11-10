import { Esqueleto, TelaCarregando } from "@/components/ui/esqueleto";

export default function Carregando() {
  return (
    <TelaCarregando
      titulo="Notificações"
      descricao="O que você publica aqui aparece para todas as barbearias, no sino do topo."
      className="mx-auto max-w-3xl gap-6"
    >
      <Esqueleto className="h-44" />
      <Esqueleto className="h-44" />
    </TelaCarregando>
  );
}
