import Image from "next/image";

import { CADASTRO, ENTRAR, SISTEMA } from "@/lib/site";

export function Rodape() {
  return (
    <footer className="border-t border-graf-800 bg-graf-950">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-14 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <Image
            src="/marca/logo-escuro.png"
            alt="BARBOS"
            width={132}
            height={30}
          />
          <p className="mt-4 text-sm leading-6 text-graf-400">
            Agenda, serviços, equipe e estoque da barbearia numa tela só.
            Feito para ser aberto com o cliente já sentado na cadeira.
          </p>
        </div>

        <div className="flex gap-14">
          <div>
            <p className="text-xs font-semibold tracking-[0.12em] text-graf-500 uppercase">
              Sistema
            </p>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <a href={ENTRAR} className="text-graf-300 hover:text-white">
                  Entrar
                </a>
              </li>
              <li>
                <a href={CADASTRO} className="text-graf-300 hover:text-white">
                  Criar conta
                </a>
              </li>
              <li>
                <a href={SISTEMA} className="text-graf-300 hover:text-white">
                  www.barboss.com.br
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold tracking-[0.12em] text-graf-500 uppercase">
              No site
            </p>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <a href="#ferramentas" className="text-graf-300 hover:text-white">
                  O que faz
                </a>
              </li>
              <li>
                <a href="#telas" className="text-graf-300 hover:text-white">
                  As telas
                </a>
              </li>
              <li>
                <a href="#caderno" className="text-graf-300 hover:text-white">
                  Por que trocar
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="faixa-barbearia" aria-hidden="true" />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <p className="text-xs text-graf-500">
          BARBOS · gestão para barbearias · {new Date().getFullYear()}
        </p>
      </div>
    </footer>
  );
}
