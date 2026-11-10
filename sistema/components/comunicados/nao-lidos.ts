"use client";

import { useQuery } from "@tanstack/react-query";

import { contarNaoLidos } from "@/app/(sistema)/notificacoes/acoes";
import { dadosOuErro } from "@/lib/consulta";
import { chaves } from "@/lib/query";

/**
 * Quantas notificações novas, e o alerta novo mais recente.
 *
 * O sino e a faixa leem esta MESMA consulta: uma ida ao banco para os dois.
 * Busca do navegador, e não do layout no servidor, de propósito — o layout
 * roda a cada navegação, e uma consulta a mais ali atrasaria TODA tela do
 * sistema por causa de um número no canto.
 *
 * A cada 5 minutos ela se refaz sozinha: um alerta de "sistema instável"
 * precisa chegar a quem deixou a agenda aberta no balcão o dia inteiro.
 * Falhar aqui não é erro de tela — o sino só fica sem número.
 */
export function useNaoLidos() {
  return useQuery({
    queryKey: chaves.comunicados.naoLidos,
    queryFn: () => dadosOuErro(contarNaoLidos()),
    refetchInterval: 5 * 60 * 1000,
    retry: false,
  });
}
