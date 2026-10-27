import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Where the API is listening. Override with API_PROXY when 3000 is taken by
// something else on your machine.
const API = process.env.API_PROXY ?? 'http://127.0.0.1:3000';

// RG-6: one short page, no large images. The budget is 200 KB.
export default defineConfig({
  plugins: [react()],
  server: {
    // Same shape as production: the app calls /api on its own origin and Vite
    // forwards it, so nothing is cross-origin in development either.
    proxy: {
      '/api': { target: API, changeOrigin: false },
      '/socket.io': { target: API, ws: true },
    },
  },
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        manualChunks: { react: ['react', 'react-dom', 'react-router-dom'] },
      },
    },
  },
});
