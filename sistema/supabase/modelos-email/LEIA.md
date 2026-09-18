# Modelos de e-mail

São dois: `confirmacao.html` (conta nova) e `recuperacao.html` (senha
esquecida).

## Antes de tentar colar: o painel pode não deixar

O Supabase passou a exigir **SMTP próprio** para editar assunto e corpo dos
e-mails. Sem isso, a tela Authentication → Emails mostra os campos em modo de
leitura, com o aviso *"Set up custom SMTP to edit templates"* — e não há botão
de salvar que resolva.

**Então estes arquivos são o alvo, não o passo de hoje.** O sistema funciona
sem eles; o que muda é o que está descrito abaixo.

## O que muda usando o modelo padrão

O modelo padrão usa `{{ .ConfirmationURL }}`, que volta para o app no formato
**PKCE** (`?code=`). Esse código só pode ser trocado por sessão **no mesmo
navegador** em que o pedido foi feito: o verificador fica num cookie local.

Na prática: o dono da barbearia pede a senha nova no computador do balcão e
abre o e-mail no celular. O link falha.

Quando isso acontece, o sistema não some com o problema — manda para o login
com "O link de recuperação abriu em outro aparelho. Peça um novo e abra no
mesmo em que pediu." Mas é uma instrução chata de seguir para quem já está
sem acesso.

Além disso, o remetente padrão do Supabase tem **limite baixo de envio por
hora** e cai em spam com frequência. Para produção de verdade, isso é o
problema maior — não a aparência do e-mail.

## O que os arquivos daqui corrigem

Eles trocam o link para `{{ .TokenHash }}`, que não depende de nada guardado
no navegador. O `app/auth/confirmar/route.ts` já aceita esse formato, e usa o
`type` para saber se manda para a agenda ou para a tela de senha nova.

**Quando o SMTP próprio estiver configurado**, em Authentication → Emails:

| Modelo do painel | Arquivo daqui |
|---|---|
| **Confirm signup** | `confirmacao.html` |
| **Reset password** | `recuperacao.html` |

Se você usa domínio próprio, troque `{{ .SiteURL }}` pela URL certa em
Authentication → URL Configuration.

## Como o código sobrevive aos dois formatos

`/auth/confirmar` reconhece uma recuperação por três caminhos, em ordem de
confiança:

1. `type=recovery` na URL — só existe com o modelo editado;
2. `?proximo=/redefinir-senha`, que a ação põe no `redirectTo`;
3. o cookie `barbos-pediu-recuperacao`, gravado ao pedir o link.

O terceiro existe porque o formato PKCE não carrega o tipo, e o segundo
depende de o Supabase preservar a query string do `redirect_to`. Se não
preservar, `/auth/confirmar` receberia um `code` pelado e mandaria a pessoa
para a agenda — sem erro, e sem trocar a senha. Recurso que falha em silêncio
é pior que recurso que falha com estardalhaço.

O cookie não é furo de privacidade: ele é gravado **mesmo quando o e-mail não
tem conta**. Um cookie que só aparecesse para endereço cadastrado devolveria
pela porta dos fundos a resposta que o formulário se recusa a dar.
