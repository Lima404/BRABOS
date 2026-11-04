import type { CSSProperties } from "react";

import { Janela, Lateral } from "@/components/mockup/janela";
import { degrau } from "@/lib/coreografia";
import { DIA_ABERTO, OUTUBRO, SERVICOS } from "@/lib/dados";

const DIAS_DA_SEMANA = ["DOM.", "SEG.", "TER.", "QUA.", "QUI.", "SEX.", "SÁB."];

/** Quantos agendamentos o mês tem, somando o que está visível e o "+N". */
const TOTAL = OUTUBRO.reduce(
  (soma, dia) =>
    soma + (dia ? dia.agendamentos.length + (dia.excedentes ?? 0) : 0),
  0,
);

/**
 * Quantos agendamentos já entraram antes de cada dia.
 *
 * Isso decide o atraso de cada chip na cascata. Fica aqui fora, calculado
 * uma vez quando o módulo carrega, e não dentro da renderização: contador
 * que avança durante o render é exatamente o que o compilador do React
 * proíbe, porque ele pode renderizar o mesmo trecho duas vezes.
 */
const ANTES_DE = OUTUBRO.map((_, i) =>
  OUTUBRO.slice(0, i).reduce(
    (soma, dia) => soma + (dia ? dia.agendamentos.length : 0),
    0,
  ),
);

/**
 * A Agenda do BARBOS, remontada.
 *
 * A ordem de montagem é de propósito: moldura, barra lateral, título,
 * ferramentas, filtros, o esqueleto do calendário, e só então os
 * agendamentos caindo dia a dia. É a ordem em que a tela de verdade
 * carrega, e é o que faz a animação parecer um sistema ligando em vez de
 * uma peça publicitária.
 */
export function MockupAgenda({ inicio = 0 }: { inicio?: number }) {
  return (
    <Janela endereco="www.barboss.com.br/agenda" inicio={inicio}>
      <div className="janela-corpo">
        <Lateral ativo="Agenda" inicio={inicio + 0.02} />

        <div className="conteudo">
          <div className="entra" style={degrau(inicio + 0.09, 0.05)}>
            <h3 className="titulo-tela">Agenda</h3>
            <p className="subtitulo-tela">
              Os horários da barbearia, mês a mês
            </p>
          </div>

          <div
            className="barra-ferramentas entra"
            style={degrau(inicio + 0.12, 0.05)}
          >
            <span className="pilula" data-forte="sim">
              Hoje
            </span>
            <span className="pilula">‹</span>
            <span className="mes-atual">Outubro 2026</span>
            <span className="pilula">›</span>
            <span className="contagem">{TOTAL} agendamentos</span>
            <span className="botao-acao">Novo agendamento</span>
          </div>

          <div className="filtros entra" style={degrau(inicio + 0.15, 0.05)}>
            <span className="filtro" data-ativo="sim">
              Todos
            </span>
            {SERVICOS.map((servico, i) => (
              <span
                key={servico.nome}
                className="filtro entra"
                style={
                  {
                    ...degrau(inicio + 0.16 + i * 0.008, 0.04),
                    "--sobe": "4px",
                  } as CSSProperties
                }
              >
                <span
                  className="filtro-ponto"
                  style={{ background: servico.cor }}
                />
                {servico.nome}
                <span className="filtro-numero">{servico.quantidade}</span>
              </span>
            ))}
          </div>

          <div className="area-calendario">
            <div
              className="calendario entra"
              style={degrau(inicio + 0.19, 0.05)}
            >
              <div className="semana-cabecalho">
                {DIAS_DA_SEMANA.map((dia) => (
                  <div key={dia}>{dia}</div>
                ))}
              </div>

              {[0, 1, 2, 3, 4].map((semana) => (
                <div className="semana" key={semana}>
                  {OUTUBRO.slice(semana * 7, semana * 7 + 7).map((dia, i) => {
                    const chave = `${semana}-${i}`;
                    if (!dia) {
                      return (
                        <div key={chave} className="dia" data-fora="sim" />
                      );
                    }

                    const foraDoMes = semana === 0 && dia.numero > 20;
                    // A cascata segue a leitura do calendário, da esquerda
                    // para a direita e de cima para baixo.
                    const antes = ANTES_DE[semana * 7 + i];

                    return (
                      <div
                        key={chave}
                        className="dia"
                        data-fora={foraDoMes ? "sim" : "nao"}
                        data-hoje={dia.numero === 26 ? "sim" : "nao"}
                      >
                        <span className="dia-numero">{dia.numero}</span>

                        {dia.folga && <span className="dia-folga">FOLGA</span>}

                        {dia.agendamentos.map((agendamento, j) => {
                          const servico = SERVICOS[agendamento.servico];
                          const atraso = inicio + 0.24 + (antes + j) * 0.0045;
                          return (
                            <span
                              key={agendamento.hora + agendamento.cliente}
                              className="chip entra entra-pop"
                              style={
                                {
                                  ...degrau(atraso, 0.04),
                                  background: `${servico.cor}1f`,
                                } as CSSProperties
                              }
                            >
                              <span
                                className="chip-ponto"
                                style={{ background: servico.cor }}
                              />
                              <span className="chip-hora">
                                {agendamento.hora}
                              </span>
                              <span className="chip-nome">
                                {agendamento.cliente}
                              </span>
                            </span>
                          );
                        })}

                        {dia.excedentes && (
                          <span
                            className="chip-mais entra"
                            style={degrau(
                              inicio +
                                0.24 +
                                (antes + dia.agendamentos.length) * 0.0045,
                              0.04,
                            )}
                          >
                            +{dia.excedentes} mais
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div
              className="painel-dia entra"
              style={
                {
                  ...degrau(inicio + 0.52, 0.06),
                  "--sobe": "0px",
                  "--encolhe": "0.04",
                } as CSSProperties
              }
            >
              <div className="painel-topo">
                <div>
                  <p className="painel-titulo">{DIA_ABERTO.titulo}</p>
                  <p className="painel-resumo">{DIA_ABERTO.resumo}</p>
                </div>
                <div className="flex items-center gap-[0.4em]">
                  <span className="rotulo-chave">Dia concluído</span>
                  <span className="chave" data-ligada="sim" />
                </div>
              </div>

              {DIA_ABERTO.cartoes.map((cartao, i) => {
                const servico = SERVICOS[cartao.servico];
                return (
                  <div
                    key={cartao.hora}
                    className="cartao-dia entra entra-pop"
                    style={degrau(inicio + 0.58 + i * 0.03, 0.05)}
                  >
                    <div className="cartao-topo">
                      <span className="cartao-hora">{cartao.hora}</span>
                      <span className="cartao-nome">{cartao.cliente}</span>
                      <span
                        className="chave ml-auto"
                        data-ligada="sim"
                        style={
                          {
                            // As chaves viram DEPOIS do cartão aparecer —
                            // é o gesto que a seção inteira existe para
                            // mostrar.
                            transitionDelay: "160ms",
                          } as CSSProperties
                        }
                      />
                    </div>
                    <div className="cartao-base">
                      <span
                        className="etiqueta"
                        style={{ color: servico.cor }}
                      >
                        <span
                          className="filtro-ponto"
                          style={{ background: servico.cor }}
                        />
                        {/* O nome precisa do próprio elemento: reticências
                            não se aplicam a texto solto dentro de um flex. */}
                        <span className="linha-nome">{servico.nome}</span>
                      </span>
                      <span className="etiqueta-estado">Concluído</span>
                      <span className="cartao-preco">{cartao.preco}</span>
                    </div>
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
