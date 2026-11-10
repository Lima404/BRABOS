"use server";

import { criarClienteServidor } from "@/lib/supabase/servidor";
import { traduzirErro, traduzirExcecao } from "@/lib/admin/erros";
import {
  assinarFotos,
  caminhosDasSecoes,
  secoesComFotos,
} from "@/lib/comunicados/fotos";
import {
  compararVersoes,
  ehTipoDeComunicado,
  type ComunicadoDaBarbearia,
  type NaoLidos,
  type PatchNote,
  type TipoDeComunicado,
} from "@/lib/comunicados/tipos";
import type { Consulta } from "@/lib/consulta";

/**
 * As notificações do sistema, do lado da barbearia (0044).
 *
 * "Nova" é decidido no banco (`meus_comunicados`): não lida E publicada
 * depois que a conta foi criada. A tela só lê.
 */

export type Resultado = { ok: true } | { ok: false; erro: string };

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function listarMeusComunicados(): Promise<
  Consulta<ComunicadoDaBarbearia[]>
> {
  try {
    const supabase = await criarClienteServidor();
    const { data, error } = await supabase.rpc("meus_comunicados");
    if (error) {
      return { ok: false, erro: traduzirErro("meus_comunicados", error) };
    }

    const linhas = (data ?? []) as Record<string, unknown>[];
    return {
      ok: true,
      dados: linhas
        .filter((l) => ehTipoDeComunicado(l.tipo))
        .map((l) => ({
          id: String(l.id),
          tipo: l.tipo as TipoDeComunicado,
          versao: typeof l.versao === "string" && l.versao ? l.versao : null,
          titulo: String(l.titulo ?? ""),
          texto: String(l.texto ?? ""),
          publicadoEm: String(l.publicado_em),
          atualizadoEm: String(l.atualizado_em),
          nova: l.nova === true,
        })),
    };
  } catch (erro) {
    return { ok: false, erro: traduzirExcecao("meus_comunicados", erro) };
  }
}

/** O sino e a faixa de alerta. Uma ida ao banco para os dois. */
export async function contarNaoLidos(): Promise<Consulta<NaoLidos>> {
  try {
    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .rpc("comunicados_nao_lidos")
      .maybeSingle();
    if (error) {
      return { ok: false, erro: traduzirErro("comunicados_nao_lidos", error) };
    }

    const l = (data ?? {}) as Record<string, unknown>;
    const quantidade = Number(l.quantidade);
    return {
      ok: true,
      dados: {
        quantidade: Number.isFinite(quantidade) ? quantidade : 0,
        alerta:
          typeof l.alerta_id === "string"
            ? { id: l.alerta_id, titulo: String(l.alerta_titulo ?? "") }
            : null,
      },
    };
  } catch (erro) {
    return { ok: false, erro: traduzirExcecao("comunicados_nao_lidos", erro) };
  }
}

/** Sem lista = todas (abrir a tela). Com lista = dispensar a faixa. */
export async function marcarComunicadosLidos(ids?: string[]): Promise<Resultado> {
  if (ids !== undefined && (ids.length === 0 || ids.length > 200 || !ids.every((id) => UUID.test(id)))) {
    return { ok: false, erro: "Notificação não encontrada. Recarregue a página." };
  }

  try {
    const supabase = await criarClienteServidor();
    const { error } = await supabase.rpc("marcar_comunicados_lidos", {
      p_ids: ids ?? null,
    });
    if (error) {
      return { ok: false, erro: traduzirErro("marcar_comunicados_lidos", error) };
    }
    return { ok: true };
  } catch (erro) {
    return { ok: false, erro: traduzirExcecao("marcar_comunicados_lidos", erro) };
  }
}

/**
 * Os patch notes (0045): toda atualização, da versão mais nova para a mais
 * velha, com as seções e as fotos já assinadas.
 *
 * A ordem é pela VERSÃO, não pela data: a página é a história do sistema,
 * e uma correção publicada depois numa versão velha não pode subir para o
 * topo como se fosse a mais nova.
 */
export async function listarPatchNotes(): Promise<Consulta<PatchNote[]>> {
  try {
    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("comunicados")
      .select(
        "id, tipo, versao, titulo, texto, publicado_em, atualizado_em, secoes:comunicado_secoes(ordem, titulo, texto, fotos)",
      )
      .eq("tipo", "atualizacao")
      .not("versao", "is", null)
      .limit(100);
    if (error) {
      return { ok: false, erro: traduzirErro("patch notes", error) };
    }

    type Linha = {
      id: string;
      versao: string;
      titulo: string;
      texto: string;
      publicado_em: string;
      atualizado_em: string;
      secoes: { ordem: number; titulo: unknown; texto: unknown; fotos: unknown }[] | null;
    };
    const linhas = (data ?? []) as unknown as Linha[];
    const ordenadas = linhas.map((l) => ({
      ...l,
      secoes: [...(l.secoes ?? [])].sort((a, b) => a.ordem - b.ordem),
    }));

    const assinadas = await assinarFotos(
      supabase,
      ordenadas.flatMap((l) => caminhosDasSecoes(l.secoes)),
    );

    return {
      ok: true,
      dados: ordenadas
        .map((l) => ({
          id: String(l.id),
          tipo: "atualizacao" as const,
          versao: String(l.versao),
          titulo: String(l.titulo ?? ""),
          texto: String(l.texto ?? ""),
          publicadoEm: String(l.publicado_em),
          atualizadoEm: String(l.atualizado_em),
          secoes: secoesComFotos(l.secoes, assinadas),
        }))
        .sort((a, b) => compararVersoes(b.versao, a.versao)),
    };
  } catch (erro) {
    return { ok: false, erro: traduzirExcecao("patch notes", erro) };
  }
}
