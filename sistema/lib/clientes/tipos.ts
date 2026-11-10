/**
 * O cliente da barbearia (migração 0042): nome e telefone, uma linha por
 * telefone em cada barbearia. O agendamento aponta para ele.
 *
 * A regra de COMO o telefone é guardado mora no banco
 * (`normalizar_telefone`) e só lá. O que fica aqui é o que a TELA precisa
 * decidir antes de perguntar ao banco.
 */

import { semAcento } from "@/lib/formato";

/** O que a busca pelo telefone respondeu. */
export type ClienteDoTelefone =
  | {
      estado: "achou";
      /**
       * Na agenda interna, o nome inteiro. Na tela pública, resumido
       * ("GABRIEL L."): ela abre sem sessão, e dá para testar telefones
       * nela.
       */
      nome: string;
    }
  | { estado: "novo" }
  /** A busca não respondeu. A tela segue pedindo o nome, como antes. */
  | { estado: "falhou" };

/**
 * Já dá para procurar o cliente por este número?
 *
 * 11 dígitos é celular completo. 10 só é número completo quando é FIXO
 * (o primeiro dígito depois do DDD vai de 2 a 5): um 10 começando em 9 é
 * celular pela metade, e procurar ali acenderia "cliente novo" no meio da
 * digitação, um dígito antes de achar o cadastro.
 */
export function telefoneCompleto(digitos: string): boolean {
  if (digitos.length === 11) return true;
  return digitos.length === 10 && /^[2-5]$/.test(digitos[2] ?? "");
}

/**
 * Nome E sobrenome: duas palavras de pelo menos duas letras.
 *
 * Cobrado de quem DIGITA o nome na tela pública — cliente novo, ou quem
 * marca para outra pessoa (pedido do Gabriel, 10/11/2026). "MARIA DA
 * SILVA" passa; "JOAO" e "ANA B" não. A RPC pública cobra a mesma coisa
 * de cliente novo, porque ela é endereço público e a tela é conveniência.
 */
export function temNomeESobrenome(nome: string): boolean {
  return nome.trim().split(/\s+/).filter((p) => p.length >= 2).length >= 2;
}

/**
 * "Gabriel " e "GABRIEL" são o mesmo nome? Espelho de `normalizar_nome`
 * do banco (sem acento, minúsculo, espaços colapsados).
 *
 * Serve SÓ para a tela decidir se oferece "corrigir o cadastro". Quem
 * decide o que é gravado como quem é atendido é o banco
 * (`salvar_cliente`) — se as duas divergirem num caso raro, o pior que
 * acontece é a caixa aparecer quando não precisava.
 */
export function mesmoNome(a: string, b: string): boolean {
  const chave = (t: string) => semAcento(t).toLowerCase().replace(/\s+/g, " ").trim();
  return chave(a) === chave(b);
}
