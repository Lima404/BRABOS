import type { CSSProperties } from "react";

import { Janela, Lateral } from "@/components/mockup/janela";
import { Rosca } from "@/components/mockup/rosca";
import { degrau } from "@/lib/coreografia";
import { CAIXA, emReais, MESES, PRODUTOS, SERVICOS } from "@/lib/dados";

const MAIOR_MES = Math.max(...MESES.map((m) => m.servico + m.loja));

/**
 * O Dashboard do BARBOS, remontado.
 *
 * Os números são de outubro de 2026 na barbearia do Gabriel. Vêm de
 * lib/dados.ts, estáticos — o site não fala com o banco.
 */
export function MockupDashboard({ inicio = 0 }: { inicio?: number }) {
  return (
    <Janela endereco="www.barboss.com.br/dashboard" inicio={inicio}>
      <div className="janela-corpo">
        <Lateral ativo="Dashboard" inicio={inicio + 0.02} />

        <div className="conteudo">
          <div
            className="cabeca-tela flex items-start gap-[1em] entra"
            style={degrau(inicio + 0.09, 0.05)}
          >
            <div>
              <h3 className="titulo-tela">Dashboard</h3>
              <p className="subtitulo-tela">
                mês 2026-10, só o que já foi atendido e pago.
              </p>
            </div>
            <span className="botao-acao">Registro manual</span>
            <span className="pilula" data-forte="sim">
              Filtros
            </span>
          </div>

          <div className="cartoes-caixa">
            <div
              className="cartao-caixa entra entra-pop"
              data-forte="sim"
              style={degrau(inicio + 0.14, 0.05)}
            >
              <p className="cartao-caixa-rotulo">Total do período</p>
              <p className="cartao-caixa-valor">
                {emReais(CAIXA.totalCentavos)}
              </p>
              <p className="cartao-caixa-nota">
                {CAIXA.atendimentos} atendimentos · {CAIXA.vendas} venda
              </p>
            </div>

            <div
              className="cartao-caixa entra entra-pop"
              style={degrau(inicio + 0.17, 0.05)}
            >
              <p className="cartao-caixa-rotulo">
                <span>Serviços</span>
                <span>97% do total</span>
              </p>
              <p className="cartao-caixa-valor">
                {emReais(CAIXA.servicoCentavos)}
              </p>
              <p className="cartao-caixa-nota">
                {CAIXA.atendimentos} atendimentos concluídos
              </p>
            </div>

            <div
              className="cartao-caixa entra entra-pop"
              style={degrau(inicio + 0.2, 0.05)}
            >
              <p className="cartao-caixa-rotulo">
                <span>Loja</span>
                <span>3% do total</span>
              </p>
              <p className="cartao-caixa-valor">
                {emReais(CAIXA.lojaCentavos)}
              </p>
              <p className="cartao-caixa-nota">
                {CAIXA.vendas} venda confirmada
              </p>
            </div>
          </div>

          <div className="quadros">
            <QuadroDeValores
              titulo="Serviços do período"
              sub="Qual serviço tem mais procura e quanto cada um rendeu."
              linhas={SERVICOS}
              centro={CAIXA.atendimentos}
              rodape="atendimentos"
              inicio={inicio + 0.26}
            />
            <QuadroDeValores
              titulo="Produtos vendidos"
              sub="Do mais saído ao que fica na prateleira."
              linhas={PRODUTOS}
              centro={CAIXA.itens}
              rodape="itens"
              inicio={inicio + 0.4}
            />
          </div>

          <div
            className="quadro entra"
            style={{ ...degrau(inicio + 0.56, 0.06), marginTop: "0.7em" } as CSSProperties}
          >
            <p className="quadro-titulo">Mês a mês</p>
            <p className="quadro-sub">
              Todo o histórico, do primeiro movimento até agora.
            </p>

            <div className="barras">
              {MESES.map((mes, i) => {
                const altura = ((mes.servico + mes.loja) / MAIOR_MES) * 100;
                const fatiaLoja = mes.loja / (mes.servico + mes.loja);
                return (
                  <div className="barra-coluna" key={mes.rotulo}>
                    <div
                      className="barra-pilha cresce"
                      style={
                        {
                          ...degrau(inicio + 0.62 + i * 0.03, 0.07),
                          height: `${altura}%`,
                        } as CSSProperties
                      }
                    >
                      <div
                        className="barra-loja"
                        style={{ height: `${fatiaLoja * 100}%` }}
                      />
                      <div
                        className="barra-servico"
                        style={{ height: `${(1 - fatiaLoja) * 100}%` }}
                      />
                    </div>
                    <span className="barra-rotulo">{mes.rotulo}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </Janela>
  );
}

function QuadroDeValores({
  titulo,
  sub,
  linhas,
  centro,
  rodape,
  inicio,
}: {
  titulo: string;
  sub: string;
  linhas: typeof SERVICOS;
  centro: number;
  rodape: string;
  inicio: number;
}) {
  return (
    <div className="quadro entra" style={degrau(inicio, 0.05)}>
      <p className="quadro-titulo">{titulo}</p>
      <p className="quadro-sub">{sub}</p>

      <div className="quadro-corpo">
        <Rosca
          fatias={linhas}
          centro={centro}
          rodape={rodape}
          inicio={inicio + 0.03}
        />

        <div className="lista-valores">
          {linhas.map((linha, i) => (
            <div
              key={linha.nome}
              className="linha-valor entra"
              style={
                {
                  ...degrau(inicio + 0.05 + i * 0.012, 0.04),
                  "--sobe": "5px",
                } as CSSProperties
              }
            >
              <span
                className="filtro-ponto"
                style={{ background: linha.cor }}
              />
              <span className="linha-nome">{linha.nome}</span>
              <span className="linha-qtd">{linha.quantidade}</span>
              <span className="linha-total">{emReais(linha.centavos)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
