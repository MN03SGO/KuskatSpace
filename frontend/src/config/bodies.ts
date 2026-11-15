import type { BBox } from '../lib/bbox'
import type { BodyId } from '../types/explorer'
import { GIBS_ATTRIBUTION, GIBS_LAYERS, gibsTileUrl } from './gibsLayers'

export interface TileConfig {
  id: string
  url: string
  attribution: string
  maxNativeZoom?: number
  opacity?: number
}

export interface BodyConfig {
  id: BodyId
  crs: 'EPSG3857' | 'EPSG4326'
  center: [number, number]
  zoom: number
  maxZoom: number
  /** Latitud máxima para crear un bbox con clic (Web Mercator llega a ~85°). */
  maxClickLat: number
  defaultBBox: BBox
}

/**
 * bbox por defecto alineados con los datasets del backend (B8: la Luna usa
 * -30,-89.5,30,-80 como en connectors.py, no -85..-65 como el App.jsx original).
 */
export const BODIES: Record<BodyId, BodyConfig> = {
  earth: {
    id: 'earth',
    crs: 'EPSG3857',
    center: [13.8, -88.9],
    zoom: 5,
    maxZoom: 12,
    maxClickLat: 85,
    defaultBBox: [-90.1, 13.1, -87.6, 14.5],
  },
  moon: {
    id: 'moon',
    crs: 'EPSG4326',
    center: [0, 0],
    zoom: 2,
    maxZoom: 6,
    maxClickLat: 90,
    defaultBBox: [-30, -89.5, 30, -80],
  },
  mars: {
    id: 'mars',
    crs: 'EPSG4326',
    center: [0, 0],
    zoom: 2,
    maxZoom: 6,
    maxClickLat: 90,
    defaultBBox: [135, -6, 140, -3],
  },
}

export const BODY_ORDER: BodyId[] = ['earth', 'moon', 'mars']

const TREK_MOON =
  'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/{z}/{y}/{x}.jpg'
const TREK_MARS =
  'https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg'

/** Capas base por cuerpo (B18: la Tierra usa GIBS en lugar de Esri). */
export function baseTiles(body: BodyId, gibsDate: string): TileConfig[] {
  if (body === 'moon') {
    return [{ id: 'moon-wac', url: TREK_MOON, attribution: 'NASA LRO WAC · Moon Trek' }]
  }
  if (body === 'mars') {
    return [{ id: 'mars-viking', url: TREK_MARS, attribution: 'NASA Viking MDIM 2.1 · Mars Trek' }]
  }
  return [
    {
      id: 'blue-marble',
      url: gibsTileUrl(GIBS_LAYERS.blueMarble),
      attribution: GIBS_ATTRIBUTION,
      maxNativeZoom: GIBS_LAYERS.blueMarble.maxLevel,
    },
    {
      id: `modis-${gibsDate}`,
      url: gibsTileUrl(GIBS_LAYERS.trueColor, gibsDate),
      attribution: GIBS_ATTRIBUTION,
      maxNativeZoom: GIBS_LAYERS.trueColor.maxLevel,
      opacity: 0.75,
    },
  ]
}
