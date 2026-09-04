"use server";

import { revalidatePath } from "next/cache";

import { criarClienteServidor } from "@/lib/supabase/servidor";
import { obterAgendaPublica } from "@/lib/agendamento-online/repositorio";
import type { AgendaPublica } from "@/lib/agendamento-online/tipos";
import { sanitizarNome } from "@/lib/formato";

/**
 * Marcação feita pelo cliente, pelo link público. Roda SEM sessão.
 *
 * A barreira de verdade é a RPC `criar_agendamento_publico` (0018): ela
 * confere slug, serviço, barbeiro, janela de datas e expediente, e a trava
 * `agendamento_sem_sobreposicao` decide o choque de horário. Aqui só se
 * empacota o resultado em português.
 */

export type ResultadoAgendamentoPublico =
  | { ok: true; data: string; horario: string }
  | { ok: false; erro: string };

const FALHA_DE_TRANSPORTE =
  /fetch failed|failed to fetch|network request failed|econnrefused|enotfound|etimedout|unable to verify|self.signed|socket hang up/i;

export async function agendarPeloLink(entrada: {
  slug: string;
  clienteNome: string;
  barbeiroId: string;
  servicoId: string;
  /** AAAA-MM-DD */
  data: string;
  /** HH:MM */
  horario: string;
  observacao?: string;
}): Promise<ResultadoAgendamentoPublico> {
  try {
    const slug = entrada.slug.trim();
    const nome = sanitizarNome(entrada.clienteNome).trim();

    if (!slug) return { ok: false, erro: "Link inválido." };
    if (nome.length < 2) {
      return { ok: false, erro: "Informe seu nome." };
    }
    if (!entrada.barbeiroId) {
      return { ok: false, erro: "Escolha o barbeiro." };
    }
    if (!entrada.servicoId) {
      return { ok: false, erro: "Escolha o serviço." };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entrada.data)) {
      return { ok: false, erro: "Informe a data." };
    }
    if (!/^\d{2}:\d{2}$/.test(entrada.horario)) {
      return { ok: false, erro: "Informe o horário." };
    }

    const supabase = await criarClienteServidor();

    const { data, error } = await supabase.rpc("criar_agendamento_publico", {
      p_slug: slug,
      p_cliente_nome: nome,
      p_barbeiro_id: entrada.barbeiroId,
      p_servico_id: entrada.servicoId,
      p_data: entrada.data,
      p_horario: entrada.horario,
      p_observacao: entrada.observacao?.trim() || null,
    });

    if (error) {
      console.error(
        "[BARBOS] agendamento público:",
        error.code ?? "",
        error.message,
      );

      if (
        error.message?.includes("criar_agendamento_publico") ||
        error.code === "PGRST202"
      ) {
        return {
          ok: false,
          erro: "O agendamento online ainda não está ligado no banco. Rode a migração 0018.",
        };
      }

      return { ok: false, erro: "Não consegui marcar agora. Tente de novo." };
    }

    const resposta = data as { ok?: boolean; erro?: string } | null;

    if (!resposta?.ok) {
      return { ok: false, erro: resposta?.erro ?? "Não consegui marcar." };
    }

    // A dona vê o horário novo na agenda dela sem precisar recarregar na mão.
    revalidatePath("/agenda");
    revalidatePath(`/agendar/${slug}`);

    return { ok: true, data: entrada.data, horario: entrada.horario };
  } catch (erro) {
    console.error("[BARBOS] agendamento público lançou exceção:", erro);

    const texto = [
      (erro as Error)?.message,
      (erro as { cause?: { message?: string } })?.cause?.message,
    ]
      .filter(Boolean)
      .join(" ");

    if (FALHA_DE_TRANSPORTE.test(texto)) {
      return {
        ok: false,
        erro: "Não consegui falar com o servidor. Tente de novo em alguns segundos.",
      };
    }

    return {
      ok: false,
      erro: "Algo deu errado. Se continuar, recarregue a página.",
    };
  }
}

/**
 * Relê o dia quando o cliente troca a data.
 *
 * Ação de servidor e não rota `/api/`: o proxy devolve 401 em `/api/` sem
 * sessão, e quem abre esta tela não tem nenhuma. A ação chega pelo próprio
 * caminho `/agendar/...`, que está na lista de rotas abertas.
 */
export async function buscarDiaPublico(
  slug: string,
  data: string,
): Promise<AgendaPublica | null> {
  if (!slug || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
  return obterAgendaPublica(slug, data);
}
