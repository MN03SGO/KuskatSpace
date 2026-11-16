/**
 * Capa principal IFA en el Buscador.
 * - zoom < 4: círculos en centroides (manchas regionales)
 * - zoom >= 4: fill de polígonos
 * Cruce corto vía minzoom/maxzoom. Escenario = solo setPaintProperty.
 */
import type { Map as MapLibreMap, GeoJSONSource } from 'maplibre-gl'
import { ifaColorExpr, type IfaMode, type IfaWeights } from './ifaColorExpr'

export const GRID_SOURCE_ID = 'grid'
export const GRID_CENTROIDS_SOURCE_ID = 'grid-centroids'
export const GRID_LAYER_ID = 'grid-fill'
export const GRID_CIRCLES_LAYER_ID = 'grid-circles'
export const POINTS_LAYER_ID = 'candidates-circles'

const FALLBACK_FILL = '#21918c'
const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

/** Cruce: círculos hasta z≈4.2, fill desde z≈3.8 */
const CIRCLES_MAX_ZOOM = 4.2
const FILL_MIN_ZOOM = 3.8

function safeBeforeId(map: MapLibreMap, id: string | undefined): string | undefined {
  if (!id) return undefined
  return map.getLayer(id) ? id : undefined
}

function safeColorExpr(weights: IfaWeights, mode: IfaMode): unknown {
  try {
    return ifaColorExpr(weights, mode)
  } catch (err) {
    console.error('[AnalogsView] ifaColorExpr → color plano de respaldo', err)
    return FALLBACK_FILL
  }
}

/** Opacidad atenuada si missing > 2. */
function opacityExpr(base: number): unknown {
  return [
    'case',
    ['>', ['to-number', ['get', 'missing']], 2],
    base * 0.35,
    base,
  ]
}

export function polygonsToCentroids(
  fc: GeoJSON.FeatureCollection,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []
  for (const ft of fc.features) {
    if (!ft.geometry || ft.geometry.type !== 'Polygon') continue
    const ring = ft.geometry.coordinates[0]
    if (!ring || ring.length < 4) continue
    const xs = ring.slice(0, -1).map((c) => c[0])
    const ys = ring.slice(0, -1).map((c) => c[1])
    const lon = 0.5 * (Math.min(...xs) + Math.max(...xs))
    const lat = 0.5 * (Math.min(...ys) + Math.max(...ys))
    features.push({
      type: 'Feature',
      properties: { ...(ft.properties ?? {}) },
      geometry: { type: 'Point', coordinates: [lon, lat] },
    })
  }
  return { type: 'FeatureCollection', features }
}

function ensureSources(
  map: MapLibreMap,
  polygons: GeoJSON.FeatureCollection,
  centroids: GeoJSON.FeatureCollection,
): void {
  if (!map.getSource(GRID_SOURCE_ID)) {
    map.addSource(GRID_SOURCE_ID, { type: 'geojson', data: polygons })
  } else {
    ;(map.getSource(GRID_SOURCE_ID) as GeoJSONSource).setData(polygons)
  }
  if (!map.getSource(GRID_CENTROIDS_SOURCE_ID)) {
    map.addSource(GRID_CENTROIDS_SOURCE_ID, { type: 'geojson', data: centroids })
  } else {
    ;(map.getSource(GRID_CENTROIDS_SOURCE_ID) as GeoJSONSource).setData(centroids)
  }
}

function ensureFillLayer(
  map: MapLibreMap,
  colorExpr: unknown,
  opacity: number,
  beforeId?: string,
): void {
  if (map.getLayer(GRID_LAYER_ID)) {
    map.setPaintProperty(GRID_LAYER_ID, 'fill-color', colorExpr as never)
    map.setPaintProperty(GRID_LAYER_ID, 'fill-opacity', opacityExpr(opacity) as never)
    return
  }
  map.addLayer(
    {
      id: GRID_LAYER_ID,
      type: 'fill',
      source: GRID_SOURCE_ID,
      minzoom: FILL_MIN_ZOOM,
      layout: { visibility: 'visible' },
      paint: {
        'fill-color': colorExpr as never,
        'fill-opacity': opacityExpr(opacity) as never,
        'fill-outline-color': 'rgba(0,0,0,0)',
      },
    },
    beforeId,
  )
}

function ensureCirclesLayer(
  map: MapLibreMap,
  colorExpr: unknown,
  opacity: number,
  beforeId?: string,
): void {
  if (map.getLayer(GRID_CIRCLES_LAYER_ID)) {
    map.setPaintProperty(GRID_CIRCLES_LAYER_ID, 'circle-color', colorExpr as never)
    map.setPaintProperty(GRID_CIRCLES_LAYER_ID, 'circle-opacity', opacityExpr(opacity) as never)
    return
  }
  map.addLayer(
    {
      id: GRID_CIRCLES_LAYER_ID,
      type: 'circle',
      source: GRID_CENTROIDS_SOURCE_ID,
      maxzoom: CIRCLES_MAX_ZOOM,
      layout: { visibility: 'visible' },
      paint: {
        'circle-color': colorExpr as never,
        'circle-opacity': opacityExpr(opacity) as never,
        'circle-blur': 0.35,
        'circle-stroke-width': 0,
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          1,
          2.5,
          2,
          4,
          3,
          7,
          4,
          11,
        ],
      },
    },
    beforeId,
  )
}

/** Monta / actualiza IFA (polígonos + centroides). No usa PNG. */
export function ensureIfaLayers(
  map: MapLibreMap,
  weights: IfaWeights,
  mode: IfaMode,
  opacity: number,
  geojsonData: GeoJSON.FeatureCollection,
): void {
  try {
    const centroids = polygonsToCentroids(geojsonData)
    ensureSources(map, geojsonData, centroids)
    const colorExpr = safeColorExpr(weights, mode)
    const beforeCand = safeBeforeId(map, POINTS_LAYER_ID)
    // Orden: círculos bajo fill bajo candidatos
    ensureCirclesLayer(map, colorExpr, opacity, beforeCand)
    const beforeFill = safeBeforeId(map, POINTS_LAYER_ID)
    ensureFillLayer(map, colorExpr, opacity, beforeFill)
    if (map.getLayer(POINTS_LAYER_ID)) {
      if (map.getLayer(GRID_CIRCLES_LAYER_ID)) {
        map.moveLayer(GRID_CIRCLES_LAYER_ID, POINTS_LAYER_ID)
      }
      if (map.getLayer(GRID_LAYER_ID)) {
        map.moveLayer(GRID_LAYER_ID, POINTS_LAYER_ID)
      }
    }
  } catch (err) {
    console.error('[AnalogsView] IFA layers', err)
  }
}

/** Placeholder vacío hasta que llegue el GeoJSON. */
export function ensureIfaPlaceholder(
  map: MapLibreMap,
  weights: IfaWeights,
  mode: IfaMode,
  opacity: number,
): void {
  ensureIfaLayers(map, weights, mode, opacity, EMPTY_FC)
}

export function setIfaOpacity(map: MapLibreMap, opacity: number): void {
  const o = Math.min(1, Math.max(0.1, opacity))
  try {
    if (map.getLayer(GRID_LAYER_ID)) {
      map.setPaintProperty(GRID_LAYER_ID, 'fill-opacity', opacityExpr(o) as never)
    }
    if (map.getLayer(GRID_CIRCLES_LAYER_ID)) {
      map.setPaintProperty(GRID_CIRCLES_LAYER_ID, 'circle-opacity', opacityExpr(o) as never)
    }
  } catch (err) {
    console.error('[AnalogsView] IFA opacity', err)
  }
}

/** Solo paint — no recrea layers al cambiar escenario/pesos. */
export function setIfaFillColor(
  map: MapLibreMap,
  weights: IfaWeights,
  ifaMode: IfaMode,
): void {
  const color = safeColorExpr(weights, ifaMode)
  try {
    if (map.getLayer(GRID_LAYER_ID)) {
      map.setPaintProperty(GRID_LAYER_ID, 'fill-color', color as never)
    }
    if (map.getLayer(GRID_CIRCLES_LAYER_ID)) {
      map.setPaintProperty(GRID_CIRCLES_LAYER_ID, 'circle-color', color as never)
    }
  } catch (err) {
    console.error('[AnalogsView] IFA fill-color', err)
    if (map.getLayer(GRID_LAYER_ID)) {
      map.setPaintProperty(GRID_LAYER_ID, 'fill-color', FALLBACK_FILL)
    }
    if (map.getLayer(GRID_CIRCLES_LAYER_ID)) {
      map.setPaintProperty(GRID_CIRCLES_LAYER_ID, 'circle-color', FALLBACK_FILL)
    }
  }
}

/** @deprecated — PNG desactivado (mismos datos sesgados). */
export function ensureIfaHeatmapLayer(
  _map: MapLibreMap,
  _mode: IfaMode,
  _opacity: number,
): void {
  console.warn('[AnalogsView] PNG heatmap desactivado; usar polígonos/círculos IFA')
}

/** @deprecated alias */
export function ensureIfaPolygonLayer(
  map: MapLibreMap,
  weights: IfaWeights,
  mode: IfaMode,
  opacity: number,
  geojsonData: string | GeoJSON.FeatureCollection,
): void {
  if (typeof geojsonData === 'string') {
    console.error('[AnalogsView] ensureIfaLayers requiere FeatureCollection en memoria')
    return
  }
  ensureIfaLayers(map, weights, mode, opacity, geojsonData)
}
