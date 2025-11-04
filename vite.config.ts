import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import viteCompression from "vite-plugin-compression";
import { visualizer } from "rollup-plugin-visualizer";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
    // Brotli compression for all static assets
    viteCompression({
      verbose: false,
      disable: false,
      threshold: 1024,
      algorithm: 'brotliCompress',
      ext: '.br',
      filter: (file) => !file.endsWith('.map'),
    }),
    // Bundle visualizer when running analyze mode
    mode === 'analyze' && visualizer({
      filename: 'dist/stats.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    cssMinify: true,
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        manualChunks: {
          // React core - sempre carrega primeiro
          'react-vendor': [
            'react',
            'react-dom',
            'react/jsx-runtime',
            'scheduler'
          ],
          // React Router e navegação
          'router': [
            'react-router-dom'
          ],
          // UI Libraries - Radix
          'ui-vendor': [
            '@radix-ui/react-accordion',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip',
          ],
          // Data fetching e state
          'data-vendor': [
            '@tanstack/react-query',
            '@supabase/supabase-js'
          ],
          // Charts e visualização
          'charts': [
            'recharts'
          ],
          // Form handling
          'forms': [
            'react-hook-form',
            '@hookform/resolvers',
            'zod'
          ],
        },
        chunkFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
}));
