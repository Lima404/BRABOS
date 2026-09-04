"use client";

import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ThemeProvider } from "next-themes";

import { ToastProvider } from "@/components/ui/toast";
import { obterQueryClient } from "@/lib/query";

export function Providers({ children }: { children: React.ReactNode }) {
  // useState garante um cliente estavel entre renders sem vazar entre
  // requisicoes no servidor.
  const [queryClient] = useState(obterQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        {/* Dentro do tema: o toast usa os tokens, e precisa saber se a tela
            está clara ou escura. */}
        <ToastProvider>{children}</ToastProvider>
      </ThemeProvider>
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
    </QueryClientProvider>
  );
}
