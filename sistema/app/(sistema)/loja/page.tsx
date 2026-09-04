import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { QrCode } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { obterSessao } from "@/lib/conta";

export const metadata: Metadata = { title: "Loja" };

/**
 * `/loja` sem apelido não é uma loja — é o atalho da dona.
 *
 * Loja é sempre de UMA barbearia, e sem sessão o sistema não tem como saber
 * de qual: quem carrega essa informação é a URL do QR code. Então aqui só há
 * dois caminhos: logada, manda pra própria loja; deslogada, explica.
 */
export default async function LojaPage() {
  const { logado, barbearia } = await obterSessao();

  if (logado && barbearia) {
    redirect(`/loja/${barbearia.slug}`);
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 py-6">
      <EstadoVazio
        icone={QrCode}
        titulo="Cada loja tem seu endereço"
        descricao="A loja é sempre de uma barbearia. Leia o QR code no balcão dela, ou peça o link — o endereço tem o nome da barbearia no fim."
        acao={
          <Button asChild variant="secondary" className="w-full">
            <Link href="/entrar">Sou dono de barbearia</Link>
          </Button>
        }
      />

      {logado && !barbearia ? (
        <p className="text-sm text-muted-foreground">
          Sua conta existe, mas não há linha em <code>barbearias</code>. Rode a
          migração <code className="font-mono">0001_barbearias.sql</code>.
        </p>
      ) : null}
    </div>
  );
}
