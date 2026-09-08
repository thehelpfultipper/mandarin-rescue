import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  // GitHub project Pages needs e.g. VITE_BASE=/mandarin-rescue/
  const configuredBase = process.env.VITE_BASE || '/';
  const base = configuredBase.endsWith('/') ? configuredBase : `${configuredBase}/`;
  // Installed PWAs must launch inside the same base path as the deployed app.
  // Absolute root URLs would send project-Pages installs to the user-site root.
  const pwaUrl = (asset = '') => `${base}${asset}`;

  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg'],
        // Avoid workbox+terser early-exit hangs on some Node environments
        minify: false,
        manifest: {
          id: pwaUrl(),
          name: 'Mandarin Rescue',
          short_name: 'MandarinRescue',
          description: 'A mobile-first Mandarin learning puzzle game where drawing routes solves missions.',
          theme_color: '#141211',
          background_color: '#141211',
          display: 'standalone',
          display_override: ['standalone', 'minimal-ui'],
          orientation: 'portrait',
          start_url: pwaUrl(),
          scope: pwaUrl(),
          icons: [
            {
              src: pwaUrl('pwa-192x192.png'),
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: pwaUrl('pwa-512x512.png'),
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: pwaUrl('pwa-maskable-512x512.png'),
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          mode: 'development',
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
