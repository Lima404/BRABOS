"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { marcarComunicadosLidos } from "@/app/(sistema)/notificacoes/acoes";
import { useNaoLidos } from "@/components/comunicados/nao-lidos";
import { Alerta } from "@/components/ui/alerta";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { chaves } from "@/lib/query";

/**
 * A faixa de alerta no topo de toda tela do sistema.
 *
 * Só para o tipo "alerta" (sistema instável, manutenção) e só enquanto a
 * barbearia não leu. Notas de atualização ficam no sino: elas podem esperar,
 * o alerta não.
 *
 * `Alerta` e não `Toast`: é recado para reler, e precisa continuar lá até
 * alguém decidir. "Dispensar" marca como lido — sem isso a faixa voltaria
 * em toda navegação, e uma faixa que não sai ensina a não ler faixa.
 *
 * Na própria tela de notificações ela some: o alerta já está ali, inteiro.
 */
export function FaixaDeAlerta() {
  const caminho = usePathname();
  const { data } = useNaoLidos();
  const [dispensando, setDispensando] = useState(false);
  const { avisar } = useToast();
  const clienteQuery = useQueryClient();

  const alerta = data?.alerta;
  if (!alerta || caminho === "/notificacoes") return null;

  async function dispensar() {
    if (!alerta) return;
    setDispensando(true);
    try {
      const resultado = await marcarComunicadosLidos([alerta.id]);
      if (!resultado.ok) {
        avisar({ tom: "erro", titulo: "Não consegui dispensar", descricao: resultado.erro });
        return;
      }
      await clienteQuery.invalidateQueries({ queryKey: chaves.comunicados.todas });
    } catch (causa) {
      console.error("[BARBOS] dispensar alerta:", causa);
      avisar({
        tom: "erro",
        titulo: "Não consegui dispensar",
        descricao: "Recarregue a página e tente de novo.",
      });
    } finally {
      setDispensando(false);
    }
  }

  return (
    <Alerta
      tom="aviso"
      titulo="Alerta do BARBOS"
      className="mb-6"
      acao={
        <>
          <Button asChild variant="outline">
            <Link href={`/notificacoes#notificacao-${alerta.id}`}>Ler o alerta</Link>
          </Button>
          <Button variant="ghost" onClick={dispensar} disabled={dispensando}>
            {dispensando ? "Dispensando…" : "Dispensar"}
          </Button>
        </>
      }
    >
      {alerta.titulo}
    </Alerta>
  );
}
