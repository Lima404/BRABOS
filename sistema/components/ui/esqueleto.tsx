import { cn } from "@/lib/utils";

/**
 * O bloco cinza que ocupa o lugar do conteúdo enquanto ele não chega.
 *
 * Existe porque toda tela do sistema é dinâmica: cada navegação espera o
 * servidor falar com o Supabase antes de desenhar. Sem um `loading.tsx` com
 * esqueleto, o navegador segura a tela ANTERIOR parada durante essa espera, e
 * o barbeiro toca de novo achando que não pegou.
 *
 * Regras que ele carrega:
 *   - **Não anuncia nada sozinho.** Quem avisa o leitor de tela é o contêiner
 *     da tela (`role="status"` + `aria-label`), uma vez só. Vinte blocos
 *     falando "carregando" é ruído, não acessibilidade.
 *   - **A animação respeita `prefers-reduced-motion`** (o `motion-safe:`).
 *     Pulso em tela inteira embrulha o estômago de quem tem sensibilidade
 *     vestibular, e o bloco cinza parado comunica a mesma coisa.
 *   - **Tem que ter a forma do que vai chegar.** Esqueleto genérico faz a
 *     tela pular quando o conteúdo entra; esqueleto do tamanho certo faz o
 *     conteúdo só "acender" no lugar onde já estava.
 */
export function Esqueleto({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "motion-safe:animate-pulse rounded-lg bg-secondary",
        className,
      )}
    />
  );
}

/**
 * A casca de uma tela inteira em carregamento.
 *
 * O título vem escrito de verdade, não como bloco cinza: ele é estático,
 * o sistema já sabe qual é antes de falar com o banco, e ver "Agenda" na
 * hora do toque é o que diz "peguei, estou indo". Cinza no lugar do título
 * seria esconder o que já se tem.
 */
export function TelaCarregando({
  titulo,
  descricao,
  children,
  className,
}: {
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label={`Carregando ${titulo.toLowerCase()}`}
      className={cn("flex w-full flex-col gap-4", className)}
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
        {descricao ? (
          <p className="text-muted-foreground">{descricao}</p>
        ) : null}
      </div>

      {children}
    </div>
  );
}
