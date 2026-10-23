"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellOff,
  Loader2,
  Share,
  Smartphone,
  Trash2,
} from "lucide-react";

import {
  enviarAvisoDeTeste,
  listarAparelhosAvisados,
  removerAparelhoAvisado,
  salvarAparelhoAvisado,
  type AssinaturaDeAviso,
} from "@/app/(sistema)/barbearia/acoes";
import { Alerta } from "@/components/ui/alerta";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/**
 * Aviso de agendamento no celular da barbearia.
 *
 * Quando alguém marca pelo link público, este aparelho toca — com o BARBOS
 * fechado, porque quem mostra a notificação é o service worker (`public/sw.js`)
 * e não a página.
 *
 * ============================================================
 * O ESTADO AQUI NÃO É "LIGADO OU DESLIGADO"
 * ============================================================
 *
 * São seis, e cada um pede uma frase diferente — misturá-los é o que
 * produz "ative as notificações" numa tela onde o botão não existe:
 *
 *   sem-suporte      o navegador não faz push (Safari antigo, Firefox iOS)
 *   precisa-instalar iPhone fora da tela de início — ver abaixo
 *   bloqueado        a pessoa já negou; o botão não resolve, só os Ajustes
 *   desligado        dá para ligar
 *   ligado           este aparelho recebe
 *   carregando       ainda perguntando ao navegador
 *
 * **O caso do iPhone não é detalhe.** Até hoje o iOS só entrega push para
 * site ADICIONADO À TELA DE INÍCIO. Aberto no Safari, `Notification` até
 * existe, e pedir permissão ali falha sem explicação — a dona ficaria
 * tocando num botão que não faz nada. Por isso detectamos antes e
 * mostramos o caminho em vez do botão.
 */

type Estado =
  | "carregando"
  | "sem-suporte"
  | "precisa-instalar"
  | "bloqueado"
  | "desligado"
  | "ligado";

const CHAVE_PUBLICA = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

/**
 * A chave VAPID em bytes.
 *
 * `applicationServerKey` não aceita a string base64url que o padrão usa em
 * todo o resto — só `Uint8Array`. É conversão chata e obrigatória.
 */
function chaveParaBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const preenchimento = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + preenchimento).replace(/-/g, "+").replace(/_/g, "/");
  const bruto = atob(base64);

  // O `ArrayBuffer` explícito não é enfeite: `new Uint8Array(n)` tem tipo
  // `Uint8Array<ArrayBufferLike>`, que inclui `SharedArrayBuffer`, e
  // `applicationServerKey` só aceita buffer comum. Sem isto o TypeScript
  // recusa — com razão, porque memória compartilhada não serve ali.
  const bytes = new Uint8Array(new ArrayBuffer(bruto.length));
  for (let i = 0; i < bruto.length; i += 1) bytes[i] = bruto.charCodeAt(i);
  return bytes;
}

function ehIPhone(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** Aberto pelo ícone da tela de início, e não pela aba do navegador. */
function estaInstalado(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // O Safari do iOS não implementa `display-mode` e usa esta bandeira
    // própria, que não existe nos tipos do TypeScript.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** "iPhone", "Android", "Computador" — para a dona reconhecer na lista. */
function nomeDoAparelho(): string {
  const ua = navigator.userAgent;
  if (/iphone/i.test(ua)) return "iPhone";
  if (/ipad/i.test(ua)) return "iPad";
  if (/android/i.test(ua)) return "Android";
  return "Computador";
}

export function SecaoNotificacoes({
  aparelhosIniciais,
}: {
  aparelhosIniciais: AssinaturaDeAviso[];
}) {
  const router = useRouter();
  const { avisar } = useToast();

  const [estado, setEstado] = useState<Estado>("carregando");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aparelhos, setAparelhos] = useState(aparelhosIniciais);

  useEffect(() => {
    let vivo = true;

    // Dentro de função própria e assíncrona: ler o navegador aqui é
    // pergunta com resposta demorada (`getRegistration`), e nada disso
    // existe no servidor — por isso não sai do efeito para o render.
    void (async () => {
      try {
        const temSuporte =
          "serviceWorker" in navigator &&
          "PushManager" in window &&
          "Notification" in window &&
          CHAVE_PUBLICA.length > 0;

        if (!temSuporte) {
          if (vivo) setEstado("sem-suporte");
          return;
        }

        if (ehIPhone() && !estaInstalado()) {
          if (vivo) setEstado("precisa-instalar");
          return;
        }

        if (Notification.permission === "denied") {
          if (vivo) setEstado("bloqueado");
          return;
        }

        const registro = await navigator.serviceWorker.getRegistration();
        const assinatura = await registro?.pushManager.getSubscription();
        if (vivo) setEstado(assinatura ? "ligado" : "desligado");
      } catch (causa) {
        console.error("[BARBOS] não consegui ler o estado do aviso:", causa);
        if (vivo) setEstado("sem-suporte");
      }
    })();

    return () => {
      vivo = false;
    };
  }, []);

  async function recarregar() {
    setAparelhos(await listarAparelhosAvisados());
    router.refresh();
  }

  async function ligar() {
    setOcupado(true);
    setErro(null);

    try {
      const permissao = await Notification.requestPermission();

      if (permissao !== "granted") {
        setEstado(permissao === "denied" ? "bloqueado" : "desligado");
        return;
      }

      const registro = await navigator.serviceWorker.register("/sw.js");
      // `ready` e não o retorno do `register`: recém-registrado o worker
      // ainda está instalando, e `pushManager.subscribe` falha enquanto ele
      // não está no ar.
      await navigator.serviceWorker.ready;

      const assinatura = await registro.pushManager.subscribe({
        // Obrigatório: promete que todo push VAI mostrar notificação. Sem
        // isso o navegador recusa a assinatura — é a regra que impede push
        // silencioso de rastreamento.
        userVisibleOnly: true,
        applicationServerKey: chaveParaBytes(CHAVE_PUBLICA),
      });

      const chaves = assinatura.toJSON().keys;
      if (!chaves?.p256dh || !chaves?.auth) {
        setErro("O navegador devolveu uma assinatura incompleta.");
        await assinatura.unsubscribe();
        return;
      }

      const salvo = await salvarAparelhoAvisado({
        endpoint: assinatura.endpoint,
        p256dh: chaves.p256dh,
        auth: chaves.auth,
        aparelho: nomeDoAparelho(),
      });

      if (!salvo.ok) {
        // Desfaz a assinatura: guardada só no navegador, ela nunca receberia
        // nada — e a tela diria "ligado" para um aparelho que o servidor não
        // conhece.
        await assinatura.unsubscribe();
        setErro(salvo.erro);
        return;
      }

      setEstado("ligado");
      await recarregar();
      avisar({
        tom: "sucesso",
        titulo: "Aviso ligado neste aparelho",
        descricao: "Toque em Testar para ver como chega.",
      });
    } catch (causa) {
      console.error("[BARBOS] não consegui ligar o aviso:", causa);
      setErro(
        "Não consegui ligar o aviso neste aparelho. Recarregue a página e tente de novo.",
      );
    } finally {
      setOcupado(false);
    }
  }

  async function desligar() {
    setOcupado(true);
    setErro(null);

    try {
      const registro = await navigator.serviceWorker.getRegistration();
      const assinatura = await registro?.pushManager.getSubscription();

      if (assinatura) {
        // O servidor primeiro: se a ordem fosse ao contrário e a rede
        // falhasse no meio, o aparelho ficaria sem assinatura local mas
        // listado no banco — e a dona não teria mais como desligá-lo daqui.
        await removerAparelhoAvisado(assinatura.endpoint);
        await assinatura.unsubscribe();
      }

      setEstado("desligado");
      await recarregar();
    } catch (causa) {
      console.error("[BARBOS] não consegui desligar o aviso:", causa);
      setErro("Não consegui desligar. Recarregue a página e tente de novo.");
    } finally {
      setOcupado(false);
    }
  }

  async function testar() {
    setOcupado(true);
    setErro(null);

    const r = await enviarAvisoDeTeste();
    if (!r.ok) setErro(r.erro);
    else {
      avisar({
        tom: "sucesso",
        titulo: "Teste enviado",
        descricao: "Deve chegar em alguns segundos.",
      });
    }

    setOcupado(false);
  }

  async function removerDaLista(endpoint: string) {
    setOcupado(true);
    const r = await removerAparelhoAvisado(endpoint);
    if (!r.ok) setErro(r.erro);
    await recarregar();

    // Se o aparelho removido era ESTE, a tela precisa voltar a oferecer
    // "Ligar" — senão ela continuaria dizendo "ligado" para uma assinatura
    // que não existe mais do lado do servidor.
    const registro = await navigator.serviceWorker?.getRegistration();
    const minha = await registro?.pushManager.getSubscription();
    if (minha?.endpoint === endpoint) {
      await minha.unsubscribe();
      setEstado("desligado");
    }

    setOcupado(false);
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Aviso de agendamento</h2>
        <p className="text-sm text-muted-foreground">
          Quando alguém marca pelo link de agendamento, este aparelho toca —
          mesmo com o BARBOS fechado. O aviso traz o nome, o dia e a hora.
        </p>
      </div>

      {estado === "carregando" ? (
        <div
          role="status"
          aria-label="Verificando este aparelho"
          className="h-11 animate-pulse rounded-lg bg-secondary"
        />
      ) : null}

      {estado === "sem-suporte" ? (
        <Alerta tom="aviso" titulo="Este navegador não recebe aviso">
          Abra o BARBOS no Chrome (Android, computador) ou no Safari do iPhone
          para ligar o aviso. O agendamento online continua funcionando do
          mesmo jeito — o que falta aqui é só o toque no celular.
        </Alerta>
      ) : null}

      {estado === "precisa-instalar" ? (
        <Alerta tom="info" titulo="No iPhone, instale o BARBOS primeiro">
          <div className="flex flex-col gap-2">
            <p>
              O iPhone só entrega aviso para app instalado. São três toques, e
              só precisa fazer uma vez:
            </p>
            <ol className="ml-4 flex list-decimal flex-col gap-1">
              <li>
                Toque em <Share className="inline size-4 align-text-bottom" />{" "}
                <strong>Compartilhar</strong>, na barra do Safari
              </li>
              <li>
                Escolha <strong>Adicionar à Tela de Início</strong>
              </li>
              <li>
                Abra o BARBOS <strong>pelo ícone novo</strong> e volte aqui
              </li>
            </ol>
          </div>
        </Alerta>
      ) : null}

      {estado === "bloqueado" ? (
        <Alerta tom="aviso" titulo="As notificações estão bloqueadas">
          Você negou a permissão neste aparelho, e daqui não dá para pedir de
          novo — o navegador não deixa. Libere em Ajustes → Notificações →
          BARBOS (ou no cadeado ao lado do endereço, no computador) e recarregue
          esta página.
        </Alerta>
      ) : null}

      {estado === "desligado" ? (
        <Button
          type="button"
          size="lg"
          className="sm:self-start"
          disabled={ocupado}
          onClick={ligar}
        >
          {ocupado ? <Loader2 className="animate-spin" /> : <Bell />}
          Ligar o aviso neste aparelho
        </Button>
      ) : null}

      {estado === "ligado" ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            disabled={ocupado}
            onClick={testar}
          >
            {ocupado ? <Loader2 className="animate-spin" /> : <Bell />}
            Testar agora
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={ocupado}
            onClick={desligar}
          >
            <BellOff />
            Desligar neste aparelho
          </Button>
        </div>
      ) : null}

      {erro ? <Alerta>{erro}</Alerta> : null}

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <h3 className="text-sm font-semibold">
          Aparelhos avisados{" "}
          <span className="font-normal text-muted-foreground">
            (<span data-numero>{aparelhos.length}</span>)
          </span>
        </h3>

        {aparelhos.length === 0 ? (
          <p className="rounded-lg border border-border bg-secondary/40 px-3 py-3 text-sm text-muted-foreground">
            Nenhum aparelho ainda. Ligue em cada celular que deve tocar — o seu
            e o de quem mais atende.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {aparelhos.map((a) => (
              <li
                key={a.id}
                className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3"
              >
                <Smartphone
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {a.aparelho ?? "Aparelho"}
                  {a.ultimaFalha ? (
                    <span
                      className={cn("ml-2 text-xs", "text-muted-foreground")}
                    >
                      · última tentativa falhou
                    </span>
                  ) : null}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-faltou"
                  aria-label={`Tirar ${a.aparelho ?? "este aparelho"} da lista`}
                  disabled={ocupado}
                  onClick={() => removerDaLista(a.endpoint)}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
