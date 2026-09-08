"use client";

import { useState } from "react";
import { CalendarPlus, Inbox, Scissors, Trash2 } from "lucide-react";

import { Alerta } from "@/components/ui/alerta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Campo, Opcao } from "@/components/ui/campo";
import { Checkbox } from "@/components/ui/checkbox";
import { Esqueleto } from "@/components/ui/esqueleto";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { RadioGrupo, RadioItem } from "@/components/ui/radio";
import {
  Select,
  SelectConteudo,
  SelectGatilho,
  SelectGrupo,
  SelectItem,
  SelectRotulo,
  SelectSeparador,
  SelectValor,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { Textarea } from "@/components/ui/textarea";

/**
 * Amostruário dos componentes.
 *
 * Serve para duas coisas: escolher a peça certa sem caçar pelo código, e
 * conferir num lugar só que tudo continua legível nos dois temas depois de
 * mexer nos tokens. Não é tela de produto — não entra no menu lateral.
 */
export function Amostruario() {
  const [servico, setServico] = useState("");
  const [pagamento, setPagamento] = useState("dinheiro");
  const [confirma, setConfirma] = useState(true);
  const [lembrete, setLembrete] = useState(false);
  const [online, setOnline] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const { avisar } = useToast();

  return (
    <div className="flex flex-col gap-10">
      <Secao
        titulo="Botão"
        nota="Um âmbar por tela. `sm` e `xs` existem só para área de mouse — nunca em fluxo tocado durante o atendimento."
      >
        <Amostra rotulo="Variantes">
          <Button>Novo agendamento</Button>
          <Button variant="secondary">Hoje</Button>
          <Button variant="outline">Cancelar</Button>
          <Button variant="ghost">Ver mais</Button>
          <Button variant="destructive">
            <Trash2 />
            Excluir
          </Button>
          <Button variant="link">Recuperar acesso</Button>
        </Amostra>

        <Amostra rotulo="Tamanhos">
          <Button size="lg">48px — ação principal</Button>
          <Button>44px — padrão</Button>
          <Button size="icon" aria-label="Agendar">
            <CalendarPlus />
          </Button>
          <Button size="sm">36px — só mouse</Button>
        </Amostra>

        <Amostra rotulo="Estados">
          <Button disabled>Desabilitado</Button>
          <Button variant="outline" disabled>
            Desabilitado
          </Button>
        </Amostra>
      </Secao>

      <Secao
        titulo="Campo"
        nota="Amarra rótulo, ajuda e erro ao controle sozinho. Marcamos o opcional, não o obrigatório."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Campo rotulo="Nome do cliente">
            <Input placeholder="Rafael Nunes" />
          </Campo>

          <Campo rotulo="Telefone" opcional ajuda="Só para avisar de mudança.">
            <Input placeholder="(11) 90000-0000" inputMode="tel" />
          </Campo>

          <Campo rotulo="Valor" erro="Informe o valor como 45,00.">
            <Input defaultValue="quarenta e cinco" inputMode="decimal" />
          </Campo>

          <Campo rotulo="Identificador" ajuda="Gerado pelo sistema.">
            <Input defaultValue="a1b2c3" disabled />
          </Campo>
        </div>

        <Campo
          rotulo="Observação"
          opcional
          ajuda="O que o barbeiro precisa lembrar antes de começar."
        >
          <Textarea placeholder="Corta baixo dos lados, deixa em cima." />
        </Campo>
      </Secao>

      <Secao
        titulo="Select"
        nota="Gêmeo do Input: 48px, texto de 16px, mesma borda. Cada item da lista também tem 44px."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Campo rotulo="Serviço">
            <Select value={servico} onValueChange={setServico}>
              <SelectGatilho>
                <SelectValor placeholder="Escolha o serviço" />
              </SelectGatilho>
              <SelectConteudo>
                {/* SelectRotulo exige SelectGrupo em volta — regra do Radix. */}
                <SelectGrupo>
                  <SelectRotulo>Mais pedidos</SelectRotulo>
                  <SelectItem value="cabelo">Cabelo</SelectItem>
                  <SelectItem value="barba">Barba</SelectItem>
                  <SelectItem value="cabelo_barba">Cabelo + Barba</SelectItem>
                </SelectGrupo>
                <SelectSeparador />
                <SelectGrupo>
                  <SelectRotulo>Outros</SelectRotulo>
                  <SelectItem value="pezinho">Pezinho</SelectItem>
                  <SelectItem value="sobrancelha" disabled>
                    Sobrancelha (desativado)
                  </SelectItem>
                </SelectGrupo>
              </SelectConteudo>
            </Select>
          </Campo>

          <Campo rotulo="Barbeiro" erro="Escolha quem vai atender.">
            <Select>
              <SelectGatilho>
                <SelectValor placeholder="Escolha o barbeiro" />
              </SelectGatilho>
              <SelectConteudo>
                <SelectItem value="1">Diego</SelectItem>
                <SelectItem value="2">Marcos</SelectItem>
              </SelectConteudo>
            </Select>
          </Campo>
        </div>
      </Secao>

      <Secao
        titulo="Escolha"
        nota="Radio para até cinco opções comparadas de relance; acima disso, Select. A linha inteira é o alvo de toque, não a bolinha."
      >
        <Amostra rotulo="Radio — escolha única" coluna>
          <RadioGrupo value={pagamento} onValueChange={setPagamento}>
            <Opcao
              htmlFor="pag-dinheiro"
              rotulo="Dinheiro"
              controle={<RadioItem id="pag-dinheiro" value="dinheiro" />}
            />
            <Opcao
              htmlFor="pag-pix"
              rotulo="Pix"
              ajuda="Cai na hora, sem taxa."
              controle={<RadioItem id="pag-pix" value="pix" />}
            />
            <Opcao
              htmlFor="pag-cartao"
              rotulo="Cartão"
              controle={<RadioItem id="pag-cartao" value="cartao" />}
            />
            <Opcao
              htmlFor="pag-fiado"
              rotulo="Fiado"
              ajuda="Indisponível neste plano."
              desabilitado
              controle={<RadioItem id="pag-fiado" value="fiado" disabled />}
            />
          </RadioGrupo>
        </Amostra>

        <Amostra rotulo="Checkbox — escolha múltipla" coluna>
          <Opcao
            htmlFor="op-confirma"
            rotulo="Pedir confirmação no dia anterior"
            controle={
              <Checkbox
                id="op-confirma"
                checked={confirma}
                onCheckedChange={(v) => setConfirma(v === true)}
              />
            }
          />
          <Opcao
            htmlFor="op-lembrete"
            rotulo="Mandar lembrete uma hora antes"
            ajuda="Só funciona com telefone cadastrado."
            controle={
              <Checkbox
                id="op-lembrete"
                checked={lembrete}
                onCheckedChange={(v) => setLembrete(v === true)}
              />
            }
          />
          <Opcao
            htmlFor="op-parcial"
            rotulo="Alguns dias selecionados"
            ajuda="Estado indeterminado, para grupo com marcação parcial."
            controle={<Checkbox id="op-parcial" checked="indeterminate" />}
          />
        </Amostra>

        <Amostra rotulo="Switch — vale na hora" coluna>
          <Opcao
            htmlFor="op-online"
            rotulo="Aceitar agendamento pelo link"
            ajuda="Aplica na hora. Se a mudança só vale depois do Salvar, use Checkbox."
            controle={
              <Switch
                id="op-online"
                checked={online}
                onCheckedChange={setOnline}
              />
            }
          />
        </Amostra>
      </Secao>

      <Secao
        titulo="Alerta"
        nota="Todo tom carrega ícone, não só cor de fundo. role=alert só no erro — leitor de tela interrompe a leitura quando vê isso."
      >
        <div className="flex flex-col gap-3">
          <Alerta>Já existe um serviço ativo com esse nome.</Alerta>
          <Alerta tom="aviso" titulo="Confirmação de e-mail desligada">
            Religue antes de ir pra produção: sem ela qualquer pessoa cria conta
            com o e-mail de outra.
          </Alerta>
          <Alerta tom="info">
            Sua conta foi confirmada. Entre com e-mail e senha.
          </Alerta>
          <Alerta
            tom="sucesso"
            titulo="Serviço cadastrado"
            acao={
              <Button size="sm" variant="outline">
                Ver na agenda
              </Button>
            }
          >
            Pezinho · R$ 20,00 · 15 min
          </Alerta>
        </div>
      </Secao>

      <Secao
        titulo={"Toast"}
        nota="Recado que aparece e some. O Alerta fica na pagina, para o que se rele; o Toast confirma (ou recusa) uma acao que acabou de acontecer."
      >
        <Amostra rotulo="Tons">
          <Button
            variant="outline"
            onClick={() =>
              avisar({
                tom: "erro",
                titulo: "Horário ocupado",
                descricao: "Rafael Nunes já está marcado das 09:00 às 10:00.",
              })
            }
          >
            Erro
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              avisar({
                tom: "aviso",
                titulo: "Estoque baixo",
                descricao: "Pomada modeladora: 2 unidades.",
              })
            }
          >
            Aviso
          </Button>
          <Button
            variant="outline"
            onClick={() => avisar({ tom: "info", titulo: "Agenda atualizada" })}
          >
            Info
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              avisar({
                tom: "sucesso",
                titulo: "Agendamento marcado",
                descricao: "Diego Marques · 10/09 às 14:00",
              })
            }
          >
            Sucesso
          </Button>
        </Amostra>
      </Secao>

      <Secao
        titulo="Badge"
        nota="Estado nunca só por cor: o texto é o sinal. Os que geram prejuízo ganham ícone ou tachado."
      >
        <Amostra rotulo="Variantes">
          <Badge>Hoje</Badge>
          <Badge variant="secondary">Agendado</Badge>
          <Badge variant="outline">4 cadeiras</Badge>
          <Badge variant="destructive">Não compareceu</Badge>
        </Amostra>
      </Secao>

      <Secao
        titulo="Estado vazio"
        nota="Nunca é beco sem saída: ou traz a ação que preenche a tela, ou explica o que faz aparecer coisa ali."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <EstadoVazio
            icone={Inbox}
            titulo="Nenhum agendamento"
            descricao="Quando alguém marcar, aparece aqui em ordem de horário."
            acao={
              <Button variant="secondary" className="w-full">
                <CalendarPlus />
                Novo agendamento
              </Button>
            }
          />
          <EstadoVazio
            icone={Scissors}
            titulo="Nenhum serviço cadastrado"
            descricao="Sem serviço não dá pra marcar horário. Comece pelo mais pedido."
          />
        </div>
      </Secao>

      <Secao
        titulo="Esqueleto"
        nota="O bloco que ocupa o lugar do conteúdo enquanto ele não chega. Tem que ter a FORMA do que vai chegar — esqueleto genérico faz a tela pular quando o conteúdo entra. Quem anuncia pro leitor de tela é o contêiner da tela, uma vez só; o bloco é aria-hidden. A animação respeita prefers-reduced-motion."
      >
        <Amostra rotulo="Uma tela em carregamento" coluna>
          <div className="flex w-full flex-col gap-3 rounded-lg border border-border p-4">
            <Esqueleto className="h-5 w-40" />
            <Esqueleto className="h-11" />
            <div className="grid gap-3 sm:grid-cols-3">
              <Esqueleto className="h-20" />
              <Esqueleto className="h-20" />
              <Esqueleto className="h-20" />
            </div>
          </div>
        </Amostra>

        <Amostra rotulo="Onde ele mora">
          <p className="max-w-2xl text-sm text-muted-foreground">
            Em <code className="font-mono">loading.tsx</code>, na pasta da
            rota. Toda tela daqui é dinâmica: a navegação espera o servidor
            falar com o Supabase, e sem esse arquivo o navegador segura a tela
            ANTERIOR parada durante a espera — o barbeiro toca de novo achando
            que não pegou.
          </p>
        </Amostra>
      </Secao>

      <Secao
        titulo="Modal"
        nota="Quatro larguras: pequeno, medio, grande, cheio. No celular todas ocupam quase a tela inteira."
      >
        <Amostra rotulo="Abrir">
          <Button variant="outline" onClick={() => setModalAberto(true)}>
            Ver o modal padrão
          </Button>
        </Amostra>

        <Modal
          aberto={modalAberto}
          aoMudarAberto={setModalAberto}
          titulo="Confirmar cancelamento"
          descricao="O horário volta a ficar livre na agenda."
          tamanho="pequeno"
          rodape={
            <>
              <Button variant="outline" onClick={() => setModalAberto(false)}>
                Voltar
              </Button>
              <Button
                variant="destructive"
                onClick={() => setModalAberto(false)}
              >
                Cancelar agendamento
              </Button>
            </>
          }
        >
          <p className="text-sm text-muted-foreground">
            Rafael Nunes, hoje às 09:30, Cabelo + Barba. O cliente não é avisado
            automaticamente.
          </p>
        </Modal>
      </Secao>
    </div>
  );
}

function Secao({
  titulo,
  nota,
  children,
}: {
  titulo: string;
  nota: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="border-b border-border pb-3">
        <h2 className="text-lg font-semibold">{titulo}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{nota}</p>
      </div>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  );
}

function Amostra({
  rotulo,
  coluna,
  children,
}: {
  rotulo: string;
  coluna?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {rotulo}
      </span>
      <div
        className={
          coluna ? "flex flex-col" : "flex flex-wrap items-center gap-3"
        }
      >
        {children}
      </div>
    </div>
  );
}
