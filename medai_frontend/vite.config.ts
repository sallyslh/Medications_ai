import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

/**
 * Vite configuration for MedAI Frontend (React + TypeScript).
 *
 * The /api/* proxy forwards all API calls to the Django REST Framework
 * backend (default: http://localhost:8000) during local development,
 * so the React app never needs to know the backend's absolute URL.
 * In production, configure your web server (nginx / reverse proxy) to
 * forward /api/* to Django instead.
 */
export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 5173,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api': {
          target: process.env.VITE_API_BASE_URL || 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
