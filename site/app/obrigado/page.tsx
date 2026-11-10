import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { ProximoPasso } from "@/app/obrigado/proximo-passo";

export const metadata: Metadata = {
  title: "Pagamento feito",
  // Só chega aqui quem acabou de pagar. Não é página para buscador.
  robots: { index: false, follow: false },
};

/**
 * Para onde o Asaas manda a pessoa depois de pagar (o `successUrl` do
 * checkout, aberto pelo `/assinar` do sistema).
 *
 * Chegar aqui não prova que o pagamento entrou: quem confirma é o webhook
 * do Asaas, lá no sistema. Esta página só leva a pessoa adiante — o
 * cadastro é que espera a confirmação antes de abrir o formulário.
 */
export default function Obrigado() {
  return (
    <main
      id="conteudo"
      className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-4 py-24 text-center"
    >
      <div
        aria-hidden="true"
        className="luz-ambar pointer-events-none absolute top-1/2 left-1/2 h-[56rem] w-[56rem] -translate-x-1/2 -translate-y-1/2 opacity-70"
      />

      <Link href="/" aria-label="BARBOS, voltar ao site" className="relative">
        <Image src="/marca/logo-escuro.png" alt="BARBOS" width={132} height={30} priority />
      </Link>

      <span
        aria-hidden="true"
        className="relative mt-14 grid h-16 w-16 place-items-center rounded-full border border-ambar-500/50 bg-ambar-500/10"
      >
        <svg viewBox="0 0 20 20" className="h-8 w-8 text-ambar-500">
          <path
            d="M5 10.5l3.2 3.2L15 6.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>

      <h1 className="relative mt-8 text-[clamp(2.2rem,6vw,4rem)] leading-[0.98] font-bold tracking-[-0.03em] uppercase">
        Pagamento feito.
      </h1>
      <ProximoPasso />
    </main>
  );
}
