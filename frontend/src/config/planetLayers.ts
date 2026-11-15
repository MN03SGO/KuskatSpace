import type { BodyId } from '../types/explorer'

/**
 * Capas globales del planeta (temperatura, humedad, precipitación).
 * Tierra: datos de satélite de NASA GIBS (nombres, TileMatrixSet y colormaps
 * verificados en WMTSCapabilities y /colormaps/v1.3 el 2026-11-14).
 * Luna y Marte: solo temperatura, con un MODELO aproximado (lib/thermalModel.ts).
 */

export type PlanetLayerId = 'temperature' | 'humidity' | 'precipitation'

export const PLANET_LAYER_ORDER: PlanetLayerId[] = ['temperature', 'humidity', 'precipitation']

export interface LegendSpec {
  /** Colores de la paleta, de menor a mayor valor. */
  stops: string[]
  min: number
  max: number
  unit: string
  /** La escala de color es logarítmica (precipitación). */
  log?: boolean
}

export interface EarthLayerDef {
  gibsId: string
  /** Días de retraso típicos de publicación en GIBS: la fecha se recorta a hoy − lagDays. */
  lagDays: number
  legend: LegendSpec
  /** El producto tiene franjas sin datos entre pasadas del satélite. */
  hasSwathGaps: boolean
}

// Paradas muestreadas de los colormaps oficiales de GIBS (8 colores).
export const EARTH_LAYERS: Record<PlanetLayerId, EarthLayerDef> = {
  temperature: {
    gibsId: 'AIRS_L3_Surface_Air_Temperature_Daily_Day',
    lagDays: 7,
    hasSwathGaps: true,
    legend: {
      stops: [
        'rgb(227,245,255)',
        'rgb(139,126,182)',
        'rgb(30,40,102)',
        'rgb(35,101,171)',
        'rgb(135,227,218)',
        'rgb(254,223,136)',
        'rgb(228,44,42)',
        'rgb(251,3,207)',
      ],
      min: 200,
      max: 320,
      unit: 'K',
    },
  },
  humidity: {
    gibsId: 'AIRS_L3_Surface_Relative_Humidity_Daily_Day',
    lagDays: 7,
    hasSwathGaps: true,
    legend: {
      stops: [
        'rgb(183,119,48)',
        'rgb(231,179,119)',
        'rgb(244,236,205)',
        'rgb(223,252,228)',
        'rgb(180,242,223)',
        'rgb(117,213,215)',
        'rgb(47,165,192)',
        'rgb(0,35,96)',
      ],
      min: 0,
      max: 100,
      unit: '%',
    },
  },
  precipitation: {
    gibsId: 'IMERG_Precipitation_Rate',
    lagDays: 2,
    hasSwathGaps: false,
    legend: {
      stops: [
        'rgb(0,118,78)',
        'rgb(0,162,9)',
        'rgb(104,203,0)',
        'rgb(247,217,0)',
        'rgb(255,101,34)',
        'rgb(243,0,0)',
        'rgb(150,0,0)',
        'rgb(51,0,0)',
      ],
      min: 0.1,
      max: 50,
      unit: 'mm/h',
      log: true,
    },
  },
}

/** Paleta del modelo térmico (tipo "inferno"). */
export const MODEL_STOPS = ['#000004', '#320a5e', '#781c6d', '#bc3754', '#ed6925', '#fbb61a', '#fcffa4']

export function isLayerAvailable(body: BodyId, layer: PlanetLayerId): boolean {
  return body === 'earth' || layer === 'temperature'
}

const GIBS_4326 = 'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best'
const GIBS_3857 = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best'

/** Rejilla del TileMatrixSet "2km" de GIBS EPSG:4326, nivel 2: 5 × 3 teselas de 512 px y 72°. */
export const GIBS_EQUIRECT_GRID = { z: 2, cols: 5, rows: 3, tileDeg: 72 } as const

export function gibsEquirectTileUrl(gibsId: string, date: string, row: number, col: number): string {
  return `${GIBS_4326}/${gibsId}/default/${date}/2km/${GIBS_EQUIRECT_GRID.z}/${row}/${col}.png`
}

/** Plantilla {z}/{y}/{x} para el mapa 2D (Leaflet, EPSG:3857). */
export function gibsMercatorTemplate(gibsId: string, date: string): string {
  return `${GIBS_3857}/${gibsId}/default/${date}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10)

/** Fecha a pedir: la elegida, recortada a la más reciente que GIBS suele tener publicada. */
export function layerDate(requested: string, lagDays: number, today: Date = new Date()): string {
  const latest = new Date(today)
  latest.setUTCDate(latest.getUTCDate() - lagDays)
  const latestIso = isoDate(latest)
  return requested > latestIso ? latestIso : requested
}
