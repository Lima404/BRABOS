"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Megaphone, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";

import {
  apagarComunicado,
  descartarFotos,
  listarComunicadosDoAdmin,
  salvarAlerta,
  salvarAtualizacao,
} from "@/app/(sistema)/admin/acoes";
import {
  EditorDeSecoes,
  secaoVazia,
  type SecaoEmEdicao,
} from "@/components/admin/editor-de-secoes";
import { CartaoDeComunicado } from "@/components/comunicados/cartao-comunicado";
import { Alerta } from "@/components/ui/alerta";
import { Button } from "@/components/ui/button";
import { Campo, Opcao } from "@/components/ui/campo";
import { Esqueleto } from "@/components/ui/esqueleto";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { RadioGrupo, RadioItem } from "@/components/ui/radio";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import {
  compararVersoes,
  linkDoPatch,
  PRIMEIRA_VERSAO,
  proximaVersao,
  TEXTO_MAX,
  TIPOS_DE_COMUNICADO,
  TITULO_MAX,
  VERSAO_VALIDA,
  versaoAtual,
  type ComunicadoDoAdmin,
  type TipoDeComunicado,
} from "@/lib/comunicados/tipos";
import { dadosOuErro } from "@/lib/consulta";
import { numero, sanitizarTextoLivre } from "@/lib/formato";
import { chaves } from "@/lib/query";

/**
 * Painel Admin → Notificações.
 *
 * Dois tipos, dois formulários:
 *   - ALERTA: título e texto. Vira faixa no topo das telas.
 *   - ATUALIZAÇÃO: um patch note — versão, título, resumo (o que aparece
 *     no sino) e seções por parte do sistema, com fotos. Vira a página
 *     /patch-notes, e a versão mais alta é a versão do sistema.
 *
 * Publicar é imediato, sem rascunho. Erro de digitação se corrige no
 * Editar, e quem já leu vê a versão nova (marcada "editada").
 */
export function NotificacoesDoAdmin() {
  // `null` = fechado; um tipo = publicar; um comunicado = editar.
  const [emEdicao, setEmEdicao] = useState<ComunicadoDoAdmin | "nova" | null>(null);
  const [paraApagar, setParaApagar] = useState<ComunicadoDoAdmin | null>(null);
  // Remonta o formulário a cada abertura: o rascunho anterior não vaza.
  const [sessao, setSessao] = useState(0);

  const { data, isPending, isError, error, refetch, isRefetching } = useQuery({
    queryKey: chaves.admin.comunicados,
    queryFn: () => dadosOuErro(listarComunicadosDoAdmin()),
  });

  const atual = useMemo(() => versaoAtual((data ?? []).map((c) => c.versao)), [data]);

  function abrir(alvo: ComunicadoDoAdmin | "nova") {
    setSessao((n) => n + 1);
    setEmEdicao(alvo);
  }

  const cabecalho = (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notificações</h1>
        <p className="text-muted-foreground">
          O que você publica aqui aparece para todas as barbearias, no sino do topo.
          {atual ? (
            <>
              {" "}
              Versão do sistema: <strong className="text-foreground">{atual}</strong>.
            </>
          ) : null}
        </p>
      </div>
      <Button type="button" onClick={() => abrir("nova")}>
        <Plus />
        Nova notificação
      </Button>
    </header>
  );

  let corpo: React.ReactNode;
  if (isError) {
    corpo = (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <p className="font-semibold">As notificações não carregaram</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Verifique a conexão e tente de novo."}
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          <RefreshCw className={isRefetching ? "animate-spin" : undefined} />
          Tentar de novo
        </Button>
      </div>
    );
  } else if (isPending) {
    corpo = (
      <div role="status" aria-label="Carregando as notificações" className="flex flex-col gap-4">
        <Esqueleto className="h-44" />
        <Esqueleto className="h-44" />
      </div>
    );
  } else if (data.length === 0) {
    corpo = (
      <EstadoVazio
        icone={Megaphone}
        titulo="Nenhuma notificação publicada"
        descricao="Escreva a primeira: a versão 1.0 do sistema ou um alerta."
        acao={
          <Button variant="outline" onClick={() => abrir("nova")}>
            Escrever notificação
          </Button>
        }
      />
    );
  } else {
    corpo = (
      <div className="flex flex-col gap-4">
        {data.map((c) => (
          <CartaoDeComunicado
            key={c.id}
            comunicado={c}
            rodape={
              <>
                <p className="mr-auto text-sm text-muted-foreground" data-numero>
                  {c.publico === 0
                    ? "Nenhuma barbearia existia quando foi publicada"
                    : `Lida por ${numero(c.lidos)} de ${numero(c.publico)} ${c.publico === 1 ? "barbearia" : "barbearias"}`}
                  {c.versao ? ` · ${c.secoes.length} ${c.secoes.length === 1 ? "seção" : "seções"}` : null}
                </p>
                {c.versao ? (
                  <Button asChild variant="ghost">
                    <Link href={linkDoPatch(c.versao)}>
                      <ExternalLink />
                      Ver no patch notes
                    </Link>
                  </Button>
                ) : null}
                <Button variant="outline" onClick={() => abrir(c)}>
                  <Pencil />
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setParaApagar(c)}
                  className="text-muted-foreground hover:text-faltou"
                >
                  <Trash2 />
                  Apagar
                </Button>
              </>
            }
          />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      {cabecalho}
      {corpo}

      <DialogoComunicado
        key={sessao}
        alvo={emEdicao}
        versaoDoSistema={atual}
        aoFechar={() => setEmEdicao(null)}
      />

      <ConfirmarApagar alvo={paraApagar} aoFechar={() => setParaApagar(null)} />
    </div>
  );
}

type ErrosDoFormulario = {
  versao?: string;
  titulo?: string;
  texto?: string;
  secoes: Record<string, { titulo?: string; texto?: string }>;
};

function DialogoComunicado({
  alvo,
  versaoDoSistema,
  aoFechar,
}: {
  alvo: ComunicadoDoAdmin | "nova" | null;
  versaoDoSistema: string | null;
  aoFechar: () => void;
}) {
  const editando = alvo !== null && alvo !== "nova" ? alvo : null;
  const [tipo, setTipo] = useState<TipoDeComunicado>(editando?.tipo ?? "atualizacao");
  // A primeira versão já nasce escrita (1.0). Depois disso o campo nasce
  // vazio e a ajuda sugere a próxima: número de versão é decisão, não
  // padrão a aceitar sem ler.
  const [versao, setVersao] = useState(
    editando?.versao ?? (versaoDoSistema ? "" : PRIMEIRA_VERSAO),
  );
  const [titulo, setTitulo] = useState(editando?.titulo ?? "");
  const [texto, setTexto] = useState(editando?.texto ?? "");
  const [secoes, setSecoes] = useState<SecaoEmEdicao[]>(() =>
    editando && editando.secoes.length > 0
      ? editando.secoes.map((s) => ({ chave: crypto.randomUUID(), ...s }))
      : [secaoVazia()],
  );
  const [erros, setErros] = useState<ErrosDoFormulario>({ secoes: {} });
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, setPendente] = useState(false);
  // Fotos que subiram NESTA abertura: as que não forem usadas saem do
  // bucket ao cancelar ou ao salvar sem elas.
  const enviadas = useRef<string[]>([]);

  const { avisar } = useToast();
  const clienteQuery = useQueryClient();
  const ehAtualizacao = tipo === "atualizacao";

  function descartarNaoUsadas(usadas: string[]) {
    const ficam = new Set(usadas);
    const soltas = enviadas.current.filter((c) => !ficam.has(c));
    enviadas.current = [];
    if (soltas.length > 0) {
      // Melhor esforço: a foto solta no bucket não aparece em lugar nenhum.
      descartarFotos(soltas).catch((causa) =>
        console.error("[BARBOS] descartar fotos:", causa),
      );
    }
  }

  function cancelar() {
    if (pendente) return;
    descartarNaoUsadas([]);
    aoFechar();
  }

  function validar(): boolean {
    const novos: ErrosDoFormulario = { secoes: {} };
    if (!titulo.trim()) novos.titulo = "Escreva o título.";
    if (!texto.trim()) novos.texto = ehAtualizacao ? "Escreva o resumo." : "Escreva o texto.";

    if (ehAtualizacao) {
      const v = versao.trim();
      if (!VERSAO_VALIDA.test(v)) {
        novos.versao = "Use números e pontos: 1.0, 1.1 ou 1.2.3.";
      } else if (!editando && versaoDoSistema && compararVersoes(v, versaoDoSistema) <= 0) {
        novos.versao = `Precisa ser maior que a atual (${versaoDoSistema}).`;
      }
      for (const s of secoes) {
        const e: { titulo?: string; texto?: string } = {};
        if (!s.titulo.trim()) e.titulo = "Diga que parte do sistema mudou.";
        if (!s.texto.trim()) e.texto = "Escreva o que mudou.";
        if (e.titulo || e.texto) novos.secoes[s.chave] = e;
      }
    }

    setErros(novos);
    return !(
      novos.versao ||
      novos.titulo ||
      novos.texto ||
      Object.keys(novos.secoes).length > 0
    );
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!validar()) {
      setErro("Falta preencher alguma coisa — os campos estão marcados.");
      return;
    }

    setPendente(true);
    try {
      const resultado = ehAtualizacao
        ? await salvarAtualizacao({
            id: editando?.id,
            versao: versao.trim(),
            titulo,
            texto,
            secoes: secoes.map((s) => ({
              titulo: s.titulo,
              texto: s.texto,
              fotos: s.fotos.map((f) => f.caminho),
            })),
          })
        : await salvarAlerta({ id: editando?.id, titulo, texto });

      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }

      descartarNaoUsadas(secoes.flatMap((s) => s.fotos.map((f) => f.caminho)));
      avisar({
        tom: "sucesso",
        titulo: editando
          ? "Notificação salva"
          : ehAtualizacao
            ? `Versão ${versao.trim()} publicada`
            : "Alerta publicado",
        descricao: editando
          ? "Quem abrir já vê a versão nova."
          : "Ela já aparece no sino de todas as barbearias.",
      });
      aoFechar();
      await Promise.all([
        clienteQuery.invalidateQueries({ queryKey: chaves.admin.comunicados }),
        // As telas da própria conta admin (sino, notificações, patch notes).
        clienteQuery.invalidateQueries({ queryKey: chaves.comunicados.todas }),
      ]);
    } catch (causa) {
      console.error("[BARBOS] salvar notificação:", causa);
      setErro("Não consegui falar com o servidor. Recarregue a página e tente de novo.");
    } finally {
      setPendente(false);
    }
  }

  const ajudaDaVersao = editando
    ? "Corrigir o número de uma versão já publicada não lança uma versão nova."
    : versaoDoSistema
      ? `Versão atual do sistema: ${versaoDoSistema}. A nova precisa ser maior — por exemplo, ${proximaVersao(versaoDoSistema)}.`
      : "É a primeira atualização: a versão 1.0.";

  return (
    <Modal
      aberto={alvo !== null}
      aoMudarAberto={(aberto) => {
        if (!aberto) cancelar();
      }}
      tamanho={ehAtualizacao ? "cheio" : "grande"}
      titulo={
        editando
          ? ehAtualizacao
            ? `Editar a versão ${editando.versao}`
            : "Editar alerta"
          : "Nova notificação"
      }
      descricao="Vai para todas as barbearias assim que você publicar."
      rodape={
        <>
          <Button type="button" variant="outline" onClick={cancelar} disabled={pendente}>
            Cancelar
          </Button>
          <Button type="submit" form="formulario-comunicado" size="lg" disabled={pendente}>
            {pendente ? "Salvando…" : editando ? "Salvar" : "Publicar"}
          </Button>
        </>
      }
    >
      <form
        id="formulario-comunicado"
        onSubmit={salvar}
        noValidate
        className="flex flex-col gap-5"
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Tipo</legend>
          {/* O tipo não muda depois de publicado: uma atualização tem
              versão e seções, e virar alerta jogaria as duas fora. */}
          <RadioGrupo
            value={tipo}
            onValueChange={(v) => setTipo(v as TipoDeComunicado)}
            disabled={editando !== null}
            className="grid gap-1 sm:grid-cols-2"
          >
            {(Object.keys(TIPOS_DE_COMUNICADO) as TipoDeComunicado[]).map((t) => (
              <Opcao
                key={t}
                htmlFor={`comunicado-tipo-${t}`}
                rotulo={TIPOS_DE_COMUNICADO[t].rotulo}
                ajuda={TIPOS_DE_COMUNICADO[t].ajuda}
                desabilitado={editando !== null && editando.tipo !== t}
                controle={<RadioItem id={`comunicado-tipo-${t}`} value={t} />}
              />
            ))}
          </RadioGrupo>
        </fieldset>

        {ehAtualizacao ? (
          <Campo rotulo="Versão" ajuda={ajudaDaVersao} erro={erros.versao}>
            <Input
              value={versao}
              inputMode="decimal"
              maxLength={11}
              placeholder={proximaVersao(versaoDoSistema)}
              onChange={(e) => setVersao(e.target.value.replace(/[^0-9.]/g, ""))}
              className="max-w-40"
            />
          </Campo>
        ) : null}

        <Campo
          rotulo="Título"
          ajuda={`${titulo.length} de ${TITULO_MAX} letras.`}
          erro={erros.titulo}
        >
          <Input
            value={titulo}
            maxLength={TITULO_MAX}
            onChange={(e) => setTitulo(sanitizarTextoLivre(e.target.value))}
          />
        </Campo>

        <Campo
          rotulo={ehAtualizacao ? "Resumo" : "Texto"}
          ajuda={
            ehAtualizacao
              ? `Aparece no sino e no topo da versão, antes das seções. ${texto.length} de ${TEXTO_MAX} letras.`
              : `${texto.length} de ${TEXTO_MAX} letras. Linha em branco separa parágrafos.`
          }
          erro={erros.texto}
        >
          <Textarea
            value={texto}
            maxLength={TEXTO_MAX}
            rows={ehAtualizacao ? 3 : 8}
            onChange={(e) => setTexto(sanitizarTextoLivre(e.target.value))}
          />
        </Campo>

        {ehAtualizacao ? (
          <EditorDeSecoes
            secoes={secoes}
            aoMudar={setSecoes}
            aoEnviarFoto={(caminho) => enviadas.current.push(caminho)}
            erros={erros.secoes}
          />
        ) : null}

        {erro ? <Alerta>{erro}</Alerta> : null}
      </form>
    </Modal>
  );
}

function ConfirmarApagar({
  alvo,
  aoFechar,
}: {
  alvo: ComunicadoDoAdmin | null;
  aoFechar: () => void;
}) {
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const { avisar } = useToast();
  const clienteQuery = useQueryClient();

  async function apagar() {
    if (!alvo) return;
    setErro(null);
    setPendente(true);
    try {
      const resultado = await apagarComunicado(alvo.id);
      if (!resultado.ok) {
        // O modal fica aberto com o erro: fechar levaria a explicação junto.
        setErro(resultado.erro);
        return;
      }
      avisar({ tom: "sucesso", titulo: "Notificação apagada" });
      aoFechar();
      await Promise.all([
        clienteQuery.invalidateQueries({ queryKey: chaves.admin.comunicados }),
        clienteQuery.invalidateQueries({ queryKey: chaves.comunicados.todas }),
      ]);
    } catch (causa) {
      console.error("[BARBOS] apagar notificação:", causa);
      setErro("Não consegui falar com o servidor. Recarregue a página e tente de novo.");
    } finally {
      setPendente(false);
    }
  }

  return (
    <Modal
      aberto={alvo !== null}
      aoMudarAberto={(aberto) => {
        if (!aberto && !pendente) {
          setErro(null);
          aoFechar();
        }
      }}
      tamanho="pequeno"
      titulo={alvo?.versao ? `Apagar a versão ${alvo.versao}?` : "Apagar notificação?"}
      rodape={
        <>
          <Button type="button" variant="outline" onClick={aoFechar} disabled={pendente}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" onClick={apagar} disabled={pendente}>
            <Trash2 />
            {pendente ? "Apagando…" : "Apagar"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p>
          <strong>{alvo?.titulo}</strong> some para todas as barbearias,
          inclusive para quem já leu
          {alvo?.versao ? ", junto com as seções e as fotos do patch note" : ""}.
          Não dá para desfazer.
        </p>
        {erro ? <Alerta>{erro}</Alerta> : null}
      </div>
    </Modal>
  );
}
