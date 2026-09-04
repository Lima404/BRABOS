import { Cabecalho } from "@/components/cabecalho";
import { Sidebar } from "@/components/navegacao/sidebar";
import { obterSessao } from "@/lib/conta";

/**
 * Shell do sistema.
 *
 * Tem duas caras. Com sessão: sidebar fixa no desktop, hamburguer no celular.
 * Sem sessão: só cabeçalho — e é isso que quem lê o QR code da barbearia vê,
 * porque a loja mora aqui dentro mas é aberta. Nenhuma rota privada aparece
 * pra quem não entrou.
 *
 * A tela de login fica fora deste grupo de rotas — lá não existe navegação
 * nenhuma.
 */
export default async function LayoutSistema({ children }: LayoutProps<"/">) {
  const { logado, barbearia } = await obterSessao();
  const nome = barbearia?.nome;

  return (
    <div className="flex flex-1">
      <Sidebar logado={logado} />

      {/* min-w-0 impede que conteudo largo (tabela, nome comprido) empurre
          a coluna e estoure a largura da pagina. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Cabecalho logado={logado} nomeBarbearia={nome} />
        {/* Sem max-width: a agenda ocupa a tela inteira. Páginas de leitura
            põem o próprio limite de largura internamente. */}
        <main className="w-full flex-1 px-4 pb-28 pt-6 sm:px-6 sm:pb-10">
          {children}
        </main>
      </div>
    </div>
  );
}
