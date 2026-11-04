import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Código de terceiro, copiado pela CLI do shadcn a partir do React
    // Bits. Fica fora do lint porque QUALQUER correção aqui é perdida na
    // próxima `shadcn add` — e um aviso que não se pode resolver ensina a
    // ignorar a saída do lint inteira.
    //
    // O que ele acusa hoje: "Cannot access refs during render". É leitura
    // de ref durante a renderização para o gesto de arrastar. Não é o que
    // a regra existe para pegar, e o componente não é nosso para arrumar.
    //
    // A ponte para o resto do sistema é `components/ui/chave-squish.tsx`,
    // que é nossa e passa no lint.
    "components/SquishSwitch.tsx",
  ]),
]);

export default eslintConfig;
