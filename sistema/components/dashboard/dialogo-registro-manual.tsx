"use client";

import { useMemo, useState, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";

import {
  lerRegistroManual,
  salvarRegistroManual,
} from "@/app/(sistema)/dashboard/acoes";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Input, InputDeTempo } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
  Select,
  SelectConteudo,
  SelectGatilho,
  SelectItem,
  SelectValor,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { buscarConfiguracao } from "@/lib/agenda/api";
import { buscarBarbeiros } from "@/lib/barbearia/api";
import {
  DIA_SEM_LANCAMENTO,
  QUANTIDADE_MAXIMA,
  faltaNaPrateleira,
  linhasParaSalvar,
  quantidadeDigitada,
  quantidadeNaTela,
  totalLancado,
  type ItemDoRegistro,
} from "@/lib/dashboard/registro-manual";
import { buscarProdutos } from "@/lib/estoque/api";
import { NOME_DO_TIPO } from "@/lib/estoque/tipos";
import { duracaoPorExtenso, hojeNaBarbearia, moeda } from "@/lib/formato";
import { chaves } from "@/lib/query";
import { cn } from "@/lib/utils";

/**
 * Registro manual do dia.
 *
 * Para a barbearia que não usa agenda: no fim do expediente o dono abre
 * isto, escolhe o dia e o barbeiro, e digita quantos de cada serviço e
 * quantos de cada produto saíram. O dashboard passa a contar aquilo.
 *
 * CORRIGE, NÃO SOMA. Reabrir o mesmo dia mostra os números que já estão
 * lá; mudar 5 para 6 deixa 6, e o estoque anda só a diferença. Toda essa
 * regra mora na `registrar_dia_manual` (0040) — aqui é só a mesa.
 */
type Aba = "servicos" | "loja";

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "servicos", rotulo: "Serviços" },
  { id: "loja", rotulo: "Loja" },
];

const SEM_BARBEIRO = "balcao";

export function DialogoRegistroManual({
  aberto,
  aoMudarAberto,
}: {
  aberto: boolean;
  aoMudarAberto: (aberto: boolean) => void;
}) {
  const { avisar } = useToast();
  const clienteDeCache = useQueryClient();
  const [salvando, iniciarSalvamento] = useTransition();

  const [aba, setAba] = useState<Aba>("servicos");
  const [dia, setDia] = useState(() => hojeNaBarbearia());
  const [barbeiroId, setBarbeiroId] = useState<string | null>(null);
  // Só o que a pessoa digitou AGORA. O resto vem do que já está lançado —
  // ver `quantidadeNaTela`.
  const [digitado, setDigitado] = useState<{
    servicos: Record<string, number>;
    produtos: Record<string, number>;
  }>({ servicos: {}, produtos: {} });

  // Reabrir recomeça limpo. Isto é ajuste de estado DURANTE a renderização,
  // e não um efeito: efeito rodaria depois de um quadro já pintado com os
  // números do dia anterior.
  const [abertoAntes, setAbertoAntes] = useState(aberto);
  if (aberto !== abertoAntes) {
    setAbertoAntes(aberto);
    if (aberto) {
      setAba("servicos");
      setDia(hojeNaBarbearia());
      setBarbeiroId(null);
      setDigitado({ servicos: {}, produtos: {} });
    }
  }

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

  // O dia já lançado. Troca junto com o par (dia, barbeiro) porque é a
  // chave do cache — mudar o barbeiro no seletor busca o dia dele.
  const { data: jaLancado, isFetching: lendoDia } = useQuery({
    queryKey: chaves.dashboard.registroManual(dia, barbeiroId),
    // Arrow obrigatória: passar a ação por referência faria o React Query
    // mandar o próprio contexto dele (com um AbortSignal) como argumento,
    // e ação de servidor serializa o que recebe.
    queryFn: () => lerRegistroManual(dia, barbeiroId),
    enabled: aberto,
  });

  const dia0 = jaLancado ?? DIA_SEM_LANCAMENTO;

  const barbeiros = useMemo(() => barbeirosData ?? [], [barbeirosData]);

  const servicos = useMemo<ItemDoRegistro[]>(
    () =>
      (ajustes?.servicos ?? [])
        .filter((s) => s.ativo)
        .map((s) => ({
          id: s.id,
          nome: s.nome,
          detalhe: duracaoPorExtenso(s.duracaoMin),
          precoCentavos: s.precoCentavos,
          unidades: null,
        })),
    [ajustes],
  );

  // Todo produto cadastrado, e não só o da vitrine: o que não está à venda
  // no QR continua saindo no balcão, e é justamente isso que o dono está
  // lançando à mão.
  const produtos = useMemo<ItemDoRegistro[]>(
    () =>
      (produtosData ?? []).map((p) => ({
        id: p.id,
        nome: p.nome,
        detalhe: `${NOME_DO_TIPO[p.tipo]} · ${p.unidades} em estoque`,
        precoCentavos: p.precoCentavos,
        unidades: p.unidades,
      })),
    [produtosData],
  );

  const totalServicos = totalLancado(servicos, digitado.servicos, dia0.servicos);
  const totalProdutos = totalLancado(produtos, digitado.produtos, dia0.produtos);
  const faltas = faltaNaPrateleira(produtos, digitado.produtos, dia0.produtos);

  const linhasServicos = linhasParaSalvar(
    servicos,
    digitado.servicos,
    dia0.servicos,
  );
  const linhasProdutos = linhasParaSalvar(
    produtos,
    digitado.produtos,
    dia0.produtos,
  );

  const semBarbeiro = barbeiroId === null;
  const nada = linhasServicos.length === 0 && linhasProdutos.length === 0;

  function mudar(grupo: Aba, id: string, bruto: string) {
    const campo = grupo === "servicos" ? "servicos" : "produtos";
    setDigitado((atual) => ({
      ...atual,
      [campo]: { ...atual[campo], [id]: quantidadeDigitada(bruto) },
    }));
  }

  function salvar() {
    iniciarSalvamento(async () => {
      const resultado = await salvarRegistroManual({
        data: dia,
        barbeiroId,
        servicos: linhasServicos,
        produtos: linhasProdutos,
      });

      if (!resultado.ok) {
        avisar({
          tom: "erro",
          titulo: "Não consegui lançar",
          descricao: resultado.erro,
        });
        return;
      }

      // O dashboard inteiro muda de número, e o estoque junto. Invalidar e
      // não `router.refresh()`: o React Query já sabe quem depende do quê.
      await Promise.all([
        clienteDeCache.invalidateQueries({ queryKey: chaves.dashboard.todas }),
        clienteDeCache.invalidateQueries({ queryKey: chaves.estoque.todas }),
      ]);

      avisar({
        tom: "sucesso",
        titulo: "Dia lançado",
        descricao: resumoDoLancamento(resultado.cortes, resultado.itens),
      });

      aoMudarAberto(false);
    });
  }

  return (
    <Modal
      aberto={aberto}
      aoMudarAberto={aoMudarAberto}
      tamanho="grande"
      titulo="Registro manual"
      descricao="Quantos de cada serviço e de cada produto saíram no dia."
      classNameCorpo="p-0 overflow-hidden flex flex-col"
      rodape={
        <>
          <div className="mr-auto flex min-w-0 flex-col gap-1">
            <p className="text-sm">
              <span className="text-muted-foreground">Total do dia: </span>
              <span className="font-semibold tabular-nums">
                {moeda(totalServicos + totalProdutos)}
              </span>
            </p>
            {faltas.length > 0 ? (
              <p className="flex items-start gap-1.5 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>
                  {faltas[0].nome}: lançou {faltas[0].pedido} e só há{" "}
                  {faltas[0].disponivel} em estoque
                  {faltas.length > 1 ? ` (+${faltas.length - 1})` : ""}.
                </span>
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            size="lg"
            onClick={salvar}
            disabled={salvando || nada || faltas.length > 0}
          >
            {salvando ? "Lançando…" : "Lançar no dashboard"}
          </Button>
        </>
      }
    >
      {/* Dia e barbeiro valem para as DUAS abas, então ficam acima delas. */}
      <div className="grid shrink-0 gap-3 border-b border-border p-4 sm:grid-cols-2">
        <Campo rotulo="Dia">
          <InputDeTempo
            type="date"
            value={dia}
            max={hojeNaBarbearia()}
            onChange={(e) => setDia(e.target.value)}
          />
        </Campo>

        <Campo
          rotulo="Barbeiro"
          ajuda={
            semBarbeiro
              ? "Balcão só aceita produtos — corte precisa de quem cortou."
              : undefined
          }
        >
          <Select
            value={barbeiroId ?? SEM_BARBEIRO}
            onValueChange={(v) =>
              setBarbeiroId(v === SEM_BARBEIRO ? null : v)
            }
          >
            <SelectGatilho>
              <SelectValor placeholder="Selecione um barbeiro" />
            </SelectGatilho>
            <SelectConteudo>
              <SelectItem value={SEM_BARBEIRO}>
                <span className="text-muted-foreground">
                  Balcão (sem barbeiro)
                </span>
              </SelectItem>
              {/* A lista já vem só com os ativos (repositório de barbeiros). */}
              {barbeiros.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.nome}
                </SelectItem>
              ))}
            </SelectConteudo>
          </Select>
        </Campo>
      </div>

      <div className="grid min-h-[min(20rem,45dvh)] flex-1 sm:grid-cols-[11rem_minmax(0,1fr)]">
        <nav
          aria-label="O que lançar"
          className="flex flex-row gap-1 overflow-x-auto border-b border-border p-2 sm:flex-col sm:overflow-y-auto sm:border-r sm:border-b-0"
        >
          {ABAS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAba(a.id)}
              className={cn(
                "shrink-0 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                aba === a.id
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
              )}
            >
              {a.rotulo}
              <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
                {a.id === "servicos"
                  ? somar(servicos, digitado.servicos, dia0.servicos)
                  : somar(produtos, digitado.produtos, dia0.produtos)}
              </span>
            </button>
          ))}
        </nav>

        <div className="flex min-h-0 flex-col overflow-y-auto">
          {aba === "servicos" ? (
            <Tabela
              itens={servicos}
              digitado={digitado.servicos}
              jaLancado={dia0.servicos}
              carregando={lendoDia}
              desabilitado={semBarbeiro}
              aviso={
                semBarbeiro
                  ? "Escolha um barbeiro acima para lançar serviços."
                  : null
              }
              vazio="Nenhum serviço ativo. Cadastre em Configurar agenda."
              aoMudar={(id, v) => mudar("servicos", id, v)}
            />
          ) : (
            <Tabela
              itens={produtos}
              digitado={digitado.produtos}
              jaLancado={dia0.produtos}
              carregando={lendoDia}
              desabilitado={false}
              aviso={null}
              vazio="Nenhum produto cadastrado. Cadastre em Estoque."
              aoMudar={(id, v) => mudar("loja", id, v)}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}

function somar(
  itens: ItemDoRegistro[],
  digitado: Record<string, number>,
  jaLancado: Record<string, number>,
): number {
  let total = 0;
  for (const i of itens) {
    total += quantidadeNaTela(i.id, digitado, jaLancado);
  }
  return total;
}

function resumoDoLancamento(cortes: number, itens: number): string {
  const partes: string[] = [];
  if (cortes > 0) {
    partes.push(cortes === 1 ? "1 serviço" : `${cortes} serviços`);
  }
  if (itens > 0) {
    partes.push(itens === 1 ? "1 produto" : `${itens} produtos`);
  }
  return partes.length > 0 ? partes.join(" e ") : "Lançamento apagado.";
}

function Tabela({
  itens,
  digitado,
  jaLancado,
  carregando,
  desabilitado,
  aviso,
  vazio,
  aoMudar,
}: {
  itens: ItemDoRegistro[];
  digitado: Record<string, number>;
  jaLancado: Record<string, number>;
  carregando: boolean;
  desabilitado: boolean;
  aviso: string | null;
  vazio: string;
  aoMudar: (id: string, bruto: string) => void;
}) {
  if (itens.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">{vazio}</p>;
  }

  return (
    <div className="flex flex-col">
      {aviso ? (
        <p className="border-b border-border bg-secondary/40 px-4 py-2.5 text-sm text-muted-foreground">
          {aviso}
        </p>
      ) : null}

      <table className="w-full text-sm">
        <caption className="sr-only">
          Quantidade lançada de cada item no dia
        </caption>
        <thead className="sticky top-0 z-10 bg-popover">
          <tr className="border-b border-border text-left">
            <th scope="col" className="px-4 py-2 font-medium">
              Item
            </th>
            <th scope="col" className="px-2 py-2 text-right font-medium">
              Preço
            </th>
            <th scope="col" className="w-24 px-4 py-2 text-right font-medium">
              Quantos
            </th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item) => {
            const quantidade = quantidadeNaTela(item.id, digitado, jaLancado);
            const faltou =
              item.unidades !== null &&
              quantidade > item.unidades + (jaLancado[item.id] ?? 0);

            return (
              <tr key={item.id} className="border-b border-border/60">
                <td className="px-4 py-2">
                  <label
                    htmlFor={`manual-${item.id}`}
                    className="block cursor-pointer"
                  >
                    <span className="font-medium">{item.nome}</span>
                    {item.detalhe ? (
                      <span className="block text-xs text-muted-foreground">
                        {item.detalhe}
                      </span>
                    ) : null}
                  </label>
                </td>
                <td className="px-2 py-2 text-right whitespace-nowrap tabular-nums text-muted-foreground">
                  {moeda(item.precoCentavos)}
                </td>
                <td className="px-4 py-2 text-right">
                  <Input
                    id={`manual-${item.id}`}
                    // `inputMode` e não `type=number`: a rodinha do mouse
                    // muda o valor de um `number` sem querer, e o teclado
                    // do celular já vem numérico com isto.
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={3}
                    value={quantidade === 0 ? "" : String(quantidade)}
                    placeholder="0"
                    disabled={desabilitado || carregando}
                    aria-invalid={faltou || undefined}
                    aria-label={`Quantos ${item.nome}`}
                    onChange={(e) => aoMudar(item.id, e.target.value)}
                    className={cn(
                      "text-right tabular-nums",
                      faltou && "border-destructive",
                    )}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="px-4 py-3 text-xs text-muted-foreground">
        Até {QUANTIDADE_MAXIMA} por linha. Deixar em branco apaga o
        lançamento daquele item no dia.
      </p>
    </div>
  );
}
