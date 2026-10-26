import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Served under /admin on the one origin.
  base: '/admin/',
  plugins: [react()],
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
