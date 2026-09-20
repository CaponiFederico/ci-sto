import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',

      injectRegister: false,
      registerType: 'prompt',

      includeAssets: ['favicon.svg', 'offline.html'],

      manifest: {
        name: 'Bacheca universitaria',
        short_name: 'Bacheca',
        description:
          'Attività fra studenti: pubblica, trova compagni, iscriviti.',
        lang: 'it',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#10427a',
        theme_color: '#10427a',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },

      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
      },

      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html',
      },
    }),
  ],
});
