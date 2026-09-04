/**
 * Diagnóstico da conexão com o Supabase.
 *   npm run supabase:verificar
 *
 * Responde em ordem: as chaves existem? o projeto responde? a migração rodou?
 * Sempre pelo npm — o .npmrc do projeto injeta --use-system-ca, necessário
 * quando um antivírus intercepta HTTPS.
 */
import { readFileSync } from "node:fs";

function lerEnvLocal() {
  try {
    return Object.fromEntries(
      readFileSync(".env.local", "utf8")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"))
        .map((l) => {
          const i = l.indexOf("=");
          return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
        }),
    );
  } catch {
    return {};
  }
}

const env = { ...lerEnvLocal(), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const chave =
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !chave) {
  console.error("✗ Falta URL ou chave em .env.local.");
  console.error("  Copie de .env.local.example e preencha.");
  process.exit(1);
}

console.log(`✓ Chaves encontradas — ${url}`);

if (!(process.env.NODE_OPTIONS ?? "").includes("--use-system-ca")) {
  console.log(
    "  (aviso: sem --use-system-ca. Se o antivírus interceptar HTTPS isto vai " +
      "falhar. Prefira `npm run supabase:verificar`.)",
  );
}

const cabecalhos = { apikey: chave, Authorization: `Bearer ${chave}` };

const CODIGOS_TLS = new Set([
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "CERT_SIGNATURE_FAILURE",
]);

function explicarTLS() {
  const linhas = [
    "",
    "✗ Certificado TLS não validado.",
    "  Algo está interceptando HTTPS — normalmente antivírus",
    "  (Norton, Kaspersky, ESET) ou firewall corporativo. Ele reassina",
    "  os certificados com uma CA própria que o Windows confia e o Node não.",
    "",
    "  Este projeto já corrige isso: o .npmrc define",
    "  node-options=--use-system-ca, que faz o Node usar os certificados",
    "  do Windows — onde essa CA está instalada.",
    "",
    "  Se apareceu mesmo assim, o comando rodou por fora do npm. Use",
    "  `npm run supabase:verificar`, ou passe a flag:",
    "  node --use-system-ca scripts/verificar-supabase.mjs",
    "",
    "  NUNCA use NODE_TLS_REJECT_UNAUTHORIZED=0. Aquilo desliga a",
    "  verificação inteira e abre a porta pra ataque de intermediário.",
  ];
  console.error(linhas.join("\n"));
}

/** fetch que traduz falha de transporte em recado acionável. */
async function buscar(endereco) {
  try {
    return await fetch(endereco, { headers: cabecalhos });
  } catch (erro) {
    const causa = erro?.cause;
    const codigo = causa?.code ?? "";
    const texto = String(causa?.message ?? erro?.message ?? "");

    if (CODIGOS_TLS.has(codigo) || texto.includes("unable to verify")) {
      explicarTLS();
      process.exit(1);
    }

    console.error(`\n✗ Não consegui alcançar ${endereco}`);
    console.error(`  ${codigo || texto}`);
    process.exit(1);
  }
}

const saude = await buscar(`${url}/auth/v1/health`);
if (!saude.ok) {
  console.error(`✗ Projeto não respondeu (HTTP ${saude.status}).`);
  console.error("  Confira a URL, ou se o projeto está pausado no painel.");
  process.exit(1);
}
console.log("✓ Projeto responde");

// Uma entrada por migracao aplicada. Sem isto, "conectou" vira falso positivo.
const TABELAS = [
  "barbearias",
  "agendamentos",
  "servicos",
  "configuracao_agenda",
  "produtos",
  "lojas", // view publica (0005)
  "loja_produtos", // view publica (0005)
  "vendas", // 0007
  "itens_venda", // 0007
  "barbeiros", // 0014
];
const faltando = [];

for (const t of TABELAS) {
  const r = await buscar(`${url}/rest/v1/${t}?select=*&limit=1`);
  if (r.status === 404 || (await r.clone().text()).includes("PGRST205")) {
    faltando.push(t);
  }
}

if (faltando.length) {
  console.error(`\n✗ Tabelas ausentes: ${faltando.join(", ")}`);
  console.error("  Rode as migrações que faltam em supabase/migracoes/");
  console.error("  em Supabase → SQL Editor → New query → Run.");
  process.exit(1);
}

console.log("✓ Todas as tabelas existem");
console.log("\nTudo pronto. `npm run dev` e entre com seu usuário.");
