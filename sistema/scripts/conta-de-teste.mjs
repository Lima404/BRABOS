/**
 * Confere a conta de teste do projeto.
 *
 *   npm run teste:conta
 *
 * Regra do projeto: **todo teste acontece na barbearia "Gabriel Teste"**.
 * Nunca criar conta na hora — cada conta criada por conveniência vira lixo
 * permanente no Supabase, porque apagar usuário exige a chave `service_role`,
 * que não entra neste projeto.
 *
 * As credenciais moram em `.env.local` (fora do git):
 *
 *   BARBOS_EMAIL_TESTE=...
 *   BARBOS_SENHA_TESTE=...
 *
 * Este script só ENTRA e confere. Ele não cria conta e não renomeia nada:
 * já aconteceu de um script "prestativo" criar uma segunda barbearia com o
 * mesmo nome e disputar o apelido público da verdadeira.
 *
 * Sempre pelo npm — o .npmrc injeta --use-system-ca, necessário quando um
 * antivírus intercepta HTTPS (ver AGENTS.md).
 */
import { readFileSync } from "node:fs";

export const NOME_DA_BARBEARIA = "Gabriel Teste";

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
const email = env.BARBOS_EMAIL_TESTE;
const senha = env.BARBOS_SENHA_TESTE;

if (!url || !chave) {
  console.error("✗ Falta URL ou chave do Supabase em .env.local.");
  process.exit(1);
}

if (!email || !senha) {
  console.error(`✗ Falta a credencial da conta de teste em .env.local.`);
  console.error("");
  console.error("  Acrescente as duas linhas (o arquivo não vai pro git):");
  console.error("");
  console.error(`    BARBOS_EMAIL_TESTE=e-mail da conta "${NOME_DA_BARBEARIA}"`);
  console.error("    BARBOS_SENHA_TESTE=a senha dela");
  process.exit(1);
}

const cabecalhos = { apikey: chave, "Content-Type": "application/json" };

const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: cabecalhos,
  body: JSON.stringify({ email, password: senha }),
});
const sessao = await r.json();

if (!r.ok) {
  console.error("✗ Não consegui entrar com a conta de teste.");
  console.error(`  ${sessao?.error_description ?? sessao?.msg ?? ""}`);
  console.error("  Confira BARBOS_EMAIL_TESTE e BARBOS_SENHA_TESTE.");
  process.exit(1);
}

const comSessao = { ...cabecalhos, Authorization: `Bearer ${sessao.access_token}` };

const b = await fetch(
  `${url}/rest/v1/barbearias?id=eq.${sessao.user.id}&select=nome,slug`,
  { headers: comSessao },
);
const [barbearia] = await b.json();

if (!barbearia) {
  console.error("✗ Entrei, mas essa conta não tem barbearia.");
  console.error("  Rode as migrações: npm run supabase:verificar");
  process.exit(1);
}

console.log(`✓ Entrei em "${barbearia.nome}"`);
console.log(`  e-mail: ${email}`);
console.log(`  loja:   /loja/${barbearia.slug}`);

if (barbearia.nome !== NOME_DA_BARBEARIA) {
  console.error("");
  console.error(`✗ Mas o nome deveria ser "${NOME_DA_BARBEARIA}".`);
  console.error("  Ou a credencial aponta pra conta errada, ou a barbearia foi");
  console.error("  renomeada. Não sigo o teste numa conta que não é a de teste.");
  process.exit(1);
}

console.log("\nÉ esta a conta de todo teste. Não crie conta nova.");
