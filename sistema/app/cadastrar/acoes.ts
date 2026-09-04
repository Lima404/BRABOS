"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { sanitizarNome } from "@/lib/formato";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export type EstadoCadastro = {
  erro?: string;
  /** Cadastro aceito: a tela troca para "confirme seu e-mail". */
  enviadoPara?: string;
};

/** Tamanho mínimo de senha. O padrão do Supabase é 6; 8 é um piso melhor. */
const SENHA_MINIMA = 8;

function mensagemDeErro(bruta: string): string {
  const m = bruta.toLowerCase();

  if (m.includes("password") && m.includes("short")) {
    return `A senha precisa de pelo menos ${SENHA_MINIMA} caracteres.`;
  }
  if (m.includes("weak") || m.includes("pwned")) {
    return "Essa senha é fácil de adivinhar. Escolha outra.";
  }
  if (m.includes("invalid") && m.includes("email")) {
    return "Esse e-mail não parece válido. Confira e tente de novo.";
  }
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "Já existe uma conta com esse e-mail. Tente entrar.";
  }
  // O limite de E-MAIL do Supabase e por hora, nao por minuto: mandar
  // "espere um minuto" faria a pessoa tentar em loop e nunca funcionar.
  if (m.includes("email rate limit")) {
    return "Muitos cadastros em pouco tempo. Tente de novo daqui a uma hora.";
  }
  if (m.includes("too many requests") || m.includes("rate limit")) {
    return "Muitas tentativas seguidas. Espere um minuto e tente de novo.";
  }
  // Falha de transporte: NAO culpar a internet do usuario sem saber. Pode
  // ser o Supabase fora do ar, DNS, proxy, ou URL errada no .env.local.
  if (
    m.includes("fetch failed") ||
    m.includes("failed to fetch") ||
    m.includes("network request failed") ||
    m.includes("econnrefused") ||
    m.includes("enotfound") ||
    m.includes("etimedout")
  ) {
    return "Não consegui falar com o servidor de contas. Tente de novo em instantes.";
  }
  return "Não foi possível criar a conta agora. Tente de novo em instantes.";
}

/** URL pública desta instalação, para o link de confirmação voltar aqui. */
async function origemDaRequisicao(): Promise<string> {
  const h = await headers();
  const origem = h.get("origin");
  if (origem) return origem;

  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocolo =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocolo}://${host}`;
}

export async function criarConta(
  _anterior: EstadoCadastro,
  dados: FormData,
): Promise<EstadoCadastro> {
  const nomeBarbearia = sanitizarNome(
    String(dados.get("nomeBarbearia") ?? ""),
  ).trim();
  const email = String(dados.get("email") ?? "")
    .trim()
    .toLowerCase();
  const senha = String(dados.get("senha") ?? "");

  if (!nomeBarbearia || !email || !senha) {
    return { erro: "Preencha nome, e-mail e senha." };
  }
  if (nomeBarbearia.length > 80) {
    return { erro: "O nome da barbearia está longo demais." };
  }
  if (!email.includes("@") || email.length < 5) {
    return { erro: "Esse e-mail não parece válido. Confira e tente de novo." };
  }
  if (senha.length < SENHA_MINIMA) {
    return { erro: `A senha precisa de pelo menos ${SENHA_MINIMA} caracteres.` };
  }

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: {
      emailRedirectTo: `${await origemDaRequisicao()}/auth/confirmar`,
      // O trigger ao_criar_usuario lê raw_user_meta_data.barbearia →
      // grava barbearias.nome e gera barbearias.slug (link /loja/<slug>).
      data: { barbearia: nomeBarbearia },
    },
  });

  if (error) {
    // O usuario ve a versao traduzida; o log guarda a original. Sem isso,
    // diagnosticar "deu erro no cadastro" vira adivinhacao.
    console.error(
      `[BARBOS] falha no cadastro — ${error.name} ${error.status ?? ""}: ${error.message}`,
    );
    return { erro: mensagemDeErro(error.message) };
  }

  // Com a confirmacao de e-mail DESLIGADA no projeto, o Supabase ja devolve
  // sessao pronta: a conta esta ativa e a pessoa esta logada. Mandar ela
  // "conferir a caixa de entrada" seria mentira — nenhum e-mail foi enviado.
  //
  // Fora do try/catch de proposito: redirect() sinaliza por excecao.
  if (data.session) {
    redirect("/agenda");
  }

  // Confirmacao LIGADA. Quando o endereco JA tem conta, o Supabase devolve
  // sucesso com `identities` vazio — de proposito, pra nao revelar quem esta
  // cadastrado. Respondemos igual nos dois casos: quem e dono do e-mail
  // descobre pela caixa de entrada, e mais ninguem.
  return { enviadoPara: email };
}
