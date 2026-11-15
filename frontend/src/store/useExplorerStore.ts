import { create } from 'zustand'
import { processScene, searchCatalogs } from '../api/explorer'
import { ApiError } from '../api/http'
import { BODIES } from '../config/bodies'
import { type PlanetLayerId, isLayerAvailable } from '../config/planetLayers'
import { type BBox, type BBoxError, formatBBox, parseBBox, sameBBox, validateBBox } from '../lib/bbox'
import type { BodyId, ProcessMode, ProcessedScene, SearchResponse, SelectableResult } from '../types/explorer'

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
  runSearch: () => Promise<void>
  runProcess: (mode: ProcessMode, opts?: { bbox?: BBox; label?: string | null }) => Promise<void>
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
    const bbox = opts.bbox ?? get().bbox
    const request = { mode, bbox }
    const seq = ++processSeq
    set({ process: { state: 'loading', mode } })
    try {
      const response = await processScene(request)
      if (seq !== processSeq) return
      set({
        scene: { id: `${mode}:${formatBBox(bbox, 4)}:${seq}`, request, label: opts.label ?? null, response },
        process: { state: 'success', mode },
      })
    } catch (err) {
      if (seq !== processSeq) return
      set({ process: { state: 'error', mode, error: toApiError(err) } })
    }
  },

  selectResult: async ({ bbox, mode, label }) => {
    const valid = validateBBox(bbox)
    const target = valid.ok ? valid.bbox : get().bbox
    get().setBbox(target)
    await get().runProcess(mode, { bbox: get().bbox, label })
  },
}))
