"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { ListaDeAtributos } from "@/components/dashboard/lista-de-atributos";
import { PainelPeriodo } from "@/components/dashboard/painel-periodo";
import { Button } from "@/components/ui/button";
import { Opcao } from "@/components/ui/campo";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { RadioGrupo, RadioItem } from "@/components/ui/radio";
import {
  atributosDoFiltroAdmin,
  filtroAdminPadrao,
  removerAtributoAdmin,
  type FiltroAdmin,
  type PagamentoDoFiltro,
} from "@/lib/admin/filtros";
import type { BarbeariaNoPainel } from "@/lib/admin/tipos";
import { sanitizarTextoLivre, semAcento } from "@/lib/formato";
import { cn } from "@/lib/utils";

type Secao = "todos" | "periodo" | "barbearias" | "pagamento";

const SECOES: { id: Secao; rotulo: string }[] = [
  { id: "todos", rotulo: "Todos" },
  { id: "periodo", rotulo: "Período" },
  { id: "barbearias", rotulo: "Barbearias" },
  { id: "pagamento", rotulo: "Pagamento" },
];

/**
 * Os filtros da tela Movimento. Mesma forma do diálogo do dashboard:
 * seções à esquerda, opções à direita, fichas do RASCUNHO no rodapé, e a
 * URL só muda no "Aplicar filtros".
 *
 * Quem usa passa `key` nova a cada abertura (ver `Movimento`): é o que
 * descarta o rascunho de uma abertura anterior que não foi aplicada.
 */
export function DialogoFiltrosAdmin({
  aberto,
  aoMudarAberto,
  valor,
  mesAtual,
  barbearias,
  aoAplicar,
}: {
  aberto: boolean;
  aoMudarAberto: (aberto: boolean) => void;
  valor: FiltroAdmin;
  mesAtual: string;
  barbearias: BarbeariaNoPainel[];
  aoAplicar: (filtro: FiltroAdmin) => void;
}) {
  // Nasce do que está aplicado. Quem abre passa uma `key` nova a cada
  // abertura, então o rascunho recomeça sem efeito nenhum para sincronizar.
  const [rascunho, setRascunho] = useState(valor);
  const [secao, setSecao] = useState<Secao>(() =>
    valor.barbeariaIds.length > 0
      ? "barbearias"
      : valor.pagamento !== "todas"
        ? "pagamento"
        : "periodo",
  );
  const [busca, setBusca] = useState("");

  const nomes = useMemo(
    () => new Map(barbearias.map((b) => [b.id, b.nome])),
    [barbearias],
  );

  const atributos = useMemo(
    () => atributosDoFiltroAdmin(rascunho, mesAtual, nomes),
    [rascunho, mesAtual, nomes],
  );

  const termo = semAcento(busca.trim()).toLowerCase();
  const filtradas = useMemo(
    () =>
      termo
        ? barbearias.filter((b) =>
            [b.nome, b.slug].some((c) => semAcento(c).toLowerCase().includes(termo)),
          )
        : barbearias,
    [barbearias, termo],
  );

  function alternar(id: string, marcado: boolean) {
    setRascunho((atual) => ({
      ...atual,
      barbeariaIds: marcado
        ? atual.barbeariaIds.includes(id)
          ? atual.barbeariaIds
          : [...atual.barbeariaIds, id]
        : atual.barbeariaIds.filter((x) => x !== id),
    }));
  }

  function limpar() {
    setRascunho(filtroAdminPadrao(mesAtual));
    setSecao("todos");
    setBusca("");
  }

  function aplicar() {
    aoAplicar(rascunho);
    aoMudarAberto(false);
  }

  return (
    <Modal
      aberto={aberto}
      aoMudarAberto={aoMudarAberto}
      tamanho="grande"
      titulo="Filtros"
      descricao="Escolha o recorte — as somas mudam ao aplicar."
      classNameCorpo="p-0 overflow-hidden flex flex-col"
      rodape={
        <>
          <div className="mr-auto flex min-w-0 flex-col gap-2 sm:max-w-[58%]">
            <ListaDeAtributos
              atributos={atributos}
              aoRemover={(a) =>
                setRascunho((atual) => removerAtributoAdmin(atual, a, mesAtual))
              }
            />
          </div>
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
        <nav
          aria-label="Seções do filtro"
          className="flex flex-row gap-1 overflow-x-auto border-b border-border p-2 sm:flex-col sm:overflow-y-auto sm:border-r sm:border-b-0"
        >
          {SECOES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                if (s.id === "todos") {
                  setRascunho(filtroAdminPadrao(mesAtual));
                }
                setSecao(s.id);
              }}
              className={cn(
                "shrink-0 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                // `background` e não `secondary`: ver o mesmo comentário no
                // diálogo do dashboard (no escuro, secondary = superfície).
                secao === s.id
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:bg-background/50 hover:text-foreground",
              )}
            >
              {s.rotulo}
            </button>
          ))}
        </nav>

        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto p-4">
          {secao === "todos" ? (
            <div className="flex flex-col gap-2">
              <h3 className="font-semibold">Todos</h3>
              <p className="text-sm text-muted-foreground">
                Todas as barbearias, no mês corrente. Escolher esta seção e
                aplicar limpa período, barbearias e pagamento.
              </p>
            </div>
          ) : null}

          {secao === "periodo" ? (
            <PainelPeriodo valor={rascunho} aoMudar={setRascunho} />
          ) : null}

          {secao === "barbearias" ? (
            <div className="flex flex-col gap-3">
              <div>
                <h3 className="font-semibold">Barbearias</h3>
                <p className="text-sm text-muted-foreground">
                  Nenhuma marcada = todas.
                </p>
              </div>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(sanitizarTextoLivre(e.target.value))}
                  placeholder="Pesquisar"
                  className="pl-9"
                  aria-label="Pesquisar barbearia"
                />
              </div>
              {filtradas.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma barbearia com esse nome.
                </p>
              ) : (
                <ul className="flex flex-col gap-0.5">
                  {filtradas.map((b) => (
                    <li key={b.id}>
                      <Opcao
                        htmlFor={`filtro-barbearia-${b.id}`}
                        rotulo={b.nome}
                        ajuda={b.slug}
                        controle={
                          <Checkbox
                            id={`filtro-barbearia-${b.id}`}
                            checked={rascunho.barbeariaIds.includes(b.id)}
                            onCheckedChange={(v) => alternar(b.id, v === true)}
                          />
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {secao === "pagamento" ? (
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="font-semibold">Pagamento</h3>
                <p className="text-sm text-muted-foreground">
                  Pela situação de hoje, não pela do período escolhido.
                </p>
              </div>
              <RadioGrupo
                value={rascunho.pagamento}
                onValueChange={(v) =>
                  setRascunho((a) => ({ ...a, pagamento: v as PagamentoDoFiltro }))
                }
                className="flex flex-col gap-1"
              >
                <Opcao
                  htmlFor="filtro-pagamento-todas"
                  rotulo="Todas"
                  controle={<RadioItem id="filtro-pagamento-todas" value="todas" />}
                />
                <Opcao
                  htmlFor="filtro-pagamento-adimplentes"
                  rotulo="Adimplentes"
                  ajuda="Em dia ou liberadas à mão."
                  controle={
                    <RadioItem id="filtro-pagamento-adimplentes" value="adimplentes" />
                  }
                />
                <Opcao
                  htmlFor="filtro-pagamento-inadimplentes"
                  rotulo="Inadimplentes"
                  ajuda="Mensalidade vencida (em tolerância) ou bloqueadas."
                  controle={
                    <RadioItem id="filtro-pagamento-inadimplentes" value="inadimplentes" />
                  }
                />
              </RadioGrupo>
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
