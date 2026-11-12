"use server";

import { revalidatePath } from "next/cache";

import { criarClienteServidor } from "@/lib/supabase/servidor";
import { listarConvites } from "@/lib/convites/repositorio";
import {
  APELIDO_MAXIMO,
  HORAS_VALIDAS,
  LIMITES_VALIDOS,
  type Convite,
} from "@/lib/convites/tipos";
import { telefoneCompleto, type ClienteDoTelefone } from "@/lib/clientes/tipos";
import {
  digitosDoTelefone,
  nomeDeItemParaBanco,
  nomeParaBanco,
  textoLivreParaBanco,
} from "@/lib/formato";
import {
  DURACAO_MAX,
  DURACAO_MIN,
  ESTADOS,
  PASSO_PADRAO,
  descricaoDoPasso,
  ehCorServico,
  ehPassoDeHorario,
  type EstadoAgendamento,
  type ConfiguracaoAgenda,
  type CorServico,
  type MudancaDeConsumo,
  type PassoDeHorario,
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

/** "09:30" → 570. Só depois de `HORA.test`. */
function minutosDaHora(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * A grade da barbearia (migração 0031), lida do banco.
 *
 * Coluna ausente — migração não rodada — cai no padrão de 15, que é o
 * comportamento de sempre. Uma agenda não pode parar de aceitar horário
 * porque falta uma migração.
 */
async function passoDaBarbearia(
  supabase: Awaited<ReturnType<typeof criarClienteServidor>>,
): Promise<PassoDeHorario> {
  const { data, error } = await supabase
    .from("configuracao_agenda")
    .select("passo_min")
    .maybeSingle();

  if (error) {
    console.error("[BARBOS] passo_min indisponivel:", error.message);
    return PASSO_PADRAO;
  }

  const bruto = (data as { passo_min?: unknown } | null)?.passo_min;
  return ehPassoDeHorario(bruto) ? bruto : PASSO_PADRAO;
}

/**
 * O horário cai na grade?
 *
 * Refeita aqui e não só na tela, pela mesma razão de toda validação deste
 * arquivo: uma ação de servidor é um endereço HTTP público. E a grade não é
 * enfeite — ela é o que faz a agenda do dia ser legível de relance.
 */
function foraDaGrade(horario: string, passo: PassoDeHorario): string | null {
  if (minutosDaHora(horario) % passo === 0) return null;
  return `Esta agenda marca ${descricaoDoPasso(passo)}. Escolha um horário da grade.`;
}

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
/**
 * Genérico sobre o resultado porque nem toda ação devolve só `ok`: a de
 * lote devolve QUANTAS mudaram. O que ele acrescenta é sempre
 * `{ ok: false, erro }`, que cabe em qualquer um desses formatos.
 */
async function protegido<T extends { ok: boolean }>(
  operacao: string,
  corpo: () => Promise<T>,
): Promise<T | { ok: false; erro: string }> {
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

    // A tela oferece três opções e o banco tem CHECK; esta é a terceira
    // barreira, e a única que fala português.
    if (!ehPassoDeHorario(entrada.passoMin)) {
      return {
        ok: false,
        erro: "Escolha um intervalo entre horários: 15 min, 30 min ou 1 hora.",
      };
    }
    const passoMin = entrada.passoMin;

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
        passo_min: passoMin,
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
  /**
   * Com DDD, como a máscara entrega: "(84) 99630-8743".
   *
   * Obrigatório ao marcar. Pode chegar vazio ao EDITAR um agendamento
   * anterior à migração 0037 — ver `validarAgendamento`.
   */
  clienteTelefone: string;
  /**
   * O telefone já é cliente da barbearia (a busca do formulário achou).
   * Só a tela pública usa: lá, com o cliente achado e marcando para si,
   * `clienteNome` vai vazio e o banco usa o nome do cadastro.
   */
  clienteCadastrado?: boolean;
  /**
   * Agenda interna: o nome digitado é diferente do cadastro e a barbearia
   * marcou "Corrigir o nome no cadastro". Sem a marca, o nome diferente
   * vira quem é atendido NESTE horário, e o cadastro fica como está — o
   * avulso no número do barbeiro não pode renomear o barbeiro.
   */
  corrigirCadastro?: boolean;
  servicoId: string;
  /** Barbeiro que atende. */
  barbeiroId: string;
  /** AAAA-MM-DD */
  data: string;
  /** HH:MM */
  horario: string;
  observacao?: string;
};

/**
 * O cliente deste telefone, com o nome inteiro — a agenda é da própria
 * barbearia, e o RLS garante que a busca só alcança os clientes dela.
 *
 * Nunca estoura: "falhou" faz o formulário seguir como antes, pedindo o
 * nome. Quem barra de verdade é o salvar.
 */
export async function buscarClienteDaAgenda(
  telefone: string,
): Promise<ClienteDoTelefone> {
  try {
    const digitos = digitosDoTelefone(telefone ?? "");
    if (!telefoneCompleto(digitos)) return { estado: "novo" };

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase.rpc("buscar_cliente", {
      p_telefone: digitos,
    });

    if (error) {
      console.error("[BARBOS] busca de cliente:", error.code ?? "", error.message);
      return { estado: "falhou" };
    }

    const cliente = data as { nome?: string } | null;
    return cliente?.nome
      ? { estado: "achou", nome: cliente.nome }
      : { estado: "novo" };
  } catch (erro) {
    console.error("[BARBOS] busca de cliente lançou exceção:", erro);
    return { estado: "falhou" };
  }
}

/**
 * Acha ou cria o cliente pelo telefone e diz quem é atendido (0042).
 *
 * Quem decide "é o mesmo nome?" é o banco (`salvar_cliente`), com a mesma
 * regra da tela pública. Nome diferente do cadastro vira `nomeAtendido` —
 * a menos que a barbearia tenha marcado "corrigir o cadastro", e aí o
 * cadastro é renomeado.
 */
async function salvarCliente(
  supabase: Awaited<ReturnType<typeof criarClienteServidor>>,
  telefone: string,
  nome: string,
  corrigir: boolean,
): Promise<
  { ok: true; id: string; nomeAtendido: string | null } | { ok: false; erro: string }
> {
  const { data, error } = await supabase.rpc("salvar_cliente", {
    p_telefone: telefone,
    p_nome: nome,
    p_corrigir: corrigir,
  });

  if (error) {
    if (error.code === "PGRST202" || error.message?.includes("salvar_cliente")) {
      console.error("[BARBOS] salvar cliente:", error.code ?? "", error.message);
      return {
        ok: false,
        erro: "O cadastro de clientes ainda não está ligado no banco. Rode a migração 0042.",
      };
    }
    const traduzido = traduzir("salvar cliente", error);
    return { ok: false, erro: traduzido.ok ? "Não consegui salvar." : traduzido.erro };
  }

  const resposta = data as { id?: string; nomeAtendido?: string | null } | null;
  if (!resposta?.id) {
    return { ok: false, erro: "Informe o telefone do cliente com DDD (10 ou 11 dígitos)." };
  }
  return { ok: true, id: resposta.id, nomeAtendido: resposta.nomeAtendido ?? null };
}

/**
 * As colunas de "quem" de um agendamento da agenda da barbearia.
 *
 * Com telefone: aponta para o cliente (acha, cria ou renomeia) e guarda
 * `nome_atendido` quando quem senta não é o dono do telefone.
 * Sem telefone (opcional na agenda desde a 0047): sem cadastro, só o nome
 * em `cliente_nome`. É o "um ou outro" que a 0043 cobra no banco.
 */
async function quemSentaNaCadeira(
  supabase: Awaited<ReturnType<typeof criarClienteServidor>>,
  d: DadosAgendamento,
): Promise<
  | {
      ok: true;
      colunas:
        | { cliente_id: string; cliente_nome: null; nome_atendido: string | null }
        | { cliente_id: null; cliente_nome: string; nome_atendido: null };
    }
  | { ok: false; erro: string }
> {
  if (digitosDoTelefone(d.clienteTelefone ?? "").length === 0) {
    return {
      ok: true,
      colunas: {
        cliente_id: null,
        cliente_nome: nomeParaBanco(d.clienteNome),
        nome_atendido: null,
      },
    };
  }

  const cliente = await salvarCliente(
    supabase,
    d.clienteTelefone,
    nomeParaBanco(d.clienteNome),
    Boolean(d.corrigirCadastro),
  );
  if (!cliente.ok) return cliente;
  return {
    ok: true,
    colunas: {
      cliente_id: cliente.id,
      cliente_nome: null,
      nome_atendido: cliente.nomeAtendido,
    },
  };
}

/**
 * Na agenda da barbearia o telefone é OPCIONAL, ao marcar e ao editar
 * (pedido do Gabriel em 12/11/2026, migração 0047): o avulso que chegou
 * na porta ou ligou nem sempre deixa número. Sem telefone, o agendamento
 * guarda só o nome (`cliente_nome`), sem cadastro de cliente — o mesmo
 * formato dos antigos de antes da 0037. O formato continua cobrado: se
 * veio algo, tem que ser telefone com DDD.
 *
 * Consequência: editar e APAGAR o telefone solta o agendamento do
 * cliente (fica só o nome; o cadastro continua lá). É a própria barbearia
 * mexendo nos dados dela; o RLS já garante que é na dela.
 *
 * A página pública NÃO passa por aqui: lá o telefone continua obrigatório
 * (`app/(sistema)/agendar/acoes.ts` e a RPC pública).
 */
function validarAgendamento(d: DadosAgendamento): string | null {
  // Depois de sanitizar: quem mandou só "###" enviou três caracteres e não
  // sobrou nenhum. Aceitar isso gravaria um agendamento sem nome.
  const cliente = nomeParaBanco(d.clienteNome);

  if (cliente.length === 0) {
    return "Informe o nome do cliente com letras ou números.";
  }
  if (cliente.length > 80) {
    return "O nome do cliente está longo demais.";
  }

  // Opcional, mas se veio tem que ser telefone. Cobrado AQUI e não só na
  // tela: ação de servidor é endereço HTTP público.
  const digitos = digitosDoTelefone(d.clienteTelefone ?? "");
  if (digitos.length > 0 && (digitos.length < 10 || digitos.length > 11)) {
    return "Informe o telefone do cliente com DDD (10 ou 11 dígitos).";
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

    // A grade da barbearia (migração 0031). Refeita aqui e não só na tela:
    // ação de servidor é endereço HTTP público, e o `step` do campo de hora
    // é conveniência de quem digita, não barreira.
    const desencaixado = foraDaGrade(
      d.horario,
      await passoDaBarbearia(supabase),
    );
    if (desencaixado) return { ok: false, erro: desencaixado };

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

    const observacao = textoLivreParaBanco(d.observacao ?? "");

    // Com telefone, o cliente primeiro: o agendamento aponta para ele
    // (0042). Se o horário for recusado logo abaixo, o cadastro fica — ele
    // vale para a próxima marcação, e é a barbearia mexendo nos dados dela.
    // Sem telefone (opcional aqui desde a 0047), não há cadastro: o
    // agendamento guarda só o nome — o "um ou outro" que a 0043 cobra.
    const quem = await quemSentaNaCadeira(supabase, d);
    if (!quem.ok) return quem;

    const { error } = await supabase.from("agendamentos").insert({
      barbearia_id: user.id,
      // Nome e telefone moram no cadastro do cliente, guardados uma vez;
      // `nome_atendido` só quando quem senta não é o dono do telefone.
      ...quem.colunas,
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
      // O gatilho da 0043 sem o ajuste da 0047: marcar sem telefone ainda
      // é recusado pelo banco.
      if (error.code === "23502" && error.message?.includes("precisa de um cliente")) {
        console.error("[BARBOS] criar agendamento:", error.message);
        return {
          ok: false,
          erro: "Marcar sem telefone ainda não está ligado no banco. Informe o telefone ou rode a migração 0047.",
        };
      }
      // Antes do `42703` genérico: coluna que falta é SEMPRE 42703, e a
      // mensagem de baixo mandaria rodar a 0015 por causa da 0042.
      if (error.message?.includes("cliente_id")) {
        return {
          ok: false,
          erro: "O cadastro de clientes ainda não está ligado no banco. Rode a migração 0042.",
        };
      }
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

    // A grade da barbearia (migração 0031). Refeita aqui e não só na tela:
    // ação de servidor é endereço HTTP público, e o `step` do campo de hora
    // é conveniência de quem digita, não barreira.
    const desencaixado = foraDaGrade(
      d.horario,
      await passoDaBarbearia(supabase),
    );
    if (desencaixado) return { ok: false, erro: desencaixado };

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

    const observacao = textoLivreParaBanco(d.observacao ?? "");

    // Com telefone, o agendamento aponta para o cliente (acha, cria ou
    // renomeia). Sem telefone, fica só com o nome — ver `quemSentaNaCadeira`.
    const quem = await quemSentaNaCadeira(supabase, d);
    if (!quem.ok) return quem;

    // Sem filtro de dono: o RLS já recusa a linha de outra barbearia.
    const { error } = await supabase
      .from("agendamentos")
      .update({
        ...quem.colunas,
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
      // Antes do `42703` genérico: coluna que falta é SEMPRE 42703, e a
      // mensagem de baixo mandaria rodar a 0015 por causa da 0042.
      if (error.message?.includes("cliente_id")) {
        return {
          ok: false,
          erro: "O cadastro de clientes ainda não está ligado no banco. Rode a migração 0042.",
        };
      }
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

export type ResultadoEmLote =
  | { ok: true; quantos: number }
  | { ok: false; erro: string };

/**
 * Teto de ids por chamada.
 *
 * Um dia de barbearia não passa de algumas dezenas de horários. O teto
 * existe porque a ação aceita o que mandarem — e um `in` com dez mil ids
 * é uma consulta que ninguém da tela conseguiria pedir.
 */
const TETO_DO_LOTE = 120;

/**
 * Muda o estado de vários agendamentos de uma vez.
 *
 * Uma consulta só, e não uma por linha: a chave do topo da agenda fecha o
 * dia inteiro: com uma chamada por horário, a sétima falhando deixaria
 * seis concluídos e nenhum aviso de onde parou.
 *
 * Devolve QUANTAS mudaram, lido do retorno do banco e não do que a tela
 * mandou. Id de outra barbearia simplesmente não casa (RLS), e aí o número
 * é menor que o pedido — é assim que o aviso na tela fala a verdade em vez
 * de repetir o que foi pedido.
 */
export async function mudarEstadoDeVariosAgendamentos(
  ids: string[],
  estado: EstadoAgendamento,
): Promise<ResultadoEmLote> {
  const resultado = await protegido("mudar estado em lote", async () => {
    if (!ESTADOS[estado]) {
      return { ok: false as const, erro: "Estado desconhecido." };
    }

    const limpos = [...new Set(ids.filter((id) => typeof id === "string" && id))]
      .slice(0, TETO_DO_LOTE);

    if (limpos.length === 0) {
      return { ok: false as const, erro: "Nenhum atendimento para mudar." };
    }

    const supabase = await criarClienteServidor();

    const { data, error } = await supabase
      .from("agendamentos")
      .update({ estado })
      .in("id", limpos)
      .select("id");

    if (error) return traduzir("mudar estado em lote", error);

    revalidatePath("/agenda");
    return { ok: true as const, quantos: data?.length ?? 0 };
  });

  return resultado as ResultadoEmLote;
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
 * O consumo lançado no atendimento SOME JUNTO, e as unidades voltam pro
 * estoque (RPC `excluir_agendamento`, migração 0026). Compra lançada num
 * agendamento só entra no caixa quando ele é concluído — se o atendimento
 * nunca vai existir, ela também não. Quem quer guardar a venda lança de novo
 * como avulsa, pela loja.
 *
 * Um delete direto na tabela não serve mais: ele deixaria a venda para trás,
 * e `vendas.agendamento_id` órfão é indistinguível de compra avulsa — a
 * receita voltaria sozinha ao caixa, que era o bug.
 */
export async function excluirAgendamento(id: string): Promise<Resultado> {
  return protegido("excluir agendamento", async () => {
    if (!id) return { ok: false, erro: "Agendamento não informado." };

    const supabase = await criarClienteServidor();

    const { data, error } = await supabase.rpc("excluir_agendamento", {
      p_id: id,
    });

    if (error) {
      if (error.message?.includes("excluir_agendamento")) {
        return {
          ok: false,
          erro: "A exclusão de agendamento ainda não está ligada no banco. Rode a migração 0026.",
        };
      }

      return traduzir("excluir agendamento", error);
    }

    const resposta = data as {
      ok?: boolean;
      erro?: string;
      unidadesDevolvidas?: number;
    } | null;

    if (!resposta?.ok) {
      return { ok: false, erro: resposta?.erro ?? "Não consegui excluir o agendamento." };
    }

    revalidatePath("/agenda");
    // O estoque muda junto quando havia consumo lançado.
    if ((resposta.unidadesDevolvidas ?? 0) > 0) revalidatePath("/estoque");

    return {
      ok: true,
      aviso:
        (resposta.unidadesDevolvidas ?? 0) > 0
          ? `${resposta.unidadesDevolvidas} un. voltaram para o estoque.`
          : undefined,
    };
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


// ============================================================
// Convites de agendamento (migração 0033)
// ============================================================

export type ResultadoConvite =
  | { ok: true; convite: Convite }
  | { ok: false; erro: string };

/**
 * Lista os convites da barbearia.
 *
 * Ação de servidor e não rota `/api/`: a tela de link vive dentro do modal
 * da agenda, abre a pedido, e a ação chega pelo caminho da própria página —
 * um caminho a menos para dar errado.
 */
export async function listarConvitesDaAgenda(): Promise<Convite[]> {
  return listarConvites();
}

/**
 * Gera um convite.
 *
 * O CÓDIGO é sorteado pelo banco (`gerar_codigo_convite`, 0033), nunca aqui:
 * só lá dentro dá para conferir que ele não repete nem bate com apelido de
 * barbearia nenhuma — o RLS esconderia dos olhos daqui exatamente as linhas
 * que precisariam ser comparadas.
 */
export async function criarConvite(entrada: {
  /** Horas de validade. `null` = não expira. */
  horas: number | null;
  /** `null` = ilimitado. */
  usosMax: number | null;
  /** Opcional: quem gera às pressas no balcão não para para batizar. */
  apelido?: string;
}): Promise<ResultadoConvite> {
  try {
    if (!HORAS_VALIDAS.includes(entrada.horas)) {
      return { ok: false, erro: "Escolha uma validade da lista." };
    }
    if (!LIMITES_VALIDOS.includes(entrada.usosMax)) {
      return { ok: false, erro: "Escolha um limite de usos da lista." };
    }

    const supabase = await criarClienteServidor();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, erro: "Sessão expirada. Entre de novo." };

    const expiraEm =
      entrada.horas === null
        ? null
        : new Date(Date.now() + entrada.horas * 3_600_000).toISOString();

    const { data, error } = await supabase
      .from("convites_agendamento")
      .insert({
        barbearia_id: user.id,
        apelido: apelidoParaBanco(entrada.apelido),
        expira_em: expiraEm,
        usos_max: entrada.usosMax,
      })
      .select(
        "id, apelido, codigo, expira_em, usos, usos_max, revogado, criado_em",
      )
      .single();

    if (error) {
      console.error("[BARBOS] criar convite:", error.code ?? "", error.message);

      if (error.code === "PGRST205" || error.message?.includes("convites_agendamento")) {
        return {
          ok: false,
          erro: "Os convites ainda não estão ligados no banco. Rode a migração 0033.",
        };
      }
      return { ok: false, erro: "Não consegui gerar o link agora. Tente de novo." };
    }

    revalidatePath("/agenda");

    return {
      ok: true,
      convite: {
        id: data.id,
        apelido: data.apelido,
        codigo: data.codigo,
        expiraEm: data.expira_em,
        usos: data.usos,
        usosMax: data.usos_max,
        revogado: data.revogado,
        criadoEm: data.criado_em,
      },
    };
  } catch (erro) {
    console.error("[BARBOS] criar convite lançou exceção:", erro);
    return { ok: false, erro: "Não consegui falar com o servidor." };
  }
}

/**
 * O nome do convite, pronto para o banco.
 *
 * `null` e nunca string vazia: o CHECK da 0034 recusa o vazio, e com as duas
 * formas válidas a tela precisaria testar as duas em todo lugar que mostra o
 * nome — e esqueceria numa delas.
 *
 * Passa pelo mesmo `nomeParaBanco` do resto do sistema: maiúscula, sem
 * acento, espaço duplo colapsado. Um nome que se escreve diferente do nome
 * do serviço ao lado não parece do mesmo sistema.
 */
function apelidoParaBanco(bruto: string | undefined): string | null {
  const limpo = nomeParaBanco(bruto ?? "").slice(0, APELIDO_MAXIMO).trim();
  return limpo.length > 0 ? limpo : null;
}

/** Renomeia — ou tira o nome, quando o campo volta a ficar vazio. */
export async function renomearConvite(
  id: string,
  apelido: string,
): Promise<Resultado> {
  return protegido("renomear convite", async () => {
    if (!id) return { ok: false, erro: "Convite não informado." };

    const supabase = await criarClienteServidor();
    const { error } = await supabase
      .from("convites_agendamento")
      .update({ apelido: apelidoParaBanco(apelido) })
      .eq("id", id);

    if (error) return traduzir("renomear convite", error);

    revalidatePath("/agenda");
    return { ok: true };
  });
}

/**
 * Apaga o convite de vez.
 *
 * Diferente de desligar, e a diferença importa para quem está do outro lado:
 * desligado, o link responde "a barbearia desativou esse link"; apagado, ele
 * responde "esse link não existe" — e quem recebeu o papel semana passada
 * acha que digitou errado e fica tentando.
 *
 * Por isso a tela explica isso antes de apagar, em vez de só perguntar "tem
 * certeza?", que não dá o que conferir.
 *
 * Os AGENDAMENTOS marcados por este link ficam. Não existe chave de
 * `agendamentos` para cá: o convite contava usos, não era dono de nada. O
 * que se perde é a contagem.
 */
export async function excluirConvite(id: string): Promise<Resultado> {
  return protegido("excluir convite", async () => {
    if (!id) return { ok: false, erro: "Convite não informado." };

    const supabase = await criarClienteServidor();
    const { error } = await supabase
      .from("convites_agendamento")
      .delete()
      .eq("id", id);

    if (error) return traduzir("excluir convite", error);

    revalidatePath("/agenda");
    return { ok: true };
  });
}

/**
 * Liga e desliga um convite.
 *
 * Marca `revogado` em vez de apagar a linha, por dois motivos. Quem recebeu
 * o papel semana passada merece ler "a barbearia desativou esse link" e não
 * "link não encontrado" — a segunda frase faz a pessoa achar que digitou
 * errado e ficar tentando. E, guardada a linha, desligar deixa de ser
 * irreversível: por isso é um interruptor e não um "excluir", e por isso
 * não pede confirmação. Nada se perde no caminho.
 */
export async function alternarConvite(
  id: string,
  revogado: boolean,
): Promise<Resultado> {
  return protegido("alternar convite", async () => {
    if (!id) return { ok: false, erro: "Convite não informado." };

    const supabase = await criarClienteServidor();
    const { error } = await supabase
      .from("convites_agendamento")
      .update({ revogado })
      .eq("id", id);

    if (error) return traduzir("alternar convite", error);

    revalidatePath("/agenda");
    return { ok: true };
  });
}
