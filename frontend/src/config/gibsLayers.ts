/**
 * Capas NASA GIBS (Worldview) en EPSG:3857. Nombres y TileMatrixSet verificados
 * contra WMTSCapabilities.xml el 2026-11-14. Las fechas se fijan aquí (no "hoy")
 * para que la demo sea reproducible.
 */

const GIBS_BASE = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best'

export const GIBS_ATTRIBUTION = 'Imagery: NASA EOSDIS GIBS / Worldview'

export type AnalogDimension = 'relieve' | 'iluminacion' | 'frio' | 'hielo' | 'polvo'

export interface GibsLayer {
  id: string
  /** Nivel máximo de su TileMatrixSet (= maxNativeZoom / maxzoom de la fuente). */
  maxLevel: number
  format: 'jpg' | 'png'
  /** Fecha por defecto; null para capas sin dimensión temporal. */
  defaultDate: string | null
  dimension?: AnalogDimension | 'filtro' | 'contexto'
}

export const GIBS_LAYERS = {
  blueMarble: { id: 'BlueMarble_ShadedRelief_Bathymetry', maxLevel: 8, format: 'jpg', defaultDate: null },
  trueColor: {
    id: 'MODIS_Terra_CorrectedReflectance_TrueColor',
    maxLevel: 9,
    format: 'jpg',
    defaultDate: '2026-11-01',
    dimension: 'contexto',
  },
  relief: { id: 'ASTER_GDEM_Greyscale_Shaded_Relief', maxLevel: 12, format: 'jpg', defaultDate: null, dimension: 'relieve' },
  lst: {
    id: 'MODIS_Terra_L3_Land_Surface_Temp_Monthly_Day',
    maxLevel: 7,
    format: 'png',
    defaultDate: '2026-01-01',
    dimension: 'frio',
  },
  snow: { id: 'MODIS_Terra_NDSI_Snow_Cover', maxLevel: 8, format: 'png', defaultDate: '2026-11-01', dimension: 'hielo' },
  aod: {
    id: 'MERRA2_Aerosol_Optical_Depth_Analysis_Monthly',
    maxLevel: 6,
    format: 'png',
    defaultDate: '2026-08-01',
    dimension: 'polvo',
  },
  ndvi: { id: 'MODIS_Terra_L3_NDVI_16Day', maxLevel: 9, format: 'png', defaultDate: '2026-10-16', dimension: 'filtro' },
  labels: { id: 'Reference_Labels_15m', maxLevel: 13, format: 'png', defaultDate: null },
  coastlines: { id: 'Coastlines_15m', maxLevel: 13, format: 'png', defaultDate: null },
} as const satisfies Record<string, GibsLayer>

/** URL de teselas {z}/{y}/{x} para Leaflet o MapLibre. */
export function gibsTileUrl(layer: GibsLayer, date: string | null = layer.defaultDate): string {
  const time = date ? `${date}/` : ''
  return `${GIBS_BASE}/${layer.id}/default/${time}GoogleMapsCompatible_Level${layer.maxLevel}/{z}/{y}/{x}.${layer.format}`
}
