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
  build: {
    // El chunk del globo (three.js, ~140 kB gzip) se carga bajo demanda, no en la carga inicial.
    chunkSizeWarningLimit: 600,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
