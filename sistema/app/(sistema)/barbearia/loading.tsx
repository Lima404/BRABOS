import { Esqueleto, TelaCarregando } from "@/components/ui/esqueleto";

export default function Carregando() {
  return (
    <TelaCarregando
      titulo="Barbearia"
      descricao="Dados da conta e equipe de barbeiros"
      // Mesma coluna estreita da tela real: sem isto o conteúdo "encolhe"
      // ao chegar, e o olho lê isso como a página tendo se quebrado.
      className="mx-auto max-w-3xl gap-6"
    >
      <Esqueleto className="h-64" />
      <Esqueleto className="h-48" />
    </TelaCarregando>
  );
}
