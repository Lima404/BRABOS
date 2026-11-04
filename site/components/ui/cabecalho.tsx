"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { CADASTRO, ENTRAR } from "@/lib/site";

const ATALHOS = [
  { href: "#ferramentas", texto: "O que faz" },
  { href: "#telas", texto: "As telas" },
  { href: "#caderno", texto: "Por que trocar" },
];

/**
 * A barra do topo. Nasce transparente sobre o herói e ganha fundo assim que
 * a página rola — senão o texto dela briga com a cadeira.
 */
export function Cabecalho() {
  const [rolou, setRolou] = useState(false);

  useEffect(() => {
    const olhar = () => setRolou(window.scrollY > 24);
    olhar();
    window.addEventListener("scroll", olhar, { passive: true });
    return () => window.removeEventListener("scroll", olhar);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-[5px] z-50 transition-colors duration-300 ${
        rolou
          ? "border-b border-graf-800 bg-graf-950/85 backdrop-blur-md"
          : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-8 px-4 sm:px-6">
        <a href="#topo" className="flex shrink-0 items-center" aria-label="BARBOS">
          <Image
            src="/marca/logo-escuro.png"
            alt="BARBOS"
            width={116}
            height={26}
            priority
          />
        </a>

        <nav className="hidden items-center gap-7 md:flex">
          {ATALHOS.map((atalho) => (
            <a
              key={atalho.href}
              href={atalho.href}
              className="text-sm font-medium text-graf-300 transition-colors hover:text-white"
            >
              {atalho.texto}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <a
            href={ENTRAR}
            className="hidden h-10 items-center rounded-lg px-4 text-sm font-semibold text-graf-200 transition-colors hover:bg-graf-800 hover:text-white sm:inline-flex"
          >
            Entrar
          </a>
          <a
            href={CADASTRO}
            className="inline-flex h-10 items-center rounded-lg bg-ambar-500 px-4 text-sm font-semibold text-graf-900 transition-colors hover:bg-ambar-600"
          >
            Criar conta
          </a>
        </div>
      </div>
    </header>
  );
}
