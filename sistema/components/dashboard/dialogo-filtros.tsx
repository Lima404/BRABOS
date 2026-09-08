"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Campo, Opcao } from "@/components/ui/campo";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { RadioGrupo, RadioItem } from "@/components/ui/radio";
import { buscarConfiguracao } from "@/lib/agenda/api";
import { buscarBarbeiros } from "@/lib/barbearia/api";
import {
  filtroPadrao,
  SECOES_FILTRO,
  type FiltroDashboard,
  type PeriodoFiltro,
  type SecaoFiltro,
} from "@/lib/dashboard/filtros";
import { buscarProdutos } from "@/lib/estoque/api";
import { NOME_DO_TIPO } from "@/lib/estoque/tipos";
import { moeda, sanitizarTextoLivre } from "@/lib/formato";
import { chaves } from "@/lib/query";
import { cn } from "@/lib/utils";

/**
 * Modal de filtros do dashboard — duas colunas no estilo CRM:
 * seções à esquerda, opções à direita. Aplicar só grava o estado local;
 * a RPC filtrada vem depois.
 */
export function DialogoFiltrosDashboard({
  aberto,
  aoMudarAberto,
  valor,
  mesAtual,
  aoAplicar,
}: {
  aberto: boolean;
  aoMudarAberto: (aberto: boolean) => void;
  valor: FiltroDashboard;
  mesAtual: string;
  aoAplicar: (filtro: FiltroDashboard) => void;
}) {
  const [rascunho, setRascunho] = useState(valor);
  const [secao, setSecao] = useState<SecaoFiltro>("periodo");
  const [busca, setBusca] = useState("");

  // Remonta o rascunho a cada abertura — o que está aplicado na tela.
  useEffect(() => {
    if (aberto) {
      setRascunho(valor);
      setBusca("");
      setSecao(
        valor.soLoja || valor.produtoIds.length > 0
          ? "loja"
          : valor.barbeiroIds.length > 0
            ? "barbeiros"
            : valor.servicoIds.length > 0
              ? "servicos"
              : "periodo",
      );
    }
  }, [aberto, valor]);

  const { data: ajustes } = useQuery({
    queryKey: chaves.agenda.configuracao,
    queryFn: buscarConfiguracao,
    enabled: aberto,
  });

  const { data: barbeirosData } = useQuery({
    queryKey: chaves.barbearia.barbeiros,
    queryFn: buscarBarbeiros,
    enabled: aberto,
  });

  const { data: produtosData } = useQuery({
    queryKey: chaves.estoque.produtos,
    queryFn: buscarProdutos,
    enabled: aberto,
  });

  const servicos = useMemo(
    () => (ajustes?.servicos ?? []).filter((s) => s.ativo),
    [ajustes],
  );
  const barbeiros = useMemo(() => barbeirosData ?? [], [barbeirosData]);
  // Mesma regra da vitrine: preço > 0 e pelo menos 1 unidade.
  const produtosLoja = useMemo(
    () =>
      (produtosData ?? []).filter(
        (p) => p.precoCentavos > 0 && p.unidades >= 1,
      ),
    [produtosData],
  );

  const q = busca.trim().toLowerCase();
  const servicosFiltrados = useMemo(
    () =>
      q
        ? servicos.filter((s) => s.nome.toLowerCase().includes(q))
        : servicos,
    [servicos, q],
  );
  const barbeirosFiltrados = useMemo(
    () =>
      q
        ? barbeiros.filter((b) => b.nome.toLowerCase().includes(q))
        : barbeiros,
    [barbeiros, q],
  );
  const produtosFiltrados = useMemo(
    () =>
      q
        ? produtosLoja.filter((p) => p.nome.toLowerCase().includes(q))
        : produtosLoja,
    [produtosLoja, q],
  );

  function limpar() {
    setRascunho(filtroPadrao(mesAtual));
    setSecao("todos");
    setBusca("");
  }

  function aplicar() {
    aoAplicar(rascunho);
    aoMudarAberto(false);
  }

  function escolherTodos() {
    setSecao("todos");
    setRascunho(filtroPadrao(mesAtual));
  }

  function alternarId(
    campo: "servicoIds" | "barbeiroIds" | "produtoIds",
    id: string,
    marcado: boolean,
  ) {
    setRascunho((atual) => {
      const lista = atual[campo];
      return {
        ...atual,
        [campo]: marcado
          ? lista.includes(id)
            ? lista
            : [...lista, id]
          : lista.filter((x) => x !== id),
      };
    });
  }

  return (
    <Modal
      aberto={aberto}
      aoMudarAberto={aoMudarAberto}
      tamanho="grande"
      titulo="Filtros"
      descricao="Escolha o recorte — os números do dashboard mudam ao aplicar."
      classNameCorpo="p-0 overflow-hidden flex flex-col"
      rodape={
        <>
          <Button type="button" variant="outline" onClick={limpar}>
            Limpar
          </Button>
          <Button type="button" size="lg" onClick={aplicar}>
            Aplicar filtros
          </Button>
        </>
      }
    >
      <div className="grid min-h-[min(22rem,50dvh)] flex-1 sm:grid-cols-[11rem_minmax(0,1fr)]">
        {/* Seções — esquerda */}
        <nav
          aria-label="Seções do filtro"
          className="flex flex-row gap-1 overflow-x-auto border-b border-border p-2 sm:flex-col sm:overflow-y-auto sm:border-r sm:border-b-0"
        >
          {SECOES_FILTRO.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                if (s.id === "todos") escolherTodos();
                else setSecao(s.id);
              }}
              className={cn(
                "shrink-0 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                secao === s.id
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
              )}
            >
              {s.rotulo}
            </button>
          ))}
        </nav>

        {/* Opções — direita */}
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto p-4">
          {secao === "todos" ? (
            <PainelTodos />
          ) : null}

          {secao === "periodo" ? (
            <PainelPeriodo
              valor={rascunho}
              aoMudar={setRascunho}
            />
          ) : null}

          {secao === "servicos" ? (
            <PainelLista
              busca={busca}
              aoMudarBusca={setBusca}
              vazio={
                servicos.length === 0
                  ? "Nenhum serviço ativo. Cadastre em Configurar agenda."
                  : "Nenhum serviço com esse nome."
              }
              itens={servicosFiltrados.map((s) => ({
                id: s.id,
                rotulo: s.nome,
                marcado: rascunho.servicoIds.includes(s.id),
              }))}
              aoAlternar={(id, marcado) =>
                alternarId("servicoIds", id, marcado)
              }
            />
          ) : null}

          {secao === "barbeiros" ? (
            <PainelLista
              busca={busca}
              aoMudarBusca={setBusca}
              vazio={
                barbeiros.length === 0
                  ? "Nenhum barbeiro. Cadastre em Barbearia."
                  : "Nenhum barbeiro com esse nome."
              }
              itens={barbeirosFiltrados.map((b) => ({
                id: b.id,
                rotulo: b.nome,
                marcado: rascunho.barbeiroIds.includes(b.id),
              }))}
              aoAlternar={(id, marcado) =>
                alternarId("barbeiroIds", id, marcado)
              }
            />
          ) : null}

          {secao === "loja" ? (
            <PainelLoja
              soLoja={rascunho.soLoja}
              aoMudarSoLoja={(soLoja) =>
                setRascunho((a) => ({ ...a, soLoja }))
              }
              busca={busca}
              aoMudarBusca={setBusca}
              produtos={produtosFiltrados.map((p) => ({
                id: p.id,
                rotulo: p.nome,
                detalhe: `${NOME_DO_TIPO[p.tipo]} · ${moeda(p.precoCentavos)}`,
                marcado: rascunho.produtoIds.includes(p.id),
              }))}
              vazio={
                produtosLoja.length === 0
                  ? "Nenhum item à venda (preço e pelo menos 1 unidade)."
                  : "Nenhum produto com esse nome."
              }
              aoAlternarProduto={(id, marcado) =>
                alternarId("produtoIds", id, marcado)
              }
            />
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

function PainelTodos() {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-semibold">Todos</h3>
      <p className="text-sm text-muted-foreground">
        O dashboard mostra serviços concluídos e vendas da loja sem recorte.
        Escolher esta seção e aplicar limpa período, serviços, barbeiros e
        loja.
      </p>
    </div>
  );
}

function PainelPeriodo({
  valor,
  aoMudar,
}: {
  valor: FiltroDashboard;
  aoMudar: (f: FiltroDashboard) => void;
}) {
  function setPeriodo(periodo: PeriodoFiltro) {
    aoMudar({ ...valor, periodo });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="font-semibold">Período</h3>
        <p className="text-sm text-muted-foreground">
          Dia, semana, mês, ano ou um intervalo entre duas datas.
        </p>
      </div>

      <RadioGrupo
        value={valor.periodo}
        onValueChange={(v) => setPeriodo(v as PeriodoFiltro)}
        className="grid grid-cols-2 gap-1 sm:grid-cols-3"
      >
        <Opcao
          htmlFor="filtro-periodo-dia"
          rotulo="Dia"
          controle={<RadioItem id="filtro-periodo-dia" value="dia" />}
        />
        <Opcao
          htmlFor="filtro-periodo-semana"
          rotulo="Semana"
          controle={<RadioItem id="filtro-periodo-semana" value="semana" />}
        />
        <Opcao
          htmlFor="filtro-periodo-mes"
          rotulo="Mês"
          controle={<RadioItem id="filtro-periodo-mes" value="mes" />}
        />
        <Opcao
          htmlFor="filtro-periodo-ano"
          rotulo="Ano"
          controle={<RadioItem id="filtro-periodo-ano" value="ano" />}
        />
        <Opcao
          htmlFor="filtro-periodo-intervalo"
          rotulo="Início e fim"
          className="sm:col-span-2"
          controle={
            <RadioItem id="filtro-periodo-intervalo" value="intervalo" />
          }
        />
      </RadioGrupo>

      {valor.periodo === "dia" ? (
        <Campo rotulo="Data">
          <Input
            type="date"
            value={valor.dataInicio}
            onChange={(e) =>
              aoMudar({ ...valor, dataInicio: e.target.value, dataFim: "" })
            }
          />
        </Campo>
      ) : null}

      {valor.periodo === "semana" ? (
        <Campo rotulo="Semana" ajuda="Escolha qualquer dia da semana desejada.">
          <Input
            type="week"
            value={valor.semana}
            onChange={(e) => aoMudar({ ...valor, semana: e.target.value })}
          />
        </Campo>
      ) : null}

      {valor.periodo === "mes" ? (
        <Campo rotulo="Mês">
          <Input
            type="month"
            value={valor.mes}
            onChange={(e) => aoMudar({ ...valor, mes: e.target.value })}
          />
        </Campo>
      ) : null}

      {valor.periodo === "ano" ? (
        <Campo rotulo="Ano">
          <Input
            type="number"
            inputMode="numeric"
            min={2020}
            max={2100}
            value={valor.ano}
            onChange={(e) => aoMudar({ ...valor, ano: e.target.value })}
          />
        </Campo>
      ) : null}

      {valor.periodo === "intervalo" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Data início">
            <Input
              type="date"
              value={valor.dataInicio}
              onChange={(e) =>
                aoMudar({ ...valor, dataInicio: e.target.value })
              }
            />
          </Campo>
          <Campo rotulo="Data fim">
            <Input
              type="date"
              value={valor.dataFim}
              onChange={(e) => aoMudar({ ...valor, dataFim: e.target.value })}
            />
          </Campo>
        </div>
      ) : null}
    </div>
  );
}

function PainelLista({
  busca,
  aoMudarBusca,
  itens,
  aoAlternar,
  vazio,
}: {
  busca: string;
  aoMudarBusca: (v: string) => void;
  itens: { id: string; rotulo: string; marcado: boolean }[];
  aoAlternar: (id: string, marcado: boolean) => void;
  vazio: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={busca}
          onChange={(e) => aoMudarBusca(sanitizarTextoLivre(e.target.value))}
          placeholder="Pesquisar"
          className="pl-9"
          aria-label="Pesquisar na lista"
        />
      </div>

      {itens.length === 0 ? (
        <p className="text-sm text-muted-foreground">{vazio}</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {itens.map((item) => (
            <li key={item.id}>
              <Opcao
                htmlFor={`filtro-item-${item.id}`}
                rotulo={item.rotulo}
                controle={
                  <Checkbox
                    id={`filtro-item-${item.id}`}
                    checked={item.marcado}
                    onCheckedChange={(v) =>
                      aoAlternar(item.id, v === true)
                    }
                  />
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const PAGINA_PRODUTOS = 8;

function PainelLoja({
  soLoja,
  aoMudarSoLoja,
  busca,
  aoMudarBusca,
  produtos,
  aoAlternarProduto,
  vazio,
}: {
  soLoja: boolean;
  aoMudarSoLoja: (v: boolean) => void;
  busca: string;
  aoMudarBusca: (v: string) => void;
  produtos: {
    id: string;
    rotulo: string;
    detalhe: string;
    marcado: boolean;
  }[];
  aoAlternarProduto: (id: string, marcado: boolean) => void;
  vazio: string;
}) {
  const [visiveis, setVisiveis] = useState(PAGINA_PRODUTOS);
  const listaRef = useRef<HTMLUListElement | null>(null);
  const fimListaRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    setVisiveis(PAGINA_PRODUTOS);
  }, [busca, produtos.length]);

  const mostrar = produtos.slice(0, visiveis);
  const temMais = visiveis < produtos.length;

  useEffect(() => {
    const alvo = fimListaRef.current;
    const root = listaRef.current;
    if (!alvo || !root || !temMais) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisiveis((n) => Math.min(n + PAGINA_PRODUTOS, produtos.length));
        }
      },
      { root, rootMargin: "40px" },
    );

    observer.observe(alvo);
    return () => observer.disconnect();
  }, [temMais, mostrar.length, produtos.length]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="font-semibold">Loja</h3>
        <p className="text-sm text-muted-foreground">
          Só as vendas da vitrine (QR), sem os serviços da cadeira.
        </p>
      </div>

      <Opcao
        htmlFor="filtro-so-loja"
        rotulo="Só movimentações da loja"
        ajuda="Esconde a receita de atendimentos no recorte."
        controle={
          <Checkbox
            id="filtro-so-loja"
            checked={soLoja}
            onCheckedChange={(v) => aoMudarSoLoja(v === true)}
          />
        }
      />

      <div
        role="separator"
        className="border-t border-border"
        aria-hidden
      />

      <div className="flex flex-col gap-3">
        <div>
          <h4 className="text-sm font-semibold">Itens à venda</h4>
          <p className="text-sm text-muted-foreground">
            Produtos com preço e pelo menos 1 unidade — a mesma regra da
            vitrine.
          </p>
        </div>

        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={busca}
            onChange={(e) => aoMudarBusca(sanitizarTextoLivre(e.target.value))}
            placeholder="Pesquisar produto"
            className="pl-9"
            aria-label="Pesquisar produtos da loja"
          />
        </div>

        {produtos.length === 0 ? (
          <p className="text-sm text-muted-foreground">{vazio}</p>
        ) : (
          <ul
            ref={listaRef}
            className="barra-fina max-h-48 overflow-y-auto"
          >
            {mostrar.map((p) => (
              <li key={p.id} className="py-0.5">
                <Opcao
                  htmlFor={`filtro-produto-${p.id}`}
                  rotulo={p.rotulo}
                  ajuda={p.detalhe}
                  controle={
                    <Checkbox
                      id={`filtro-produto-${p.id}`}
                      checked={p.marcado}
                      onCheckedChange={(v) =>
                        aoAlternarProduto(p.id, v === true)
                      }
                    />
                  }
                />
              </li>
            ))}
            {temMais ? (
              <li
                ref={fimListaRef}
                className="py-2 text-center text-xs text-muted-foreground"
                aria-hidden
              >
                Carregando…
              </li>
            ) : null}
          </ul>
        )}
      </div>
    </div>
  );
}
