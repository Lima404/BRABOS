"use client";

import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Link2, Plus, Trash2, Unlink, X } from "lucide-react";

import { FotoDoPatch } from "@/components/comunicados/foto-do-patch";
import { Alerta } from "@/components/ui/alerta";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AREA_MAX,
  AREAS_SUGERIDAS,
  BUCKET_DAS_FOTOS,
  EXTENSAO_DA_FOTO,
  FOTO_BYTES_MAX,
  FOTOS_POR_SECAO,
  LINK_MAX,
  ROTULO_DO_LINK_MAX,
  ROTULO_PADRAO_DO_LINK,
  SECOES_MAX,
  TEXTO_MAX,
  type FotoDoPatch as Foto,
} from "@/lib/comunicados/tipos";
import { criarClienteNavegador } from "@/lib/supabase/cliente";

/** Uma seção no formulário. `chave` só existe para o React. */
export type SecaoEmEdicao = {
  chave: string;
  titulo: string;
  texto: string;
  fotos: Foto[];
  /** Vazio = seção sem botão. Como foi digitado; quem arruma é o servidor. */
  link: string;
  rotuloDoLink: string;
};

/** O que cada seção pode ter de errado no formulário. */
export type ErrosDaSecao = { titulo?: string; texto?: string; link?: string };

export function secaoVazia(): SecaoEmEdicao {
  return {
    chave: crypto.randomUUID(),
    titulo: "",
    texto: "",
    fotos: [],
    link: "",
    rotuloDoLink: "",
  };
}

/**
 * As seções de um patch note: uma por fluxo do sistema ("Agendamento",
 * "Dashboard", "Nova ferramenta"), cada uma com texto, até 6 fotos e um
 * link opcional, que vira botão no patch note.
 *
 * A foto SOBE NA HORA para o bucket, direto do navegador com a sessão do
 * admin (a política do Storage só aceita a conta admin). Assim o "Publicar"
 * só leva caminhos, e não esbarra no limite de tamanho de uma ação de
 * servidor. Quem subiu e não foi usado é descartado por quem abriu o
 * formulário (`aoEnviarFoto` registra cada envio).
 */
export function EditorDeSecoes({
  secoes,
  aoMudar,
  aoEnviarFoto,
  erros,
}: {
  secoes: SecaoEmEdicao[];
  aoMudar: Dispatch<SetStateAction<SecaoEmEdicao[]>>;
  aoEnviarFoto: (caminho: string) => void;
  /** Por `chave`: o que falta em cada seção. */
  erros: Record<string, ErrosDaSecao>;
}) {
  function mudar(chave: string, parte: Partial<SecaoEmEdicao>) {
    aoMudar((atual) => atual.map((s) => (s.chave === chave ? { ...s, ...parte } : s)));
  }

  function mover(indice: number, para: number) {
    aoMudar((atual) => {
      if (para < 0 || para >= atual.length) return atual;
      const copia = [...atual];
      const [item] = copia.splice(indice, 1);
      copia.splice(para, 0, item);
      return copia;
    });
  }

  function remover(chave: string) {
    aoMudar((atual) => atual.filter((s) => s.chave !== chave));
  }

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-1 text-sm font-medium">Seções</legend>
      <p className="-mt-2 text-sm text-muted-foreground">
        Uma por parte do sistema que mudou. Aparecem nesta ordem no patch note.
      </p>

      {/* Uma lista de sugestões só, para todos os campos de nome. */}
      <datalist id="areas-sugeridas">
        {AREAS_SUGERIDAS.map((a) => (
          <option key={a} value={a} />
        ))}
      </datalist>

      {secoes.map((secao, i) => (
        <CartaoDaSecao
          key={secao.chave}
          secao={secao}
          numero={i + 1}
          primeira={i === 0}
          ultima={i === secoes.length - 1}
          sozinha={secoes.length === 1}
          erros={erros[secao.chave] ?? {}}
          aoMudar={(parte) => mudar(secao.chave, parte)}
          aoAdicionarFoto={(foto) =>
            aoMudar((atual) =>
              atual.map((s) =>
                s.chave === secao.chave ? { ...s, fotos: [...s.fotos, foto] } : s,
              ),
            )
          }
          aoEnviarFoto={aoEnviarFoto}
          aoSubir={() => mover(i, i - 1)}
          aoDescer={() => mover(i, i + 1)}
          aoRemover={() => remover(secao.chave)}
        />
      ))}

      {secoes.length < SECOES_MAX ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => aoMudar((atual) => [...atual, secaoVazia()])}
          className="self-start"
        >
          <Plus />
          Adicionar seção
        </Button>
      ) : null}
    </fieldset>
  );
}

function CartaoDaSecao({
  secao,
  numero,
  primeira,
  ultima,
  sozinha,
  erros,
  aoMudar,
  aoAdicionarFoto,
  aoEnviarFoto,
  aoSubir,
  aoDescer,
  aoRemover,
}: {
  secao: SecaoEmEdicao;
  numero: number;
  primeira: boolean;
  ultima: boolean;
  sozinha: boolean;
  erros: ErrosDaSecao;
  aoMudar: (parte: Partial<SecaoEmEdicao>) => void;
  aoAdicionarFoto: (foto: Foto) => void;
  aoEnviarFoto: (caminho: string) => void;
  aoSubir: () => void;
  aoDescer: () => void;
  aoRemover: () => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(0);
  const [erroDasFotos, setErroDasFotos] = useState<string | null>(null);
  // O link fica escondido atrás de um botão: a maioria das seções não tem.
  const [comLink, setComLink] = useState(secao.link.trim() !== "");
  const campoDoLink = useRef<HTMLInputElement>(null);

  const vagas = FOTOS_POR_SECAO - secao.fotos.length;
  const nome = secao.titulo.trim() || `Seção ${numero}`;

  async function enviar(arquivos: FileList | null) {
    if (!arquivos || arquivos.length === 0) return;
    setErroDasFotos(null);

    const lista = Array.from(arquivos);
    const recusas: string[] = [];
    if (lista.length > vagas) {
      recusas.push(`Cada seção leva até ${FOTOS_POR_SECAO} fotos; as que passaram ficaram de fora.`);
    }

    const supabase = criarClienteNavegador();
    const aceitas = lista.slice(0, Math.max(0, vagas));
    setEnviando((n) => n + aceitas.length);

    for (const arquivo of aceitas) {
      try {
        const extensao = EXTENSAO_DA_FOTO[arquivo.type];
        if (!extensao) {
          recusas.push(`${arquivo.name}: só PNG, JPG ou WEBP.`);
          continue;
        }
        if (arquivo.size > FOTO_BYTES_MAX) {
          recusas.push(`${arquivo.name}: passa de 5 MB.`);
          continue;
        }

        const caminho = `${crypto.randomUUID()}.${extensao}`;
        const { error } = await supabase.storage
          .from(BUCKET_DAS_FOTOS)
          .upload(caminho, arquivo, {
            contentType: arquivo.type,
            cacheControl: "31536000",
            upsert: false,
          });
        if (error) {
          console.error("[BARBOS] enviar foto do patch note:", error.message);
          recusas.push(`${arquivo.name}: não consegui enviar. Tente de novo.`);
          continue;
        }

        aoEnviarFoto(caminho);
        aoAdicionarFoto({ caminho, url: URL.createObjectURL(arquivo) });
      } finally {
        setEnviando((n) => n - 1);
      }
    }

    if (recusas.length > 0) setErroDasFotos(recusas.join(" "));
    if (entrada.current) entrada.current.value = "";
  }

  function abrirLink() {
    setComLink(true);
    // O campo só existe depois deste clique: o foco vai no quadro seguinte.
    requestAnimationFrame(() => campoDoLink.current?.focus());
  }

  function tirarLink() {
    setComLink(false);
    aoMudar({ link: "", rotuloDoLink: "" });
  }

  function tirarFoto(caminho: string) {
    const foto = secao.fotos.find((f) => f.caminho === caminho);
    if (foto?.url.startsWith("blob:")) URL.revokeObjectURL(foto.url);
    aoMudar({ fotos: secao.fotos.filter((f) => f.caminho !== caminho) });
  }

  return (
    <section
      aria-label={nome}
      className="flex flex-col gap-4 rounded-lg border border-l-4 border-border border-l-ambar-500 bg-card p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-muted-foreground" data-numero>
          Seção {numero}
        </p>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={aoSubir}
            disabled={primeira}
            aria-label={`Subir ${nome}`}
          >
            <ArrowUp />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={aoDescer}
            disabled={ultima}
            aria-label={`Descer ${nome}`}
          >
            <ArrowDown />
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={aoRemover}
            disabled={sozinha}
            className="text-muted-foreground hover:text-faltou"
          >
            <Trash2 />
            Tirar seção
          </Button>
        </div>
      </div>

      <Campo
        rotulo="Parte do sistema"
        ajuda="Ex.: Agenda, Dashboard, Nova ferramenta. Escolha da lista ou escreva."
        erro={erros.titulo}
      >
        <Input
          list="areas-sugeridas"
          value={secao.titulo}
          maxLength={AREA_MAX}
          onChange={(e) => aoMudar({ titulo: e.target.value })}
        />
      </Campo>

      <Campo
        rotulo="O que mudou"
        ajuda={`${secao.texto.length} de ${TEXTO_MAX} letras. Linha em branco separa parágrafos.`}
        erro={erros.texto}
      >
        <Textarea
          value={secao.texto}
          maxLength={TEXTO_MAX}
          rows={4}
          onChange={(e) => aoMudar({ texto: e.target.value })}
        />
      </Campo>

      {/* Mesma ordem da página: o botão vem logo depois do texto. */}
      {comLink ? (
        <div className="flex flex-col gap-4 rounded-md border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">
              Link{" "}
              <span className="font-normal text-muted-foreground">(opcional)</span>
            </p>
            <Button
              type="button"
              variant="ghost"
              onClick={tirarLink}
              className="text-muted-foreground hover:text-faltou"
            >
              <Unlink />
              Tirar link
            </Button>
          </div>

          <Campo
            rotulo="Endereço"
            ajuda="Um site (https://…) ou uma tela do sistema, como /agenda. Vira um botão no patch note."
            erro={erros.link}
          >
            <Input
              ref={campoDoLink}
              value={secao.link}
              maxLength={LINK_MAX}
              inputMode="url"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="https://"
              onChange={(e) => aoMudar({ link: e.target.value })}
            />
          </Campo>

          <Campo
            rotulo="Texto do botão"
            opcional
            ajuda={`Ex.: Ver o vídeo, Abrir a agenda. Sem texto, o botão diz "${ROTULO_PADRAO_DO_LINK}".`}
          >
            <Input
              value={secao.rotuloDoLink}
              maxLength={ROTULO_DO_LINK_MAX}
              placeholder={ROTULO_PADRAO_DO_LINK}
              onChange={(e) => aoMudar({ rotuloDoLink: e.target.value })}
            />
          </Campo>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">
            Link{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </p>
          <Button type="button" variant="outline" onClick={abrirLink}>
            <Link2 />
            Adicionar link
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">
            Fotos{" "}
            <span className="font-normal text-muted-foreground" data-numero>
              ({secao.fotos.length} de {FOTOS_POR_SECAO}, opcional)
            </span>
          </p>
          {/* O controle visível é o botão; o seletor de arquivo do
              navegador fica escondido atrás dele. */}
          <input
            ref={entrada}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            hidden
            onChange={(e) => enviar(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => entrada.current?.click()}
            disabled={vagas <= 0 || enviando > 0}
          >
            <ImagePlus />
            {enviando > 0 ? `Enviando ${enviando}…` : "Adicionar fotos"}
          </Button>
        </div>

        {secao.fotos.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {secao.fotos.map((foto, i) => (
              <li key={foto.caminho} className="relative">
                <FotoDoPatch url={foto.url} alt={`${nome}: foto ${i + 1}`} />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  onClick={() => tirarFoto(foto.caminho)}
                  aria-label={`Tirar a foto ${i + 1} de ${nome}`}
                  className="absolute top-2 right-2 shadow-sm"
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}

        {erroDasFotos ? <Alerta>{erroDasFotos}</Alerta> : null}
      </div>
    </section>
  );
}
