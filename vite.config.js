import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// BASE_PATH é definido no deploy do GitHub Pages (ex.: "/role-costa-verde/").
// Localmente fica "/".
const base = process.env.BASE_PATH || '/';

import { readFileSync } from 'node:fs';
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: { chunkSizeWarningLimit: 1000 },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'seed.json'],
      manifest: {
        name: 'Rolê Costa Verde',
        short_name: 'Rolê',
        description: 'Campings, trilhas e cachoeiras entre Ubatuba e Paraty',
        lang: 'pt-BR',
        theme_color: '#0f4c5c',
        background_color: '#0f4c5c',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // App shell + seed ficam em cache para abrir sem sinal
        globPatterns: ['**/*.{js,css,html,png,svg,json,woff2}'],
        runtimeCaching: [
          {
            // Tiles do mapa: guarda o que já foi visto (até ~3000 tiles)
            urlPattern: /^https:\/\/([abc]\.tile\.openstreetmap\.org|[abcd]\.basemaps\.cartocdn\.com)\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tiles-osm',
              expiration: { maxEntries: 3000, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            // Previsão do tempo: tenta rede, cai pro cache
            urlPattern: /^https:\/\/api\.open-meteo\.com\/.*/,
            handler: 'NetworkFirst',
            options: { cacheName: 'clima', networkTimeoutSeconds: 4 }
          }
        ]
      }
    })
  ]
});
