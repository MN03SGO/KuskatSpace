/**
 * Expresiones MapLibre + IFA en JS para la grilla GeoJSON (relief/illum/cold/ice/dust).
 * La expresión GPU y computeGridIFA deben devolver el mismo escalar para los mismos pesos.
 */

/** Expresión MapLibre tipada sin `any` (compatible con setPaintProperty). */
export type ExpressionSpecification =
  | string
  | number
  | boolean
  | null
  | ExpressionSpecification[]

export type IfaMode = 'global' | 'moon_psr' | 'mars_arid'

export type IfaWeights = {
  relieve: number
  iluminacion: number
  frio: number
  hielo: number
  polvo: number
}

/** Props numéricas 0–1 de cada celda en grid.geojson */
export type GridCellProps = {
  relief: number
  illum: number
  cold: number
  ice: number
  dust: number
  valid?: number
}

/** Pesos Luna Z4 · Trampas frías (PSR) — mismo preset que AnalogsView PRESETS.z4 */
export const MOON_PSR_WEIGHTS: IfaWeights = {
  relieve: 0.1,
  iluminacion: 0.2,
  frio: 0.3,
  hielo: 0.4,
  polvo: 0.0,
}

/** Pesos Marte · Llanuras áridas — mismo preset que AnalogsView PRESETS.mars */
export const MARS_ARID_WEIGHTS: IfaWeights = {
  relieve: 0.2,
  iluminacion: 0.05,
  frio: 0.2,
  hielo: 0.25,
  polvo: 0.3,
}

export function normalizeWeights(w: IfaWeights): IfaWeights {
  const sum = w.relieve + w.iluminacion + w.frio + w.hielo + w.polvo
  if (sum <= 0) {
    return { relieve: 0.2, iluminacion: 0.2, frio: 0.2, hielo: 0.2, polvo: 0.2 }
  }
  return {
    relieve: w.relieve / sum,
    iluminacion: w.iluminacion / sum,
    frio: w.frio / sum,
    hielo: w.hielo / sum,
    polvo: w.polvo / sum,
  }
}

/**
 * Pesos efectivos para el IFA.
 * - global: normaliza `weights` (sliders).
 * - moon_psr / mars_arid: usa Z4 / Marte si el llamador no ha sincronizado aún;
 *   AnalogsView aplica esos presets al cambiar de pestaña, así ranking y mapa coinciden.
 */
export function effectiveWeights(weights: IfaWeights, _mode: IfaMode): IfaWeights {
  return normalizeWeights(weights)
}

/** IFA JS (misma fórmula que la expresión MapLibre). */
export function computeGridIFA(props: GridCellProps, weights: IfaWeights, mode: IfaMode = 'global'): number {
  const w = effectiveWeights(weights, mode)
  const relief = props.relief || 0
  const illum = props.illum || 0
  const cold = props.cold || 0
  const ice = props.ice || 0
  const dust = props.dust || 0
  return (
    relief * w.relieve +
    illum * w.iluminacion +
    cold * w.frio +
    ice * w.hielo +
    dust * w.polvo
  )
}

function propGet(key: string): ExpressionSpecification {
  return ['coalesce', ['get', key], 0]
}

function ifaValueExpr(w: IfaWeights): ExpressionSpecification {
  // suma ponderada: relief*wr + illum*wi + cold*wc + ice*wh + dust*wd
  return [
    '+',
    ['*', propGet('relief'), w.relieve],
    [
      '+',
      ['*', propGet('illum'), w.iluminacion],
      [
        '+',
        ['*', propGet('cold'), w.frio],
        ['+', ['*', propGet('ice'), w.hielo], ['*', propGet('dust'), w.polvo]],
      ],
    ],
  ]
}

/** Paleta viridis (global / Luna) — stops 0→1 */
const VIRIDIS_STOPS: ExpressionSpecification[] = [
  0, '#440154',
  0.25, '#3b528b',
  0.5, '#21918c',
  0.75, '#5ec962',
  1, '#fde725',
]

/** Paleta inferno (Marte) — stops 0→1 */
const INFERNO_STOPS: ExpressionSpecification[] = [
  0, '#000004',
  0.25, '#57106e',
  0.5, '#bc3754',
  0.75, '#f98e09',
  1, '#fcffa4',
]

/**
 * Expresión fill-color MapLibre: interpolate linear sobre IFA ponderado.
 * Pesos: siempre los `weights` normalizados (pestañas Luna/Marte cargan Z4/Marte en el estado).
 * mode elige paleta (viridis / inferno).
 */
export function ifaColorExpr(weights: IfaWeights, mode: IfaMode): ExpressionSpecification {
  const w = effectiveWeights(weights, mode)
  const stops = mode === 'mars_arid' ? INFERNO_STOPS : VIRIDIS_STOPS
  return ['interpolate', ['linear'], ifaValueExpr(w), ...stops]
}

/** Assert de paridad JS ↔ fórmula de la expresión (2–3 celdas de muestra). */
export function assertGridIfaParity(weights: IfaWeights, mode: IfaMode = 'global'): void {
  const samples: GridCellProps[] = [
    { relief: 0.2, illum: 0.8, cold: 0.9, ice: 0.7, dust: 0.1, valid: 1 },
    { relief: 0.5, illum: 0.1, cold: 0.3, ice: 0.05, dust: 0.85, valid: 1 },
    { relief: 0.0, illum: 0.0, cold: 0.0, ice: 0.0, dust: 0.0, valid: 1 },
  ]
  const w = effectiveWeights(weights, mode)
  for (const p of samples) {
    const js = computeGridIFA(p, weights, mode)
    const manual =
      (p.relief || 0) * w.relieve +
      (p.illum || 0) * w.iluminacion +
      (p.cold || 0) * w.frio +
      (p.ice || 0) * w.hielo +
      (p.dust || 0) * w.polvo
    console.assert(
      Math.abs(js - manual) < 1e-9,
      `[IFA parity] js=${js} manual=${manual} props=`,
      p,
      'mode=',
      mode,
    )
  }
}
