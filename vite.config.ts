/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { viteStaticCopy } from 'vite-plugin-static-copy';

/** Versi�n fijada de @mediapipe/tasks-vision; nombra la cach� runtime para invalidarla al subirla. */
const MEDIAPIPE_VERSION = '0.10.35';

export default defineConfig(({ mode }) => ({
  base: '/',
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [
    react(),
    // HTTPS autofirmado solo para probar en el celular por LAN: `npm run dev:lan`.
    mode === 'lan' && basicSsl(),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/@mediapipe/tasks-vision/wasm/*',
          dest: 'mediapipe/wasm',
          rename: { stripBase: true },
        },
      ],
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Soroban Trainer',
        short_name: 'Soroban',
        description: 'Aprend� c�lculo mental con el soroban japon�s.',
        lang: 'es',
        display: 'standalone',
        orientation: 'any',
        start_url: '.',
        scope: '.',
        theme_color: '#3b2a1a',
        background_color: '#f5efe6',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        // El WASM (~11 MB por variante) y el modelo (~7,8 MB) no se precachean:
        // superan el l�mite de 2 MiB y quien usa solo el modo t�ctil nunca los descarga.
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2,ogg,mp3}'],
        globIgnores: ['mediapipe/**', 'models/**'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /\/(mediapipe|models)\//.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: `mediapipe-${MEDIAPIPE_VERSION}`,
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 10 },
            },
          },
        ],
      },
    }),
  ],
  optimizeDeps: { exclude: ['@mediapipe/tasks-vision'] },
  server: { host: true },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'domain',
          environment: 'node',
          include: ['src/{domain,application}/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'ui',
          environment: 'jsdom',
          setupFiles: ['src/test/setup.ts'],
          include: ['src/{presentation,infrastructure,app}/**/*.test.{ts,tsx}'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.fixtures.ts',
        'src/test/**',
        'src/**/testing/**',
        'src/main.tsx',
        'src/**/*.d.ts',
      ],
      thresholds: {
        'src/domain/**': { lines: 100, branches: 100, functions: 100, statements: 100 },
      },
    },
  },
}));
