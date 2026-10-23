"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { criarClienteServidor } from "@/lib/supabase/servidor";
import { obterAgendaPublica } from "@/lib/agendamento-online/repositorio";
import { avisarAgendamento } from "@/lib/notificacoes/servidor";
import type { AgendaPublica } from "@/lib/agendamento-online/tipos";
import {
  digitosDoTelefone,
  sanitizarNome,
  textoLivreParaBanco,
} from "@/lib/formato";

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
  /** Com DDD. Obrigatório desde a migração 0037. */
  clienteTelefone: string;
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
    const telefone = (entrada.clienteTelefone ?? "").trim();
    const digitos = digitosDoTelefone(telefone);

    if (!slug) return { ok: false, erro: "Link inválido." };
    if (nome.length < 2) {
      return { ok: false, erro: "Informe seu nome." };
    }
    // Cobrado aqui e não só na tela: esta função é um endereço HTTP
    // público, e é ela que decide se o telefone é obrigatório enquanto a
    // RPC ainda aceita chegar sem ele (ver o cabeçalho da 0037).
    if (digitos.length === 0) {
      return { ok: false, erro: "Informe seu telefone." };
    }
    if (digitos.length < 10 || digitos.length > 11) {
      return { ok: false, erro: "Informe seu telefone com DDD (10 ou 11 dígitos)." };
    }
    if (!entrada.barbeiroId) {
      return { ok: false, erro: "Selecione um barbeiro." };
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

    // `_por_chave` (0033): aceita o apelido E o código de convite, e é ela
    // que confere prazo, limite e contador — tudo com a linha do convite
    // travada, para dois cliques no mesmo segundo não furarem um link de
    // uma vaga. Apelido continua caindo na função de sempre, sem convite
    // nenhum no caminho.
    const { data, error } = await supabase.rpc(
      "criar_agendamento_publico_por_chave",
      {
      p_chave: slug,
      p_cliente_nome: nome,
      p_cliente_telefone: telefone,
      p_barbeiro_id: entrada.barbeiroId,
      p_servico_id: entrada.servicoId,
      p_data: entrada.data,
      p_horario: entrada.horario,
      p_observacao: textoLivreParaBanco(entrada.observacao ?? "") || null,
      },
    );

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
        // A 0037 mudou a ASSINATURA da função (o telefone entrou). Sem
        // ela aplicada, o PostgREST não acha a função com estes
        // argumentos e devolve PGRST202 — o mesmo erro de quando a 0033
        // nunca rodou. Daí as duas migrações no recado.
        return {
          ok: false,
          erro: "O agendamento online ainda não está ligado no banco. Rode as migrações 0033 e 0037.",
        };
      }

      return { ok: false, erro: "Não consegui marcar agora. Tente de novo." };
    }

    const resposta = data as {
      ok?: boolean;
      erro?: string;
      agendamentoId?: string;
    } | null;

    if (!resposta?.ok) {
      return { ok: false, erro: resposta?.erro ?? "Não consegui marcar." };
    }

    // ============================================================
    // O AVISO SAI DEPOIS DA RESPOSTA, NUNCA ANTES
    // ============================================================
    //
    // `after()` roda com a resposta já entregue. O horário está gravado e o
    // cliente precisa ver "Horário marcado" agora — não depois de esperar a
    // Apple e o Google responderem. E se o envio falhar, quem marcou não
    // tem o que fazer com esse erro: o agendamento existe do mesmo jeito.
    //
    // Sem `after()` haveria duas escolhas ruins: aguardar o push (a tela de
    // confirmação fica presa numa rede que não é nossa) ou disparar e
    // esquecer (em servidor sem estado a função congela depois da resposta,
    // e o envio morre no meio).
    if (resposta.agendamentoId) {
      after(() => avisarAgendamento(resposta.agendamentoId!));
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
  const leitura = await obterAgendaPublica(slug, data);
  // A tela já está montada quando isto roda: se o dia novo falhar, ela segue
  // com o dia anterior em vez de piscar vazia.
  return leitura.ok ? leitura.agenda : null;
}
