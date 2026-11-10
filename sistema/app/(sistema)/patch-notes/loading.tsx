import { FormaDosPatchNotes } from "@/components/comunicados/forma-dos-patch-notes";
import { TelaCarregando } from "@/components/ui/esqueleto";

export default function Carregando() {
  return (
    <TelaCarregando
      titulo="Patch notes"
      descricao="O que mudou em cada versão do BARBOS."
      className="gap-6"
    >
      <FormaDosPatchNotes />
    </TelaCarregando>
  );
}
