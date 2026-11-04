import { MockupAgenda } from "@/components/mockup/agenda";
import { MockupDashboard } from "@/components/mockup/dashboard";
import { Cena } from "@/components/ui/cena";

/**
 * As duas telas do sistema se construindo.
 *
 * Cada tela fica presa no alto enquanto a página rola, e a rolagem é o que
 * monta a tela peça por peça. Rolar para cima desmonta na ordem inversa —
 * a coreografia inteira é uma função do scroll, não uma animação que
 * dispara e acaba.
 */
export function Telas() {
  return (
    <section
      id="telas"
      className="relative border-t border-graf-800 py-24 sm:py-28"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.2em] text-ambar-500 uppercase">
            As telas
          </p>
          <h2 className="mt-5 text-3xl leading-tight font-bold text-balance sm:text-4xl">
            Role, e veja a barbearia inteira se montar.
          </h2>
          <p className="mt-5 max-w-lg text-base leading-7 text-graf-300">
            São as telas de verdade, com os números de um outubro de verdade:
            234 atendimentos e R$ 9.966,00 numa barbearia de três cadeiras.
          </p>
        </div>
      </div>

      <TelaPresa
        etiqueta="Agenda"
        legenda="O mês inteiro numa tela. O dia que você clicar abre ao lado, e a chave conclui o atendimento sem sair da agenda."
      >
        <MockupAgenda />
      </TelaPresa>

      <TelaPresa
        etiqueta="Dashboard"
        legenda="Quanto entrou, em quê, e com quem. Some serviço e loja no mesmo lugar — e mostra o mês fraco junto com o forte."
      >
        <MockupDashboard />
      </TelaPresa>
    </section>
  );
}

function TelaPresa({
  etiqueta,
  legenda,
  children,
}: {
  etiqueta: string;
  legenda: string;
  children: React.ReactNode;
}) {
  return (
    <Cena className="relative mt-16 h-[190vh] first-of-type:mt-20 lg:h-[300vh]" modo="presa">
      <div className="sticky top-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <h3 className="text-xl font-bold text-white">{etiqueta}</h3>
            <p className="max-w-md text-sm leading-6 text-graf-400">
              {legenda}
            </p>
          </div>

          <div className="mockup-area">
            <div className="mockup mockup-interno">{children}</div>
          </div>

          {/* Numa tela de celular a tela do sistema não cabe inteira, e
              ela rola de lado dentro da própria moldura. Sem este aviso
              ninguém descobre que dá para arrastar. */}
          <p className="mt-3 text-xs text-graf-500 sm:hidden">
            Arraste a tela para o lado para ver o mês inteiro.
          </p>
        </div>
      </div>
    </Cena>
  );
}
