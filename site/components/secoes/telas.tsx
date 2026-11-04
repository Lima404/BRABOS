import { MockupAgenda } from "@/components/mockup/agenda";
import { MockupDashboard } from "@/components/mockup/dashboard";
import { Cena } from "@/components/ui/cena";
import { JanelaViva } from "@/components/ui/janela-viva";
import { Revela } from "@/components/ui/revela";
import { Rotulo } from "@/components/ui/rotulo";

/**
 * Capítulo 03 — as duas telas do sistema se construindo.
 *
 * Cada tela fica presa no alto enquanto a página rola, e a rolagem é o que
 * monta a tela peça por peça. Rolar para cima desmonta na ordem inversa —
 * a coreografia inteira é uma função do scroll, não uma animação que
 * dispara e acaba.
 *
 * Por cima da montagem, o mouse: um holofote que anda pela interface e uma
 * inclinação leve na direção do cursor.
 */
export function Telas() {
  return (
    <section id="telas" className="relative pt-28 sm:pt-36">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <Rotulo capitulo="telas">As telas</Rotulo>
          <Revela
            texto="Role, e veja a barbearia inteira se montar."
            destaque="se montar."
            className="mt-5 text-[clamp(1.75rem,3.6vw,3rem)] leading-[1.05] font-bold tracking-[-0.025em] text-balance"
          />
          <p className="mt-5 max-w-lg text-base leading-7 text-graf-300">
            São as telas de verdade, com os números de um outubro de verdade:
            234 atendimentos e R$ 9.966,00 numa barbearia de três cadeiras.
          </p>
        </div>
      </div>

      <TelaPresa
        numero="01"
        etiqueta="Agenda"
        legenda="O mês inteiro numa tela. O dia que você clicar abre ao lado, e a chave conclui o atendimento sem sair da agenda."
      >
        <MockupAgenda />
      </TelaPresa>

      <TelaPresa
        numero="02"
        etiqueta="Dashboard"
        legenda="Quanto entrou, em quê, e com quem. Soma serviço e loja no mesmo lugar — e mostra o mês fraco junto com o forte."
      >
        <MockupDashboard />
      </TelaPresa>
    </section>
  );
}

function TelaPresa({
  numero,
  etiqueta,
  legenda,
  children,
}: {
  numero: string;
  etiqueta: string;
  legenda: string;
  children: React.ReactNode;
}) {
  return (
    <Cena
      className="palco-alto relative mt-12 h-[190vh] lg:h-[280vh]"
      modo="presa"
    >
      <div className="palco sticky top-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <h3 className="flex items-baseline gap-3 text-xl font-bold text-white">
              <span className="numeros text-sm font-semibold text-ambar-500">
                {numero}
              </span>
              {etiqueta}
            </h3>
            <p className="max-w-md text-sm leading-6 text-graf-300">{legenda}</p>
          </div>

          <JanelaViva>
            <div className="mockup-area">
              <div className="mockup mockup-interno">{children}</div>
            </div>
          </JanelaViva>

          {/* Numa tela de celular a tela do sistema não cabe inteira, e
              ela rola de lado dentro da própria moldura. Sem este aviso
              ninguém descobre que dá para arrastar. */}
          <p className="mt-3 text-xs text-graf-400 sm:hidden">
            Arraste a tela para o lado para ver o mês inteiro.
          </p>
        </div>
      </div>
    </Cena>
  );
}
