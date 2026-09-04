"use client";

import { useState } from "react";
import { Menu } from "lucide-react";

import { ListaRotas } from "@/components/navegacao/lista-rotas";
import { Logo } from "@/components/marca/logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * Menu do celular. Some no desktop, onde a sidebar fica fixa.
 *
 * Usa Sheet (Radix Dialog por baixo): traz prisao de foco, fechar no Esc e
 * `aria-modal` de graca. Um `<div>` com `translate-x` faria a animacao, mas
 * deixaria o leitor de tela navegando pela pagina atras do menu aberto.
 */
export function MenuMobile({
  logado,
  nomeBarbearia,
}: {
  logado: boolean;
  nomeBarbearia?: string;
}) {
  const [aberto, setAberto] = useState(false);

  // Sem sessao nao ha o que navegar — o hamburguer nem aparece.
  if (!logado) return null;

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Abrir menu"
          className="lg:hidden"
        >
          <Menu className="size-6" />
        </Button>
      </SheetTrigger>

      <SheetContent side="left" className="w-[17rem] p-0">
        <SheetHeader className="border-b border-border p-4 text-left">
          <SheetTitle asChild>
            <span className="flex items-center">
              <Logo largura={124} />
              <span className="sr-only">BARBOS — menu de navegação</span>
            </span>
          </SheetTitle>
          <SheetDescription className="truncate">
            {nomeBarbearia ?? "Navegação do sistema"}
          </SheetDescription>
        </SheetHeader>

        {/* Fecha ao navegar: menu aberto por cima da tela nova confunde. */}
        <ListaRotas
          className="p-3"
          logado={logado}
          aoNavegar={() => setAberto(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
