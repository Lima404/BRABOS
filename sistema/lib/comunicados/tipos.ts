/**
 * Notificações do sistema (migração 0044).
 *
 * Na tela o nome é "Notificações"; no banco e no código é "comunicado",
 * porque `lib/notificacoes/` já é outra coisa: o aviso no celular quando um
 * cliente marca horário pelo link (0035).
 */

export type TipoDeComunicado = "atualizacao" | "alerta";

export type Comunicado = {
  id: string;
  tipo: TipoDeComunicado;
  /** Só na atualização (0045): "1.0", "1.1", "1.2.3". Alerta não tem. */
  versao: string | null;
  titulo: string;
  texto: string;
  /** timestamptz */
  publicadoEm: string;
  /** timestamptz */
  atualizadoEm: string;
};

/** Do lado da barbearia: a mesma notificação, sabendo se é nova para ela. */
export type ComunicadoDaBarbearia = Comunicado & { nova: boolean };

/** Uma foto de seção: o caminho no bucket e o endereço assinado para ver. */
export type FotoDoPatch = { caminho: string; url: string };

/** Uma seção do patch note: um fluxo do sistema, com texto e fotos. */
export type SecaoDoPatch = {
  /** "Agendamento", "Dashboard", "Nova ferramenta"… */
  titulo: string;
  texto: string;
  fotos: FotoDoPatch[];
};

/** Uma atualização inteira, como a tela /patch-notes mostra. */
export type PatchNote = Comunicado & { versao: string; secoes: SecaoDoPatch[] };

/** Do lado do admin: quantas barbearias leram, e as seções para editar. */
export type ComunicadoDoAdmin = Comunicado & {
  lidos: number;
  /** Barbearias (fora a admin) que já existiam quando ela foi publicada. */
  publico: number;
  secoes: SecaoDoPatch[];
};

/** O sino e a faixa do topo. */
export type NaoLidos = {
  quantidade: number;
  /** O alerta novo mais recente — vira faixa no topo das telas. */
  alerta: { id: string; titulo: string } | null;
};

/** Os mesmos limites do `check` da tabela. */
export const TITULO_MAX = 120;
export const TEXTO_MAX = 5000;

/** Os limites das seções — os mesmos `check` da `comunicado_secoes`. */
export const SECOES_MAX = 30;
export const AREA_MAX = 60;
export const FOTOS_POR_SECAO = 6;
/** O bucket PRIVADO das fotos dos patch notes (0045). */
export const BUCKET_DAS_FOTOS = "patch-notes";
/** O mesmo `file_size_limit` do bucket `patch-notes`. */
export const FOTO_BYTES_MAX = 5 * 1024 * 1024;
/** Tipo da foto → extensão do caminho no bucket. */
export const EXTENSAO_DA_FOTO: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
/** O caminho que a `fotos_validas` do banco aceita. */
export const CAMINHO_DE_FOTO =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$/;

/**
 * Sugestões para o nome da seção. Texto livre: entra o que o admin digitar.
 * Sem acento e sem ç, porque o campo tira o acento e transforma ç em Ç: a
 * sugestão escolhida tem que ficar igual ao que aparece na lista.
 */
export const AREAS_SUGERIDAS = [
  "Agenda",
  "Agendamento online",
  "Dashboard",
  "Estoque",
  "Loja",
  "Barbearia",
  "Clientes",
  "Nova ferramenta",
  "Ajustes",
];

// ============================================================
// VERSÃO
// ============================================================
//
// A mesma regra da `versao_em_numeros` do banco: até três números
// separados por ponto, cada um com até três dígitos. Comparação POR
// NÚMERO — 1.10 vem depois de 1.9 — e 1.0 = 1.0.0. Quem recusa de verdade
// é o banco; aqui é para a tela avisar antes.

export const VERSAO_VALIDA = /^[0-9]{1,3}(\.[0-9]{1,3}){1,2}$/;
export const PRIMEIRA_VERSAO = "1.0";

export function versaoEmNumeros(versao: string): [number, number, number] | null {
  if (!VERSAO_VALIDA.test(versao)) return null;
  const [a, b = "0", c = "0"] = versao.split(".");
  return [Number(a), Number(b), Number(c)];
}

/** Negativo se `a` < `b`, zero se iguais, positivo se `a` > `b`. */
export function compararVersoes(a: string, b: string): number {
  const x = versaoEmNumeros(a) ?? [0, 0, 0];
  const y = versaoEmNumeros(b) ?? [0, 0, 0];
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}

/** A maior versão da lista — a versão do sistema. `null` sem nenhuma. */
export function versaoAtual(versoes: (string | null)[]): string | null {
  return versoes
    .filter((v): v is string => typeof v === "string" && VERSAO_VALIDA.test(v))
    .reduce<string | null>(
      (maior, v) => (maior === null || compararVersoes(v, maior) > 0 ? v : maior),
      null,
    );
}

/** A sugestão para a próxima: 1.0 → 1.1; 1.2.3 → 1.3. */
export function proximaVersao(atual: string | null): string {
  const n = atual ? versaoEmNumeros(atual) : null;
  if (!n) return PRIMEIRA_VERSAO;
  return `${n[0]}.${n[1] + 1}`;
}

/** O `id` da versão na página: "1.10" → "versao-1-10". */
export function ancoraDaVersao(versao: string): string {
  return `versao-${versao.replace(/\./g, "-")}`;
}

/** Para onde a notificação de uma atualização leva. */
export function linkDoPatch(versao: string): string {
  return `/patch-notes#${ancoraDaVersao(versao)}`;
}

export const TIPOS_DE_COMUNICADO: Record<
  TipoDeComunicado,
  { rotulo: string; ajuda: string }
> = {
  atualizacao: {
    rotulo: "Atualização",
    ajuda:
      "Nova versão do sistema. Vira um patch note em /patch-notes, com uma seção por parte do sistema que mudou.",
  },
  alerta: {
    rotulo: "Alerta",
    ajuda:
      "Sistema fora do ar, instabilidade, manutenção. Aparece numa faixa no topo de todas as telas até a barbearia ler.",
  },
};

export function ehTipoDeComunicado(valor: unknown): valor is TipoDeComunicado {
  return valor === "atualizacao" || valor === "alerta";
}

/** Editada depois de publicada? Um minuto de folga para o próprio salvar. */
export function foiEditado(c: Comunicado): boolean {
  return (
    new Date(c.atualizadoEm).getTime() - new Date(c.publicadoEm).getTime() >
    60_000
  );
}
