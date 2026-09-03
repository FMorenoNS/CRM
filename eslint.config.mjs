import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// eslint-config-next 15.5.20 todavía no publica su configuración como
// paquetes planos (eslint-config-next/core-web-vitals, /typescript): esas
// rutas son de la versión 16. FlatCompat traduce su configuración clásica
// (.eslintrc) al formato plano que usa ESLint 9.
const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      // Salida de compilación de Next.js, no código fuente.
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // .claude/** contiene worktrees de git con su propio node_modules:
      // sin excluirlos, ESLint los recorre enteros y saca miles de avisos
      // que no son de este proyecto.
      ".claude/**",
    ],
  },
];

export default eslintConfig;
