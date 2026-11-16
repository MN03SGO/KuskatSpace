import { useEffect } from 'react'
import { create } from 'zustand'

export type ThemeMode = 'light' | 'dark' | 'auto'

const THEME_STORAGE_KEY = 'terraanaloga.theme'

function readStoredTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    return v === 'light' || v === 'dark' || v === 'auto' ? v : 'dark'
  } catch {
    return 'dark'
  }
}

function resolveDark(mode: ThemeMode): boolean {
  if (mode === 'dark') return true
  if (mode === 'light') return false
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

interface ThemeState {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
}

export const useTheme = create<ThemeState>((set) => ({
  theme: typeof window === 'undefined' ? 'dark' : readStoredTheme(),
  setTheme: (theme) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // Modo privado / sin almacenamiento: el tema solo dura esta sesión.
    }
    set({ theme })
  },
}))

/** Sincroniza las clases `dark` / `light` en <html> y escucha cambios del SO en modo automático. */
export function useDocumentTheme(): void {
  const theme = useTheme((s) => s.theme)

  useEffect(() => {
    const apply = () => {
      const isDark = resolveDark(theme)
      document.documentElement.classList.toggle('dark', isDark)
      document.documentElement.classList.toggle('light', !isDark)
    }
    apply()

    if (theme !== 'auto' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
}

/**
 * Clases de interfaz compartidas (*Aero-Analogue Scientific*):
 * - objetivo táctil mínimo de 40 px en controles primarios (min-h-10);
 * - foco visible de alto contraste en tema claro y oscuro;
 * - tipografía dual Inter + JetBrains Mono (tabular-nums).
 */
export const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info'

/** Para controles dentro de un grupo con overflow-hidden: el contorno va por dentro. */
export const focusRingInset =
  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-info'

const segmentBase = `min-h-10 px-3 py-2 text-xs font-semibold transition-all ${focusRingInset}`

/** Botón de un control segmentado (cuerpo, vista, idioma, capas). */
export function segmentClass(active: boolean, extra = ''): string {
  return `${segmentBase} ${
    active
      ? 'bg-accent text-white dark:text-[#002b42] shadow-xs'
      : 'bg-raised text-ink-muted hover:bg-line/70 hover:text-ink'
  } disabled:cursor-not-allowed disabled:opacity-50 ${extra}`
}

/** Contenedor de un control segmentado. */
export const segmentGroup = 'overflow-hidden rounded-xl border border-line bg-raised p-0.5'

/** Botón primario de acción científica (CTA). */
export const primaryButton = `min-h-10 rounded-xl bg-ok px-3 py-2 text-xs font-bold text-white dark:text-[#022c22] shadow-sm transition-all hover:brightness-110 active:scale-[0.99] ${focusRing} disabled:cursor-not-allowed disabled:opacity-50`

/** Botón secundario de acción dentro de un panel. */
export const secondaryButton = `min-h-10 rounded-lg border border-line bg-surface px-2.5 py-2 text-xs font-medium text-ink transition-all hover:border-info/60 hover:bg-raised ${focusRing} disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-white dark:aria-pressed:text-[#002b42] aria-pressed:font-bold`

/** Campo de texto o select. */
export const inputClass = `min-h-10 w-full rounded-lg border border-line bg-raised px-2.5 py-2 text-sm text-ink transition-colors placeholder:text-ink-muted/70 focus:border-info focus:bg-surface ${focusRing} aria-invalid:border-danger`

export const selectClass = `${inputClass} appearance-none pr-8 cursor-pointer`

export const labelClass = 'mb-1 block font-mono text-[11px] font-medium text-ink-muted'

/** Control deslizante científico. */
export const sliderClass =
  'h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-line accent-accent disabled:cursor-not-allowed disabled:opacity-50'

/** Superficie flotante translúcida sobre el mapa o globo. */
export const hudPanelClass = 'hud-panel rounded-xl'

/** Tarjeta interna de sección / módulo. */
export const hudCardClass =
  'rounded-xl border border-line bg-surface p-3 shadow-xs transition-colors'

/** Cápsula / etiqueta técnica monoespaciada. */
export const pillBadgeClass =
  'inline-flex items-center gap-1 rounded-md border border-line bg-raised px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-ink-muted'

/** Badge de fidelidad IFA coloreado por umbral científico. */
export function ifaBadgeClass(ifa01: number): string {
  if (ifa01 >= 0.85) {
    return 'rounded-lg border border-ok/40 bg-ok/15 px-2 py-0.5 font-mono text-xs font-bold text-ok'
  }
  if (ifa01 >= 0.78) {
    return 'rounded-lg border border-info/40 bg-info/15 px-2 py-0.5 font-mono text-xs font-bold text-info'
  }
  return 'rounded-lg border border-line bg-raised px-2 py-0.5 font-mono text-xs font-bold text-ink-muted'
}

/** Rótulos que flotan sobre el globo o el mapa. */
export const mapLabel = 'hud-panel pointer-events-none rounded-lg px-2.5 py-1 font-mono text-[11px] text-ink-muted'

/** Tooltip técnico flotante. */
export const tooltipClass =
  'hud-panel pointer-events-none z-50 rounded-lg px-2.5 py-1.5 font-mono text-[11px] text-ink shadow-lg'

/** Contenedor de diálogo/modal accesible. */
export const modalOverlayClass =
  'fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm'

export const modalCardClass =
  'w-full max-w-lg rounded-2xl border border-line bg-surface p-5 shadow-2xl'
