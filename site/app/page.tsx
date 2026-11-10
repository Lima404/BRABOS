import { Caderno } from "@/components/secoes/caderno";
import { Celular } from "@/components/secoes/celular";
import { Ferramentas } from "@/components/secoes/ferramentas";
import { Final } from "@/components/secoes/final";
import { Heroi } from "@/components/secoes/heroi";
import { Impacto } from "@/components/secoes/impacto";
import { Passos } from "@/components/secoes/passos";
import { Planos } from "@/components/secoes/planos";
import { Telas } from "@/components/secoes/telas";
import { Cabecalho } from "@/components/ui/cabecalho";
import { Rodape } from "@/components/ui/rodape";
import { Trilho } from "@/components/ui/trilho";

/**
 * O site do BARBOS, contado em nove capítulos.
 *
 * A ordem é um argumento, não uma lista: a barbearia à noite e o problema
 * (o caderno não avisa); as quatro ferramentas que viram uma tela só; as
 * telas de verdade se montando; a tesoura cortando o caderno; o celular,
 * que é onde ele é usado de fato; os passos; o impacto, no mapa do Rio
 * Grande do Norte; o plano e o pagamento; e a cadeira de volta, com o
 * convite.
 *
 * Cada capítulo mistura três tipos de movimento — o que a rolagem comanda,
 * o que acontece sozinho e o que segue o mouse — e a lista de qual é qual
 * está no comentário de cada seção. A ordem e os nomes dos capítulos moram
 * em `lib/capitulos.ts`.
 */
export default function Site() {
  return (
    <>
      <Cabecalho />
      <Trilho />
      <main id="conteudo" className="flex-1">
        <Heroi />
        <Ferramentas />
        <Telas />
        <Caderno />
        <Celular />
        <Passos />
        <Impacto />
        <Planos />
        <Final />
      </main>
      <Rodape />
    </>
  );
}
