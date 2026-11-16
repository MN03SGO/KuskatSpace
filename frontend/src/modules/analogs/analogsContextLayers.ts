/**
 * Capas GIBS de contexto en el mapa del Buscador.
 * Alternar = layout visibility / paint opacity (nunca removeLayer).
 * Cambiar fecha = source.setTiles([...]).
 */
import type { Map as MapLibreMap, RasterTileSource } from 'maplibre-gl'
import {
  CONTEXT_LAYERS,
  type ContextLayerId,
  type GibsContextDef,
  gibsContextTileUrl,
} from './layerRegistry'

export type ContextVisibility = Record<ContextLayerId, boolean>
export type ContextOpacity = Record<ContextLayerId, number>

export const DEFAULT_CONTEXT_VISIBILITY: ContextVisibility = {
  lst: false,
  aod: false,
  snow: false,
  relief: false,
}

export const DEFAULT_CONTEXT_OPACITY: ContextOpacity = {
  lst: 0.65,
  aod: 0.65,
  snow: 0.65,
  relief: 0.45,
}

function safeBeforeId(map: MapLibreMap, id: string | undefined): string | undefined {
  if (!id) return undefined
  return map.getLayer(id) ? id : undefined
}

function ensureSourceAndLayer(
  map: MapLibreMap,
  def: GibsContextDef,
  date: string | null,
  beforeId: string | undefined,
): void {
  try {
    const url = gibsContextTileUrl(def, date)
    if (!map.getSource(def.sourceId)) {
      map.addSource(def.sourceId, {
        type: 'raster',
        tiles: [url],
        tileSize: 256,
        maxzoom: def.maxZoom,
        attribution: 'NASA GIBS / Worldview',
      })
    }
    if (!map.getLayer(def.layerId)) {
      const before = safeBeforeId(map, beforeId)
      map.addLayer(
        {
          id: def.layerId,
          type: 'raster',
          source: def.sourceId,
          layout: { visibility: 'none' },
          paint: {
            'raster-opacity': DEFAULT_CONTEXT_OPACITY[def.id],
            'raster-fade-duration': 0,
          },
        },
        before,
      )
    }
  } catch (err) {
    console.error(`[AnalogsView] contexto GIBS ${def.id}`, err)
  }
}

/**
 * Monta las 4 capas de contexto una sola vez.
 * Orden deseado: bajo IFA / candidatos. Solo pasa beforeId si la capa existe.
 */
export function ensureAllContextLayers(map: MapLibreMap, beforeId?: string): void {
  const before = safeBeforeId(
    map,
    beforeId && map.getLayer(beforeId)
      ? beforeId
      : map.getLayer('grid-circles')
        ? 'grid-circles'
        : map.getLayer('grid-fill')
          ? 'grid-fill'
          : map.getLayer('candidates-circles')
            ? 'candidates-circles'
            : undefined,
  )
  for (const def of CONTEXT_LAYERS) {
    ensureSourceAndLayer(map, def, def.defaultDate, before)
  }
}

export function setContextVisibility(
  map: MapLibreMap,
  id: ContextLayerId,
  visible: boolean,
): void {
  const def = CONTEXT_LAYERS.find((l) => l.id === id)
  if (!def || !map.getLayer(def.layerId)) return
  try {
    map.setLayoutProperty(def.layerId, 'visibility', visible ? 'visible' : 'none')
  } catch (err) {
    console.error(`[AnalogsView] visibilidad ${id}`, err)
  }
}

export function setContextOpacity(map: MapLibreMap, id: ContextLayerId, opacity: number): void {
  const def = CONTEXT_LAYERS.find((l) => l.id === id)
  if (!def || !map.getLayer(def.layerId)) return
  try {
    const o = Math.min(1, Math.max(0.1, opacity))
    map.setPaintProperty(def.layerId, 'raster-opacity', o)
  } catch (err) {
    console.error(`[AnalogsView] opacidad ${id}`, err)
  }
}

/** Actualiza tiles de una capa temporal sin recrear source/layer. */
export function setContextDate(map: MapLibreMap, id: ContextLayerId, date: string): void {
  const def = CONTEXT_LAYERS.find((l) => l.id === id)
  if (!def || !def.period) return
  try {
    const src = map.getSource(def.sourceId) as RasterTileSource | undefined
    if (!src || typeof src.setTiles !== 'function') return
    src.setTiles([gibsContextTileUrl(def, date)])
  } catch (err) {
    console.error(`[AnalogsView] fecha ${id}`, err)
  }
}

export function applyAllContextState(
  map: MapLibreMap,
  visibility: ContextVisibility,
  opacity: ContextOpacity,
): void {
  for (const def of CONTEXT_LAYERS) {
    setContextVisibility(map, def.id, visibility[def.id])
    setContextOpacity(map, def.id, opacity[def.id])
  }
}
