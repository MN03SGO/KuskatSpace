/**
 * Capa IFA del Buscador — heatmap IDW continuo tipo “escáner planetario”.
 *
 * Sin máscara de tierra ni clip a celdas: `MaplibreInterpolateHeatmapLayer`
 * interpola sobre todo el mapa (incluido océano). El tinte suave sobre el
 * satélite Esri es intencional.
 *
 * La librería solo lee `data` en `onAdd`; `IdwHeatmapLayer.setData` permite
 * actualizar pesos/escenario sin recrear la capa.
 */
import { MercatorCoordinate } from 'maplibre-gl'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { MaplibreInterpolateHeatmapLayer } from 'maplibre-gl-interpolate-heatmap'
import { computeGridIFA, type GridCellProps, type IfaMode, type IfaWeights } from './ifaColorExpr'

export const GRID_LAYER_ID = 'grid-ifa-idw'
/** @deprecated fuente fill eliminada; se mantiene el id por compat de imports. */
export const GRID_SOURCE_ID = 'grid'
export const POINTS_LAYER_ID = 'candidates-circles'

/** Opacidad del escáner sobre Esri World Imagery. */
export const IFA_FILL_OPACITY = 0.65

/** Potencia IDW (menor = más suave / continuo entre puntos). */
export const IFA_IDW_POWER = 3

/**
 * Tope de puntos IDW: la librería hace una pasada a pantalla completa por
 * punto en cada prerender, así que el coste crece linealmente con N.
 */
const MAX_IDW_POINTS = 1200
/** Tamaños de bin (grados) probados de fino a grueso hasta caber en el tope. */
const BIN_SIZES_DEG = [0.25, 0.5, 1, 1.5, 2, 3, 5] as const

const MAX_MISSING_DIMS = 2
const MERCATOR_MAX_LAT = 85.05112878

type Bbox = [number, number, number, number]

export type IdwPoint = { lat: number; lon: number; val: number }

export type GridCell = GridCellProps & { missing: number; stepKm: number }

/** GLSL: plasma IFA (mismos stops que la leyenda). */
export const IFA_VALUE_TO_COLOR = `
vec3 valueToColor(float value) {
  vec3 c0 = vec3(0.050980, 0.031373, 0.529412);
  vec3 c1 = vec3(0.494118, 0.011765, 0.658824);
  vec3 c2 = vec3(0.800000, 0.278431, 0.470588);
  vec3 c3 = vec3(0.972549, 0.584314, 0.250980);
  vec3 c4 = vec3(0.941176, 0.975490, 0.129412);
  float v = clamp(value, 0.0, 1.0);
  if (v < 0.25) return mix(c0, c1, v / 0.25);
  if (v < 0.50) return mix(c1, c2, (v - 0.25) / 0.25);
  if (v < 0.75) return mix(c2, c3, (v - 0.50) / 0.25);
  return mix(c3, c4, (v - 0.75) / 0.25);
}
`

export const IFA_VALUE_TO_COLOR4 = `
vec4 valueToColor4(float value, float defaultOpacity) {
  return vec4(valueToColor(value), defaultOpacity);
}
`

function clampOpacity(opacity: number): number {
  return Math.min(1, Math.max(0, opacity))
}

function isFiniteNum(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n)
}

function readCellProps(raw: Record<string, unknown> | null | undefined): GridCell | null {
  if (!raw) return null
  const relief = Number(raw.relief)
  const illum = Number(raw.illum)
  const cold = Number(raw.cold)
  const ice = Number(raw.ice)
  const dust = Number(raw.dust)
  const missing = Number(raw.missing ?? 99)
  if (![relief, illum, cold, ice, dust].every(isFiniteNum)) return null
  if (!Number.isFinite(missing) || missing > MAX_MISSING_DIMS) return null
  return { relief, illum, cold, ice, dust, missing, stepKm: Number(raw.step_km ?? 0) }
}

function outerRing(geom: GeoJSON.Geometry | null | undefined): number[][] | null {
  if (!geom) return null
  if (geom.type === 'Polygon') return geom.coordinates[0] ?? null
  if (geom.type === 'MultiPolygon') return geom.coordinates[0]?.[0] ?? null
  return null
}

function openRing(ring: number[][]): number[][] {
  const last = ring.length - 1
  const closed = last > 0 && ring[0][0] === ring[last][0] && ring[0][1] === ring[last][1]
  return (closed ? ring.slice(0, last) : ring).filter((c) => isFiniteNum(c[0]) && isFiniteNum(c[1]))
}

function ringBbox(pts: number[][]): Bbox {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of pts) {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  return [minX, minY, maxX, maxY]
}

function bucketKeys(b: Bbox): string[] {
  const keys: string[] = []
  for (let ix = Math.floor(b[0]); ix <= Math.floor(b[2]); ix++) {
    for (let iy = Math.floor(b[1]); iy <= Math.floor(b[3]); iy++) keys.push(`${ix}:${iy}`)
  }
  return keys
}

/** Centroide de un polígono GeoJSON (anillo exterior). */
export function polygonCentroid(geom: GeoJSON.Geometry | null | undefined): { lon: number; lat: number } | null {
  const ring = outerRing(geom)
  if (!ring || ring.length < 3) return null
  const pts = openRing(ring)
  if (pts.length === 0) return null
  const lon = pts.reduce((s, c) => s + c[0], 0) / pts.length
  const lat = pts.reduce((s, c) => s + c[1], 0) / pts.length
  if (Math.abs(lat) > MERCATOR_MAX_LAT) return null
  return { lon, lat }
}

/**
 * Extrae puntos IDW {lat, lon, val} desde TODAS las celdas con IFA calculable
 * (tierra y océano). Sin filtro de máscara.
 */
export function gridToIdwPoints(
  polygons: GeoJSON.FeatureCollection,
  weights: IfaWeights,
  mode: IfaMode,
): IdwPoint[] {
  const all: IdwPoint[] = []
  for (const f of polygons.features) {
    const props = readCellProps(f.properties as Record<string, unknown> | undefined)
    if (!props) continue
    const c = polygonCentroid(f.geometry)
    if (!c) continue
    const val = computeGridIFA(props, weights, mode)
    if (!Number.isFinite(val)) continue
    all.push({ lat: c.lat, lon: c.lon, val: Math.min(1, Math.max(0, val)) })
  }
  if (all.length <= MAX_IDW_POINTS) return all

  for (const size of BIN_SIZES_DEG) {
    const bins = new Map<string, { lon: number; lat: number; val: number; n: number }>()
    for (const p of all) {
      const key = `${Math.floor((p.lon + 180) / size)}:${Math.floor((p.lat + 90) / size)}`
      const b = bins.get(key)
      if (b) {
        b.lon += p.lon
        b.lat += p.lat
        b.val += p.val
        b.n += 1
      } else {
        bins.set(key, { lon: p.lon, lat: p.lat, val: p.val, n: 1 })
      }
    }
    const isLast = size === BIN_SIZES_DEG[BIN_SIZES_DEG.length - 1]
    if (bins.size <= MAX_IDW_POINTS || isLast) {
      return [...bins.values()]
        .map((b) => ({ lon: b.lon / b.n, lat: b.lat / b.n, val: b.val / b.n }))
        .slice(0, MAX_IDW_POINTS)
    }
  }
  return all.slice(0, MAX_IDW_POINTS)
}

/**
 * Capa IDW a pantalla completa. Solo añade `setData` (la lib fija puntos en onAdd).
 * Sin override de render → mancha continua, sin bloques de celda.
 */
class IdwHeatmapLayer extends MaplibreInterpolateHeatmapLayer {
  setData(data: IdwPoint[]): void {
    this.data = data
    let min = this.minValue
    let max = this.maxValue
    for (const p of data) {
      if (p.val < min) min = p.val
      if (p.val > max) max = p.val
    }
    const span = max - min || 1
    this.points = data.map((p) => {
      const m = MercatorCoordinate.fromLngLat({ lng: p.lon, lat: p.lat })
      return [m.x, m.y, (p.val - min) / span]
    })
  }
}

function removeLegacyLayers(map: MapLibreMap): void {
  for (const id of ['grid-fill', 'grid-circles']) {
    if (map.getLayer(id)) map.removeLayer(id)
  }
  for (const id of ['grid', 'grid-centroids']) {
    if (map.getSource(id)) map.removeSource(id)
  }
}

const layers = new WeakMap<MapLibreMap, IdwHeatmapLayer>()

function getIdwLayer(map: MapLibreMap): IdwHeatmapLayer | null {
  const layer = layers.get(map)
  return layer && map.getLayer(GRID_LAYER_ID) ? layer : null
}

/**
 * Crea o actualiza el heatmap IDW continuo (toda la Tierra, sin clip).
 */
export function ensureIfaLayers(
  map: MapLibreMap,
  weights: IfaWeights,
  mode: IfaMode,
  opacity: number,
  polygons: GeoJSON.FeatureCollection,
): void {
  removeLegacyLayers(map)

  const data = gridToIdwPoints(polygons, weights, mode)
  const opac = clampOpacity(opacity)

  const existing = getIdwLayer(map)
  if (existing) {
    existing.opacity = opac
    existing.p = IFA_IDW_POWER
    existing.setData(data)
    map.triggerRepaint()
    return
  }

  // Capa custom previa (p. ej. clip a tierra tras HMR) → reemplazar
  if (map.getLayer(GRID_LAYER_ID)) {
    try {
      map.removeLayer(GRID_LAYER_ID)
    } catch {
      /* ignore */
    }
  }
  layers.delete(map)

  // aoi vacío = pantalla completa (incl. océano) — look de escáner planetario
  const layer = new IdwHeatmapLayer({
    id: GRID_LAYER_ID,
    data,
    opacity: opac,
    minValue: 0,
    maxValue: 1,
    p: IFA_IDW_POWER,
    framebufferFactor: 0.35,
    aoi: [],
    valueToColor: IFA_VALUE_TO_COLOR,
    valueToColor4: IFA_VALUE_TO_COLOR4,
  })
  layers.set(map, layer)
  const beforeId = map.getLayer(POINTS_LAYER_ID) ? POINTS_LAYER_ID : undefined
  if (beforeId) map.addLayer(layer, beforeId)
  else map.addLayer(layer)
}

export function ensureIfaPlaceholder(
  map: MapLibreMap,
  weights: IfaWeights,
  mode: IfaMode,
  opacity: number,
): void {
  ensureIfaLayers(map, weights, mode, opacity, { type: 'FeatureCollection', features: [] })
}

export function setIfaOpacity(map: MapLibreMap, opacity: number): void {
  const layer = getIdwLayer(map)
  if (!layer) return
  layer.opacity = clampOpacity(opacity)
  map.triggerRepaint()
}

export function setIfaFillColor(
  map: MapLibreMap,
  weights: IfaWeights,
  ifaMode: IfaMode,
  polygons?: GeoJSON.FeatureCollection | null,
): void {
  const layer = getIdwLayer(map)
  if (!layer || !polygons) return
  try {
    layer.setData(gridToIdwPoints(polygons, weights, ifaMode))
    map.triggerRepaint()
  } catch (err) {
    console.error('[AnalogsView] IFA IDW update', err)
  }
}

export function nearestIdwPoint(
  points: IdwPoint[],
  lon: number,
  lat: number,
  maxDeg = 2.5,
): IdwPoint | null {
  let best: IdwPoint | null = null
  let bestD = maxDeg * maxDeg
  for (const p of points) {
    const dLon = p.lon - lon
    const dLat = p.lat - lat
    const d2 = dLon * dLon + dLat * dLat
    if (d2 < bestD) {
      bestD = d2
      best = p
    }
  }
  return best
}

// ─── Hit-test por celda (inspector; la custom layer no es consultable) ───────

export type GridCellIndex = Map<string, { bbox: Bbox; cell: GridCell }[]>

export function buildGridCellIndex(polygons: GeoJSON.FeatureCollection): GridCellIndex {
  const index: GridCellIndex = new Map()
  for (const f of polygons.features) {
    const cell = readCellProps(f.properties as Record<string, unknown> | undefined)
    const ring = outerRing(f.geometry)
    if (!cell || !ring) continue
    const pts = openRing(ring)
    if (pts.length < 3) continue
    const bbox = ringBbox(pts)
    for (const k of bucketKeys(bbox)) {
      const list = index.get(k)
      if (list) list.push({ bbox, cell })
      else index.set(k, [{ bbox, cell }])
    }
  }
  return index
}

export function findGridCellAt(index: GridCellIndex, lon: number, lat: number): GridCell | null {
  let best: GridCell | null = null
  for (const { bbox, cell } of index.get(`${Math.floor(lon)}:${Math.floor(lat)}`) ?? []) {
    if (lon >= bbox[0] && lon <= bbox[2] && lat >= bbox[1] && lat <= bbox[3]) {
      if (!best || cell.stepKm < best.stepKm) best = cell
    }
  }
  return best
}

export function hasIfaHeatmap(map: MapLibreMap): boolean {
  return getIdwLayer(map) !== null
}
