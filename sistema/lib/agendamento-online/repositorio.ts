import "server-only";

import { criarClienteServidor } from "@/lib/supabase/servidor";
import { CONFIGURACAO_PADRAO, ehCorServico } from "@/lib/agenda/tipos";
import type { AgendaPublica } from "@/lib/agendamento-online/tipos";

/**
 * Leitura da tela pública de agendamento.
 *
 * Uma chamada só, `agenda_publica` (0018), que roda como `security definer`:
 * o cliente do link não tem sessão, e as tabelas continuam fechadas pelo RLS.
 * Nada aqui toca `agendamentos`, `servicos` ou `barbeiros` direto.
 */
export async function obterAgendaPublica(
  slug: string,
  data: string,
): Promise<AgendaPublica | null> {
  const supabase = await criarClienteServidor();

  const { data: bruto, error } = await supabase.rpc("agenda_publica", {
    p_slug: slug,
    p_data: data,
  });

  if (error) {
    console.error(
      "[BARBOS] agenda pública indisponível (rode a migração 0018):",
      error.message,
    );
    return null;
  }

  const r = (bruto ?? {}) as Record<string, unknown>;
  if (r.ok !== true) return null;

  const barbearia = r.barbearia as AgendaPublica["barbearia"] | undefined;
  if (!barbearia?.id) return null;

  const cfg = (r.configuracao ?? {}) as Record<string, unknown>;

  return {
    barbearia,
    configuracao: {
      diasAtendimento: Array.isArray(cfg.diasAtendimento)
        ? (cfg.diasAtendimento as number[])
        : CONFIGURACAO_PADRAO.diasAtendimento,
      abre: typeof cfg.abre === "string" ? cfg.abre : CONFIGURACAO_PADRAO.abre,
      fecha:
        typeof cfg.fecha === "string" ? cfg.fecha : CONFIGURACAO_PADRAO.fecha,
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
    ocupados: lista(r.ocupados).map((o) => ({
      barbeiroId: texto(o.barbeiroId),
      horario: texto(o.horario),
      duracaoMin: inteiro(o.duracaoMin),
    })),
  };
}

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
