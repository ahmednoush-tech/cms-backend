import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Phase 3A: dev server proxies /api to the backend so the browser
// never needs CORS configuration changes on the backend (which we
// are not permitted to modify). Adjust VITE_API_BASE_URL per
// environment instead of hardcoding a host here.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
});
