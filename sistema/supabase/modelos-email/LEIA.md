# Modelos de e-mail (opcionais, mas recomendados)

São dois: `confirmacao.html` (conta nova) e `recuperacao.html` (senha
esquecida). Os dois resolvem o mesmo problema, e o segundo resolve um a mais.

## O problema que isso resolve

O modelo padrão do Supabase usa `{{ .ConfirmationURL }}`, que volta para o app
com um parâmetro `code`. Esse código só pode ser trocado por sessão **no mesmo
navegador** em que o pedido foi feito — o verificador fica num cookie local.

Na prática: o dono da barbearia pede a senha nova no computador do balcão e
abre o e-mail no celular. O link falha.

O sistema já trata esse caso (manda pro login com um aviso explicando), mas o
melhor é o link simplesmente funcionar.

**Na recuperação isso pesa mais que na confirmação.** Quem está confirmando
uma conta acabou de criá-la e costuma estar no mesmo aparelho. Quem esqueceu a
senha muitas vezes pede do computador e lê o e-mail no celular, porque é onde
o e-mail está configurado — e é justamente a pessoa que não tem outro jeito de
entrar.

## A correção

Trocar o link do modelo para `{{ .TokenHash }}`, que não depende de nada
guardado no navegador. O `app/auth/confirmar/route.ts` já aceita esse formato,
e usa o `type` para saber se manda para a agenda ou para a tela de senha nova.

**Onde, no painel do Supabase → Authentication → Emails:**

| Modelo do painel | Arquivo daqui |
|---|---|
| **Confirm signup** | `confirmacao.html` |
| **Reset password** | `recuperacao.html` |

Cole o conteúdo do arquivo no corpo do e-mail e salve.

Se você usa domínio próprio em produção, troque `{{ .SiteURL }}` pela URL certa
em Authentication → URL Configuration.

## Sem trocar os modelos, funciona?

Funciona, com a ressalva do aparelho. O código lida com os dois formatos de
propósito — inclusive passando `?proximo=/redefinir-senha` no `redirectTo`,
que é o único jeito de reconhecer uma recuperação no formato `code`, já que
ele não carrega o tipo do token.
