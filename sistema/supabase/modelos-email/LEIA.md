# Modelo de e-mail de confirmação (opcional, mas recomendado)

## O problema que isso resolve

O modelo padrão do Supabase usa `{{ .ConfirmationURL }}`, que volta para o app
com um parâmetro `code`. Esse código só pode ser trocado por sessão **no mesmo
navegador** em que o cadastro foi feito — o verificador fica num cookie local.

Na prática: o dono da barbearia se cadastra no computador do balcão e abre o
e-mail no celular. O link falha.

O sistema já trata esse caso (manda pro login com um aviso explicando), mas o
melhor é o link simplesmente funcionar.

## A correção

Trocar o link do modelo para `{{ .TokenHash }}`, que não depende de nada
guardado no navegador. O `app/auth/confirmar/route.ts` já aceita esse formato.

**Onde:** Supabase → Authentication → Emails → **Confirm signup** → cole o
conteúdo de `confirmacao.html` no corpo do e-mail.

Se você usa domínio próprio em produção, troque `{{ .SiteURL }}` pela URL certa
em Authentication → URL Configuration.
