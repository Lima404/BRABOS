import "server-only";

import { criarClienteServidor } from "@/lib/supabase/servidor";
import {
  CONFIGURACAO_PADRAO,
  type Agendamento,
  type ConfiguracaoAgenda,
  type CorServico,
  type EstadoAgendamento,
  type ItemDaComanda,
  type Servico,
} from "@/lib/agenda/tipos";

/**
 * Camada de dados da agenda — tabelas `agendamentos`, `servicos` e
 * `configuracao_agenda` (migrações 0002 e 0003).
 *
 * `server-only` garante erro de build se alguém importar num componente de
 * cliente. O RLS já limita as linhas à barbearia logada — por isso nenhuma
 * consulta aqui filtra barbearia_id na mão.
 */

/** O Postgres devolve `time` como HH:MM:SS; a UI quer HH:MM. */
function hhmm(valor: string): string {
  return valor.slice(0, 5);
}

// ============================================================
// Serviços
// ============================================================

type LinhaServico = {
  id: string;
  nome: string;
  preco_centavos: number;
  duracao_min: number;
  cor: CorServico;
  ativo: boolean;
  ordem: number;
};

function servicoDaLinha(l: LinhaServico): Servico {
  return {
    id: l.id,
    nome: l.nome,
    cor: l.cor,
    duracaoMin: l.duracao_min,
    precoCentavos: l.preco_centavos,
    ativo: l.ativo,
    ordem: l.ordem,
  };
}

const CAMPOS_SERVICO = "id, nome, preco_centavos, duracao_min, cor, ativo, ordem";

/**
 * O cardápio. Traz também os desativados: eles não entram na legenda, mas a
 * tela de configuração precisa mostrá-los para poder reativar.
 */
export async function listarServicos(): Promise<Servico[]> {
  const supabase = await criarClienteServidor();

  const { data, error } = await supabase
    .from("servicos")
    .select(CAMPOS_SERVICO)
    .order("ordem", { ascending: true })
    .order("nome", { ascending: true });

  if (error) {
    console.error("[BARBOS] erro ao ler servicos:", error.message);
    throw new Error("Não foi possível carregar os serviços.");
  }

  return (data as LinhaServico[]).map(servicoDaLinha);
}

// ============================================================
// Configuração
// ============================================================

type LinhaConfiguracao = {
  dias_atendimento: number[];
  abre: string;
  fecha: string;
};

/**
 * Configuração da barbearia logada.
 *
 * Sem linha no banco devolve o padrão em vez de erro: a agenda tem que abrir
 * mesmo em conta criada antes da migração 0003.
 */
export async function obterConfiguracaoAgenda(): Promise<ConfiguracaoAgenda> {
  const supabase = await criarClienteServidor();

  const { data, error } = await supabase
    .from("configuracao_agenda")
    .select("dias_atendimento, abre, fecha")
    .maybeSingle();

  if (error) {
    console.error("[BARBOS] erro ao ler configuracao_agenda:", error.message);
    throw new Error("Não foi possível carregar a configuração da agenda.");
  }

  if (!data) return CONFIGURACAO_PADRAO;

  const l = data as LinhaConfiguracao;
  return {
    diasAtendimento: [...l.dias_atendimento].sort((a, b) => a - b),
    abre: hhmm(l.abre),
    fecha: hhmm(l.fecha),
  };
}

// ============================================================
// Agendamentos
// ============================================================

type LinhaAgendamento = {
  id: string;
  cliente_nome: string;
  data: string;
  horario: string;
  estado: EstadoAgendamento;
  observacao: string | null;
  preco_centavos: number | null;
  duracao_min: number | null;
  barbeiro_id: string | null;
  servico: {
    id: string;
    nome: string;
    cor: CorServico;
    duracao_min: number;
    preco_centavos: number;
  } | null;
};

/** Último dia do mês, em AAAA-MM-DD. */
function ultimoDia(mes: string): string {
  const [ano, m] = mes.split("-").map(Number);
  const dia = new Date(ano, m, 0).getDate();
  return `${mes}-${String(dia).padStart(2, "0")}`;
}

/** `mes` no formato AAAA-MM. */
export async function listarAgendamentosDoMes(
  mes: string,
): Promise<Agendamento[]> {
  const supabase = await criarClienteServidor();

  const { data, error } = await supabase
    .from("agendamentos")
    .select(
      "id, cliente_nome, data, horario, estado, observacao, preco_centavos," +
        " duracao_min, barbeiro_id," +
        " servico:servicos(id, nome, cor, duracao_min, preco_centavos)",
    )
    .gte("data", `${mes}-01`)
    .lte("data", ultimoDia(mes))
    .order("data", { ascending: true })
    .order("horario", { ascending: true });

  if (error) {
    // Coluna barbeiro_id só existe depois da 0015 — tenta sem ela.
    if (
      error.message?.includes("barbeiro_id") ||
      error.code === "42703"
    ) {
      return listarAgendamentosDoMesSemBarbeiro(supabase, mes);
    }
    console.error("[BARBOS] erro ao ler agendamentos:", error.message);
    throw new Error("Não foi possível carregar a agenda.");
  }

  const linhas = data as unknown as LinhaAgendamento[];
  const orfaos = linhas.filter((l) => !l.servico);
  if (orfaos.length > 0) {
    // Só acontece se a conversão da 0003 tiver deixado linha sem serviço.
    console.error(
      `[BARBOS] ${orfaos.length} agendamento(s) sem serviço — ocultados. ` +
        "Rode 0003_servicos_e_configuracao.sql de novo.",
    );
  }

  return linhas
    .filter((l): l is LinhaAgendamento & { servico: NonNullable<LinhaAgendamento["servico"]> } =>
      Boolean(l.servico),
    )
    .map((l) => ({
      id: l.id,
      clienteNome: l.cliente_nome,
      servico: {
        id: l.servico.id,
        nome: l.servico.nome,
        cor: l.servico.cor,
        duracaoMin: l.servico.duracao_min,
      },
      barbeiroId: l.barbeiro_id ?? undefined,
      data: l.data,
      horario: hhmm(l.horario),
      estado: l.estado,
      // Linha antiga sem preço congelado cai no preço atual do serviço. É a
      // única saída, e por isso a 0003 congela o que dá na hora de migrar.
      precoCentavos: l.preco_centavos ?? l.servico.preco_centavos,
      // Mesma queda de braço do preço: linha antiga sem cópia usa o valor
      // atual do serviço. Remendo de migração, não caminho normal.
      duracaoMin: l.duracao_min ?? l.servico.duracao_min,
      observacao: l.observacao ?? undefined,
    }));
}

async function listarAgendamentosDoMesSemBarbeiro(
  supabase: Awaited<ReturnType<typeof criarClienteServidor>>,
  mes: string,
): Promise<Agendamento[]> {
  const { data, error } = await supabase
    .from("agendamentos")
    .select(
      "id, cliente_nome, data, horario, estado, observacao, preco_centavos," +
        " duracao_min, servico:servicos(id, nome, cor, duracao_min, preco_centavos)",
    )
    .gte("data", `${mes}-01`)
    .lte("data", ultimoDia(mes))
    .order("data", { ascending: true })
    .order("horario", { ascending: true });

  if (error) {
    console.error("[BARBOS] erro ao ler agendamentos:", error.message);
    throw new Error("Não foi possível carregar a agenda.");
  }

  const linhas = data as unknown as Omit<LinhaAgendamento, "barbeiro_id">[];

  return linhas
    .filter((l): l is typeof l & { servico: NonNullable<typeof l.servico> } =>
      Boolean(l.servico),
    )
    .map((l) => ({
      id: l.id,
      clienteNome: l.cliente_nome,
      servico: {
        id: l.servico.id,
        nome: l.servico.nome,
        cor: l.servico.cor,
        duracaoMin: l.servico.duracao_min,
      },
      data: l.data,
      horario: hhmm(l.horario),
      estado: l.estado,
      precoCentavos: l.preco_centavos ?? l.servico.preco_centavos,
      duracaoMin: l.duracao_min ?? l.servico.duracao_min,
      observacao: l.observacao ?? undefined,
    }));
}

// ============================================================
// Comanda
// ============================================================

type LinhaVendaDoAgendamento = {
  id: string;
  itens_venda:
    | {
        id: string;
        nome: string;
        preco_centavos: number;
        quantidade: number;
      }[]
    | null;
};

/**
 * O que o cliente consumiu durante um atendimento.
 *
 * São as compras da loja lançadas neste agendamento (migração 0009).
 * Cancelada não entra: comanda cobra o que ficou de pé.
 *
 * Uma linha por lançamento — iguais NÃO são somados. Juntar deixaria a
 * comanda mais curta, mas tiraria a identidade de cada linha, e sem ela a
 * edição do consumo não sabe qual das compras mexer.
 *
 * O RLS de `vendas` já limita à barbearia logada, então nada aqui filtra
 * barbearia na mão.
 */
export async function listarItensDoAgendamento(
  agendamentoId: string,
): Promise<ItemDaComanda[]> {
  const supabase = await criarClienteServidor();

  const { data, error } = await supabase
    .from("vendas")
    .select("id, itens_venda(id, nome, preco_centavos, quantidade)")
    .eq("agendamento_id", agendamentoId)
    .eq("status", "confirmada");

  if (error) {
    console.error("[BARBOS] erro ao ler a comanda:", error.message);
    throw new Error("Não foi possível carregar os itens do atendimento.");
  }

  const itens: ItemDaComanda[] = [];

  for (const venda of (data ?? []) as unknown as LinhaVendaDoAgendamento[]) {
    for (const item of venda.itens_venda ?? []) {
      itens.push({
        id: item.id,
        nome: item.nome,
        quantidade: item.quantidade,
        precoCentavos: item.preco_centavos,
      });
    }
  }

  return itens.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
