import { Esqueleto, TelaCarregando } from "@/components/ui/esqueleto";

export default function Carregando() {
  return (
    <TelaCarregando
      titulo="Barbearias"
      descricao="Todas as contas do BARBOS e o pagamento de cada uma."
      className="gap-6"
    >
      <Esqueleto className="h-36" />
      <Esqueleto className="h-80" />
    </TelaCarregando>
  );
}
