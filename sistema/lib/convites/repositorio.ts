import "server-only";

import { criarClienteServidor } from "@/lib/supabase/servidor";
import type { Convite } from "@/lib/convites/tipos";

type LinhaConvite = {
  id: string;
  codigo: string;
  expira_em: string | null;
  usos: number;
  usos_max: number | null;
  revogado: boolean;
  criado_em: string;
};

/**
 * Os convites da barbearia logada, do mais novo para o mais velho.
 *
 * Nenhuma consulta filtra `barbearia_id`: quem isola é o RLS (migração
 * 0033), como em todo o resto do sistema.
 *
 * Devolve lista vazia quando a tabela ainda não existe — a tela de link
 * continua mostrando o endereço do apelido, que não depende de nada disso.
 * Derrubar a tela inteira por causa de uma migração pendente esconderia o
 * link que a dona foi buscar.
 */
export async function listarConvites(): Promise<Convite[]> {
  const supabase = await criarClienteServidor();

  const { data, error } = await supabase
    .from("convites_agendamento")
    .select("id, codigo, expira_em, usos, usos_max, revogado, criado_em")
    .order("criado_em", { ascending: false });

  if (error) {
    console.error(
      "[BARBOS] convites indisponíveis (rode a migração 0033):",
      error.message,
    );
    return [];
  }

  return ((data ?? []) as LinhaConvite[]).map((l) => ({
    id: l.id,
    codigo: l.codigo,
    expiraEm: l.expira_em,
    usos: l.usos,
    usosMax: l.usos_max,
    revogado: l.revogado,
    criadoEm: l.criado_em,
  }));
}
