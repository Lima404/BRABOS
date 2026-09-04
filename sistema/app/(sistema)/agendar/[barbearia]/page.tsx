import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarX } from "lucide-react";

import { AgendarPublico } from "@/components/agendamento-online/agendar-publico";
import { Alerta } from "@/components/ui/alerta";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { obterSessao } from "@/lib/conta";
import { obterAgendaPublica } from "@/lib/agendamento-online/repositorio";
import { hojeNaBarbearia } from "@/lib/formato";

type Props = PageProps<"/agendar/[barbearia]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { barbearia } = await params;
  const leitura = await obterAgendaPublica(barbearia, hojeNaBarbearia());

  // O título é o que aparece na aba e no link colado no WhatsApp —
  // "Agendar | BARBOS" não diz de quem é.
  return leitura.ok
    ? {
        title: `Agendar na ${leitura.agenda.barbearia.nome}`,
        description: `Escolha o horário na ${leitura.agenda.barbearia.nome}.`,
      }
    : { title: "Agendamento indisponível" };
}

/**
 * A tela pública de agendamento. **Abre sem sessão** — é o destino do link
 * que a barbearia manda no WhatsApp.
 *
 * Quem diz de qual barbearia é a agenda é o apelido na URL, não o cookie: o
 * cliente que recebeu o link não tem conta nenhuma.
 *
 * Três saídas, e não duas: apelido errado é 404 de verdade; banco sem
 * resposta é uma tela que EXPLICA. Antes as duas caíam no mesmo 404 mudo, e
 * uma migração pendente virava "This page could not be found" — o erro morria
 * no log do servidor, que é exatamente o que o AGENTS.md manda não fazer.
 */
export default async function AgendarPage({ params }: Props) {
  const { barbearia: slug } = await params;

  const [leitura, sessao] = await Promise.all([
    obterAgendaPublica(slug, hojeNaBarbearia()),
    obterSessao(),
  ]);

  if (!leitura.ok && leitura.motivo === "nao-encontrada") notFound();

  if (!leitura.ok) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 py-6">
        <EstadoVazio
          icone={CalendarX}
          titulo="Agendamento fora do ar"
          descricao="Não consegui carregar os horários desta barbearia agora. Tente de novo em alguns minutos, ou fale com ela direto."
        />

        {/* O detalhe técnico só para quem tem conta — é dono de barbearia, e
            é quem pode resolver. O cliente não tem o que fazer com isso. */}
        {sessao.logado ? (
          <Alerta tom="aviso" titulo="Detalhe para você, dono">
            {leitura.detalhe}
          </Alerta>
        ) : null}
      </div>
    );
  }

  const agenda = leitura.agenda;
  const ehDona = sessao.barbearia?.id === agenda.barbearia.id;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Agendamento online
        </p>
        <h1 className="text-2xl font-bold tracking-tight">
          {agenda.barbearia.nome}
        </h1>
        <p className="text-muted-foreground">
          Escolha o serviço, o barbeiro e o horário. Não precisa criar conta.
        </p>
      </header>

      {ehDona ? (
        <Alerta tom="info" titulo="Você está vendo a sua própria tela">
          É assim que o cliente enxerga o link. A faixa da direita mostra os
          horários ocupados <strong>sem nome nenhum</strong> — quem recebe o
          link vê que as 10h estão presas, mas não de quem.
        </Alerta>
      ) : null}

      <AgendarPublico inicial={agenda} slug={slug} />
    </div>
  );
}
