import type { BBox, LeafletBounds } from '../lib/bbox'

/** Contrato de la API de back-AR (FastAPI v0.3.0). */

export type BodyId = 'earth' | 'moon' | 'mars'

export type ProcessMode = 'sar_db' | 'ndvi' | 'ndwi' | 'diviner_thermal' | 'jaxa_precip'

export interface EarthdataItem {
  id: string
  title: string
  date: string
  source: string
  bbox: number[]
  recommended_mode: ProcessMode
}

export interface CopernicusItem {
  id: string
  collection: string
  date: string
  cloud_cover: number | null
  source: string
  bbox: number[]
  recommended_mode: ProcessMode
}

export interface PdsItem {
  id: string
  instrument: string
  product_type: string
  source: string
  bbox: number[]
  recommended_mode: ProcessMode
}

export interface PartnerItem {
  id: string
  agency: string
  mission: string
  body: BodyId
  variable: string
  instruments: string
  description: string
  recommended_mode: ProcessMode
  bbox: number[]
}

export interface SearchResponse {
  live_earthdata: EarthdataItem[]
  live_copernicus: CopernicusItem[]
  live_pds_planetary: PdsItem[]
  partner_resources: PartnerItem[]
}

export interface SearchParams {
  bbox: BBox
  body: BodyId
  variable: string
  startDate: string
  endDate: string
  limit?: number
}

export interface CryosphereComparison {
  lunar_psr_min_k: number
  lunar_sunlit_max_k: number
  earth_antarctica_avg_k: number
  delta_vs_earth_ice_k: number
  insight: string
}

export interface ProcessResponse {
  mode: ProcessMode
  source_file: string
  unit: string
  stats: { min: number; max: number; mean: number }
  bounds: LeafletBounds
  overlay_png_base64: string
  cryosphere_comparison?: CryosphereComparison
}

export interface ProcessParams {
  mode: ProcessMode
  bbox: BBox
  sampleName?: string
}

/** Resultado guardado junto con la petición que lo produjo (B3: la descarga usa ESTE bbox). */
export interface ProcessedScene {
  id: string
  request: ProcessParams
  label: string | null
  response: ProcessResponse
}

/** Lo mínimo que necesita la UI para ubicar y procesar un resultado de búsqueda. */
export interface SelectableResult {
  bbox: number[]
  mode: ProcessMode
  label: string
}
