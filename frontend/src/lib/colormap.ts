/** Utilidades de paletas de color: interpolación lineal entre paradas "rgb(r,g,b)" o "#rrggbb". */

export type RGB = [number, number, number]

export function parseColor(color: string): RGB {
  const hex = color.trim().match(/^#([0-9a-f]{6})$/i)
  if (hex) {
    const n = parseInt(hex[1], 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const rgb = color.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i)
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
  throw new Error(`Color no válido: ${color}`)
}

/** Color en la posición t ∈ [0, 1] de una paleta (t fuera de rango se recorta). */
export function sampleColormap(stops: readonly RGB[], t: number): RGB {
  if (stops.length === 0) return [0, 0, 0]
  const x = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0)) * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(x))
  if (stops.length === 1) return stops[0]
  const f = x - i
  const a = stops[i]
  const b = stops[i + 1]
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ]
}

/** Gradiente CSS horizontal para una leyenda. */
export function cssGradient(stops: readonly string[]): string {
  return `linear-gradient(to right, ${stops.join(', ')})`
}
