import { Esqueleto, TelaCarregando } from "@/components/ui/esqueleto";

export default function Carregando() {
  return (
    <TelaCarregando
      titulo="Notificações"
      descricao="Atualizações e alertas do BARBOS."
      className="mx-auto max-w-3xl gap-6"
    >
      <Esqueleto className="h-40" />
      <Esqueleto className="h-40" />
    </TelaCarregando>
  );
}
