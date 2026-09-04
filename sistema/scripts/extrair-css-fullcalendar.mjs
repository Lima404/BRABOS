/**
 * Extrai o CSS do FullCalendar para app/fullcalendar.css.
 *
 * POR QUE ISSO EXISTE
 * Os pacotes do FullCalendar v6 declaram `"sideEffects": false` no
 * package.json, mas injetam o próprio CSS por uma chamada de escopo de módulo
 * (`injectStyles(css_248z)`). Isso É um efeito colateral. O bundler acredita
 * na declaração, remove a chamada no build de produção, e o calendário
 * renderiza sem estilo nenhum — a grade colapsa para 1px de altura.
 *
 * A correção é não depender da injeção: lemos as strings de CSS dos pacotes
 * instalados e gravamos um .css de verdade, importado pelo globals.css.
 *
 * Roda sozinho antes de `dev` e `build` (ver scripts do package.json), então
 * um `npm update` do FullCalendar regenera o arquivo sem ninguém lembrar.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

/** Ordem importa: o core define as bases que os plugins sobrescrevem. */
const PACOTES = [
  ["@fullcalendar/core", "internal-common.js"],
  ["@fullcalendar/daygrid", "internal.js"],
  ["@fullcalendar/timegrid", "internal.js"],
];

const SAIDA = "app/fullcalendar.css";

/** Lê um literal de string JS a partir da aspa de abertura, respeitando escapes. */
function lerLiteral(texto, inicio) {
  const aspa = texto[inicio];
  let i = inicio + 1;
  let bruto = "";

  while (i < texto.length) {
    const c = texto[i];
    if (c === "\\") {
      bruto += texto.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (c === aspa) break;
    bruto += c;
    i += 1;
  }

  // `bruto` preserva as sequências de escape exatamente como estão no fonte.
  // Um literal de aspas duplas já é JSON válido — reescapar as aspas aqui
  // transformaria `\"` em `\\"` e quebraria o parse. Só literais de aspa
  // simples podem conter `"` cru, e aí sim precisam de escape.
  const pronto = aspa === '"' ? bruto : bruto.replace(/(?<!\\)"/g, '\\"');
  return JSON.parse(`"${pronto}"`);
}

function extrair(pacote, arquivo) {
  const raiz = dirname(require.resolve(`${pacote}/package.json`));
  const conteudo = readFileSync(join(raiz, arquivo), "utf8");

  const partes = [];
  // O lookbehind exclui a DEFINIÇÃO `function injectStyles(styleText)`,
  // que casaria com o mesmo padrão da chamada.
  const chamadas = conteudo.matchAll(/(?<!function\s)injectStyles\((\w+)\)/g);

  for (const chamada of chamadas) {
    const variavel = chamada[1];
    const decl = new RegExp(`(?:var|const|let)\\s+${variavel}\\s*=\\s*["'\`]`);
    const achou = decl.exec(conteudo);

    if (!achou) {
      throw new Error(
        `Não achei a declaração de ${variavel} em ${pacote}/${arquivo}. ` +
          "O formato do pacote mudou — este script precisa ser revisto.",
      );
    }

    const aspa = achou.index + achou[0].length - 1;
    partes.push(lerLiteral(conteudo, aspa));
  }

  if (partes.length === 0) {
    throw new Error(
      `Nenhum injectStyles() em ${pacote}/${arquivo}. ` +
        "Se a versão nova já entrega .css próprio, apague este script e importe o CSS direto.",
    );
  }

  return partes.join("\n");
}

const versao = require("@fullcalendar/core/package.json").version;

const blocos = PACOTES.map(([pacote, arquivo]) => {
  const css = extrair(pacote, arquivo);
  console.log(`  ${pacote.padEnd(26)} ${String(css.length).padStart(6)} bytes`);
  return `/* ---------- ${pacote} ---------- */\n${css}`;
});

const cabecalho = `/* GERADO POR scripts/extrair-css-fullcalendar.mjs — NÃO EDITE À MÃO.
 * FullCalendar ${versao}.
 * Motivo: os pacotes marcam "sideEffects": false mas injetam CSS em escopo de
 * módulo; o bundler remove essa chamada e o calendário fica sem estilo.
 * Regenerar: npm run css:fullcalendar
 */\n`;

writeFileSync(SAIDA, `${cabecalho}\n${blocos.join("\n\n")}\n`, "utf8");
console.log(`\n✓ ${SAIDA} gerado (FullCalendar ${versao})`);
