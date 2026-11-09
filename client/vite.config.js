import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const appEnv = loadEnv(mode, path.resolve(__dirname, '..'));
  const storageOrigin = appEnv.VITE_SUPABASE_URL ? new URL(appEnv.VITE_SUPABASE_URL).origin : '';
  const escapedStorageOrigin = storageOrigin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const storyAssetPattern = storageOrigin
    ? new RegExp(`^${escapedStorageOrigin}/storage/v1/object/public/story-images/`)
    : /^https:\/\/[^/]+\/storage\/v1\/object\/public\/story-images\//;

  return {
  // Read environment variables from the repository-root .env so the client and
  // server share one configuration file.
  envDir: path.resolve(__dirname, '..'),
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Branching Story Adventures',
        short_name: 'Story Adventures',
        description: 'Interactive branching stories for students.',
        theme_color: '#2f6fed',
        background_color: '#f4f6fb',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Never let the service worker answer API calls with cached data.
        navigateFallbackDenylist: [/^\/api/],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,webp}'],
        runtimeCaching: [
          {
            urlPattern: storyAssetPattern,
            handler: 'CacheFirst',
            options: {
              cacheName: 'story-assets-v1',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 1000, maxAgeSeconds: 60 * 60 * 24 * 365, purgeOnQuotaError: true },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  };
});
