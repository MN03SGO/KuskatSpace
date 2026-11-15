/** URL base del backend (B2). Se define con VITE_API_BASE; ver .env.example. */
export const API_BASE: string = (import.meta.env.VITE_API_BASE || 'http://localhost:8000').replace(/\/+$/, '')
