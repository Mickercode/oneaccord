import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Where the API is listening. Override with API_PROXY when 3000 is taken by
// something else on your machine.
const API = process.env.API_PROXY ?? 'http://127.0.0.1:3000';

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
  build: { target: 'es2020' },
});
