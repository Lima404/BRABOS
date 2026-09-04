"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Trash2, UserPlus } from "lucide-react";

import {
  desativarBarbeiro,
  salvarBarbeiro,
} from "@/app/(sistema)/barbearia/acoes";
import { Alerta } from "@/components/ui/alerta";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { Barbeiro } from "@/lib/barbearia/tipos";
import { mascararTelefone, sanitizarNome } from "@/lib/formato";
import { chaves } from "@/lib/query";
import { cn } from "@/lib/utils";

/**
 * Equipe: formulário de cadastro/edição + tabela de barbeiros ativos.
 */
export function SecaoEquipe({
  barbeiros,
  disponivel,
}: {
  barbeiros: Barbeiro[];
  /** False quando a migração 0014 ainda não rodou. */
  disponivel: boolean;
}) {
  const router = useRouter();
  const clienteQuery = useQueryClient();
  const { avisar } = useToast();

  const [idEdicao, setIdEdicao] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, setPendente] = useState(false);
  const [removendoId, setRemovendoId] = useState<string | null>(null);

  const editando = idEdicao !== null;

  function limpar() {
    setIdEdicao(null);
    setNome("");
    setTelefone("");
    setErro(null);
  }

  function comecarEdicao(b: Barbeiro) {
    setIdEdicao(b.id);
    setNome(sanitizarNome(b.nome));
    setTelefone(mascararTelefone(b.telefone));
    setErro(null);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!disponivel) return;

    setErro(null);
    setPendente(true);

    try {
      const resultado = await salvarBarbeiro({
        id: idEdicao ?? undefined,
        nome,
        telefone,
      });

      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }

      avisar({
        tom: "sucesso",
        titulo: editando ? "Barbeiro atualizado" : "Barbeiro adicionado",
        descricao: editando
          ? `${nome.trim()} foi atualizado na equipe.`
          : `${nome.trim()} entrou na equipe.`,
      });
      limpar();
      await clienteQuery.invalidateQueries({
        queryKey: chaves.barbearia.barbeiros,
      });
      router.refresh();
    } catch (causa) {
      console.error("[BARBOS] salvar barbeiro:", causa);
      setErro("Não consegui salvar. Tente de novo.");
    } finally {
      setPendente(false);
    }
  }

  async function remover(b: Barbeiro) {
    setErro(null);
    setRemovendoId(b.id);

    try {
      const resultado = await desativarBarbeiro(b.id);
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      if (idEdicao === b.id) limpar();
      avisar({
        tom: "sucesso",
        titulo: "Barbeiro removido",
        descricao: `${b.nome} saiu da equipe ativa.`,
      });
      await clienteQuery.invalidateQueries({
        queryKey: chaves.barbearia.barbeiros,
      });
      router.refresh();
    } catch (causa) {
      console.error("[BARBOS] desativar barbeiro:", causa);
      setErro("Não consegui remover. Tente de novo.");
    } finally {
      setRemovendoId(null);
    }
  }

  if (!disponivel) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-6">
        <h2 className="font-semibold">Equipe ainda não ligada</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Rode a migração{" "}
          <code className="font-mono">0014_barbeiros.sql</code> no SQL Editor
          do Supabase para cadastrar barbeiros aqui.
        </p>
      </div>
    );
  }

  return (
    <section
      aria-labelledby="equipe-titulo"
      className="flex flex-col gap-4 overflow-hidden rounded-lg border border-border bg-card"
    >
      <header className="border-b border-border px-4 py-3">
        <h2 id="equipe-titulo" className="font-semibold">
          Barbeiros
        </h2>
        <p className="text-sm text-muted-foreground">
          Cada um terá agenda e resultados próprios. Por enquanto, só o
          cadastro.
        </p>
      </header>

      <form
        onSubmit={salvar}
        className="grid gap-3 border-b border-border px-4 pb-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      >
        <Campo rotulo="Nome">
          <Input
            value={nome}
            onChange={(e) => setNome(sanitizarNome(e.target.value))}
            placeholder="Nome do barbeiro"
            maxLength={80}
            disabled={pendente}
            required
          />
        </Campo>

        <Campo rotulo="Telefone">
          <Input
            type="tel"
            inputMode="tel"
            value={telefone}
            onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
            placeholder="(11) 98765-4321"
            disabled={pendente}
            required
          />
        </Campo>

        <div className="flex gap-2">
          {editando ? (
            <Button
              type="button"
              variant="outline"
              onClick={limpar}
              disabled={pendente}
            >
              Cancelar
            </Button>
          ) : null}
          <Button type="submit" size="lg" disabled={pendente} className="flex-1 sm:flex-none">
            {pendente ? (
              <Loader2 className="animate-spin" />
            ) : (
              <UserPlus />
            )}
            {editando ? "Salvar" : "Adicionar"}
          </Button>
        </div>
      </form>

      {erro ? (
        <div className="px-4">
          <Alerta>{erro}</Alerta>
        </div>
      ) : null}

      {barbeiros.length === 0 ? (
        <div className="p-4">
          <EstadoVazio
            icone={UserPlus}
            titulo="Nenhum barbeiro ainda"
            descricao="Cadastre o primeiro acima — nome e telefone bastam."
          />
        </div>
      ) : (
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40 text-muted-foreground">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Telefone</th>
                <th className="px-4 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {barbeiros.map((b, i) => (
                <tr
                  key={b.id}
                  className={cn(
                    "border-b border-border last:border-b-0",
                    i % 2 === 1 && "bg-secondary/20",
                    idEdicao === b.id && "bg-secondary/40",
                  )}
                >
                  <td className="px-4 py-3 font-medium">{b.nome}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <span data-numero>{b.telefone}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Editar ${b.nome}`}
                        disabled={pendente || removendoId !== null}
                        onClick={() => comecarEdicao(b)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remover ${b.nome}`}
                        disabled={pendente || removendoId !== null}
                        onClick={() => remover(b)}
                      >
                        {removendoId === b.id ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <Trash2 />
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
