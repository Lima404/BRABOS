"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";

/** De 3 em 3 segundos, por até dois minutos. */
const INTERVALO_MS = 3000;
const TENTATIVAS = 40;

/**
 * Espera o Asaas confirmar o pagamento, sem a pessoa fazer nada.
 *
 * O Asaas devolve quem pagou para o cadastro na mesma hora, e o aviso de
 * "pago" (webhook) costuma chegar segundos depois. Aqui a página pergunta de
 * novo ao servidor até o pedido virar pago, e aí o formulário aparece
 * sozinho.
 *
 * `router.refresh()` é a ferramenta certa AQUI, ao contrário do resto do
 * sistema: quem decide o que mostrar é o componente de servidor da página,
 * e é ele que precisa rodar de novo. Não há cache de lista para invalidar.
 */
export function ConfirmandoPagamento() {
  const router = useRouter();
  const [tentativa, setTentativa] = useState(0);
  const desistiu = tentativa >= TENTATIVAS;

  useEffect(() => {
    if (desistiu) return;
    const relogio = window.setTimeout(() => {
      router.refresh();
      setTentativa((n) => n + 1);
    }, INTERVALO_MS);
    return () => window.clearTimeout(relogio);
  }, [tentativa, desistiu, router]);

  if (desistiu) {
    return (
      <p className="text-base text-muted-foreground">
        A confirmação está demorando mais que o normal. Atualize a página daqui
        a pouco, ou fale com a gente no WhatsApp com o comprovante.
      </p>
    );
  }

  return (
    <p role="status" className="flex items-center gap-2 text-base text-muted-foreground">
      <LoaderCircle className="size-5 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      Recebendo a confirmação do Asaas. Isso leva alguns segundos.
    </p>
  );
}
