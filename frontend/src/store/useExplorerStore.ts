import { create } from 'zustand'
import { processScene, searchCatalogs } from '../api/explorer'
import { ApiError } from '../api/http'
import { BODIES } from '../config/bodies'
import { type PlanetLayerId, isLayerAvailable } from '../config/planetLayers'
import { DEMO_PROCESS_MODES, REAL_ONLY_PROCESS_MODES, isHlsL30 } from '../config/processModes'
import { type BBox, type BBoxError, formatBBox, parseBBox, sameBBox, validateBBox } from '../lib/bbox'
import type {
  BodyId,
  OpticalCatalog,
  ProcessDataMode,
  ProcessMode,
  ProcessedScene,
  SearchResponse,
  SelectableResult,
} from '../types/explorer'

export type RequestState = 'idle' | 'loading' | 'success' | 'error'

export type ExplorerViewMode = 'globe' | 'map'

export interface RequestStatus {
  state: RequestState
  error?: ApiError
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10)

/** Ayer (UTC): la imagen diaria más reciente que GIBS suele tener completa. */
function yesterday(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 1)
  return isoDate(d)
}

function defaultDateRange(): { startDate: string; endDate: string } {
  const end = new Date()
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - 30)
  return { startDate: isoDate(start), endDate: isoDate(end) }
}

function toApiError(err: unknown): ApiError {
  return err instanceof ApiError ? err : new ApiError('network', { detail: String(err) })
}

interface ExplorerState {
  /** Globo 3D (por defecto) o mapa 2D de Leaflet. */
  view: ExplorerViewMode
  body: BodyId
  /** bbox vigente. Solo se reemplaza cuando cambia de verdad, así el mapa no vuelve a volar en cada render (B14). */
  bbox: BBox
  bboxText: string
  bboxError: BBoxError | null
  variable: string
  startDate: string
  endDate: string
  gibsDate: string
  opacity: number
  /** Capa global del planeta visible (temperatura, humedad o precipitación). */
  planetLayer: PlanetLayerId | null
  planetLayerOpacity: number

  search: RequestStatus
  results: SearchResponse | null
  /** Separado de la búsqueda (B5). */
  process: RequestStatus & { mode?: ProcessMode }
  scene: ProcessedScene | null
  /** Escena elegida en la lista de resultados (necesaria para NDVI/NDWI reales). */
  selectedResult: SelectableResult | null
  /** real = COG de la escena; demo = GeoTIFF local. */
  processDataMode: ProcessDataMode
  /** Catálogo óptico real: Sentinel-2 o HLS. */
  opticalCatalog: OpticalCatalog
  /** Aviso UI cuando el usuario pulsa NDVI/NDWI sin escena. */
  processHint: string | null

  setView: (view: ExplorerViewMode) => void
  setBody: (body: BodyId) => void
  setBboxText: (text: string) => void
  setBbox: (bbox: BBox) => void
  setVariable: (variable: string) => void
  setStartDate: (date: string) => void
  setEndDate: (date: string) => void
  setGibsDate: (date: string) => void
  setOpacity: (opacity: number) => void
  /** Activa la capa; si ya estaba activa, la oculta. */
  togglePlanetLayer: (layer: PlanetLayerId) => void
  setPlanetLayerOpacity: (opacity: number) => void
  setProcessDataMode: (mode: ProcessDataMode) => void
  setOpticalCatalog: (catalog: OpticalCatalog) => void
  clearProcessHint: () => void
  runSearch: () => Promise<void>
  runProcess: (mode: ProcessMode, opts?: { bbox?: BBox; label?: string | null; sceneId?: string }) => Promise<void>
  selectResult: (result: SelectableResult) => Promise<void>
}

// Cada petición recibe un número; si al volver ya hay otra más nueva, se descarta.
let searchSeq = 0
let processSeq = 0

export const useExplorerStore = create<ExplorerState>((set, get) => ({
  view: 'globe',
  body: 'earth',
  bbox: BODIES.earth.defaultBBox,
  bboxText: formatBBox(BODIES.earth.defaultBBox),
  bboxError: null,
  variable: 'all',
  ...defaultDateRange(),
  gibsDate: yesterday(),
  opacity: 0.82,
  planetLayer: null,
  planetLayerOpacity: 0.75,

  search: { state: 'idle' },
  results: null,
  process: { state: 'idle' },
  scene: null,
  selectedResult: null,
  processDataMode: 'real',
  opticalCatalog: 'sentinel2',
  processHint: null,

  setView: (view) => set({ view }),

  setBody: (body) => {
    if (body === get().body) return
    searchSeq++
    processSeq++
    const bbox = BODIES[body].defaultBBox
    const layer = get().planetLayer
    set({
      body,
      // La humedad y la precipitación solo existen en la Tierra.
      planetLayer: layer && isLayerAvailable(body, layer) ? layer : null,
      bbox,
      bboxText: formatBBox(bbox),
      bboxError: null,
      variable: 'all',
      search: { state: 'idle' },
      results: null,
      process: { state: 'idle' },
      scene: null,
      selectedResult: null,
      processHint: null,
    })
  },

  setBboxText: (text) => {
    const parsed = parseBBox(text)
    if (!parsed.ok) {
      set({ bboxText: text, bboxError: parsed.error })
      return
    }
    const current = get().bbox
    set({ bboxText: text, bboxError: null, bbox: sameBBox(current, parsed.bbox) ? current : parsed.bbox })
  },

  setBbox: (bbox) => {
    if (sameBBox(get().bbox, bbox)) return
    set({ bbox, bboxText: formatBBox(bbox), bboxError: null })
  },

  setVariable: (variable) => set({ variable }),
  setStartDate: (startDate) => set({ startDate }),
  setEndDate: (endDate) => set({ endDate }),
  setGibsDate: (gibsDate) => set({ gibsDate }),
  setOpacity: (opacity) => set({ opacity }),
  togglePlanetLayer: (layer) => {
    if (!isLayerAvailable(get().body, layer)) return
    set({ planetLayer: get().planetLayer === layer ? null : layer })
  },
  setPlanetLayerOpacity: (planetLayerOpacity) => set({ planetLayerOpacity }),
  setProcessDataMode: (processDataMode) => set({ processDataMode, processHint: null }),
  setOpticalCatalog: (opticalCatalog) => set({ opticalCatalog, processHint: null, selectedResult: null }),
  clearProcessHint: () => set({ processHint: null }),

  runSearch: async () => {
    const { bbox, body, variable, startDate, endDate } = get()
    const seq = ++searchSeq
    set({ search: { state: 'loading' } })
    try {
      const results = await searchCatalogs({ bbox, body, variable, startDate, endDate, limit: 5 })
      if (seq !== searchSeq) return
      set({ results, search: { state: 'success' } })
    } catch (err) {
      if (seq !== searchSeq) return
      set({ search: { state: 'error', error: toApiError(err) } })
    }
  },

  runProcess: async (mode, opts = {}) => {
    const state = get()
    const bbox = opts.bbox ?? state.bbox
    const selected = state.selectedResult
    const optical = mode === 'ndvi' || mode === 'ndwi'
    const realOnly = REAL_ONLY_PROCESS_MODES.has(mode)
    const demoOnly = DEMO_PROCESS_MODES.has(mode)
    // hls_thermal nunca se procesa en demo: no hay simulación silenciosa
    const useDemo = !realOnly && (state.processDataMode === 'demo' || demoOnly)
    const sceneId = opts.sceneId ?? selected?.sceneId

    if ((optical || realOnly) && !useDemo && !sceneId) {
      set({
        processHint: 'needScene',
        process: { state: 'idle', mode },
      })
      return
    }
    if (realOnly && !isHlsL30(sceneId, selected?.collection)) {
      set({
        processHint: 'needL30Scene',
        process: { state: 'idle', mode },
      })
      return
    }

    const request = {
      mode,
      bbox,
      sceneId: useDemo ? undefined : sceneId,
      demo: useDemo,
      source: useDemo ? undefined : realOnly ? ('hls' as OpticalCatalog) : state.opticalCatalog,
    }
    const seq = ++processSeq
    set({ process: { state: 'loading', mode }, processHint: null })
    try {
      const response = await processScene(request)
      if (seq !== processSeq) return
      set({
        scene: {
          id: `${mode}:${formatBBox(bbox, 4)}:${seq}`,
          request,
          label: opts.label ?? selected?.label ?? null,
          response,
        },
        process: { state: 'success', mode },
      })
    } catch (err) {
      if (seq !== processSeq) return
      set({ process: { state: 'error', mode, error: toApiError(err) } })
    }
  },

  selectResult: async (result) => {
    const valid = validateBBox(result.bbox)
    const target = valid.ok ? valid.bbox : get().bbox
    // Recortar a ≤0.5° por lado para el modo real (límite del backend)
    let processBbox = target
    const [minLon, minLat, maxLon, maxLat] = target
    const maxSide = 0.45
    if (maxLon - minLon > maxSide || maxLat - minLat > maxSide) {
      const cx = (minLon + maxLon) / 2
      const cy = (minLat + maxLat) / 2
      const halfLon = Math.min(maxSide / 2, (maxLon - minLon) / 2)
      const halfLat = Math.min(maxSide / 2, (maxLat - minLat) / 2)
      processBbox = [cx - halfLon, cy - halfLat, cx + halfLon, cy + halfLat]
    }
    get().setBbox(processBbox)
    // Ajustar catálogo según la lista de origen
    const catalog: OpticalCatalog =
      result.collection?.startsWith('HLS') || result.collection === 'HLSS30' || result.collection === 'HLSL30'
        ? 'hls'
        : result.collection?.includes('sentinel-2')
          ? 'sentinel2'
          : get().opticalCatalog
    set({
      selectedResult: { ...result, bbox: [...processBbox] },
      processHint: null,
      opticalCatalog: catalog,
      processDataMode: result.sceneId ? 'real' : get().processDataMode,
    })
    const mode = result.mode === 'ndvi' || result.mode === 'ndwi' ? result.mode : 'ndvi'
    await get().runProcess(mode, {
      bbox: get().bbox,
      label: result.label,
      sceneId: result.sceneId,
    })
  },
}))
