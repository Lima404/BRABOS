/** Formatacao pt-BR. Centralizada: nenhum toLocaleString solto em componente. */

export function moeda(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function diaPorExtenso(iso: string): string {
  const texto = new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Fuso da barbearia.
 *
 * O banco guarda `data` e `horario` como relógio de parede local, sem fuso —
 * então "hoje" precisa ser o hoje DA BARBEARIA, não o do servidor. Em produção
 * o Node roda em UTC: sem isto, das 21h em diante o sistema já acharia que é
 * amanhã — justamente o fim do expediente. Quando o BARBOS atender fora do
 * Brasil, isto vira uma coluna em `barbearias`.
 */
export const FUSO_DA_BARBEARIA = "America/Sao_Paulo";

/** Hoje em AAAA-MM-DD no fuso da barbearia. "sv-SE" já formata em ISO. */
export function hojeNaBarbearia(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: FUSO_DA_BARBEARIA,
  }).format(new Date());
}

/**
 * Agora em HH:MM no fuso da barbearia.
 *
 * O mesmo motivo do `hojeNaBarbearia`: o servidor da Vercel roda em UTC, e
 * "que horas são" precisa ser a hora do relógio da parede da barbearia — às
 * 21h de Sao Paulo o UTC já virou o dia seguinte.
 */
export function agoraNaBarbearia(): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO_DA_BARBEARIA,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

/** Data de hoje em YYYY-MM-DD, no fuso local. */
export function hojeISO(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** Mês de uma data, no formato AAAA-MM. */
export function mesISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Data local em AAAA-DD-MM. Nunca usar toISOString: ele converte pra UTC. */
export function dataISO(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** "Setembro 2026" a partir de AAAA-MM. */
export function mesPorExtenso(mes: string): string {
  const [ano, m] = mes.split("-").map(Number);
  const nome = new Date(ano, m - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
  });
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} ${ano}`;
}

/** "Quinta, 03 de setembro" a partir de AAAA-MM-DD. */
export function diaComSemana(data: string): string {
  const texto = new Date(`${data}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "03 de setembro" — versão curta para o cabeçalho do painel do dia. */
export function diaCurto(data: string): string {
  return new Date(`${data}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
  });
}

/**
 * O `data` é "hoje" para a barbearia?
 *
 * Pelo relógio da BARBEARIA, não pelo da máquina: esta função é chamada
 * durante a renderização, dos dois lados. Com `new Date()` o servidor (UTC em
 * produção) e o navegador respondiam diferente na virada do dia, e o painel
 * escrevia "Hoje, 04 de setembro" num lado e "03 de setembro" no outro — erro
 * de hidratação.
 */
export function ehHoje(data: string): boolean {
  return data === hojeNaBarbearia();
}

/**
 * "45", "45,90", "R$ 45,90" ou "45.90" em centavos. `null` quando não é
 * dinheiro. Aceita as duas separações porque o teclado do celular oferece
 * ponto e a pessoa digita vírgula.
 */
export function centavosDeTexto(texto: string): number | null {
  const limpo = texto.replace(/[^\d,.]/g, "").replace(",", ".");
  if (limpo === "" || (limpo.match(/\./g)?.length ?? 0) > 1) return null;

  const valor = Number(limpo);
  if (!Number.isFinite(valor) || valor < 0) return null;

  return Math.round(valor * 100);
}

/** Centavos no formato que o campo de edição mostra: "45,90" (sem "R$"). */
export function textoDeCentavos(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(".", ",");
}

/**
 * Máscara de preço: só dígitos entram; a vírgula dos centavos é colocada
 * sozinha. Digitar "1290" vira "12,90". Vazio permanece vazio.
 */
/**
 * Máscara de contagem inteira — as unidades do estoque.
 *
 * Digita "1200", vê "1.200". Só dígito entra, e o ponto de milhar é
 * desenhado sozinho: com o limite de 999.999 do servidor, seis dígitos
 * seguidos ("999999") são lidos errado de relance no meio do atendimento.
 *
 * **Não é preço.** O campo ficava com `placeholder="0,00"` — herança de
 * copiar o campo de preço ao lado —, mas unidade é item contado: a coluna no
 * banco é `integer`, e "2,5 unidades" não existe. Sem vírgula, sem centavo.
 *
 * Corta em 6 dígitos, o mesmo teto que a ação de servidor recusa. Deixar
 * digitar 7 pra levar erro depois é fazer a pessoa apagar de novo.
 */
export function mascararInteiro(texto: string): string {
  const digitos = texto.replace(/\D/g, "").slice(0, 6);
  if (digitos === "") return "";

  // Zero à esquerda cai, mas o "0" sozinho fica: estoque zerado é um valor
  // legítimo, e é justamente o que se digita ao acabar o produto.
  return Number(digitos).toLocaleString("pt-BR");
}

/**
 * O caminho de volta de {@link mascararInteiro}: "1.200" vira 1200.
 *
 * `null` quando não sobrou dígito nenhum — quem chama decide se campo vazio
 * é erro ou zero. `Number("1.200")` daria 1.2, então nunca ler o campo
 * mascarado direto.
 */
export function inteiroDeTexto(texto: string): number | null {
  const digitos = texto.replace(/\D/g, "");
  return digitos === "" ? null : Number(digitos);
}

export function mascararPreco(texto: string): string {
  const digitos = texto.replace(/\D/g, "");
  if (digitos === "") return "";
  return textoDeCentavos(Number(digitos));
}

/**
 * Máscara de telefone BR: digitar vira "(11) 98765-4321" ou "(11) 3456-7890".
 * Só dígitos entram; vazio permanece vazio.
 */
export function mascararTelefone(texto: string): string {
  const digitos = texto.replace(/\D/g, "").slice(0, 11);
  if (digitos.length === 0) return "";
  if (digitos.length <= 2) return `(${digitos}`;
  if (digitos.length <= 6) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  }
  if (digitos.length <= 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}

/** Só os dígitos do telefone — útil pra validar tamanho. */
export function digitosDoTelefone(texto: string): string {
  return texto.replace(/\D/g, "");
}

/**
 * Tira til, circunflexo, agudo, grave e trema. **Nenhum campo do sistema
 * aceita acento** — é regra do projeto, não preferência de tela.
 *
 * O ç passa e vira Ç. Ele não é acento: é outra letra, e "ACAO" no lugar de
 * "AÇÃO" perde a palavra. O `\u0001` guarda o ç antes do NFD, que o quebraria
 * em `c` + cedilha e o faria cair junto com os diacríticos.
 *
 * É a base das outras três daqui — a regra do acento mora em UM lugar só,
 * senão um campo novo nasce esquecendo dela.
 */
export function semAcento(texto: string): string {
  return texto
    .replace(/[çÇ]/g, "\u0001")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0001/g, "Ç");
}

/**
 * Nome de PESSOA ou de BARBEARIA: maiúsculas, sem acento, sem pontuação.
 *
 * "Água sem gás" vira "AGUA SEM GAS". Letra, número e espaço passam; o resto
 * some. Para nome de serviço ou produto use {@link sanitizarNomeDeItem}, que
 * é igual mais os conectores `+ - & /`.
 */
export function sanitizarNome(texto: string): string {
  return semAcento(texto)
    .toUpperCase()
    .replace(/[^A-ZÇ0-9 ]/g, "");
}

/**
 * Nome de SERVIÇO ou de PRODUTO. Igual a {@link sanitizarNome} — maiúsculas,
 * sem acento — mais quatro conectores: `+`, `-`, `&` e `/`.
 *
 * Eles ficam porque são parte do nome, não sujeira: o exemplo do próprio
 * formulário é "CABELO + BARBA", e apagar o `+` viraria "CABELO BARBA".
 * Fora esses quatro cai tudo — `@`, `#`, `<`, aspas, emoji.
 *
 * Não colapsa espaço nem apara as pontas: fazer isso a cada tecla tira o
 * espaço da mão de quem ainda está digitando. Quem apara é o servidor.
 */
export function sanitizarNomeDeItem(texto: string): string {
  return semAcento(texto)
    .toUpperCase()
    .replace(/[^A-ZÇ0-9 +\-&/]/g, "");
}

/**
 * Texto livre — observação do agendamento, caixa de pesquisa.
 *
 * Tira só o acento. Não força maiúscula nem apaga pontuação: aqui a pessoa
 * escreve uma frase ("corta baixo dos lados, deixa a franja"), e vírgula e
 * ponto fazem parte dela.
 *
 * Na pesquisa serve de duas coisas ao mesmo tempo: cumpre a regra e faz
 * "MANICURE" achar o que foi digitado como "manicure" — os nomes gravados
 * também não têm acento.
 */
export function sanitizarTextoLivre(texto: string): string {
  return semAcento(texto);
}

/**
 * As versões "pra gravar" das três de cima: sanitiza, colapsa espaço repetido
 * e apara as pontas.
 *
 * Existem separadas porque **o colapso não pode acontecer a cada tecla** —
 * apagar o segundo espaço enquanto a pessoa digita tira o espaço da mão dela.
 * O formulário usa as de cima; a ação de servidor usa estas.
 *
 * E a ação de servidor SEMPRE usa: ela é um endereço HTTP público como outro
 * qualquer, e quem chamar direto manda o que quiser. O campo é conveniência
 * de quem digita; a barreira é aqui.
 */
function aparar(texto: string): string {
  return texto.replace(/ {2,}/g, " ").trim();
}

export function nomeParaBanco(texto: string): string {
  return aparar(sanitizarNome(texto));
}

export function nomeDeItemParaBanco(texto: string): string {
  return aparar(sanitizarNomeDeItem(texto));
}

export function textoLivreParaBanco(texto: string): string {
  return aparar(sanitizarTextoLivre(texto));
}

/** 30 → "30 min"; 90 → "1h30". Duração é lida de relance, então é curta. */
export function duracaoPorExtenso(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${horas}h` : `${horas}h${String(resto).padStart(2, "0")}`;
}

/** "Set/26" a partir de AAAA-MM. Rótulo de eixo: curto porque são muitos. */
export function mesCurto(mes: string): string {
  const [ano, m] = mes.split("-").map(Number);
  const nome = new Date(ano, m - 1, 1).toLocaleDateString("pt-BR", {
    month: "short",
  });
  const limpo = nome.replace(".", "");
  return `${limpo.charAt(0).toUpperCase()}${limpo.slice(1)}/${String(ano).slice(2)}`;
}

/**
 * Dinheiro encurtado para eixo de gráfico: "R$ 240", "R$ 1,2 mil".
 *
 * Só para rótulo de eixo, onde o número exato não cabe e nem é lido. Todo
 * valor que a pessoa vai conferir usa `moeda()`.
 */
export function moedaCurta(centavos: number): string {
  const reais = centavos / 100;
  if (Math.abs(reais) < 1000) return `R$ ${Math.round(reais)}`;

  const mil = reais / 1000;
  const casas = Math.abs(mil) < 10 ? 1 : 0;
  return `R$ ${mil.toFixed(casas).replace(".", ",")} mil`;
}
