import Image from "next/image";

import { ENTRAR, SISTEMA } from "@/lib/site";

/**
 * Pagina de espera.
 *
 * Existe para provar o caminho inteiro — repositorio, projeto da
 * Vercel, subdominio, certificado — ANTES de haver animacao nenhuma
 * para quebrar. Quando o site de verdade ficar pronto, este arquivo e
 * substituido.
 */
export default function Espera() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <Image
        src="/marca/logo-escuro.png"
        alt="BARBOS"
        width={220}
        height={50}
        priority
      />

      <p className="mt-10 text-sm font-semibold tracking-[0.18em] text-ambar-500 uppercase">
        Em construção
      </p>

      <h1 className="mt-4 max-w-2xl text-3xl leading-10 font-bold text-balance text-white sm:text-4xl sm:leading-tight">
        A barbearia sai do caderno.
      </h1>

      <p className="mt-5 max-w-lg text-base leading-6 text-graf-300">
        Agenda, serviços, equipe e estoque numa tela só. O site de
        apresentação está sendo montado — o sistema já está no ar e
        funcionando.
      </p>

      <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
        {/* Um botao ambar por tela, no maximo. Regra do manual. */}
        <a
          href={SISTEMA}
          className="flex h-12 items-center justify-center rounded-lg bg-ambar-500 px-7 text-base font-semibold text-graf-900 transition-colors hover:bg-ambar-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ambar-300"
        >
          Conhecer o sistema
        </a>
        <a
          href={ENTRAR}
          className="flex h-12 items-center justify-center rounded-lg border border-graf-400 px-7 text-base font-semibold text-white transition-colors hover:border-graf-300 hover:bg-graf-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ambar-300"
        >
          Entrar na minha conta
        </a>
      </div>

      <footer className="mt-20 text-xs text-graf-500">
        BARBOS · gestão para barbearias
      </footer>
    </main>
  );
}
