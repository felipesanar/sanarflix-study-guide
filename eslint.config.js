import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import react from "eslint-plugin-react";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "*.config.ts", "*.config.js"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: "module",
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "react": react,
    },
    settings: { react: { version: "detect" } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...react.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      // Regras de segurança — no-console como error agora que codemod
      // moveu todo console.* para Logger centralizado (Fase 5 parte 2).
      // logger.ts tem override abaixo para usar console legitimamente.
      "no-console": "error",
      "no-debugger": "error",
      "no-eval": "error",

      // Regras de TypeScript
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/prefer-optional-chain": "error",

      // Regras de React
      "react-hooks/exhaustive-deps": "error",
      "react/jsx-key": "error",
    },
  },
  // Override: src/utils/logger.ts é o ÚNICO ponto que usa console
  // diretamente (a implementação por trás do Logger.*).
  {
    files: ["src/utils/logger.ts"],
    rules: { "no-console": "off" },
  },
  // Override: arquivos de teste/setup podem usar console para debug.
  {
    files: ["src/test/**", "tests/**", "**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
    rules: { "no-console": "off" },
  }
);
