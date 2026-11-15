/**
 * Overlays raster del Explorador sobre MapLibre:
 *  - GIBS (Temperatura / Humedad / Precipitación) → source `raster` con tiles WMTS
 *  - NDVI / proceso backend → source `image` anclado al BBox
 */
import type { Map as MapLibreMap } from 'maplibre-gl'
import { GIBS_ATTRIBUTION } from '../config/gibsLayers'
import { gibsMercatorTemplate, type PlanetLayerId } from '../config/planetLayers'
import type { BBox, LeafletBounds } from './bbox'
import { drawProcessOverlayOnMap, PROCESS_OVERLAY_LAYER_ID } from './maplibreProcessOverlay'

export const GIBS_SOURCE_ID = 'gibs-planet'
export const GIBS_LAYER_ID = 'gibs-planet-layer'

export type OverlayLayerType = PlanetLayerId | 'ndvi' | null

export type UpdateOverlayOptions = {
  /** BBox [minLon, minLat, maxLon, maxLat] — obligatorio para NDVI. */
  bbox?: BBox
  /** PNG base64 / data URL del backend (NDVI). */
  image?: string
  /** Bounds Leaflet del backend [[minLat,minLon],[maxLat,maxLon]]. */
  leafletBounds?: LeafletBounds
  /** ID de producto GIBS (MODIS / AIRS / IMERG…). */
  gibsId?: string
  /** Fecha ISO YYYY-MM-DD para la dimensión TIME de GIBS. */
  date?: string
  /** Nivel max GoogleMapsCompatible_LevelN (EPSG:3857). Default 6. */
  mercatorMaxLevel?: number
  /** 0–1 → raster-opacity. */
  opacity?: number
  /** Insertar debajo de esta capa (p. ej. search-bbox-fill). */
  beforeId?: string
}

function resolveBeforeId(map: MapLibreMap, beforeId?: string): string | undefined {
  if (beforeId && map.getLayer(beforeId)) return beforeId
  if (map.getLayer(PROCESS_OVERLAY_LAYER_ID)) return PROCESS_OVERLAY_LAYER_ID
  return undefined
}

/** Quita la capa GIBS (Temperatura/Humedad/Precipitación). */
export function removeGibsLayer(map: MapLibreMap): void {
  if (map.getLayer(GIBS_LAYER_ID)) map.removeLayer(GIBS_LAYER_ID)
  if (map.getSource(GIBS_SOURCE_ID)) map.removeSource(GIBS_SOURCE_ID)
}

/**
 * Upsert de tiles NASA GIBS (EPSG:3857 / GoogleMapsCompatible_LevelN).
 * URL: .../wmts/epsg3857/best/{gibsId}/default/{date}/GoogleMapsCompatible_Level{N}/{z}/{y}/{x}.png
 */
export function upsertGibsLayer(
  map: MapLibreMap,
  gibsId: string,
  date: string,
  opacity: number,
  beforeId?: string,
  mercatorMaxLevel = 6,
): void {
  if (!map.isStyleLoaded()) {
    map.once('load', () => upsertGibsLayer(map, gibsId, date, opacity, beforeId, mercatorMaxLevel))
    return
  }

  const tiles = [gibsMercatorTemplate(gibsId, date, mercatorMaxLevel)]

  // MapLibre no permite cambiar `tiles` in-place → recrear source/layer
  if (map.getSource(GIBS_SOURCE_ID)) {
    removeGibsLayer(map)
  }

  map.addSource(GIBS_SOURCE_ID, {
    type: 'raster',
    tiles,
    tileSize: 256,
    attribution: GIBS_ATTRIBUTION,
    maxzoom: mercatorMaxLevel,
  })

  const before = resolveBeforeId(map, beforeId)
  map.addLayer(
    {
      id: GIBS_LAYER_ID,
      type: 'raster',
      source: GIBS_SOURCE_ID,
      paint: {
        'raster-opacity': opacity,
        'raster-fade-duration': 0,
      },
      minzoom: 0,
      maxzoom: 22,
    },
    before,
  )
}

/** Actualiza solo la opacidad de la capa GIBS activa. */
export function setGibsOpacity(map: MapLibreMap, opacity: number): void {
  if (map.getLayer(GIBS_LAYER_ID)) {
    map.setPaintProperty(GIBS_LAYER_ID, 'raster-opacity', opacity)
  }
}

/**
 * Agrega / actualiza / quita overlays raster sobre el mapa satelital.
 *
 * @example
 * // Temperatura MODIS LST 8-Day
 * updateOverlayLayer(map, 'temperature', {
 *   gibsId: 'MODIS_Terra_L3_Land_Surface_Temp_8Day_Day',
 *   date: '2026-10-16',
 *   mercatorMaxLevel: 7,
 *   opacity: 0.75,
 *   beforeId: 'search-bbox-fill',
 * })
 *
 * // NDVI del backend
 * updateOverlayLayer(map, 'ndvi', {
 *   bbox: [-92.5, 11.5, -83, 17.5],
 *   image: response.overlay_png_base64,
 *   opacity: 0.7,
 * })
 *
 * // Quitar GIBS
 * updateOverlayLayer(map, null)
 */
export function updateOverlayLayer(
  map: MapLibreMap,
  layerType: OverlayLayerType,
  options: UpdateOverlayOptions = {},
): void {
  if (!map.isStyleLoaded()) {
    map.once('load', () => updateOverlayLayer(map, layerType, options))
    return
  }

  const opacity = options.opacity ?? 0.7
  const beforeId = options.beforeId

  if (layerType === null) {
    removeGibsLayer(map)
    return
  }

  if (layerType === 'ndvi') {
    if (!options.image || !options.bbox) {
      console.warn('[updateOverlayLayer] ndvi requiere image + bbox')
      return
    }
    drawProcessOverlayOnMap(map, {
      image: options.image,
      bbox: options.bbox,
      leafletBounds: options.leafletBounds,
      opacity,
      beforeId,
    })
    return
  }

  // temperature | humidity | precipitation → GIBS
  if (!options.gibsId || !options.date) {
    console.warn('[updateOverlayLayer] capa GIBS requiere gibsId + date')
    return
  }
  upsertGibsLayer(
    map,
    options.gibsId,
    options.date,
    opacity,
    beforeId,
    options.mercatorMaxLevel ?? 6,
  )
}
