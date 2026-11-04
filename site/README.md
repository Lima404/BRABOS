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

## De onde vêm as imagens

Todas foram geradas no Higgsfield e tratadas aqui. Nenhuma é foto de
banco de imagens, e nenhuma tem marca de outra empresa.

| Arquivo | Como foi feito |
|---|---|
| `public/cadeira/q*.webp` | Foto da cadeira → fundo removido → montada sobre um halo âmbar → vídeo de giro de 5s → `scripts/quadros-da-cadeira.sh` |
| `public/ferramentas/*.webp` | Uma imagem por peça, fundo removido, aparada na caixa do objeto |
| `public/caderno.webp` | Imagem direta, **com** o fundo de madeira: ali a madeira velha é o argumento, não um deslize do manual |

O halo âmbar da cadeira está **gravado nos quadros**, não é CSS. Por isso
o canvas do herói leva uma máscara radial: sem ela aparece a costura
retangular do canvas contra o fundo da página.

## A coreografia

Toda seção animada é uma `<Cena>`. Ela mede o quanto já atravessou a tela
e escreve isso em `--p`, de 0 a 1, direto no DOM — uma variável, uma vez
por quadro, sem re-renderizar nada. O resto é CSS (`.entra`, `.cresce`,
`.entra-moldura` em `app/globals.css`).

Duas consequências que valem saber antes de mexer:

- **A animação é reversível de graça.** Rolar para cima desmonta a tela na
  ordem inversa, porque tudo é função de `--p` e não um gatilho.
- **`--p` começa em 1, não em 0.** Se o JavaScript não rodar, a página
  aparece montada em vez de aparecer vazia. É também o que quem pediu
  movimento reduzido vê: a `Cena` nem chega a escrever na variável.
