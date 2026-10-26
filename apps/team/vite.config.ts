import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// BD-9: delegates keep working with a weak signal, so the shell is installable
// and cached. The check-in queue itself lives in IndexedDB.
export default defineConfig({
  // Served under /team on the one origin.
  base: '/team/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'oneaccord-app-icon-192.png'],
      manifest: {
        name: 'One Accord team',
        short_name: 'One Accord',
        description: 'Boarding and gate check-in for Upper Room.',
        theme_color: '#121212',
        background_color: '#121212',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/team/',
        start_url: '/team/',
        icons: [
          { src: '/team/oneaccord-app-icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/team/oneaccord-app-icon-1024.png', sizes: '1024x1024', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        navigateFallbackDenylist: [/^\/api/, /^\/socket\.io/],
      },
    }),
  ],
  server: {
    // Same shape as production: the app calls /api on its own origin and Vite
    // forwards it, so nothing is cross-origin in development either.
    proxy: {
      '/api': { target: 'http://127.0.0.1:3000', changeOrigin: false },
      '/socket.io': { target: 'http://127.0.0.1:3000', ws: true },
    },
  },
  build: { target: 'es2020' },
});
