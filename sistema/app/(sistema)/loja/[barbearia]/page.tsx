import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EnderecoDaLoja } from "@/components/loja/endereco-da-loja";
import { Vitrine } from "@/components/loja/vitrine";
import { Alerta } from "@/components/ui/alerta";
import { obterSessao } from "@/lib/conta";
import {
  listarClientesDoDia,
  listarProdutosDaLoja,
  obterLojaPorSlug,
} from "@/lib/loja/repositorio";

type Props = PageProps<"/loja/[barbearia]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { barbearia } = await params;
  const loja = await obterLojaPorSlug(barbearia);

  // O título é o que aparece na aba e no link compartilhado no WhatsApp —
  // "Loja | BARBOS" não diz de quem é.
  return loja
    ? { title: `Loja da ${loja.nome}`, description: `Produtos da ${loja.nome}.` }
    : { title: "Loja não encontrada" };
}

/**
 * A vitrine pública. **Abre sem sessão** — é o destino do QR code do balcão.
 *
 * Quem diz de qual barbearia é a loja é o apelido na URL, não o cookie: o
 * cliente que aponta a câmera para o QR não tem conta nenhuma.
 */
export default async function LojaDaBarbeariaPage({ params }: Props) {
  const { barbearia: slug } = await params;

  const [loja, sessao] = await Promise.all([
    obterLojaPorSlug(slug),
    obterSessao(),
  ]);

  // 404 também quando a loja está fechada: para quem chega de fora, loja
  // fechada e loja inexistente são a mesma coisa, e distinguir as duas
  // entregaria a lista de quem tem conta no sistema.
  if (!loja) notFound();

  // A lista de agendamentos sai da mesma requisição da vitrine: o seletor
  // abre junto com o modal, e buscar depois faria a lista chegar atrasada
  // justamente no toque em que ela é usada. Quem esconde os nomes de quem não
  // é a dona é a função no banco, não esta página.
  const [produtos, clientes] = await Promise.all([
    listarProdutosDaLoja(loja.id),
    listarClientesDoDia(loja.slug),
  ]);
  const ehDona = sessao.barbearia?.id === loja.id;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Loja
        </p>
        <h1 className="text-2xl font-bold tracking-tight">{loja.nome}</h1>
        <p className="text-muted-foreground">
          Toque nos produtos para montar o pedido e retire no balcão.
        </p>
      </header>

      {/* Só a dona vê: é o endereço que vai virar QR code na parede. */}
      {ehDona ? <EnderecoDaLoja slug={loja.slug} /> : null}

      <Vitrine
        produtos={produtos}
        nomeDaBarbearia={loja.nome}
        ehDona={ehDona}
        slug={loja.slug}
        clientes={clientes}
      />

      {ehDona ? (
        <Alerta tom="info" titulo="O que a vitrine mostra">
          Mercearia e <strong>Produtos de Salão</strong>, desde que tenham{" "}
          <strong>preço diferente de zero</strong> e pelo menos{" "}
          <strong>1 unidade</strong>. O cliente monta o pedido, confirma na
          barra de baixo e a compra baixa o estoque. Salão sem preço fica só no
          estoque.
        </Alerta>
      ) : null}
    </div>
  );
}
