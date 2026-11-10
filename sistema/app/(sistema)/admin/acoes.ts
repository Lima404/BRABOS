"use server";

import { criarClienteServidor } from "@/lib/supabase/servidor";
import { traduzirErro, traduzirExcecao } from "@/lib/admin/erros";
import type {
  BarbeariaNoPainel,
  MovimentoDaBarbearia,
  SituacaoPagamento,
} from "@/lib/admin/tipos";
import {
  assinarFotos,
  BUCKET_DAS_FOTOS,
  caminhosDasSecoes,
  secoesComFotos,
} from "@/lib/comunicados/fotos";
import {
  AREA_MAX,
  CAMINHO_DE_FOTO,
  ehTipoDeComunicado,
  FOTOS_POR_SECAO,
  normalizarLink,
  ROTULO_DO_LINK_MAX,
  SECOES_MAX,
  TEXTO_MAX,
  TITULO_MAX,
  VERSAO_VALIDA,
  type ComunicadoDoAdmin,
  type TipoDeComunicado,
} from "@/lib/comunicados/tipos";
import type { Consulta } from "@/lib/consulta";

/**
 * O Painel Admin (0044).
 *
 * Ação de servidor é endereço HTTP público: qualquer conta logada consegue
 * chamar estas funções. Quem barra é o BANCO — as funções `admin_*` começam
 * por `sou_admin()` e respondem 42501, e a tabela `comunicados` só aceita
 * escrita do admin pelo RLS. Nada aqui confere "é admin?" por conta
 * própria: uma checagem na aplicação seria a que alguém esquece de copiar
 * para a próxima ação.
 */

export type Resultado = { ok: true } | { ok: false; erro: string };

const SITUACOES: readonly SituacaoPagamento[] = [
  "em_dia",
  "liberada",
  "tolerancia",
  "bloqueada",
];

const DATA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function texto(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function inteiro(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export async function listarBarbeariasDoPainel(): Promise<
  Consulta<BarbeariaNoPainel[]>
> {
  try {
    const supabase = await criarClienteServidor();
    const { data, error } = await supabase.rpc("admin_barbearias");
    if (error) {
      return { ok: false, erro: traduzirErro("admin_barbearias", error) };
    }

    const linhas = (data ?? []) as Record<string, unknown>[];
    return {
      ok: true,
      dados: linhas.map((l) => ({
        id: String(l.id),
        nome: String(l.nome ?? ""),
        slug: String(l.slug ?? ""),
        telefone: texto(l.telefone),
        email: texto(l.email),
        criadaEm: String(l.criada_em),
        ultimoAcesso: texto(l.ultimo_acesso),
        admin: l.admin === true,
        pagamentoAtivo: l.pagamento_ativo === true,
        plano: texto(l.plano),
        valeAte: texto(l.vale_ate),
        // Valor fora da lista cai em "bloqueada": na dúvida, a tela mostra
        // o pior caso, que é o que manda o admin olhar.
        situacao: SITUACOES.includes(l.situacao as SituacaoPagamento)
          ? (l.situacao as SituacaoPagamento)
          : "bloqueada",
      })),
    };
  } catch (erro) {
    return { ok: false, erro: traduzirExcecao("admin_barbearias", erro) };
  }
}

/** `fim` é exclusivo, o mesmo contrato do dashboard. */
export async function obterMovimentoDoPainel(
  inicio: string,
  fim: string,
): Promise<Consulta<MovimentoDaBarbearia[]>> {
  if (!DATA.test(inicio) || !DATA.test(fim) || fim <= inicio) {
    return { ok: false, erro: "Período inválido. Escolha as datas de novo." };
  }

  try {
    const supabase = await criarClienteServidor();
    const { data, error } = await supabase.rpc("admin_movimento", {
      p_inicio: inicio,
      p_fim: fim,
    });
    if (error) {
      return { ok: false, erro: traduzirErro("admin_movimento", error) };
    }

    const linhas = (data ?? []) as Record<string, unknown>[];
    return {
      ok: true,
      dados: linhas.map((l) => ({
        barbeariaId: String(l.barbearia_id),
        agendamentos: inteiro(l.agendamentos),
        atendimentos: inteiro(l.atendimentos),
        servicoCentavos: inteiro(l.servico_centavos),
        vendas: inteiro(l.vendas),
        lojaCentavos: inteiro(l.loja_centavos),
      })),
    };
  } catch (erro) {
    return { ok: false, erro: traduzirExcecao("admin_movimento", erro) };
  }
}

type SecaoCrua = {
  titulo: unknown;
  texto: unknown;
  fotos: unknown;
  link?: unknown;
  link_rotulo?: unknown;
};

export async function listarComunicadosDoAdmin(): Promise<
  Consulta<ComunicadoDoAdmin[]>
> {
  try {
    const supabase = await criarClienteServidor();
    const { data, error } = await supabase.rpc("admin_comunicados");
    if (error) {
      return { ok: false, erro: traduzirErro("admin_comunicados", error) };
    }

    const linhas = ((data ?? []) as Record<string, unknown>[]).filter((l) =>
      ehTipoDeComunicado(l.tipo),
    );
    const secoesDe = (l: Record<string, unknown>) =>
      (Array.isArray(l.secoes) ? l.secoes : []) as SecaoCrua[];

    // As fotos de TODAS as notificações numa assinatura só.
    const assinadas = await assinarFotos(
      supabase,
      linhas.flatMap((l) => caminhosDasSecoes(secoesDe(l))),
    );

    return {
      ok: true,
      dados: linhas.map((l) => ({
        id: String(l.id),
        tipo: l.tipo as TipoDeComunicado,
        versao: texto(l.versao),
        titulo: String(l.titulo ?? ""),
        texto: String(l.texto ?? ""),
        publicadoEm: String(l.publicado_em),
        atualizadoEm: String(l.atualizado_em),
        lidos: inteiro(l.lidos),
        publico: inteiro(l.publico),
        secoes: secoesComFotos(secoesDe(l), assinadas),
      })),
    };
  } catch (erro) {
    return { ok: false, erro: traduzirExcecao("admin_comunicados", erro) };
  }
}

/**
 * O texto das notificações vai como o admin escreveu: com acento, ç,
 * maiúscula, pontuação e espaços. É a EXCEÇÃO à regra "nenhum input
 * aceita acento", pedida pelo Gabriel em 10/11/2026 — é texto de leitura,
 * escrito por uma pessoa só, e "evoluÇao" no patch note não se lê.
 *
 * Só sai o que não é texto: o `\r` do Windows (a quebra de linha é `\n`)
 * e o caractere nulo, que o Postgres recusa. As pontas são aparadas para
 * o vazio poder ser conferido: quem mandou só espaços não mandou nada.
 * A tela mostra o texto como texto (o React escapa), então nada aqui
 * vira HTML.
 */
function comoEscrito(bruto: unknown): string {
  return String(bruto ?? "")
    .replace(/\r/g, "")
    .replace(/\u0000/g, "")
    .trim();
}

/** Título e texto: as duas regras que alerta e atualização dividem. */
function validarTituloETexto(
  tituloBruto: unknown,
  textoBruto: unknown,
): { ok: true; titulo: string; texto: string } | { ok: false; erro: string } {
  const titulo = comoEscrito(tituloBruto);
  const corpo = comoEscrito(textoBruto);

  if (!titulo) return { ok: false, erro: "Escreva o título." };
  if (titulo.length > TITULO_MAX) {
    return { ok: false, erro: `O título passa de ${TITULO_MAX} letras.` };
  }
  if (!corpo) return { ok: false, erro: "Escreva o texto." };
  if (corpo.length > TEXTO_MAX) {
    return { ok: false, erro: `O texto passa de ${TEXTO_MAX} letras.` };
  }
  return { ok: true, titulo, texto: corpo };
}

/** Publica (sem `id`) ou corrige (com `id`) um ALERTA. */
export async function salvarAlerta(entrada: {
  id?: string;
  titulo: string;
  texto: string;
}): Promise<Resultado> {
  if (entrada.id !== undefined && !UUID.test(entrada.id)) {
    return { ok: false, erro: "Notificação não encontrada. Recarregue a página." };
  }
  const v = validarTituloETexto(entrada.titulo, entrada.texto);
  if (!v.ok) return v;

  try {
    const supabase = await criarClienteServidor();
    const linha = { tipo: "alerta", titulo: v.titulo, texto: v.texto };

    if (entrada.id) {
      const { data, error } = await supabase
        .from("comunicados")
        .update(linha)
        .eq("id", entrada.id)
        // Editar um alerta nunca transforma uma atualização em alerta.
        .eq("tipo", "alerta")
        .select("id");
      if (error) return { ok: false, erro: traduzirErro("editar alerta", error) };
      // O RLS não dá erro para quem não pode editar: só não acha a linha.
      if (!data || data.length === 0) {
        return {
          ok: false,
          erro: "Não consegui salvar: o alerta não existe mais ou esta conta não é a admin.",
        };
      }
      return { ok: true };
    }

    const { error } = await supabase.from("comunicados").insert(linha);
    if (error) return { ok: false, erro: traduzirErro("publicar alerta", error) };
    return { ok: true };
  } catch (erro) {
    return { ok: false, erro: traduzirExcecao("salvar alerta", erro) };
  }
}

/**
 * Publica (sem `id`) ou corrige (com `id`) um PATCH NOTE inteiro: versão,
 * título, resumo e seções, numa chamada só (`salvar_atualizacao`, 0045).
 *
 * As fotos já subiram para o bucket pela tela; aqui chegam só os caminhos.
 * Corrigindo, as fotos que saíram da versão são apagadas do bucket DEPOIS
 * que a gravação deu certo — antes, uma falha no meio deixaria o patch
 * note apontando para foto que não existe mais.
 */
export async function salvarAtualizacao(entrada: {
  id?: string;
  versao: string;
  titulo: string;
  texto: string;
  secoes: {
    titulo: string;
    texto: string;
    fotos: string[];
    link?: string;
    rotuloDoLink?: string;
  }[];
}): Promise<Resultado> {
  if (entrada.id !== undefined && !UUID.test(entrada.id)) {
    return { ok: false, erro: "Atualização não encontrada. Recarregue a página." };
  }

  const versao = String(entrada.versao ?? "").trim();
  if (!VERSAO_VALIDA.test(versao)) {
    return { ok: false, erro: "Escreva a versão com números e pontos: 1.0, 1.1 ou 1.2.3." };
  }
  const v = validarTituloETexto(entrada.titulo, entrada.texto);
  if (!v.ok) return v;

  const brutas = Array.isArray(entrada.secoes) ? entrada.secoes : [];
  if (brutas.length === 0) return { ok: false, erro: "Adicione pelo menos uma seção." };
  if (brutas.length > SECOES_MAX) {
    return { ok: false, erro: `No máximo ${SECOES_MAX} seções por versão.` };
  }

  const secoes: {
    titulo: string;
    texto: string;
    fotos: string[];
    link: string | null;
    link_rotulo: string | null;
  }[] = [];
  for (const [i, s] of brutas.entries()) {
    const titulo = comoEscrito(s?.titulo);
    const corpo = comoEscrito(s?.texto);
    const fotos = Array.isArray(s?.fotos) ? s.fotos.map(String) : [];
    const n = i + 1;

    if (!titulo) return { ok: false, erro: `Dê um nome à seção ${n}.` };
    if (titulo.length > AREA_MAX) {
      return { ok: false, erro: `O nome da seção ${n} passa de ${AREA_MAX} letras.` };
    }
    if (!corpo) return { ok: false, erro: `Escreva o texto da seção ${n}.` };
    if (corpo.length > TEXTO_MAX) {
      return { ok: false, erro: `O texto da seção ${n} passa de ${TEXTO_MAX} letras.` };
    }
    if (fotos.length > FOTOS_POR_SECAO) {
      return { ok: false, erro: `A seção ${n} passa de ${FOTOS_POR_SECAO} fotos.` };
    }
    if (!fotos.every((f) => CAMINHO_DE_FOTO.test(f))) {
      return { ok: false, erro: "Uma das fotos não subiu direito. Tire e envie de novo." };
    }

    // O link é opcional. Digitado, precisa virar um endereço que o banco
    // aceite; o rótulo sem link não tem botão onde morar e cai junto.
    const linkDigitado = comoEscrito(s?.link);
    const link = linkDigitado ? normalizarLink(linkDigitado) : null;
    if (linkDigitado && !link) {
      return {
        ok: false,
        erro: `O link da seção ${n} não é um endereço válido. Use um site (https://…) ou uma tela do sistema, como /agenda.`,
      };
    }
    const rotulo = link ? comoEscrito(s?.rotuloDoLink) || null : null;
    if (rotulo && rotulo.length > ROTULO_DO_LINK_MAX) {
      return {
        ok: false,
        erro: `O texto do botão da seção ${n} passa de ${ROTULO_DO_LINK_MAX} letras.`,
      };
    }

    secoes.push({ titulo, texto: corpo, fotos, link, link_rotulo: rotulo });
  }

  try {
    const supabase = await criarClienteServidor();

    // As fotos que a versão tinha antes, para apagar as que saírem.
    let antigas: string[] = [];
    if (entrada.id) {
      const { data } = await supabase
        .from("comunicado_secoes")
        .select("fotos")
        .eq("comunicado_id", entrada.id);
      antigas = caminhosDasSecoes((data ?? []) as { fotos: unknown }[]);
    }

    const { error } = await supabase.rpc("salvar_atualizacao", {
      p_id: entrada.id ?? null,
      p_versao: versao,
      p_titulo: v.titulo,
      p_texto: v.texto,
      p_secoes: secoes,
    });

    if (error) {
      if (error.code === "22023" && error.message?.includes("versao precisa ser maior")) {
        console.error("[BARBOS] salvar atualização:", error.message);
        return {
          ok: false,
          erro: `A versão precisa ser maior que a atual (${error.details || "a última publicada"}).`,
        };
      }
      if (error.code === "23505") {
        console.error("[BARBOS] salvar atualização:", error.message);
        return { ok: false, erro: `A versão ${versao} já foi publicada. Use outro número.` };
      }
      if (error.code === "P0002") {
        return { ok: false, erro: "Essa atualização não existe mais. Recarregue a página." };
      }
      return { ok: false, erro: traduzirErro("salvar atualização", error) };
    }

    const ficaram = new Set(secoes.flatMap((s) => s.fotos));
    const sairam = antigas.filter((f) => !ficaram.has(f));
    if (sairam.length > 0) {
      const { error: erroFotos } = await supabase.storage
        .from(BUCKET_DAS_FOTOS)
        .remove(sairam);
      // A versão está salva; foto esquecida no bucket não aparece em lugar
      // nenhum. Vai para o log, não para a tela.
      if (erroFotos) console.error("[BARBOS] apagar fotos antigas:", erroFotos.message);
    }

    return { ok: true };
  } catch (erro) {
    return { ok: false, erro: traduzirExcecao("salvar atualização", erro) };
  }
}

/**
 * Fotos que subiram num formulário que foi cancelado. Apaga só as que
 * NENHUMA seção usa — se a mesma foto já estiver gravada numa versão, ela
 * fica, mesmo que a tela peça.
 */
export async function descartarFotos(caminhos: string[]): Promise<Resultado> {
  const validos = (Array.isArray(caminhos) ? caminhos : [])
    .map(String)
    .filter((c) => CAMINHO_DE_FOTO.test(c))
    .slice(0, 200);
  if (validos.length === 0) return { ok: true };

  try {
    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("comunicado_secoes")
      .select("fotos")
      .overlaps("fotos", validos);
    if (error) return { ok: false, erro: traduzirErro("conferir fotos", error) };

    const emUso = new Set(caminhosDasSecoes((data ?? []) as { fotos: unknown }[]));
    const soltas = validos.filter((c) => !emUso.has(c));
    if (soltas.length === 0) return { ok: true };

    const { error: erroFotos } = await supabase.storage
      .from(BUCKET_DAS_FOTOS)
      .remove(soltas);
    if (erroFotos) {
      console.error("[BARBOS] descartar fotos:", erroFotos.message);
      return { ok: false, erro: "Não consegui apagar as fotos enviadas." };
    }
    return { ok: true };
  } catch (erro) {
    return { ok: false, erro: traduzirExcecao("descartar fotos", erro) };
  }
}

/**
 * Apaga a notificação. Sendo um patch note, as fotos dele saem do bucket
 * depois — o `on delete cascade` leva as seções, mas o Storage não sabe
 * nada do banco.
 */
export async function apagarComunicado(id: string): Promise<Resultado> {
  if (!UUID.test(id)) {
    return { ok: false, erro: "Notificação não encontrada. Recarregue a página." };
  }

  try {
    const supabase = await criarClienteServidor();

    const { data: secoes } = await supabase
      .from("comunicado_secoes")
      .select("fotos")
      .eq("comunicado_id", id);
    const fotos = caminhosDasSecoes((secoes ?? []) as { fotos: unknown }[]);

    const { data, error } = await supabase
      .from("comunicados")
      .delete()
      .eq("id", id)
      .select("id");
    if (error) return { ok: false, erro: traduzirErro("apagar comunicado", error) };
    if (!data || data.length === 0) {
      return {
        ok: false,
        erro: "Não consegui apagar: a notificação já tinha saído ou esta conta não é a admin.",
      };
    }

    if (fotos.length > 0) {
      const { error: erroFotos } = await supabase.storage
        .from(BUCKET_DAS_FOTOS)
        .remove(fotos);
      if (erroFotos) console.error("[BARBOS] apagar fotos do patch note:", erroFotos.message);
    }
    return { ok: true };
  } catch (erro) {
    return { ok: false, erro: traduzirExcecao("apagar comunicado", erro) };
  }
}
