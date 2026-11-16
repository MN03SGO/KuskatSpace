/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // MapLibre + Vite: evita que esbuild rompa la URL del Web Worker
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
  /**
   * Desarrollo local: con VITE_API_BASE vacío (same-origin) el navegador llama
   * a :5173/candidates y :5173/api/*. Sin proxy, Vite devolvía index.html (HTML)
   * y el cliente fallaba al parsear JSON. Reenvía al FastAPI en :8000.
   */
  server: {
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/candidates': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/health': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/targets': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/datasets': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/export': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
  build: {
    // El chunk del globo (three.js, ~140 kB gzip) se carga bajo demanda, no en la carga inicial.
    chunkSizeWarningLimit: 600,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
