# site — a apresentação do BARBOS

Projeto **separado** do `sistema/`. Vive em `site.barboss.com.br`, com
deploy próprio na Vercel.

## Por que separado

O sistema tem sessão, cookie, banco e chaves. Este site não tem nada
disso: é estático, não guarda segredo nenhum e pode ser reconstruído do
zero sem risco para quem está com cliente na cadeira. Mexer aqui nunca
derruba a agenda de ninguém.

## Rodar

```sh
npm install
npm run dev     # http://localhost:3100
```

A porta é **3100** de propósito — para o site e o sistema (3000) rodarem
ao mesmo tempo na mesma máquina.

## Deploy

Projeto próprio na Vercel, apontando para este diretório
(**Root Directory = `site`**), no mesmo repositório do sistema.

**Nenhuma variável de ambiente.** Se um dia este projeto precisar de uma
chave, vale reler o motivo da separação antes de adicioná-la.

## A marca

As cores e os logos foram **copiados** de `identidade/`, não importados:
com a Root Directory em `site/`, nada acima desta pasta entra no build.
A fonte da verdade continua sendo `identidade/design-guide.md` — se o
manual mudar, `app/globals.css` e `public/marca/` precisam ser
conferidos na mão.
