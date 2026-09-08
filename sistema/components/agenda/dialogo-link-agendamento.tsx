"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { Alerta } from "@/components/ui/alerta";
import { Button } from "@/components/ui/button";
import { LinkCopiavel } from "@/components/ui/link-copiavel";
import { Modal } from "@/components/ui/modal";

/**
 * O link de agendamento online, para a dona copiar e mandar.
 *
 * Não gera nada: o endereço já existe desde que a barbearia tem apelido
 * (`slug`). "Criar link" é como a dona pensa, mas por baixo é só revelar um
 * endereço que sempre esteve lá — e por isso ele não muda, não expira, e o
 * mesmo papel colado na parede continua valendo no mês que vem.
 */
export function DialogoLinkAgendamento({
  aberto,
  aoMudarAberto,
  slug,
  semEquipe,
  semServico,
}: {
  aberto: boolean;
  aoMudarAberto: (aberto: boolean) => void;
  slug: string;
  /** Sem barbeiro cadastrado o cliente não tem com quem marcar. */
  semEquipe: boolean;
  /** Sem serviço não há o que marcar — desde a 0021 é o estado inicial. */
  semServico: boolean;
}) {
  const caminho = `/agendar/${slug}`;

  return (
    <Modal
      aberto={aberto}
      aoMudarAberto={aoMudarAberto}
      tamanho="medio"
      titulo="Link de agendamento online"
      descricao="Mande no WhatsApp, ponha na bio ou imprima como QR code."
      rodape={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => aoMudarAberto(false)}
          >
            Fechar
          </Button>
          <Button asChild size="lg">
            <Link href={caminho} target="_blank" rel="noopener noreferrer">
              <ExternalLink />
              Ver como o cliente vê
            </Link>
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <LinkCopiavel caminho={caminho} />

        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>
            Quem abrir escolhe serviço, barbeiro e horário, e o agendamento cai
            direto na sua agenda como <strong>Agendado</strong>. Não precisa
            criar conta.
          </p>
          <p>
            A faixa de horários mostra o que está ocupado{" "}
            <strong>sem nome nenhum</strong> — o cliente vê que as 10h estão
            presas, mas não de quem.
          </p>
        </div>

        {semEquipe || semServico ? (
          <Alerta tom="aviso" titulo="Ainda falta coisa pro link funcionar">
            {/* Os dois faltando é o caso mais provável: barbearia recém
                criada nasce sem serviço (0021) e sem equipe. Um alerta só,
                dizendo o que falta — dois avisos empilhados viram parede. */}
            {semEquipe && semServico
              ? "A tela pede o serviço e com quem se atender, e você ainda não cadastrou nenhum dos dois."
              : semServico
                ? "A tela pede qual serviço o cliente quer, e o seu cardápio está vazio."
                : "A tela pede com quem o cliente quer se atender, e a sua equipe está vazia."}{" "}
            Quem abrir o link agora não consegue concluir.
          </Alerta>
        ) : null}

        <Alerta tom="info" titulo="O que o link ainda não faz">
          Não pede telefone e não manda confirmação. Enquanto for assim,
          combine pelo WhatsApp o que for remarcação ou desistência.
        </Alerta>
      </div>
    </Modal>
  );
}
