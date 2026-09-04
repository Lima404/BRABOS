import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AgendarPublico } from "@/components/agendamento-online/agendar-publico";
import { Alerta } from "@/components/ui/alerta";
import { obterSessao } from "@/lib/conta";
import { obterAgendaPublica } from "@/lib/agendamento-online/repositorio";
import { hojeNaBarbearia } from "@/lib/formato";

type Props = PageProps<"/agendar/[barbearia]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { barbearia } = await params;
  const agenda = await obterAgendaPublica(barbearia, hojeNaBarbearia());

  // O título é o que aparece na aba e no link colado no WhatsApp —
  // "Agendar | BARBOS" não diz de quem é.
  return agenda
    ? {
        title: `Agendar na ${agenda.barbearia.nome}`,
        description: `Escolha o horário na ${agenda.barbearia.nome}.`,
      }
    : { title: "Barbearia não encontrada" };
}

/**
 * A tela pública de agendamento. **Abre sem sessão** — é o destino do link
 * que a barbearia manda no WhatsApp.
 *
 * Quem diz de qual barbearia é a agenda é o apelido na URL, não o cookie: o
 * cliente que recebeu o link não tem conta nenhuma.
 */
export default async function AgendarPage({ params }: Props) {
  const { barbearia: slug } = await params;

  const [agenda, sessao] = await Promise.all([
    obterAgendaPublica(slug, hojeNaBarbearia()),
    obterSessao(),
  ]);

  if (!agenda) notFound();

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
