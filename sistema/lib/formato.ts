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
 * Nome em maiúsculas, sem acento (exceto ç).
 *
 * Digitar "Água sem gás" vira "AGUA SEM GAS". O ç passa e vira Ç.
 * Espaço e letra/número passam; o resto some.
 */
export function sanitizarNome(texto: string): string {
  // Nome de PESSOA. Para nome de serviço ou produto use
  // `sanitizarNomeDeItem`, que preserva acento e os conectores `+ - & /`.
  // Guarda ç/Ç antes de tirar diacríticos — NFD transformaria ç em c + cedilha.
  const comMarcador = texto.replace(/[çÇ]/g, "\u0001");

  return comMarcador
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\u0001/g, "Ç")
    .replace(/[^A-ZÇ0-9 ]/g, "");
}

/**
 * Nome de SERVIÇO ou de PRODUTO: caixa alta, sem caractere estranho.
 *
 * Parecida com {@link sanitizarNome}, e diferente em duas coisas que não são
 * capricho:
 *
 * 1. **Guarda o acento.** "PIGMENTAÇÃO" e não "PIGMENTACAO". Nome de cliente
 *    é campo interno; nome de serviço aparece no cardápio que o cliente lê na
 *    tela pública de agendamento, e português sem acento ali parece defeito.
 *
 * 2. **Guarda `+`, `-`, `&` e `/`.** Não são "caractere especial" aqui, são
 *    parte do nome: o próprio exemplo do formulário é "CABELO + BARBA", e
 *    apagar o `+` viraria "CABELO BARBA". Fora esses quatro, cai fora tudo
 *    que não for letra, número ou espaço — `@`, `#`, `<`, aspas, emoji.
 *
 * Não colapsa espaço nem apara as pontas: fazer isso a cada tecla tira o
 * espaço da mão de quem ainda está digitando. Quem apara é o servidor, na
 * hora de gravar.
 */
export function sanitizarNomeDeItem(texto: string): string {
  // À-Ö e Ø-Þ cobrem as maiúsculas acentuadas do latim-1 (o Ç está no
  // primeiro trecho). O buraco entre Ö e Ø é o `×`, que fica de fora — é
  // sinal de multiplicação, não letra.
  return texto.toUpperCase().replace(/[^A-ZÀ-ÖØ-Þ0-9 +\-&/]/g, "");
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
