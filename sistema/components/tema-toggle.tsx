"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

/**
 * Tema escuro nao e enfeite: e a barbearia as nove da noite com a tela no
 * balcao. Comeca em "system" e o barbeiro decide.
 *
 * Os dois icones sao renderizados e a classe `dark` decide qual aparece — sem
 * estado de "montado", sem efeito, e portanto sem divergencia de hidratacao.
 * O tema atual e lido so no clique, quando ja estamos no navegador.
 */
export function TemaToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Alternar entre tema claro e escuro"
    >
      <Moon className="dark:hidden" />
      <Sun className="hidden dark:block" />
    </Button>
  );
}
