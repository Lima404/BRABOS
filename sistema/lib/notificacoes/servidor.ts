import "server-only";

import webpush from "web-push";

import { criarClienteServidor } from "@/lib/supabase/servidor";
import { diaComSemana } from "@/lib/formato";

/**
 * O aviso de agendamento, do lado do servidor.
 *
 * Quem chama é a ação que grava a marcação feita pelo link público. Roda
 * SEM sessão — ver o cabeçalho da migração 0035 para entender como as
 * assinaturas são alcançadas sem a chave `service_role`, que é proibida
 * neste projeto.
 *
 * ============================================================
 * NADA AQUI PODE DERRUBAR A MARCAÇÃO
 * ============================================================
 *
 * Quando esta função roda, o horário JÁ ESTÁ GRAVADO e o cliente já viu
 * "Horário marcado" na tela. Um erro de rede com a Apple não pode virar
 * uma tela de erro para quem acabou de marcar certo — o agendamento
 * existe, e é isso que importa. Por isso tudo aqui é engolido e
 * registrado, e a função não devolve nada que o chamador precise tratar.
 */

export type Assinatura = { endpoint: string; p256dh: string; auth: string };

export type Recado = {
  titulo: string;
  corpo: string;
  /** Para onde o toque na notificação leva. */
  url: string;
  /** Etiqueta única: com uma fixa, o segundo aviso engole o primeiro. */
  tag: string;
};

type DadosDoAviso = {
  clienteNome: string;
  /** AAAA-MM-DD */
  data: string;
  /** HH:MM */
  horario: string;
  servico: string;
  barbeiro: string;
  barbearia: string;
};

/**
 * As chaves VAPID.
 *
 * A pública identifica o remetente e vai para o navegador de propósito. A
 * privada assina cada envio e **nunca** pode ter prefixo `NEXT_PUBLIC`:
 * com ela, qualquer um manda notificação em nome do BARBOS para quem já
 * assinou. Mora só no servidor.
 *
 * Faltando qualquer uma, o aviso fica desligado em silêncio — mas com
 * recado no log. Derrubar o agendamento porque falta uma variável de
 * ambiente seria trocar um problema pequeno por um grande.
 */
function chaves(): { publica: string; privada: string; contato: string } | null {
  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  const contato = process.env.VAPID_CONTATO;

  if (!publica || !privada || !contato) {
    console.error(
      "[BARBOS] aviso de agendamento desligado: falta NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY ou VAPID_CONTATO.",
    );
    return null;
  }

  return { publica, privada, contato };
}

/** "PEDRO SILVA · Quinta-feira, 23 de outubro às 14:00". */
function corpoDoAviso(d: DadosDoAviso): string {
  const quando = `${diaComSemana(d.data)} às ${d.horario}`;
  const comQuem = d.barbeiro ? ` com ${d.barbeiro}` : "";
  return `${d.clienteNome} · ${quando}\n${d.servico}${comQuem}`;
}

/**
 * Manda o aviso para todos os aparelhos da barbearia.
 *
 * `agendamentoId` vem de `criar_agendamento_publico_por_chave`. A RPC
 * `avisar_agendamento` é de tiro único: chamar duas vezes para o mesmo
 * agendamento não avisa duas vezes, o que também protege contra a ação de
 * servidor ser repetida pelo navegador.
 */
export async function avisarAgendamento(agendamentoId: string): Promise<void> {
  if (!agendamentoId) return;

  const vapid = chaves();
  if (!vapid) return;

  try {
    const supabase = await criarClienteServidor();

    const { data: bruto, error } = await supabase.rpc("avisar_agendamento", {
      p_agendamento_id: agendamentoId,
    });

    if (error) {
      console.error(
        "[BARBOS] não consegui ler os aparelhos para avisar:",
        error.code ?? "",
        error.message,
      );
      return;
    }

    const r = (bruto ?? {}) as {
      ok?: boolean;
      motivo?: string;
      agendamento?: DadosDoAviso;
      assinaturas?: Assinatura[];
    };

    if (!r.ok) {
      // "ja-avisado" é o caso normal de uma repetição — não é erro.
      if (r.motivo !== "ja-avisado") {
        console.error(`[BARBOS] aviso não saiu (${r.motivo ?? "sem motivo"}).`);
      }
      return;
    }

    const mortos = await enviarRecado(r.assinaturas ?? [], {
      titulo: "Novo agendamento online",
      corpo: corpoDoAviso(r.agendamento!),
      url: "/agenda",
      tag: `agendamento-${agendamentoId}`,
    });

    // Assinatura morta some do banco. Guardá-la faria toda marcação futura
    // gastar uma tentativa num endereço que não existe mais.
    for (const endpoint of mortos) {
      await supabase.rpc("descartar_assinatura_push", { p_endpoint: endpoint });
    }
  } catch (erro) {
    console.error("[BARBOS] o aviso de agendamento lançou exceção:", erro);
  }
}

/**
 * Manda um recado e devolve os endereços que MORRERAM.
 *
 * Em paralelo e com `allSettled`: um aparelho que não responde não pode
 * segurar o aviso dos outros, e três aparelhos em série seriam três esperas
 * de rede empilhadas.
 *
 * 404 e 410 do serviço de push significam que a assinatura acabou — o
 * navegador foi desinstalado, ou a permissão foi revogada. Não volta, e quem
 * chama decide o que fazer com a lista (aqui e na tela, os dois apagam).
 * Qualquer outra recusa é registrada e a assinatura fica: pode ser só o
 * serviço de push instável, e apagar por causa disso desligaria o aviso da
 * barbearia sem ninguém pedir.
 */
export async function enviarRecado(
  assinaturas: Assinatura[],
  recado: Recado,
): Promise<string[]> {
  const vapid = chaves();
  if (!vapid || assinaturas.length === 0) return [];

  webpush.setVapidDetails(vapid.contato, vapid.publica, vapid.privada);
  const corpo = JSON.stringify(recado);

  const envios = await Promise.allSettled(
    assinaturas.map((a) =>
      webpush.sendNotification(
        { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
        corpo,
        { TTL: 60 * 60 },
      ),
    ),
  );

  const mortos: string[] = [];

  for (const [i, envio] of envios.entries()) {
    if (envio.status === "fulfilled") continue;

    const motivo = envio.reason as { statusCode?: number; body?: string };

    if (motivo?.statusCode === 404 || motivo?.statusCode === 410) {
      mortos.push(assinaturas[i]!.endpoint);
      continue;
    }

    console.error(
      `[BARBOS] aviso recusado pelo serviço de push (${motivo?.statusCode ?? "?"}):`,
      motivo?.body ?? envio.reason,
    );
  }

  return mortos;
}
