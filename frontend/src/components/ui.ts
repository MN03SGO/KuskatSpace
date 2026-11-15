/**
 * Clases de interfaz compartidas (pasada de UX, backlog B20–B31 del plan P5):
 * - objetivo táctil mínimo de 40 px (min-h-10, B20);
 * - estado activo con señal no cromática: barra inferior blanca, además del color (B27);
 * - foco visible: info sobre fondos oscuros, ink sobre controles rellenos de accent (B27);
 * - solo 2 pesos tipográficos: normal y bold (B30); espaciado en la cuadrícula de 4 px (B31).
 */

export const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info'

/** Para controles dentro de un grupo con overflow-hidden: el contorno va por dentro y en blanco. */
export const focusRingInset =
  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink'

const segmentBase = `min-h-10 px-3 py-2 text-xs font-bold ${focusRingInset}`

/** Botón de un control segmentado (cuerpo, vista, idioma, capas). */
export function segmentClass(active: boolean, extra = ''): string {
  return `${segmentBase} ${
    active
      ? 'bg-accent text-ink shadow-[inset_0_-3px_0_0_var(--color-ink)]'
      : 'bg-raised text-ink-muted hover:bg-line hover:text-ink'
  } disabled:cursor-not-allowed disabled:opacity-50 ${extra}`
}

/** Botón secundario de acción dentro de un panel. */
export const secondaryButton = `min-h-10 rounded bg-surface px-2 py-2 text-xs text-ink ring-1 ring-ink-muted/40 hover:bg-line ${focusRing} disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:bg-accent aria-pressed:ring-2 aria-pressed:ring-ink aria-pressed:font-bold`

/** Campo de texto o select; borde con contraste ≥ 3:1 (B29). */
export const inputClass = `min-h-10 w-full rounded border border-ink-muted/70 bg-surface px-2 py-2 text-sm text-ink ${focusRing} aria-invalid:border-danger`

export const labelClass = 'mb-1 block text-xs text-ink-muted'

/** Rótulos que flotan sobre el globo o el mapa: fondo opaco (B28). */
export const mapLabel = 'pointer-events-none rounded bg-surface px-2 py-1 text-xs text-ink-muted'
