import { Caderno } from "@/components/secoes/caderno";
import { Celular } from "@/components/secoes/celular";
import { Comecar } from "@/components/secoes/comecar";
import { Ferramentas } from "@/components/secoes/ferramentas";
import { Heroi } from "@/components/secoes/heroi";
import { Telas } from "@/components/secoes/telas";
import { Cabecalho } from "@/components/ui/cabecalho";
import { Rodape } from "@/components/ui/rodape";

/**
 * O site do BARBOS.
 *
 * A ordem das seções é um argumento, não uma lista: primeiro o problema
 * (o caderno não avisa), depois o que o sistema faz, depois as telas de
 * verdade se montando, depois a comparação direta com o papel, depois o
 * celular — que é onde ele é usado de fato — e só no fim o pedido.
 */
export default function Site() {
  return (
    <>
      <Cabecalho />
      <main className="flex-1">
        <Heroi />
        <Ferramentas />
        <Telas />
        <Caderno />
        <Celular />
        <Comecar />
      </main>
      <Rodape />
    </>
  );
}
