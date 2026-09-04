"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";

import { atualizarBarbearia } from "@/app/(sistema)/barbearia/acoes";
import { Alerta } from "@/components/ui/alerta";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { Barbearia } from "@/lib/conta";
import { mascararTelefone, sanitizarNome } from "@/lib/formato";

/**
 * Dados da conta: nome e telefone editáveis; identificador só leitura.
 */
export function FormularioDadosBarbearia({
  barbearia,
}: {
  barbearia: Barbearia;
}) {
  const router = useRouter();
  const { avisar } = useToast();
  const [nome, setNome] = useState(sanitizarNome(barbearia.nome));
  const [telefone, setTelefone] = useState(
    barbearia.telefone ? mascararTelefone(barbearia.telefone) : "",
  );
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, setPendente] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setPendente(true);

    try {
      const resultado = await atualizarBarbearia({ nome, telefone });
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      avisar({
        tom: "sucesso",
        titulo: "Dados salvos",
        descricao: "Nome e telefone da barbearia atualizados.",
      });
      router.refresh();
    } catch (causa) {
      console.error("[BARBOS] salvar dados da barbearia:", causa);
      setErro("Não consegui salvar. Tente de novo.");
    } finally {
      setPendente(false);
    }
  }

  return (
    <form
      onSubmit={salvar}
      className="flex flex-col gap-4 overflow-hidden rounded-lg border border-border bg-card p-4"
    >
      <div>
        <h2 className="font-semibold">Dados da barbearia</h2>
        <p className="text-sm text-muted-foreground">
          Nome e telefone que aparecem no sistema. O identificador não muda.
        </p>
      </div>

      <Campo rotulo="Nome">
        <Input
          value={nome}
          onChange={(e) => setNome(sanitizarNome(e.target.value))}
          autoComplete="organization"
          maxLength={80}
          disabled={pendente}
          required
        />
      </Campo>

      <Campo
        rotulo="Telefone"
        opcional
        ajuda="Com DDD. Usado pra contato e, depois, WhatsApp."
      >
        <Input
          type="tel"
          inputMode="tel"
          value={telefone}
          onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
          placeholder="(11) 98765-4321"
          disabled={pendente}
        />
      </Campo>

      <Campo rotulo="Identificador" ajuda="Só leitura — é o id da conta.">
        <Input
          value={barbearia.id}
          readOnly
          className="font-mono text-sm text-muted-foreground"
        />
      </Campo>

      {erro ? <Alerta>{erro}</Alerta> : null}

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={pendente}>
          {pendente ? <Loader2 className="animate-spin" /> : <Save />}
          Salvar dados
        </Button>
      </div>
    </form>
  );
}
