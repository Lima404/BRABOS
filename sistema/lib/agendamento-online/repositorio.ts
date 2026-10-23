import "server-only";

import { cache } from "react";

import { criarClienteServidor } from "@/lib/supabase/servidor";
import {
  CONFIGURACAO_PADRAO,
  PASSO_PADRAO,
  ehCorServico,
  ehPassoDeHorario,
} from "@/lib/agenda/tipos";
import type { AgendaPublica } from "@/lib/agendamento-online/tipos";

/**
 * O que a leitura pode devolver.
 *
 * "Barbearia não existe" e "o banco não sabe responder" são coisas
 * DIFERENTES, e juntar as duas num `null` foi erro: a tela virava um 404 mudo
 * que não distinguia apelido errado de migração faltando. Quem abre o link
 * merece saber qual dos dois é.
 */
export type LeituraAgendaPublica =
  | { ok: true; agenda: AgendaPublica }
  | { ok: false; motivo: "nao-encontrada" }
  | { ok: false; motivo: "indisponivel"; detalhe: string }
  /**
   * O link existe, a barbearia existe, e mesmo assim não dá para marcar: o
   * convite venceu, esgotou as vagas ou foi desligado. É um caso SEU, com
   * frase própria — cair no 404 faria a pessoa achar que digitou errado e
   * ficar tentando o mesmo endereço.
   */
  | {
      ok: false;
      motivo: "convite-invalido";
      estado: "expirado" | "esgotado" | "revogado";
      erro: string;
    };

/**
 * Leitura da tela pública de agendamento.
 *
 * Uma chamada só, `agenda_publica` (0018), que roda como `security definer`:
 * o cliente do link não tem sessão, e as tabelas continuam fechadas pelo RLS.
 * Nada aqui toca `agendamentos`, `servicos` ou `barbeiros` direto.
 */
/**
 * `cache()`: a página de agendar chama isto, e `generateMetadata` chama
 * de novo para montar o título da aba. Eram duas execuções da RPC
 * `agenda_publica_por_chave` — que no caminho do convite ainda trava a
 * linha do convite — para desenhar uma tela só. Vale por requisição.
 */
export const obterAgendaPublica = cache(async function obterAgendaPublica(
  /** Apelido da barbearia OU código de convite — ver migração 0033. */
  chave: string,
  data: string,
): Promise<LeituraAgendaPublica> {
  const supabase = await criarClienteServidor();

  const { data: bruto, error } = await supabase.rpc("agenda_publica_por_chave", {
    p_chave: chave,
    p_data: data,
  });

  if (error) {
    console.error(
      "[BARBOS] agenda pública indisponível:",
      error.code ?? "",
      error.message,
    );

    // A função não existe = migração pendente. Falar o número economiza a
    // caçada no log do servidor, que é onde isso morria antes.
    const semFuncao =
      error.code === "PGRST202" || error.message?.includes("agenda_publica");

    return {
      ok: false,
      motivo: "indisponivel",
      detalhe: semFuncao
        ? "A função `agenda_publica_por_chave` não existe no banco. Rode a migração 0033_convites_de_agendamento.sql."
        : error.message,
    };
  }

  const r = (bruto ?? {}) as Record<string, unknown>;

  // A própria RPC responde `ok: false` quando a chave não bate — e, desde a
  // 0033, diz POR QUE quando a chave é um convite que não serve mais.
  if (r.ok !== true) {
    const estado = r.motivo;
    if (estado === "expirado" || estado === "esgotado" || estado === "revogado") {
      return {
        ok: false,
        motivo: "convite-invalido",
        estado,
        erro: typeof r.erro === "string" ? r.erro : "Esse link não vale mais.",
      };
    }
    return { ok: false, motivo: "nao-encontrada" };
  }

  const bruta = r.barbearia as Record<string, unknown> | undefined;
  if (!bruta?.id) return { ok: false, motivo: "nao-encontrada" };

  const barbearia: AgendaPublica["barbearia"] = {
    id: texto(bruta.id),
    nome: texto(bruta.nome),
    slug: texto(bruta.slug),
    // Banco sem a migração 0036 não manda o campo. A tela some com o
    // botão do WhatsApp em vez de parar de abrir.
    telefone: typeof bruta.telefone === "string" ? bruta.telefone : null,
  };

  const cfg = (r.configuracao ?? {}) as Record<string, unknown>;

  const cv = r.convite as Record<string, unknown> | null | undefined;

  return {
    ok: true,
    agenda: {
      barbearia,
      convite: cv
        ? {
            codigo: texto(cv.codigo),
            expiraEm:
              typeof cv.expiraEm === "string" ? cv.expiraEm : null,
            usos: inteiro(cv.usos),
            usosMax:
              typeof cv.usosMax === "number" ? cv.usosMax : null,
          }
        : null,
      configuracao: {
        diasAtendimento: Array.isArray(cfg.diasAtendimento)
          ? (cfg.diasAtendimento as number[])
          : CONFIGURACAO_PADRAO.diasAtendimento,
        abre:
          typeof cfg.abre === "string" ? cfg.abre : CONFIGURACAO_PADRAO.abre,
        fecha:
          typeof cfg.fecha === "string" ? cfg.fecha : CONFIGURACAO_PADRAO.fecha,
        porTurno: cfg.porTurno === true,
        // Banco sem a migração 0031 não manda o campo. O padrão de 15 é o
        // comportamento de antes — a tela pública não pode parar de abrir
        // porque a barbearia ainda não escolheu intervalo.
        passoMin: ehPassoDeHorario(cfg.passoMin) ? cfg.passoMin : PASSO_PADRAO,
        manha: turnoPublico(cfg.manha, CONFIGURACAO_PADRAO.manha),
        tarde: turnoPublico(cfg.tarde, CONFIGURACAO_PADRAO.tarde),
      },
      servicos: lista(r.servicos).map((s) => ({
        id: texto(s.id),
        nome: texto(s.nome),
        // Cor fora da paleta cai em grafite em vez de quebrar a tela.
        cor: ehCorServico(texto(s.cor)) ? (texto(s.cor) as never) : "grafite",
        duracaoMin: inteiro(s.duracaoMin),
        precoCentavos: inteiro(s.precoCentavos),
        ativo: true,
        ordem: inteiro(s.ordem),
      })),
      barbeiros: lista(r.barbeiros).map((b) => ({
        id: texto(b.id),
        nome: texto(b.nome),
      })),
      // Ausente = banco ainda sem a 0020. Sem folga nenhuma é como o sistema
      // funcionava antes dela, então `false` é o padrão certo.
      folga: r.folga === true,
      ocupados: lista(r.ocupados).map((o) => ({
        barbeiroId: texto(o.barbeiroId),
        horario: texto(o.horario),
        duracaoMin: inteiro(o.duracaoMin),
      })),
    },
  };
});

function lista(valor: unknown): Record<string, unknown>[] {
  return Array.isArray(valor) ? (valor as Record<string, unknown>[]) : [];
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor : "";
}

function inteiro(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function turnoPublico(
  bruto: unknown,
  padrao: { abre: string; fecha: string },
): { abre: string; fecha: string } {
  if (!bruto || typeof bruto !== "object") return { ...padrao };
  const o = bruto as Record<string, unknown>;
  return {
    abre: typeof o.abre === "string" ? o.abre : padrao.abre,
    fecha: typeof o.fecha === "string" ? o.fecha : padrao.fecha,
  };
}
