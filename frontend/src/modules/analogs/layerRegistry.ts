import { IFA_PALETTE_STOPS } from './ifaColorExpr'

/**
 * Registro único de capas del Buscador de análogos.
 * IDs GIBS verificados contra GetCapabilities EPSG:3857 best (2026-11-15).
 */

export type LayerKind = 'ifa-fill' | 'candidates-circles' | 'gibs-raster' | 'heatmap-image'

export type ContextLayerId = 'lst' | 'aod' | 'snow' | 'relief'

export type LegendSpec = {
  /** Colores CSS de menor a mayor (barra de leyenda). */
  stops: string[]
  min: number
  max: number
  unit: string
}

export type GibsContextDef = {
  id: ContextLayerId
  kind: 'gibs-raster'
  /** Mapeo al slider IFA correspondiente. */
  ifaDim: 'frio' | 'polvo' | 'hielo' | 'relieve'
  nameEs: string
  nameEn: string
  helpEs: string
  helpEn: string
  gibsId: string
  tileMatrixSet: string
  maxZoom: number
  format: 'png' | 'jpeg'
  /** Paso temporal ISO-8601 duration (P1D, P8D, P1M) o null si estático. */
  period: string | null
  /** Fecha por defecto (Default de GetCapabilities). */
  defaultDate: string | null
  legend: LegendSpec
  sourceId: string
  layerId: string
}

export type FixedLayerDef = {
  id: 'ifa' | 'candidates'
  kind: LayerKind
  nameEs: string
  nameEn: string
  helpEs: string
  helpEn: string
  legend?: LegendSpec
  layerId: string
}

/** Paleta del IFA (plasma, frío → cálido): misma fuente que la expresión GPU. */
export { IFA_PALETTE_STOPS }

export const IFA_LAYER: FixedLayerDef = {
  id: 'ifa',
  kind: 'ifa-fill',
  nameEs: 'Índice de análogos (IFA)',
  nameEn: 'Analog Fidelity Index (IFA)',
  helpEs: 'Celdas GEE EASE-Grid · expresión GPU ponderada 5D',
  helpEn: 'GEE EASE-Grid cells · GPU-weighted 5D expression',
  legend: { stops: [...IFA_PALETTE_STOPS], min: 0, max: 1, unit: 'IFA' },
  layerId: 'grid-fill',
}

export const CANDIDATES_LAYER: FixedLayerDef = {
  id: 'candidates',
  kind: 'candidates-circles',
  nameEs: 'Candidatos análogos',
  nameEn: 'Analog candidates',
  helpEs: 'Sitios curados / descubiertos · ranking IFA',
  helpEn: 'Curated / discovered sites · IFA ranking',
  layerId: 'candidates-circles',
}

/**
 * Capas de contexto GIBS (GetCapabilities 2026-11-15).
 * Relieve: ASTER_GDEM_Greyscale_Shaded_Relief existe (sin Time).
 */
export const CONTEXT_LAYERS: readonly GibsContextDef[] = [
  {
    id: 'lst',
    kind: 'gibs-raster',
    ifaDim: 'frio',
    nameEs: 'Frío extremo (LST)',
    nameEn: 'Extreme cold (LST)',
    helpEs: 'MODIS Terra LST 8-Day Day · 1 km',
    helpEn: 'MODIS Terra LST 8-Day Day · 1 km',
    gibsId: 'MODIS_Terra_L3_Land_Surface_Temp_8Day_Day',
    tileMatrixSet: 'GoogleMapsCompatible_Level7',
    maxZoom: 7,
    format: 'png',
    period: 'P8D',
    defaultDate: '2026-11-01',
    legend: {
      stops: ['#440154', '#31688e', '#35b779', '#fde725'],
      min: 200,
      max: 320,
      unit: 'K',
    },
    sourceId: 'ctx-lst',
    layerId: 'ctx-lst-raster',
  },
  {
    id: 'aod',
    kind: 'gibs-raster',
    ifaDim: 'polvo',
    nameEs: 'Polvo (AOD)',
    nameEn: 'Dust (AOD)',
    helpEs: 'MERRA-2 Aerosol Optical Depth Analysis Monthly · 550 nm',
    helpEn: 'MERRA-2 Aerosol Optical Depth Analysis Monthly · 550 nm',
    gibsId: 'MERRA2_Aerosol_Optical_Depth_Analysis_Monthly',
    tileMatrixSet: 'GoogleMapsCompatible_Level6',
    maxZoom: 6,
    format: 'png',
    period: 'P1M',
    defaultDate: '2026-08-01',
    legend: {
      stops: ['#ffffcc', '#fd8d3c', '#e31a1c', '#800026'],
      min: 0,
      max: 1,
      unit: 'AOD 550 nm',
    },
    sourceId: 'ctx-aod',
    layerId: 'ctx-aod-raster',
  },
  {
    id: 'snow',
    kind: 'gibs-raster',
    ifaDim: 'hielo',
    nameEs: 'Hielo / criosfera',
    nameEn: 'Ice / cryosphere',
    helpEs: 'MODIS Terra NDSI Snow Cover · diario',
    helpEn: 'MODIS Terra NDSI Snow Cover · daily',
    gibsId: 'MODIS_Terra_NDSI_Snow_Cover',
    tileMatrixSet: 'GoogleMapsCompatible_Level8',
    maxZoom: 8,
    format: 'png',
    period: 'P1D',
    defaultDate: '2026-11-16',
    legend: {
      stops: ['#0c2c84', '#41b6c4', '#ffffcc', '#ffffff'],
      min: 0,
      max: 100,
      unit: '% NDSI',
    },
    sourceId: 'ctx-snow',
    layerId: 'ctx-snow-raster',
  },
  {
    id: 'relief',
    kind: 'gibs-raster',
    ifaDim: 'relieve',
    nameEs: 'Relieve (sombreado)',
    nameEn: 'Relief (shaded)',
    helpEs: 'ASTER GDEM Greyscale Shaded Relief · sin dimensión temporal',
    helpEn: 'ASTER GDEM Greyscale Shaded Relief · no time dimension',
    gibsId: 'ASTER_GDEM_Greyscale_Shaded_Relief',
    tileMatrixSet: 'GoogleMapsCompatible_Level12',
    maxZoom: 12,
    format: 'jpeg',
    period: null,
    defaultDate: null,
    legend: {
      stops: ['#000000', '#666666', '#cccccc', '#ffffff'],
      min: 0,
      max: 1,
      unit: 'relieve (rel.)',
    },
    sourceId: 'ctx-relief',
    layerId: 'ctx-relief-raster',
  },
] as const

const GIBS_BASE = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best'

/** Plantilla REST GIBS: …/{TileMatrixSet}/{z}/{y}/{x}.{ext} */
export function gibsContextTileUrl(def: GibsContextDef, date: string | null): string {
  const time = def.period && date ? `${date}/` : ''
  return `${GIBS_BASE}/${def.gibsId}/default/${time}${def.tileMatrixSet}/{z}/{y}/{x}.${def.format}`
}

export function getContextLayer(id: ContextLayerId): GibsContextDef | undefined {
  return CONTEXT_LAYERS.find((l) => l.id === id)
}
