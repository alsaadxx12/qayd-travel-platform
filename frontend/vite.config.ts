import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * A note on the "84 requests" figure: `npm run dev` serves every module as its own
 * unbundled request, so that number describes the dev server, not what a user
 * downloads. Re-measure against `npm run build && npm run preview`. The chunking
 * below is what actually governs production.
 *
 * Grouping is by update cadence, not by size: React and Mantine change rarely, so
 * giving them their own chunks means a routine app deploy does not invalidate them
 * in everyone's cache. The export stack is reached through `await import(...)` at
 * the call site; naming it here only labels the chunk, it does not pull it into the
 * initial graph.
 */
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'pwa-192.png', 'pwa-512.png'],
      manifest: {
        name: 'QAYD — منصة قيد للمحاسبة والسفر',
        short_name: 'قيد QAYD',
        description: 'منظومة قيد المتكاملة لإدارة السندات المحاسبية، حجز التذاكر، الفيزا، والفنادق',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#ffffff',
        theme_color: '#F45A0A',
        lang: 'ar',
        dir: 'rtl',
        categories: ['business', 'finance', 'productivity'],
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        shortcuts: [
          {
            name: 'لوحة التحكم',
            short_name: 'الرئيسية',
            description: 'فتح لوحة تحكم قيد',
            url: '/dashboard',
            icons: [{ src: '/pwa-192.png', sizes: '192x192' }],
          },
          {
            name: 'التذاكر',
            short_name: 'تذاكر',
            description: 'إدارة تذاكر الطيران',
            url: '/tickets',
            icons: [{ src: '/pwa-192.png', sizes: '192x192' }],
          },
          {
            name: 'الفيزا',
            short_name: 'فيزا',
            description: 'إدارة طلبات التأشيرة',
            url: '/visas',
            icons: [{ src: '/pwa-192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        // Cache app shell and static assets aggressively — exclude huge images (> 4MB)
        globPatterns: ['**/*.{js,css,html,ico,svg,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
        // Skip SW update popup — just auto-update silently
        skipWaiting: true,
        clientsClaim: true,
        // Runtime caching: API calls go network-first with short timeout
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'qayd-api-cache',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 5 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname || process.cwd(), './src'),
    },
  },
  build: {
    sourcemap: false,
    // Anything under 4KB becomes a data URI rather than costing a request.
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;

          if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) {
            return 'vendor-react';
          }
          if (id.includes('react-router')) return 'vendor-router';
          if (id.includes('@mantine')) return 'vendor-mantine';
          if (id.includes('@tanstack')) return 'vendor-query';

          // Icon packs in one chunk each, instead of a file per icon.
          if (id.includes('@tabler/icons-react') || id.includes('lucide-react')) {
            return 'vendor-icons';
          }

          // Charting/animation are mounted by a handful of screens only.
          if (id.includes('echarts') || id.includes('recharts') || id.includes('d3-')) {
            return 'vendor-charts';
          }
          if (id.includes('framer-motion') || id.includes('lottie')) return 'vendor-motion';

          // Export/print stack: fetched when someone clicks Excel or PDF, never before.
          if (id.includes('xlsx') || id.includes('jspdf') || id.includes('html2canvas')) {
            return 'vendor-export';
          }

          if (id.includes('i18next') || id.includes('date-fns') || id.includes('zod')) {
            return 'vendor-utils';
          }
          return 'vendor';
        },
      },
    },
  },
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
