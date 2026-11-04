import { Botao } from "@/components/ui/botao";
import { Contador } from "@/components/ui/contador";
import { Cena } from "@/components/ui/cena";
import { degrau } from "@/lib/coreografia";
import { CADASTRO, ENTRAR } from "@/lib/site";

const PASSOS = [
  {
    numero: "01",
    titulo: "Cria a conta",
    texto:
      "Nome da barbearia, e-mail e senha. Leva menos de um minuto e não pede cartão.",
  },
  {
    numero: "02",
    titulo: "Põe os serviços e a equipe",
    texto:
      "Corte, barba, sobrancelha — com preço, duração e cor. Depois os barbeiros, cada um com o próprio horário.",
  },
  {
    numero: "03",
    titulo: "Manda o link pro cliente",
    texto:
      "A barbearia ganha uma página de agendamento. Quem marca por lá já cai direto na sua agenda.",
  },
];

export function Comecar() {
  return (
    <section className="relative border-t border-graf-800 py-24 sm:py-28">
      <Cena>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          {/* A prova: um mês de verdade, contado do zero. */}
          <div className="grid gap-8 border-b border-graf-800 pb-16 sm:grid-cols-3">
            <Numero
              rotulo="atendimentos em outubro"
              valor={234}
              degrauDoNumero={0.05}
            />
            <Numero
              rotulo="somados sem calculadora"
              valor={9966}
              formato="reais"
              degrauDoNumero={0.1}
            />
            <Numero
              rotulo="dias de atendimento no mês"
              valor={27}
              degrauDoNumero={0.15}
            />
          </div>

          <div className="mt-16 max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.2em] text-ambar-500 uppercase">
              Como começa
            </p>
            <h2 className="mt-5 text-3xl leading-tight font-bold text-balance sm:text-4xl">
              Três passos, e o caderno vira enfeite.
            </h2>
          </div>

          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            {PASSOS.map((passo, i) => (
              <li
                key={passo.numero}
                className="entra relative rounded-xl border border-graf-800 bg-graf-900/60 p-7"
                style={degrau(0.3 + i * 0.06, 0.12)}
              >
                <span className="numeros block text-sm font-bold text-ambar-500">
                  {passo.numero}
                </span>
                <h3 className="mt-4 text-lg font-bold text-white">
                  {passo.titulo}
                </h3>
                <p className="mt-2 text-sm leading-6 text-graf-400">
                  {passo.texto}
                </p>
              </li>
            ))}
          </ol>

          <div
            className="entra mt-16 overflow-hidden rounded-2xl border border-graf-800 bg-graf-900"
            style={degrau(0.5, 0.14)}
          >
            <div className="faixa-barbearia" aria-hidden="true" />
            <div className="flex flex-col items-start gap-8 p-9 sm:p-12 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-lg">
                <h3 className="text-2xl leading-tight font-bold text-balance sm:text-3xl">
                  Abre a sua agenda de amanhã já organizada.
                </h3>
                <p className="mt-4 text-base leading-7 text-graf-300">
                  Dá pra cadastrar a barbearia agora e marcar o primeiro
                  horário ainda hoje.
                </p>
              </div>

              <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
                <Botao href={CADASTRO}>Criar minha conta</Botao>
                <Botao href={ENTRAR} tom="contorno">
                  Já tenho conta
                </Botao>
              </div>
            </div>
          </div>
        </div>
      </Cena>
    </section>
  );
}

function Numero({
  rotulo,
  valor,
  formato,
  degrauDoNumero,
}: {
  rotulo: string;
  valor: number;
  formato?: "numero" | "reais";
  degrauDoNumero: number;
}) {
  return (
    <div className="entra" style={degrau(degrauDoNumero, 0.12)}>
      <p className="numeros text-4xl font-bold text-white sm:text-5xl">
        <Contador ate={valor} formato={formato} />
      </p>
      <p className="mt-2 text-sm text-graf-400">{rotulo}</p>
    </div>
  );
}
