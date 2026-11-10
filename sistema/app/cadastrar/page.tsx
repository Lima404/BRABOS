import type { Metadata } from "next";
import Link from "next/link";
import { LogIn, MessageCircle, RefreshCw, Tag } from "lucide-react";

import { ConfirmandoPagamento } from "@/app/cadastrar/confirmando-pagamento";
import { FormularioCadastro } from "@/app/cadastrar/formulario-cadastro";
import { Logo } from "@/components/marca/logo";
import { Alerta } from "@/components/ui/alerta";
import { Button } from "@/components/ui/button";
import { linkDoWhatsApp } from "@/lib/formato";
import { pedidoParaCadastro, type PedidoNoCadastro } from "@/lib/pagamento/pedido";
import { PLANOS_NO_SITE, WHATSAPP_DO_BARBOS } from "@/lib/pagamento/planos";
import { supabaseConfigurado } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Criar conta" };

/**
 * Criar a conta da barbearia — só depois de pagar (0041).
 *
 * Quem paga no checkout do Asaas volta para cá com `?pedido=<id>` (passando
 * pela página de obrigado do site, por causa da regra de domínio do Asaas).
 * O formulário só aparece com o pedido pago e ainda sem conta. Os outros
 * estados dizem o que houve e têm saída: o plano no site, o login ou o
 * WhatsApp. Nenhum é beco.
 *
 * As barbearias liberadas por fora chegam com um link de convite
 * (`gerar_convites`), que é um pedido já pago — mesmo caminho.
 */
export default async function CadastrarPage({ searchParams }: PageProps<"/cadastrar">) {
  const { pedido } = await searchParams;
  const situacao: PedidoNoCadastro = supabaseConfigurado
    ? await pedidoParaCadastro(pedido)
    : "erro";

  const whatsapp = linkDoWhatsApp(
    WHATSAPP_DO_BARBOS,
    situacao === "aguardando" || situacao === "recusado"
      ? "Olá! Paguei o plano do BARBOS e não consegui criar a conta."
      : "Olá! Quero criar a conta da minha barbearia no BARBOS.",
  );

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo largura={168} />
          <p className="text-muted-foreground">
            {situacao === "pode"
              ? "Pagamento confirmado. Agora é só criar a conta."
              : "Crie a conta da sua barbearia. Leva um minuto."}
          </p>
        </div>

        <div className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm">
          {situacao === "pode" && typeof pedido === "string" ? (
            <>
              <h1 className="text-xl font-semibold">Criar conta</h1>
              <FormularioCadastro pedido={pedido} />
            </>
          ) : situacao === "aguardando" ? (
            <>
              <h1 className="text-xl font-semibold">Confirmando o pagamento</h1>
              <ConfirmandoPagamento />
            </>
          ) : situacao === "usado" ? (
            <>
              <h1 className="text-xl font-semibold">Essa conta já foi criada</h1>
              <p className="text-base text-muted-foreground">
                Esse pagamento já abriu a conta de uma barbearia. Entre com o
                e-mail e a senha que você cadastrou.
              </p>
              <Button asChild size="lg" className="w-full">
                <Link href="/entrar">
                  <LogIn aria-hidden="true" />
                  Entrar
                </Link>
              </Button>
            </>
          ) : situacao === "recusado" ? (
            <>
              <h1 className="text-xl font-semibold">O pagamento não foi concluído</h1>
              <p className="text-base text-muted-foreground">
                Esse checkout foi cancelado, expirou ou o pagamento voltou.
                Escolha o plano de novo para criar a conta.
              </p>
              <Button asChild size="lg" className="w-full">
                <a href={PLANOS_NO_SITE}>
                  <Tag aria-hidden="true" />
                  Ver os planos
                </a>
              </Button>
            </>
          ) : situacao === "erro" ? (
            <>
              <h1 className="text-xl font-semibold">Criar conta</h1>
              <Alerta tom="erro">
                Não consegui conferir o pagamento agora. Atualize a página em
                instantes.
              </Alerta>
              <Button asChild variant="outline" className="w-full">
                <a href={typeof pedido === "string" ? `/cadastrar?pedido=${encodeURIComponent(pedido)}` : "/cadastrar"}>
                  <RefreshCw aria-hidden="true" />
                  Atualizar
                </a>
              </Button>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold">Primeiro, o plano</h1>
              <p className="text-base text-muted-foreground">
                A conta é criada depois do pagamento. Escolha o plano no site
                e, assim que pagar, você volta direto para cá.
              </p>
              <Button asChild size="lg" className="w-full">
                <a href={PLANOS_NO_SITE}>
                  <Tag aria-hidden="true" />
                  Ver os planos
                </a>
              </Button>
            </>
          )}

          {situacao !== "pode" && whatsapp ? (
            <Button asChild variant="outline" className="w-full">
              <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                <MessageCircle aria-hidden="true" />
                Falar no WhatsApp
              </a>
            </Button>
          ) : null}
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link
            href="/entrar"
            className="font-semibold text-accent-foreground underline-offset-4 hover:underline"
          >
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
