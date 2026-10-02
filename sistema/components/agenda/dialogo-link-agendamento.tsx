"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Link2, Loader2, Power, PowerOff } from "lucide-react";

import {
  alternarConvite,
  criarConvite,
  listarConvitesDaAgenda,
} from "@/app/(sistema)/agenda/acoes";
import { Alerta } from "@/components/ui/alerta";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { LinkCopiavel } from "@/components/ui/link-copiavel";
import { Modal } from "@/components/ui/modal";
import {
  Select,
  SelectConteudo,
  SelectGatilho,
  SelectItem,
  SelectValor,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { chaves } from "@/lib/query";
import {
  LIMITES,
  VALIDADES,
  estadoDoConvite,
  textoDaValidade,
  textoDosUsos,
  type Convite,
  type EstadoConvite,
} from "@/lib/convites/tipos";
import { cn } from "@/lib/utils";

/**
 * O link de agendamento online, nos dois formatos.
 *
 * **O link do apelido** (`/agendar/bicos`) não é gerado nem expira: ele
 * existe desde que a barbearia tem apelido, e é o que vai no QR code colado
 * na parede. Ele continua aberto para sempre, aconteça o que acontecer com
 * os convites — papel impresso não se atualiza.
 *
 * **Os convites** são links com prazo e com limite, no formato do convite de
 * servidor do Discord: a dona gera um para a promoção da semana, outro com
 * cinco vagas para o sábado, e desliga o que não quer mais.
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
  const clienteQuery = useQueryClient();
  const { avisar } = useToast();

  const [horas, setHoras] = useState<number | null>(24 * 7);
  const [usosMax, setUsosMax] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  /** Destaca o link recém-gerado: é ele que a dona veio buscar. */
  const [recem, setRecem] = useState<string | null>(null);

  const agora = useRelogio();

  const { data: convites, isPending } = useQuery({
    queryKey: chaves.agenda.convites,
    queryFn: listarConvitesDaAgenda,
    // Só carrega com o modal ABERTO: esta tela mora dentro da agenda e
    // quase nunca é aberta — buscar sempre gastaria 4G de quem está
    // atendendo, por uma lista que ninguém pediu.
    enabled: aberto,
  });

  const gerar = useMutation({
    mutationFn: () => criarConvite({ horas, usosMax }),
    onSuccess: (r) => {
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setErro(null);
      setRecem(r.convite.codigo);
      clienteQuery.invalidateQueries({ queryKey: chaves.agenda.convites });
      avisar({
        tom: "sucesso",
        titulo: "Link gerado",
        descricao: "Copie e mande para quem vai marcar.",
      });
    },
    onError: (causa) => {
      console.error("[BARBOS] gerar convite:", causa);
      setErro("Não consegui falar com o servidor. Tente de novo.");
    },
  });

  const alternar = useMutation({
    mutationFn: ({ id, revogado }: { id: string; revogado: boolean }) =>
      alternarConvite(id, revogado),
    onSuccess: (r) => {
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setErro(null);
      clienteQuery.invalidateQueries({ queryKey: chaves.agenda.convites });
    },
    onError: (causa) => {
      console.error("[BARBOS] alternar convite:", causa);
      setErro("Não consegui falar com o servidor. Tente de novo.");
    },
  });

  const lista = convites ?? [];

  return (
    <Modal
      aberto={aberto}
      aoMudarAberto={aoMudarAberto}
      tamanho="grande"
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
            <Link
              href={`/agendar/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink />
              Ver como o cliente vê
            </Link>
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-7">
        {/* ---------------- link fixo ---------------- */}
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold">Link fixo da barbearia</h3>
            <p className="text-sm text-muted-foreground">
              Não expira e não tem limite. É o que vai no QR code da parede.
            </p>
          </div>

          <LinkCopiavel caminho={`/agendar/${slug}`} />

          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            <p>
              Quem abrir escolhe serviço, barbeiro e horário, e o agendamento
              cai direto na sua agenda como <strong>Agendado</strong>. Não
              precisa criar conta.
            </p>
            <p>
              A faixa de horários mostra o que está ocupado{" "}
              <strong>sem nome nenhum</strong> — o cliente vê que as 10h estão
              presas, mas não de quem.
            </p>
          </div>
        </section>

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

        {/* ---------------- convites ---------------- */}
        <section className="flex flex-col gap-4 border-t border-border pt-6">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold">Links com prazo e limite</h3>
            <p className="text-sm text-muted-foreground">
              Para uma promoção, um dia específico, um número de vagas. Cada um
              morre sozinho quando a hora ou as vagas acabam — e o link fixo
              acima continua valendo do mesmo jeito.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Campo id="convite-validade" rotulo="Expira após">
              <Select
                value={horas === null ? "nunca" : String(horas)}
                onValueChange={(v) => setHoras(v === "nunca" ? null : Number(v))}
              >
                <SelectGatilho>
                  <SelectValor />
                </SelectGatilho>
                <SelectConteudo>
                  {VALIDADES.map((v) => (
                    <SelectItem
                      key={v.rotulo}
                      value={v.horas === null ? "nunca" : String(v.horas)}
                    >
                      {v.rotulo}
                    </SelectItem>
                  ))}
                </SelectConteudo>
              </Select>
            </Campo>

            <Campo id="convite-usos" rotulo="Número máximo de usos">
              <Select
                value={usosMax === null ? "ilimitado" : String(usosMax)}
                onValueChange={(v) =>
                  setUsosMax(v === "ilimitado" ? null : Number(v))
                }
              >
                <SelectGatilho>
                  <SelectValor />
                </SelectGatilho>
                <SelectConteudo>
                  {LIMITES.map((l) => (
                    <SelectItem
                      key={l.rotulo}
                      value={l.usos === null ? "ilimitado" : String(l.usos)}
                    >
                      {l.rotulo}
                    </SelectItem>
                  ))}
                </SelectConteudo>
              </Select>
            </Campo>
          </div>

          {/* "Uso" é agendamento marcado, não visita. Dizer isso aqui evita a
              pergunta que a dona faria depois, olhando um contador parado. */}
          <p className="text-sm text-muted-foreground">
            Um <strong>uso</strong> é um horário marcado — abrir o link e
            desistir não gasta nada.
          </p>

          <Button
            type="button"
            variant="secondary"
            className="sm:self-start"
            disabled={gerar.isPending}
            onClick={() => gerar.mutate()}
          >
            {gerar.isPending ? <Loader2 className="animate-spin" /> : <Link2 />}
            Gerar link
          </Button>

          {erro ? <Alerta>{erro}</Alerta> : null}

          {isPending ? (
            <div
              role="status"
              aria-label="Carregando os links"
              className="h-16 animate-pulse rounded-lg bg-secondary"
            />
          ) : lista.length === 0 ? (
            <p className="rounded-lg border border-border bg-secondary/40 px-3 py-3 text-sm text-muted-foreground">
              Nenhum link com prazo ainda. O link fixo acima continua
              funcionando.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {lista.map((c) => (
                <LinhaConvite
                  key={c.id}
                  convite={c}
                  agora={agora}
                  destacado={c.codigo === recem}
                  ocupado={alternar.isPending}
                  aoAlternar={() =>
                    alternar.mutate({ id: c.id, revogado: !c.revogado })
                  }
                />
              ))}
            </ul>
          )}
        </section>

        <Alerta tom="info" titulo="O que o link ainda não faz">
          Não pede telefone e não manda confirmação. Enquanto for assim,
          combine pelo WhatsApp o que for remarcação ou desistência.
        </Alerta>
      </div>
    </Modal>
  );
}

const TOM_DO_ESTADO: Record<EstadoConvite, { classe: string; texto: string }> = {
  valido: {
    // Mesmo par que o estado "Confirmado" da agenda usa (ver CLASSES_ESTADO
    // em lib/agenda/tipos.ts): contraste já medido nos dois temas.
    classe: "border-confirmado/40 bg-confirmado-fundo text-confirmado",
    texto: "Ativo",
  },
  expirado: {
    classe: "border-border bg-secondary text-muted-foreground",
    texto: "Expirado",
  },
  esgotado: {
    classe: "border-border bg-secondary text-muted-foreground",
    texto: "Esgotado",
  },
  revogado: {
    classe: "border-border bg-secondary text-muted-foreground",
    texto: "Desligado",
  },
};

function LinhaConvite({
  convite,
  agora,
  destacado,
  ocupado,
  aoAlternar,
}: {
  convite: Convite;
  agora: Date;
  destacado: boolean;
  ocupado: boolean;
  aoAlternar: () => void;
}) {
  const estado = estadoDoConvite(convite, agora);
  const tom = TOM_DO_ESTADO[estado];

  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-border p-3",
        destacado && "border-primary ring-1 ring-primary/40",
        estado !== "valido" && "opacity-75",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {/* Estado nunca é dito só pela cor nem só pelo cinza. */}
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-xs font-semibold",
            tom.classe,
          )}
        >
          {tom.texto}
        </span>

        <span className="text-sm text-muted-foreground">
          {textoDaValidade(convite, agora)} ·{" "}
          <span data-numero>{textoDosUsos(convite)}</span>
        </span>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto"
          disabled={ocupado}
          onClick={aoAlternar}
        >
          {convite.revogado ? <Power /> : <PowerOff />}
          {convite.revogado ? "Religar" : "Desligar"}
        </Button>
      </div>

      <LinkCopiavel caminho={`/agendar/${convite.codigo}`} />
    </li>
  );
}

/**
 * O relógio, seguro para hidratação.
 *
 * No servidor devolve a época zero — uma data que não muda entre os dois
 * renders —, e no navegador a hora de verdade, reavisando a cada meio minuto
 * para um convite de 6 horas virar "Expirado" sozinho com a tela aberta.
 * Chamar `new Date()` no meio do render é o erro de hidratação clássico.
 */
const EPOCA = new Date(0);

function useRelogio(): Date {
  const ms = useSyncExternalStore(
    (aoMudar) => {
      const id = setInterval(aoMudar, 30_000);
      return () => clearInterval(id);
    },
    () => Math.floor(Date.now() / 30_000),
    () => 0,
  );

  return ms === 0 ? EPOCA : new Date(ms * 30_000);
}
