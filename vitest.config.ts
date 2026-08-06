/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { configDefaults } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    exclude: [...configDefaults.exclude, '**/.claude/**', 'tests/**'],
    /**
     * 60s, não 15s. Os 15s originais já eram apertados — a varredura do axe na
     * rota Início levava 14s — e o passe de conformidade do Portal do Gestor
     * deixou as rotas mais pesadas (KPIs com régua, cascata, tabela
     * compartilhada, distribuição). Sob a carga da suíte inteira em paralelo,
     * os workers disputam CPU e testes que passam em 2s isolados levavam mais
     * de 15s, derrubando arquivos de admin e de login que nada têm a ver com a
     * mudança.
     *
     * Não é maquiagem de falha: cada um desses testes passa, e um teste
     * genuinamente travado continua reprovando — só que depois. O que o teto
     * baixo produzia era ruído que escondia falha real no meio de dezenas de
     * timeouts.
     */
    testTimeout: 60000,
    hookTimeout: 60000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        'dist/',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});