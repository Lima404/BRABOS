"use server";

import { revalidatePath } from "next/cache";

import { criarClienteServidor } from "@/lib/supabase/servidor";
import { sanitizarNomeDeItem } from "@/lib/formato";
import {
  DURACAO_MAX,
  DURACAO_MIN,
  ESTADOS,
  ehCorServico,
  type EstadoAgendamento,
  type ConfiguracaoAgenda,
  type CorServico,
  type MudancaDeConsumo,
} from "@/lib/agenda/tipos";

/**
 * Escrita da configuração da agenda e do cardápio de serviços.
 *
 * Toda validação é refeita aqui. O que o formulário checa é conveniência para
 * quem digita; barreira de verdade é esta função somada ao CHECK do banco —
 * uma ação de servidor é um endereço HTTP público como qualquer outro.
 *
 * Nenhuma consulta filtra barbearia_id: quem isola é o RLS.
 */

/**
 * `motivo` existe para a tela poder reagir diferente sem interpretar a
 * mensagem por texto. Hoje só "conflito" — o horário pedido já é de alguém —,
 * que a agenda mostra em toast em vez de só no rodapé do formulário.
 */
export type Resultado =
  | { ok: true; aviso?: string }
  | { ok: false; erro: string; motivo?: "conflito" };

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Traduz o erro do Postgres. Registra o original — ver AGENTS.md. */
function traduzir(
  operacao: string,
  erro: { code?: string; message: string },
  mensagens?: { conflito?: string },
): Resultado {
  console.error(`[BARBOS] ${operacao}:`, erro.code ?? "", erro.message);

  if (erro.code === "23505") {
    return {
      ok: false,
      erro: mensagens?.conflito ?? "Já existe um serviço ativo com esse nome.",
      motivo: "conflito",
    };
  }
  if (erro.code === "23503") {
    return {
      ok: false,
      erro: "Esse serviço já tem agendamentos e por isso não pode ser apagado.",
    };
  }
  // 23P01 = exclusion_violation. É a trava de sobreposição da migração 0006:
  // o horário pedido cai DENTRO de outro atendimento já marcado. A 0002 usava
  // uma `unique` (23505) que só pegava o mesmo minuto — os dois códigos
  // significam "esse horário já é de alguém", então aceitam a mesma mensagem.
  if (erro.code === "23P01") {
    return {
      ok: false,
      erro:
        mensagens?.conflito ??
        "Já existe um atendimento nesse intervalo. Escolha outro horário.",
      motivo: "conflito",
    };
  }
  if (erro.code === "23514") {
    return {
      ok: false,
      erro: "Algum valor está fora do permitido. Confira e tente de novo.",
    };
  }
  return { ok: false, erro: "Não consegui salvar. Tente de novo." };
}

/** Marcas de falha de transporte — rede caída, DNS, ou antivírus no TLS. */
const FALHA_DE_TRANSPORTE =
  /fetch failed|failed to fetch|network request failed|econnrefused|enotfound|etimedout|unable to verify|self.signed|socket hang up/i;

/**
 * Casca de toda ação daqui.
 *
 * Sem ela, uma exceção (o `getUser()` não alcançar o Supabase, por exemplo)
 * sobe como promessa rejeitada, o `useMutation` cai no `onError` genérico e o
 * erro cru **não aparece em lugar nenhum** — nem no servidor, nem no
 * navegador. Foi exatamente esse buraco que transformou o caso do antivírus
 * numa caçada às cegas, e o AGENTS.md existe por causa dele.
 *
 * Aqui a exceção vira `Resultado`, e o original vai pro log do servidor.
 */
async function protegido(
  operacao: string,
  corpo: () => Promise<Resultado>,
): Promise<Resultado> {
  try {
    return await corpo();
  } catch (erro) {
    console.error(`[BARBOS] ${operacao} lançou exceção:`, erro);

    const texto = [
      (erro as Error)?.message,
      (erro as { cause?: { message?: string; code?: string } })?.cause?.message,
      (erro as { cause?: { code?: string } })?.cause?.code,
    ]
      .filter(Boolean)
      .join(" ");

    // Não acusa a internet do usuário: pode ser o servidor, o DNS ou o
    // antivírus da máquina. Diz o que se sabe e o que fazer.
    if (FALHA_DE_TRANSPORTE.test(texto)) {
      return {
        ok: false,
        erro: "Não consegui falar com o servidor de dados. Tente de novo em alguns segundos.",
      };
    }

    return {
      ok: false,
      erro: "Algo deu errado ao salvar. Se continuar, recarregue a página.",
    };
  }
}

// ============================================================
// Configuração
// ============================================================

export async function salvarConfiguracao(
  entrada: ConfiguracaoAgenda,
): Promise<Resultado> {
  return protegido("salvar configuracao", async () => {
    const dias = [...new Set(entrada.diasAtendimento)]
      .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
      .sort((a, b) => a - b);

    if (dias.length === 0) {
      return { ok: false, erro: "Escolha pelo menos um dia de atendimento." };
    }

    function validarPar(abre: string, fecha: string, rotulo: string): string | null {
      if (!HORA.test(abre) || !HORA.test(fecha)) {
        return `Informe o horário ${rotulo} no formato 00:00.`;
      }
      if (fecha <= abre) {
        return `No turno ${rotulo}, fechar precisa ser depois de abrir.`;
      }
      return null;
    }

    let abre = entrada.abre;
    let fecha = entrada.fecha;
    const manha = entrada.manha;
    const tarde = entrada.tarde;

    if (entrada.porTurno) {
      const erroManha = validarPar(manha.abre, manha.fecha, "da manhã");
      if (erroManha) return { ok: false, erro: erroManha };
      const erroTarde = validarPar(tarde.abre, tarde.fecha, "da tarde");
      if (erroTarde) return { ok: false, erro: erroTarde };
      if (manha.fecha > tarde.abre) {
        return {
          ok: false,
          erro: "A manhã precisa terminar antes (ou quando) a tarde começa.",
        };
      }
      // Envelope do dia — calendário e linha do tempo ainda leem abre/fecha.
      abre = manha.abre;
      fecha = tarde.fecha;
    } else {
      if (!HORA.test(abre) || !HORA.test(fecha)) {
        return { ok: false, erro: "Informe o horário no formato 00:00." };
      }
      if (fecha <= abre) {
        return {
          ok: false,
          erro: "O horário de fechar precisa ser depois do de abrir.",
        };
      }
    }

    const supabase = await criarClienteServidor();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, erro: "Sessão expirada. Entre de novo." };

    // upsert e não update: conta criada antes da 0003 pode não ter linha.
    const { error } = await supabase.from("configuracao_agenda").upsert(
      {
        barbearia_id: user.id,
        dias_atendimento: dias,
        abre,
        fecha,
        por_turno: entrada.porTurno,
        manha_abre: entrada.porTurno ? manha.abre : null,
        manha_fecha: entrada.porTurno ? manha.fecha : null,
        tarde_abre: entrada.porTurno ? tarde.abre : null,
        tarde_fecha: entrada.porTurno ? tarde.fecha : null,
      },
      { onConflict: "barbearia_id" },
    );

    if (error) return traduzir("salvar configuracao", error);

    revalidatePath("/agenda");
    return { ok: true };
  });
}

// ============================================================
// Folgas
// ============================================================

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Marca um dia avulso em que a barbearia não abre (migração 0020).
 *
 * NÃO cancela quem já está marcado — a folga fecha o dia para horário NOVO.
 * Quem já tem hora continua na agenda, e avisar é da dona; apagar
 * agendamento por tabela seria decidir no lugar dela. Por isso a resposta
 * volta com `aviso` contando quantas pessoas já estão naquele dia: a tela
 * consegue dizer isso sem ter o mês inteiro carregado.
 *
 * Marcar duas vezes é a mesma folga, não duas — o `unique` do banco garante,
 * e o 23505 daqui vira sucesso silencioso em vez de erro que não é erro.
 */
export async function marcarFolga(data: string): Promise<Resultado> {
  return protegido("marcar folga", async () => {
    if (!DATA_ISO.test(data)) {
      return { ok: false, erro: "Data inválida." };
    }

    const supabase = await criarClienteServidor();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, erro: "Sessão expirada. Entre de novo." };

    const { error } = await supabase
      .from("folgas")
      .insert({ barbearia_id: user.id, data });

    if (error) {
      if (error.code === "42P01") {
        return {
          ok: false,
          erro: "A tabela de folgas ainda não existe. Rode a migração 0020_folgas.sql.",
        };
      }
      // 23505 = já era folga. O resultado que a dona queria já está no banco.
      if (error.code !== "23505") return traduzir("marcar folga", error);
    }

    const { count } = await supabase
      .from("agendamentos")
      .select("id", { count: "exact", head: true })
      .eq("data", data)
      .neq("estado", "cancelado");

    revalidatePath("/agenda");

    if (count && count > 0) {
      return {
        ok: true,
        aviso:
          count === 1
            ? "Tem 1 pessoa já marcada nesse dia. A folga não cancela ninguém — avise ou remarque."
            : `Tem ${count} pessoas já marcadas nesse dia. A folga não cancela ninguém — avise ou remarque.`,
      };
    }

    return { ok: true };
  });
}

/** Desmarca a folga — o dia volta a seguir a regra da semana. */
export async function desmarcarFolga(data: string): Promise<Resultado> {
  return protegido("desmarcar folga", async () => {
    if (!DATA_ISO.test(data)) {
      return { ok: false, erro: "Data inválida." };
    }

    const supabase = await criarClienteServidor();

    // Sem filtro por barbearia: quem isola é o RLS.
    const { error } = await supabase.from("folgas").delete().eq("data", data);

    if (error) return traduzir("desmarcar folga", error);

    revalidatePath("/agenda");
    return { ok: true };
  });
}

/**
 * O dia está marcado como folga?
 *
 * Barreira de verdade da marcação: o formulário também checa, mas ele só
 * conhece as folgas que a tela carregou.
 */
async function ehFolga(
  supabase: Awaited<ReturnType<typeof criarClienteServidor>>,
  data: string,
): Promise<boolean> {
  const { data: linha, error } = await supabase
    .from("folgas")
    .select("data")
    .eq("data", data)
    .maybeSingle();

  // Tabela ausente (migração pendente) não pode BLOQUEAR agendamento: o
  // sistema funcionava sem folga nenhuma antes da 0020.
  if (error) {
    console.error("[BARBOS] checar folga:", error.code ?? "", error.message);
    return false;
  }

  return Boolean(linha);
}

// ============================================================
// Serviços
// ============================================================

export type DadosServico = {
  /** Ausente = cadastro novo. */
  id?: string;
  nome: string;
  precoCentavos: number;
  duracaoMin: number;
  cor: CorServico;
};

/**
 * Nome como ele vai pro banco: caixa alta, sem caractere estranho, espaços
 * colapsados e pontas aparadas.
 *
 * O formulário já sanitiza a cada tecla, mas isso é conveniência de quem
 * digita — uma ação de servidor é um endereço HTTP público, e quem chamar
 * direto manda o que quiser. O colapso de espaço fica só aqui: fazer isso a
 * cada tecla tirava o espaço da mão de quem ainda estava escrevendo.
 */
function nomeDeItemParaBanco(texto: string): string {
  return sanitizarNomeDeItem(texto).replace(/ {2,}/g, " ").trim();
}

function validarServico(d: DadosServico): string | null {
  const nome = nomeDeItemParaBanco(d.nome);

  // Vazio DEPOIS de sanitizar: quem digitou só "###" mandou 3 caracteres e
  // não sobrou nenhum. Dizer "dê um nome" é mais honesto que aceitar vazio.
  if (nome.length === 0) return "Dê um nome ao serviço com letras ou números.";
  if (nome.length > 60) return "O nome do serviço está longo demais.";

  if (!Number.isInteger(d.precoCentavos) || d.precoCentavos < 0) {
    return "Informe um valor válido, como 45,00.";
  }
  if (d.precoCentavos > 100_000_00) {
    return "Esse valor parece alto demais. Confira.";
  }
  if (
    !Number.isInteger(d.duracaoMin) ||
    d.duracaoMin < DURACAO_MIN ||
    d.duracaoMin > DURACAO_MAX
  ) {
    return `O intervalo precisa ficar entre ${DURACAO_MIN} minutos e ${DURACAO_MAX / 60} horas.`;
  }
  if (!ehCorServico(d.cor)) return "Escolha uma cor da paleta.";

  return null;
}

export async function salvarServico(d: DadosServico): Promise<Resultado> {
  return protegido("salvar servico", async () => {
    const problema = validarServico(d);
    if (problema) return { ok: false, erro: problema };

    const supabase = await criarClienteServidor();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, erro: "Sessão expirada. Entre de novo." };

    const campos = {
      nome: nomeDeItemParaBanco(d.nome),
      preco_centavos: d.precoCentavos,
      duracao_min: d.duracaoMin,
      cor: d.cor,
    };

    const { error } = d.id
      ? await supabase.from("servicos").update(campos).eq("id", d.id)
      : await supabase
          .from("servicos")
          .insert({ ...campos, barbearia_id: user.id });

    if (error) return traduzir("salvar servico", error);

    revalidatePath("/agenda");
    return { ok: true };
  });
}

/** Tira de circulação sem apagar — o histórico continua apontando pra ele. */
export async function alternarServicoAtivo(
  id: string,
  ativo: boolean,
): Promise<Resultado> {
  return protegido("alternar servico", async () => {
    const supabase = await criarClienteServidor();

    const { error } = await supabase
      .from("servicos")
      .update({ ativo })
      .eq("id", id);
    if (error) return traduzir("alternar servico", error);

    revalidatePath("/agenda");
    return { ok: true };
  });
}

/**
 * Apaga de vez. Só funciona em serviço que nunca foi agendado — a chave
 * estrangeira é `on delete restrict` de propósito. Se houver histórico, a
 * saída é desativar.
 */
export async function excluirServico(id: string): Promise<Resultado> {
  return protegido("excluir servico", async () => {
    const supabase = await criarClienteServidor();

    const { error } = await supabase.from("servicos").delete().eq("id", id);
    if (error) return traduzir("excluir servico", error);

    revalidatePath("/agenda");
    return { ok: true };
  });
}

// ============================================================
// Agendamentos
// ============================================================

const DATA = /^\d{4}-\d{2}-\d{2}$/;

export type DadosAgendamento = {
  clienteNome: string;
  servicoId: string;
  /** Barbeiro que atende. */
  barbeiroId: string;
  /** AAAA-MM-DD */
  data: string;
  /** HH:MM */
  horario: string;
  observacao?: string;
};

function validarAgendamento(d: DadosAgendamento): string | null {
  if (d.clienteNome.trim().length === 0) {
    return "Informe o nome do cliente.";
  }
  if (d.clienteNome.trim().length > 80) {
    return "O nome do cliente está longo demais.";
  }
  if (!d.servicoId) return "Escolha o serviço.";
  if (!d.barbeiroId) return "Escolha o barbeiro.";
  if (!DATA.test(d.data)) return "Informe a data no formato AAAA-MM-DD.";
  if (!HORA.test(d.horario)) return "Informe o horário no formato 00:00.";
  if (d.observacao && d.observacao.length > 500) {
    return "A observação está longa demais.";
  }
  return null;
}

/**
 * Confere se o barbeiro é da barbearia logada e está ativo.
 */
async function obterBarbeiroDaConta(
  supabase: Awaited<ReturnType<typeof criarClienteServidor>>,
  barbeiroId: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const { data, error } = await supabase
    .from("barbeiros")
    .select("id, ativo")
    .eq("id", barbeiroId)
    .maybeSingle();

  if (error) {
    if (
      error.code === "PGRST205" ||
      error.message?.includes("barbeiros") ||
      error.message?.includes("schema cache")
    ) {
      return {
        ok: false,
        erro: "A equipe ainda não está ligada no banco. Rode as migrações 0014 e 0015.",
      };
    }
    return traduzir("ler barbeiro", error);
  }

  if (!data) return { ok: false, erro: "Esse barbeiro não existe nesta loja." };
  if (!data.ativo) {
    return { ok: false, erro: "Esse barbeiro está inativo. Escolha outro." };
  }
  return { ok: true };
}

/**
 * Marca um horário. O preço do serviço é congelado na linha — reajuste de
 * tabela depois não reescreve o histórico (ver AGENTS.md).
 */
export async function criarAgendamento(
  d: DadosAgendamento,
): Promise<Resultado> {
  return protegido("criar agendamento", async () => {
    const problema = validarAgendamento(d);
    if (problema) return { ok: false, erro: problema };

    const supabase = await criarClienteServidor();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, erro: "Sessão expirada. Entre de novo." };

    // Folga bloqueia horário NOVO, não o que já está marcado. Aqui é sempre
    // horário novo, então recusa direto — com a saída no texto, porque quem
    // realmente quer marcar nesse dia é quem tira a folga.
    if (await ehFolga(supabase, d.data)) {
      return {
        ok: false,
        erro: "Esse dia está marcado como folga. Desmarque em Configurar agenda ou escolha outra data.",
      };
    }

    const { data: servico, error: erroServico } = await supabase
      .from("servicos")
      .select("id, preco_centavos, duracao_min, ativo")
      .eq("id", d.servicoId)
      .maybeSingle();

    if (erroServico) return traduzir("criar agendamento", erroServico);
    if (!servico) return { ok: false, erro: "Esse serviço não existe mais." };
    if (!servico.ativo) {
      return {
        ok: false,
        erro: "Esse serviço está desativado. Escolha outro ou reative-o na configuração.",
      };
    }

    const barbeiro = await obterBarbeiroDaConta(supabase, d.barbeiroId);
    if (!barbeiro.ok) return barbeiro;

    const observacao = d.observacao?.trim();

    const { error } = await supabase.from("agendamentos").insert({
      barbearia_id: user.id,
      cliente_nome: d.clienteNome.trim(),
      servico_id: d.servicoId,
      barbeiro_id: d.barbeiroId,
      data: d.data,
      horario: d.horario,
      preco_centavos: servico.preco_centavos,
      // Copiada junto com o preço, e pelo mesmo motivo: mudar a duração de
      // "Cabelo" não pode esticar horário já marcado. É também o que a trava
      // de sobreposição (0006) usa pra calcular o intervalo ocupado.
      duracao_min: servico.duracao_min,
      observacao: observacao && observacao.length > 0 ? observacao : null,
    });

    if (error) {
      if (
        error.message?.includes("barbeiro_id") ||
        error.code === "42703"
      ) {
        return {
          ok: false,
          erro: "O agendamento ainda não está ligado ao barbeiro. Rode a migração 0015.",
        };
      }
      return traduzir("criar agendamento", error, {
        conflito:
          "Já tem alguém marcado nesse intervalo. Escolha outro horário.",
      });
    }

    revalidatePath("/agenda");
    return { ok: true };
  });
}

/**
 * Edita um horário já marcado.
 *
 * Preço e duração são RECOPIADOS do serviço escolhido agora. Parece contradizer
 * "preço congelado", mas não: o congelamento protege o histórico de um
 * reajuste de tabela feito depois. Aqui a dona está reabrindo o agendamento e
 * dizendo o que ele é — se trocou de Cabelo para Cabelo + Barba, o valor e a
 * duração têm que acompanhar, senão a agenda mostra 30 minutos para um
 * serviço de 50 e a trava de sobreposição calcula o intervalo errado.
 */
export async function atualizarAgendamento(
  id: string,
  d: DadosAgendamento,
): Promise<Resultado> {
  return protegido("atualizar agendamento", async () => {
    if (!id) return { ok: false, erro: "Agendamento não informado." };

    const problema = validarAgendamento(d);
    if (problema) return { ok: false, erro: problema };

    const supabase = await criarClienteServidor();

    // Mover um horário PARA um dia de folga é marcar num dia fechado, então
    // vale a mesma recusa. Quem já estava lá antes da folga continua lá — a
    // checagem é sobre a data de destino, não sobre a de origem.
    if (await ehFolga(supabase, d.data)) {
      return {
        ok: false,
        erro: "Esse dia está marcado como folga. Desmarque em Configurar agenda ou escolha outra data.",
      };
    }

    const { data: servico, error: erroServico } = await supabase
      .from("servicos")
      .select("id, preco_centavos, duracao_min, ativo")
      .eq("id", d.servicoId)
      .maybeSingle();

    if (erroServico) return traduzir("atualizar agendamento", erroServico);
    if (!servico) return { ok: false, erro: "Esse serviço não existe mais." };
    if (!servico.ativo) {
      return {
        ok: false,
        erro: "Esse serviço está desativado. Escolha outro ou reative-o na configuração.",
      };
    }

    const barbeiro = await obterBarbeiroDaConta(supabase, d.barbeiroId);
    if (!barbeiro.ok) return barbeiro;

    const observacao = d.observacao?.trim();

    // Sem filtro de dono: o RLS já recusa a linha de outra barbearia.
    const { error } = await supabase
      .from("agendamentos")
      .update({
        cliente_nome: d.clienteNome.trim(),
        servico_id: d.servicoId,
        barbeiro_id: d.barbeiroId,
        data: d.data,
        horario: d.horario,
        preco_centavos: servico.preco_centavos,
        duracao_min: servico.duracao_min,
        observacao: observacao && observacao.length > 0 ? observacao : null,
      })
      .eq("id", id);

    if (error) {
      if (
        error.message?.includes("barbeiro_id") ||
        error.code === "42703"
      ) {
        return {
          ok: false,
          erro: "O agendamento ainda não está ligado ao barbeiro. Rode a migração 0015.",
        };
      }
      return traduzir("atualizar agendamento", error, {
        conflito:
          "Já tem alguém marcado nesse intervalo. Escolha outro horário.",
      });
    }

    revalidatePath("/agenda");
    return { ok: true };
  });
}

/**
 * Muda o estado de um agendamento.
 *
 * Separado da edição de propósito: "atendi o cliente" é um gesto de um toque
 * no meio do expediente, não um formulário. Concluir com a mão molhada de
 * água e talco tem que caber num botão.
 */
export async function mudarEstadoAgendamento(
  id: string,
  estado: EstadoAgendamento,
): Promise<Resultado> {
  return protegido("mudar estado do agendamento", async () => {
    if (!id) return { ok: false, erro: "Agendamento não informado." };
    if (!ESTADOS[estado]) return { ok: false, erro: "Estado desconhecido." };

    const supabase = await criarClienteServidor();

    const { error } = await supabase
      .from("agendamentos")
      .update({ estado })
      .eq("id", id);

    if (error) return traduzir("mudar estado do agendamento", error);

    revalidatePath("/agenda");
    return { ok: true };
  });
}

/**
 * Apaga um agendamento de vez.
 *
 * Diferente de `estado = 'cancelado'`, que LIBERA o horário e mantém a linha:
 * aqui a linha some, e com ela o histórico daquele cliente naquele dia. É o
 * caminho certo pra horário marcado por engano, e o errado pra quem desmarcou
 * — desmarcar é fato do negócio, e o mês que vem vai querer saber quantos
 * desmarcaram.
 *
 * As compras da loja lançadas no atendimento NÃO somem junto:
 * `vendas.agendamento_id` é `on delete set null` (migração 0009). A venda
 * aconteceu, o dinheiro entrou, e apagar receita porque o agendamento saiu
 * seria o sistema mentindo sobre o caixa. Ela só perde a ligação.
 */
export async function excluirAgendamento(id: string): Promise<Resultado> {
  return protegido("excluir agendamento", async () => {
    if (!id) return { ok: false, erro: "Agendamento não informado." };

    const supabase = await criarClienteServidor();

    // Sem filtro de dono: o RLS já recusa a linha de outra barbearia.
    const { error } = await supabase.from("agendamentos").delete().eq("id", id);

    if (error) return traduzir("excluir agendamento", error);

    revalidatePath("/agenda");
    return { ok: true };
  });
}

/**
 * Aplica de uma vez as mudanças no consumo de um atendimento.
 *
 * A lista inteira vai junto de propósito: cada linha mexe no estoque, e a RPC
 * `ajustar_comanda` (migração 0011) aplica tudo ou nada. Mandar uma chamada
 * por linha deixaria o estoque pela metade se a terceira falhasse.
 *
 * Lista vazia não é erro — é o caso normal de quem abriu a comanda, olhou e
 * não mexeu em nada. Ela nem chega ao banco.
 */
export async function ajustarComanda(
  agendamentoId: string,
  mudancas: MudancaDeConsumo[],
): Promise<Resultado> {
  return protegido("ajustar comanda", async () => {
    if (mudancas.length === 0) return { ok: true };

    const supabase = await criarClienteServidor();

    const { data, error } = await supabase.rpc("ajustar_comanda", {
      p_agendamento_id: agendamentoId,
      // snake_case aqui porque quem lê é a função no banco, não a tela.
      p_mudancas: mudancas.map((m) =>
        "itemId" in m
          ? { item_id: m.itemId, quantidade: m.quantidade }
          : { produto_id: m.produtoId, quantidade: m.quantidade },
      ),
    });

    if (error) {
      console.error(
        "[BARBOS] ajustar comanda:",
        error.code ?? "",
        error.message,
      );

      if (error.message?.includes("ajustar_comanda")) {
        return {
          ok: false,
          erro: "A edição do consumo ainda não está ligada no banco. Rode a migração 0011.",
        };
      }

      return { ok: false, erro: "Não consegui salvar o consumo. Tente de novo." };
    }

    const resposta = data as { ok?: boolean; erro?: string } | null;

    if (!resposta?.ok) {
      return { ok: false, erro: resposta?.erro ?? "Não consegui salvar o consumo." };
    }

    revalidatePath("/agenda");
    // O estoque muda junto: item lançado ou removido soma e subtrai unidade.
    revalidatePath("/estoque");

    return { ok: true };
  });
}
