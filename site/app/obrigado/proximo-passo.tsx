"use client";

import { useEffect, useSyncExternalStore } from "react";

import { Botao } from "@/components/ui/botao";
import { SISTEMA, whatsapp } from "@/lib/site";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function lerPedido(): string | null {
  const pedido = new URLSearchParams(window.location.search).get("pedido");
  return pedido && UUID.test(pedido) ? pedido : null;
}

const nadaParaOuvir = () => () => {};

/**
 * O próximo passo depois de pagar.
 *
 * O Asaas manda quem pagou para cá com `?pedido=<id>` (o endereço de volta
 * tem que ser deste domínio, regra do Asaas). Daqui a pessoa segue sozinha
 * para o cadastro do sistema, levando o pedido — e o botão fica na tela
 * para quem o navegador segurar.
 *
 * O site é estático, então o pedido só é lido no navegador. No servidor a
 * resposta é "ainda não sei" (`undefined`), e a página mostra só o título
 * até hidratar: sem isso, quem pagou veria por um instante o texto do
 * WhatsApp antes de o cadastro aparecer.
 */
export function ProximoPasso() {
  const pedido = useSyncExternalStore<string | null | undefined>(
    nadaParaOuvir,
    lerPedido,
    () => undefined,
  );
  const cadastro = pedido ? `${SISTEMA}/cadastrar?pedido=${pedido}` : null;

  useEffect(() => {
    if (!cadastro) return;
    const relogio = window.setTimeout(() => window.location.replace(cadastro), 1500);
    return () => window.clearTimeout(relogio);
  }, [cadastro]);

  if (pedido === undefined) return null;

  if (cadastro) {
    return (
      <>
        <p className="relative mt-5 max-w-md text-base leading-7 text-graf-300 sm:text-lg">
          Agora é só criar a conta da sua barbearia. Já estamos te levando para
          lá.
        </p>
        <div className="relative mt-9 flex flex-wrap justify-center gap-3">
          <Botao href={cadastro}>Criar minha conta</Botao>
        </div>
      </>
    );
  }

  return (
    <>
      <p className="relative mt-5 max-w-md text-base leading-7 text-graf-300 sm:text-lg">
        Agora falta um passo: chama a gente no WhatsApp pra abrir a conta da
        sua barbearia.
      </p>
      <div className="relative mt-9 flex flex-wrap justify-center gap-3">
        <Botao
          href={whatsapp(
            "Olá! Acabei de pagar o plano do BARBOS pelo site e quero abrir a conta da minha barbearia.",
          )}
          novaAba
        >
          Falar no WhatsApp
          <span className="sr-only"> (abre o WhatsApp)</span>
        </Botao>
        <Botao href="/" tom="contorno">
          Voltar ao site
        </Botao>
      </div>
    </>
  );
}
