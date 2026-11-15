/**
 * URL base del backend FastAPI.
 *
 * - Local (Vite + uvicorn en :8000): VITE_API_BASE=http://localhost:8000
 * - Vercel (mismo dominio, rewrites → servicio `api`): dejar vacío → same-origin
 *   p. ej. fetch('/candidates'), fetch('/api/search')
 *
 * Bindings de Vercel Services NO aplican al bundle del navegador (solo runtime
 * server-side). En este monorepo el cliente habla por rutas públicas.
 */
export const API_BASE: string = String(import.meta.env.VITE_API_BASE ?? '')
  .trim()
  .replace(/\/+$/, '')
