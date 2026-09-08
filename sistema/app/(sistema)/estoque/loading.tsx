import { Esqueleto, TelaCarregando } from "@/components/ui/esqueleto";

export default function Carregando() {
  return (
    <TelaCarregando
      titulo="Estoque"
      descricao="Mercearia e produtos de salão, lado a lado com o que tem na prateleira"
    >
      <Esqueleto className="h-12" />
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Seis linhas: o bastante pra preencher a dobra sem fingir uma
            lista longa que talvez nem exista. */}
        {Array.from({ length: 6 }, (_, i) => (
          <Esqueleto key={i} className="h-20" />
        ))}
      </div>
    </TelaCarregando>
  );
}
