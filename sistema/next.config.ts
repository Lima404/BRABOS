import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    /**
     * Quanto tempo o navegador pode reaproveitar a página que já baixou,
     * em segundos.
     *
     * ============================================================
     * SEM ISTO, TODA NAVEGAÇÃO REFAZ TUDO NO SERVIDOR
     * ============================================================
     *
     * O padrão do Next para rota dinâmica é ZERO. Toda página do BARBOS é
     * dinâmica (lê sessão e banco), então ir da Agenda ao Estoque e voltar
     * fazia o servidor montar a Agenda inteira de novo: sessão, mês de
     * agendamentos, configuração, serviços, folgas e equipe. O React Query
     * do navegador tinha os dados fresquinhos e não refazia nada — mas o
     * servidor já tinha pago a conta antes de a resposta chegar aqui.
     *
     * Com 30 segundos, voltar para uma tela que acabou de ser vista não
     * custa consulta nenhuma: nem no servidor, nem no banco.
     *
     * Por que 30 e não mais: é METADE do `staleTime` do React Query (60s),
     * então o cache da navegação nunca é o mais velho dos dois. E o que
     * precisa aparecer na hora não depende desta conta — gravar um
     * agendamento invalida a chave no React Query e chama
     * `revalidatePath`, e os dois furam este cache de propósito.
     */
    staleTimes: {
      dynamic: 30,
      // Padrão do Next. Vale para as telas sem dado de conta (entrar,
      // cadastrar), que não mudam entre uma visita e outra.
      static: 300,
    },
  },
};

export default nextConfig;
