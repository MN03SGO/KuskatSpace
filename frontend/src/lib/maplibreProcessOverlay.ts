import type { ImageSource, Map as MapLibreMap } from 'maplibre-gl'
import type { BBox, LeafletBounds, MaplibreCorners } from './bbox'
import { leafletBoundsToMaplibreCorners } from './bbox'

export const PROCESS_OVERLAY_SOURCE_ID = 'process-overlay'
export const PROCESS_OVERLAY_LAYER_ID = 'process-overlay-layer'

const MERCATOR_MAX_LAT = 85.05112878
const DEFAULT_OPACITY = 0.7

/** Esquinas MapLibre desde BBox [minLon, minLat, maxLon, maxLat]. */
export function bboxToMaplibreCorners(bbox: BBox): MaplibreCorners {
  const [minLon, minLat, maxLon, maxLat] = bbox
  const clampLat = (lat: number) =>
    Math.max(-MERCATOR_MAX_LAT, Math.min(MERCATOR_MAX_LAT, lat))
  return [
    [minLon, clampLat(maxLat)],
    [maxLon, clampLat(maxLat)],
    [maxLon, clampLat(minLat)],
    [minLon, clampLat(minLat)],
  ]
}

export function ensureDataUrl(png: string): string {
  if (!png) return ''
  if (png.startsWith('data:')) return png
  return `data:image/png;base64,${png}`
}

export type ProcessOverlayInput = {
  /** Data URL o base64 puro del PNG (NDVI / térmico / SAR). */
  image: string
  /**
   * Georreferencia. Preferí el BBox de la búsqueda/procesamiento
   * [minLon, minLat, maxLon, maxLat].
   */
  bbox?: BBox
  /** Alternativa: bounds Leaflet [[minLat,minLon],[maxLat,maxLon]] del backend. */
  leafletBounds?: LeafletBounds
  opacity?: number
  /** Insertar la capa raster antes de este layer id (p. ej. el fill del BBox). */
  beforeId?: string
}

/**
 * Dibuja el resultado de `/api/process` como capa `image` + `raster` sobre MapLibre,
 * anclada exactamente al BBox de la búsqueda (georreferenciada).
 */
export function drawProcessOverlayOnMap(
  map: MapLibreMap,
  input: ProcessOverlayInput,
): void {
  if (!map.isStyleLoaded()) {
    map.once('load', () => drawProcessOverlayOnMap(map, input))
    return
  }

  const url = ensureDataUrl(input.image)
  if (!url) {
    console.warn('[process-overlay] overlay_png_base64 vacío')
    return
  }

  const coordinates =
    input.bbox != null
      ? bboxToMaplibreCorners(input.bbox)
      : input.leafletBounds != null
        ? leafletBoundsToMaplibreCorners(input.leafletBounds)
        : null

  if (!coordinates) {
    console.warn('[process-overlay] Falta bbox o leafletBounds para georreferenciar')
    return
  }

  const opacity = input.opacity ?? DEFAULT_OPACITY
  const existing = map.getSource(PROCESS_OVERLAY_SOURCE_ID) as ImageSource | undefined

  if (existing) {
    existing.updateImage({ url, coordinates })
  } else {
    map.addSource(PROCESS_OVERLAY_SOURCE_ID, {
      type: 'image',
      url,
      coordinates,
    })
  }

  // Si el source quedó huérfano tras un style.load, hay que recrear la capa
  if (!map.getLayer(PROCESS_OVERLAY_LAYER_ID)) {
    const before =
      input.beforeId && map.getLayer(input.beforeId) ? input.beforeId : undefined
    map.addLayer(
      {
        id: PROCESS_OVERLAY_LAYER_ID,
        type: 'raster',
        source: PROCESS_OVERLAY_SOURCE_ID,
        paint: {
          'raster-opacity': opacity,
          'raster-fade-duration': 0,
          'raster-resampling': 'linear',
        },
      },
      before,
    )
  } else {
    map.setPaintProperty(PROCESS_OVERLAY_LAYER_ID, 'raster-opacity', opacity)
    map.setPaintProperty(PROCESS_OVERLAY_LAYER_ID, 'raster-fade-duration', 0)
    if (input.beforeId && map.getLayer(input.beforeId)) {
      map.moveLayer(PROCESS_OVERLAY_LAYER_ID, input.beforeId)
    } else {
      map.moveLayer(PROCESS_OVERLAY_LAYER_ID)
    }
  }
}

export function removeProcessOverlay(map: MapLibreMap): void {
  if (map.getLayer(PROCESS_OVERLAY_LAYER_ID)) map.removeLayer(PROCESS_OVERLAY_LAYER_ID)
  if (map.getSource(PROCESS_OVERLAY_SOURCE_ID)) map.removeSource(PROCESS_OVERLAY_SOURCE_ID)
}
