import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import viteCompression from "vite-plugin-compression";
import { visualizer } from "rollup-plugin-visualizer";
import { VitePWA } from "vite-plugin-pwa";

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
    // PWA with runtime caching and precache for offline capability
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'Guia de Estudos Sanarflix',
        short_name: 'Sanarflix Guia',
        description: 'Guia de Estudos Personalizado para Medicina - Sanarflix',
        theme_color: '#000000',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/lovable-uploads/efb6cdcc-7e6b-4bd1-acc1-0dec71e055ff.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/lovable-uploads/efb6cdcc-7e6b-4bd1-acc1-0dec71e055ff.png',
            sizes: '192x192',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            // API cache with NetworkFirst and 15 minutes cache
            urlPattern: ({ url }) => url.host.endsWith('.supabase.co'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-supabase',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 15 * 60, // 15 minutes
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Static images cache
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Fonts cache
            urlPattern: ({ request, url }) => request.destination === 'font' || url.host.includes('fonts.gstatic.com'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
          {
            // Static assets (js, css) with Stale-While-Revalidate
            urlPattern: ({ request }) => ['style', 'script', 'worker'].includes(request.destination),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'static-assets',
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
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
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Vendors
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) return 'vendor-react';
            if (id.includes('@radix-ui') || id.includes('framer-motion') || id.includes('lucide-react')) return 'vendor-ui';
            if (id.includes('recharts')) return 'vendor-charts';
            if (id.includes('zod') || id.includes('date-fns') || id.includes('clsx') || id.includes('class-variance-authority')) return 'vendor-utils';
            return 'vendor';
          }

          // App feature chunks
          if (id.includes('/src/pages/UserManagement')) return 'admin';
          if (id.includes('/src/pages/Analytics')) return 'analytics';
          if (id.includes('/src/pages/StudyGuide') || id.includes('/src/components/Study')) return 'study-guide';
          if (id.includes('/src/pages/IntensivaoEnamed') || id.includes('/src/pages/IntensivoEnamedUSCS')) return 'intensivo';

          return undefined;
        },
      },
    },
  },
}));
