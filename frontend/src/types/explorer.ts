import type { BBox, LeafletBounds } from '../lib/bbox'

/** Contrato de la API de back-AR (FastAPI v0.3.0). */

export type BodyId = 'earth' | 'moon' | 'mars'

/** hls_thermal = térmico REAL (HLS L30 B10); diviner_thermal = perfil SIMULADO (solo demo). */
export type ProcessMode = 'sar_db' | 'ndvi' | 'ndwi' | 'hls_thermal' | 'diviner_thermal' | 'jaxa_precip'

export interface EarthdataItem {
  id: string
  title: string
  date: string
  source: string
  collection?: string
  cloud_cover?: number | null
  bbox: number[]
  recommended_mode: ProcessMode
  asset_links?: { href?: string; title?: string }[]
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

export type ProcessSourceMode = 'real' | 'demo'

export type ProcessDataMode = 'real' | 'demo'

/** Catálogo óptico real: Sentinel-2 (Element84) o HLS (LP DAAC). */
export type OpticalCatalog = 'sentinel2' | 'hls'

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
  source_mode?: ProcessSourceMode
  source?: OpticalCatalog | string
  demo?: boolean
  source_file: string
  mission?: string | null
  product?: string | null
  catalog?: string | null
  provenance?: string | null
  scene_id?: string | null
  scene_date?: string | null
  cloud_cover?: number | null
  cloud_cover_scene?: number | null
  valid_pixel_pct?: number | null
  warning?: string | null
  unit: string
  stats: { min: number; max: number; mean: number }
  /** Unidad física de stats (p. ej. "°C"); vacío para índices adimensionales. */
  stats_unit?: string
  colormap?: string
  /** Rango [p2, p98] usado para colorear el PNG, en la unidad de stats. */
  color_range?: [number, number]
  qa_excluded_pixels?: { grid_pixels: number; excluded_total: number; by_class: Record<string, number> }
  /** BBox pedido por el cliente. */
  bbox_requested?: number[]
  /** BBox efectivo del ráster leído [minLon, minLat, maxLon, maxLat]. */
  bbox?: number[]
  bounds: LeafletBounds
  overlay_png_base64: string
  band_assets_used?: Record<string, string>
  qa_mask?: string | null
  cryosphere_comparison?: CryosphereComparison
}

export interface ProcessParams {
  mode: ProcessMode
  bbox: BBox
  sampleName?: string
  sceneId?: string
  demo?: boolean
  source?: OpticalCatalog
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
  sceneId?: string
  cloudCover?: number | null
  date?: string | null
  collection?: string | null
}
