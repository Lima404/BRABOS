import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CreditCard, LogOut, MessageCircle, RefreshCw } from "lucide-react";

import { sair } from "@/app/entrar/acoes";
import { Logo } from "@/components/marca/logo";
import { Alerta } from "@/components/ui/alerta";
import { Button } from "@/components/ui/button";
import { diaCurto, linkDoWhatsApp, moeda } from "@/lib/formato";
import { PLANOS, WHATSAPP_DO_BARBOS } from "@/lib/pagamento/planos";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Assinatura" };

type Assinatura = {
  pagamento_ativo: boolean;
  plano: string | null;
  situacao: string | null;
  acesso_ate: string | null;
};

/** O que aconteceu, numa frase, a partir do último pedido da conta. */
function motivo(a: Assinatura): string {
  const ate = a.acesso_ate ? diaCurto(a.acesso_ate) : null;
  if (a.situacao === "estornado") {
    return "O último pagamento foi estornado, e o acesso foi pausado.";
  }
  if (a.plano === "mensal" && ate) {
    return `A mensalidade que venceu em ${ate} ainda não foi paga. Passados 7 dias do vencimento, o acesso fica pausado até o pagamento.`;
  }
  if ((a.plano === "anual-cartao" || a.plano === "anual-pix") && ate) {
    return `Os 12 meses do seu plano anual terminaram em ${ate}.`;
  }
  if (a.plano === "manual") {
    return "O acesso desta conta foi pausado.";
  }
  return "A conta foi criada, mas ainda não tem um plano ativo.";
}

/**
 * Para onde o proxy manda a conta logada sem pagamento em dia (0041).
 *
 * Fica FORA do grupo `(sistema)`: aqui não há navegação para as telas que
 * estão bloqueadas, e é a única rota privada que o bloqueio deixa abrir —
 * senão seria um laço de redirecionamento.
 *
 * Os botões de pagar levam a conta junto (`/assinar` lê a sessão), então o
 * pagamento libera esta mesma conta sem passar pelo cadastro.
 */
export default async function AssinaturaPage() {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data, error } = await supabase.rpc("minha_assinatura").maybeSingle<Assinatura>();
  if (!error && data?.pagamento_ativo) redirect("/agenda");

  const whatsapp = linkDoWhatsApp(
    WHATSAPP_DO_BARBOS,
    "Olá! Minha barbearia está com a assinatura do BARBOS pendente e quero regularizar.",
  );

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo largura={168} />
        </div>

        <div className="space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="space-y-2">
            <h1 className="text-xl font-semibold">Assinatura pendente</h1>
            {error ? (
              <Alerta tom="erro">
                Não consegui ler a sua assinatura agora. Atualize a página em
                instantes, ou fale com a gente no WhatsApp.
              </Alerta>
            ) : (
              <p className="text-base text-muted-foreground">
                {data ? motivo(data) : motivo({ pagamento_ativo: false, plano: null, situacao: null, acesso_ate: null })}{" "}
                Seus dados estão guardados: é só escolher um plano para voltar.
              </p>
            )}
          </div>

          {/* <a> e não <Link>: /assinar é uma rota que redireciona para o
              Asaas, e o Link tentaria buscá-la adiantado. */}
          <div className="space-y-3">
            <Button asChild size="lg" className="w-full">
              <a href="/assinar?plano=mensal">
                <CreditCard aria-hidden="true" />
                Mensal · {moeda(PLANOS.mensal.centavos)} por mês
              </a>
            </Button>
            <Button asChild size="lg" variant="secondary" className="w-full">
              <a href="/assinar?plano=anual-pix">
                Anual no PIX · {moeda(PLANOS["anual-pix"].centavos)}
              </a>
            </Button>
            <Button asChild size="lg" variant="secondary" className="w-full">
              <a href="/assinar?plano=anual-cartao">
                Anual no cartão · {moeda(PLANOS["anual-cartao"].centavos)} em até 12x
              </a>
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            Já pagou? A confirmação do Asaas leva alguns segundos. Atualize esta
            página e o sistema abre sozinho.
          </p>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline" className="flex-1">
              <a href="/assinatura">
                <RefreshCw aria-hidden="true" />
                Atualizar
              </a>
            </Button>
            {whatsapp ? (
              <Button asChild variant="outline" className="flex-1">
                <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                  <MessageCircle aria-hidden="true" />
                  Falar no WhatsApp
                </a>
              </Button>
            ) : null}
          </div>
        </div>

        <form action={sair} className="mt-6 text-center">
          <Button type="submit" variant="ghost">
            <LogOut aria-hidden="true" />
            Sair da conta
          </Button>
        </form>
      </div>
    </main>
  );
}
