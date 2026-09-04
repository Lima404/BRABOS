"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, PackagePlus, Save } from "lucide-react";

import {
  salvarProduto,
  type DadosProduto,
  type Resultado,
} from "@/app/(sistema)/estoque/acoes";
import { Alerta } from "@/components/ui/alerta";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectConteudo,
  SelectGatilho,
  SelectItem,
  SelectValor,
} from "@/components/ui/select";
import { chaves } from "@/lib/query";
import {
  NOME_DO_TIPO,
  type Produto,
  type TipoProduto,
} from "@/lib/estoque/tipos";
import {
  centavosDeTexto,
  mascararPreco,
  moeda,
  sanitizarNome,
  textoDeCentavos,
} from "@/lib/formato";
import { cn } from "@/lib/utils";

/**
 * Cabeçalho da tela de estoque: cadastro e edição rápida.
 *
 * O nome é um combobox: escolhe um produto já cadastrado pra editar unidades,
 * preço e prateleira; ou digita um nome novo e cadastra do zero.
 */
export function CabecalhoCadastroProduto({
  produtos,
}: {
  produtos: Produto[];
}) {
  const clienteQuery = useQueryClient();
  const listaRef = useRef<HTMLUListElement>(null);

  const [idEdicao, setIdEdicao] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [unidades, setUnidades] = useState("0");
  const [preco, setPreco] = useState("");
  const [tipo, setTipo] = useState<TipoProduto>("mercearia");
  const [erro, setErro] = useState<string | null>(null);
  const [listaAberta, setListaAberta] = useState(false);

  const editando = idEdicao !== null;

  const sugestoes = useMemo(() => {
    const q = nome.trim().toLowerCase();
    if (q.length === 0) {
      return produtos.slice(0, 8);
    }
    return produtos
      .filter((p) => sanitizarNome(p.nome).toLowerCase().includes(q))
      .slice(0, 8);
  }, [nome, produtos]);

  function limpar() {
    setIdEdicao(null);
    setNome("");
    setUnidades("0");
    setPreco("");
    setTipo("mercearia");
    setErro(null);
    setListaAberta(false);
  }

  function escolherProduto(p: Produto) {
    setIdEdicao(p.id);
    setNome(sanitizarNome(p.nome));
    setUnidades(String(p.unidades));
    setPreco(textoDeCentavos(p.precoCentavos));
    setTipo(p.tipo);
    setListaAberta(false);
    setErro(null);
  }

  function aoDigitarNome(valor: string) {
    const limpo = sanitizarNome(valor);
    setNome(limpo);
    setListaAberta(true);
    // Saiu do produto escolhido: volta pro fluxo de cadastro.
    if (idEdicao) {
      const atual = produtos.find((p) => p.id === idEdicao);
      if (!atual || sanitizarNome(atual.nome) !== limpo) {
        setIdEdicao(null);
      }
    }
  }

  function aoEscrever(resultado: Resultado) {
    if (!resultado.ok) {
      setErro(resultado.erro);
      return;
    }
    limpar();
    clienteQuery.invalidateQueries({ queryKey: chaves.estoque.todas });
  }

  const semRede = (causa: unknown) => {
    console.error("[BARBOS] a ação não completou:", causa);
    setErro(
      "Não consegui falar com o servidor. Recarregue a página e tente de novo.",
    );
  };

  const gravar = useMutation({
    mutationFn: salvarProduto,
    onSuccess: aoEscrever,
    onError: semRede,
  });

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();

    if (nome.trim().length === 0) {
      setErro("Dê um nome ao produto.");
      return;
    }

    const nUnidades = Number(unidades);
    if (!Number.isInteger(nUnidades) || nUnidades < 0) {
      setErro("Informe quantas unidades (zero ou mais).");
      return;
    }

    // Mercearia vende: preço obrigatório. Salão é insumo: preço opcional (0).
    let centavos = 0;
    if (tipo === "mercearia") {
      if (preco.trim() === "") {
        setErro("Informe o preço da unidade — na Mercearia ele é obrigatório.");
        return;
      }
      const lido = centavosDeTexto(preco);
      if (lido === null) {
        setErro("Informe o preço da unidade como 12,90.");
        return;
      }
      centavos = lido;
    } else if (preco.trim() !== "") {
      const lido = centavosDeTexto(preco);
      if (lido === null) {
        setErro("Informe o preço da unidade como 12,90.");
        return;
      }
      centavos = lido;
    }

    setErro(null);
    const dados: DadosProduto = {
      id: idEdicao ?? undefined,
      nome,
      unidades: nUnidades,
      precoCentavos: centavos,
      tipo,
    };
    gravar.mutate(dados);
  }

  return (
    <section
      aria-labelledby="cadastro-produto-titulo"
      className="w-full rounded-lg border border-border bg-card p-4 sm:p-5"
    >
      <div className="mb-4 flex w-full flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2
            id="cadastro-produto-titulo"
            className="text-base font-semibold"
          >
            {editando ? "Editar produto" : "Cadastrar produto"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {editando
              ? "Altere unidades, preço ou prateleira e salve."
              : "Escolha um produto da lista pra editar, ou digite um nome novo."}
          </p>
        </div>
        {editando ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={limpar}
          >
            Novo cadastro
          </Button>
        ) : null}
      </div>

      <form onSubmit={enviar} className="flex w-full flex-col gap-4">
        <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-end">
          <Campo id="produto-nome" rotulo="Nome" className="min-w-0 flex-1">
            <div className="relative">
              <Input
                value={nome}
                onChange={(e) => aoDigitarNome(e.target.value)}
                onFocus={() => setListaAberta(true)}
                onBlur={() => {
                  // Espera o clique na sugestão completar antes de fechar.
                  window.setTimeout(() => setListaAberta(false), 150);
                }}
                placeholder="AGUA SEM GAS"
                maxLength={80}
                required
                autoComplete="off"
                role="combobox"
                aria-expanded={listaAberta && sugestoes.length > 0}
                aria-controls="produto-nome-sugestoes"
                aria-autocomplete="list"
              />

              {listaAberta && sugestoes.length > 0 ? (
                <ul
                  id="produto-nome-sugestoes"
                  ref={listaRef}
                  role="listbox"
                  className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-popover py-1 shadow-lg"
                >
                  {sugestoes.map((p) => (
                    <li key={p.id} role="option" aria-selected={p.id === idEdicao}>
                      <button
                        type="button"
                        className={cn(
                          "flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors",
                          "hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none",
                          p.id === idEdicao && "bg-secondary/60",
                        )}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => escolherProduto(p)}
                      >
                        <span className="min-w-0 truncate font-medium">
                          {p.nome}
                        </span>
                        <span className="shrink-0 text-muted-foreground">
                          {NOME_DO_TIPO[p.tipo]} ·{" "}
                          <span data-numero>{moeda(p.precoCentavos)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </Campo>

          <Campo
            id="produto-unidades"
            rotulo="Unidades"
            className="w-full lg:w-28"
          >
            <Input
              value={unidades}
              onChange={(e) => setUnidades(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder="0"
              required
            />
          </Campo>

          <Campo
            id="produto-preco"
            rotulo="Preço da unidade"
            opcional={tipo === "salao"}
            className="w-full lg:w-40"
          >
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
                R$
              </span>
              <Input
                value={preco}
                onChange={(e) => setPreco(mascararPreco(e.target.value))}
                placeholder="0,00"
                inputMode="numeric"
                className="pl-10"
                required={tipo === "mercearia"}
              />
            </div>
          </Campo>

          <Campo
            id="produto-tipo"
            rotulo="Prateleira"
            className="w-full min-w-0 lg:w-52"
          >
            <Select
              value={tipo}
              onValueChange={(v) => setTipo(v as TipoProduto)}
            >
              <SelectGatilho>
                <SelectValor placeholder="Escolha" />
              </SelectGatilho>
              <SelectConteudo>
                <SelectItem value="mercearia">
                  {NOME_DO_TIPO.mercearia}
                </SelectItem>
                <SelectItem value="salao">{NOME_DO_TIPO.salao}</SelectItem>
              </SelectConteudo>
            </Select>
          </Campo>

          <Button
            type="submit"
            size="lg"
            className="w-full shrink-0 lg:w-auto"
            disabled={gravar.isPending}
          >
            {gravar.isPending ? (
              <Loader2 className="animate-spin" />
            ) : editando ? (
              <Save />
            ) : (
              <PackagePlus />
            )}
            {editando ? "Salvar" : "Cadastrar"}
          </Button>
        </div>

        {erro ? <Alerta>{erro}</Alerta> : null}
      </form>
    </section>
  );
}
