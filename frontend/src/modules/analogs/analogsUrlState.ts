/**
 * Estado compartible vía URL del Buscador de análogos.
 * Params: sc, w, sel, ctx, d, ifa
 */
import type { IfaMode, IfaWeights } from './ifaColorExpr'
import type { ContextLayerId } from './layerRegistry'
import {
  DEFAULT_CONTEXT_OPACITY,
  DEFAULT_CONTEXT_VISIBILITY,
  type ContextOpacity,
  type ContextVisibility,
} from './analogsContextLayers'

export type AnalogsUrlState = {
  scenario: IfaMode
  weights: IfaWeights
  selectedId: string | null
  contextVisibility: ContextVisibility
  contextOpacity: ContextOpacity
  date: string | null
  /** Opacidad IFA 0.1–1 */
  ifaOpacity: number
}

const WEIGHT_KEYS: (keyof IfaWeights)[] = [
  'relieve',
  'iluminacion',
  'frio',
  'hielo',
  'polvo',
]

const CONTEXT_IDS: ContextLayerId[] = ['lst', 'aod', 'snow', 'relief']

const SCENARIOS: IfaMode[] = ['global', 'moon_psr', 'mars_arid']

function clamp01(n: number, min = 0.1, max = 1): number {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

function parseIsoDate(s: string | null): string | null {
  if (!s) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(`${s}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return null
  return s
}

export function defaultAnalogsUrlState(baseWeights: IfaWeights): AnalogsUrlState {
  return {
    scenario: 'global',
    weights: { ...baseWeights },
    selectedId: null,
    contextVisibility: { ...DEFAULT_CONTEXT_VISIBILITY },
    contextOpacity: { ...DEFAULT_CONTEXT_OPACITY },
    date: null,
    ifaOpacity: 0.65,
  }
}

/** Lee y valida searchParams. Valores inválidos → defaults. */
export function parseAnalogsUrl(
  search: string,
  baseWeights: IfaWeights,
): AnalogsUrlState {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const out = defaultAnalogsUrlState(baseWeights)

  const sc = params.get('sc')
  if (sc && (SCENARIOS as string[]).includes(sc)) {
    out.scenario = sc as IfaMode
  }

  const w = params.get('w')
  if (w) {
    const parts = w.split(',').map((x) => parseFloat(x))
    if (parts.length === 5 && parts.every((n) => Number.isFinite(n) && n >= 0 && n <= 1)) {
      WEIGHT_KEYS.forEach((k, i) => {
        out.weights[k] = parts[i]
      })
    }
  }

  const sel = params.get('sel')
  if (sel && /^[a-zA-Z0-9_\-.:]+$/.test(sel) && sel.length < 120) {
    out.selectedId = sel
  }

  const ifa = params.get('ifa')
  if (ifa) {
    const n = parseFloat(ifa)
    if (Number.isFinite(n)) out.ifaOpacity = clamp01(n)
  }

  const ctx = params.get('ctx')
  if (ctx) {
    // formato: lst:0.7,aod:0.5  (presente = visible)
    const vis = { ...DEFAULT_CONTEXT_VISIBILITY }
    const opac = { ...DEFAULT_CONTEXT_OPACITY }
    for (const token of ctx.split(',')) {
      const [id, op] = token.split(':')
      if (!(CONTEXT_IDS as string[]).includes(id)) continue
      const cid = id as ContextLayerId
      vis[cid] = true
      if (op !== undefined && op !== '') {
        const n = parseFloat(op)
        if (Number.isFinite(n)) opac[cid] = clamp01(n)
      }
    }
    out.contextVisibility = vis
    out.contextOpacity = opac
  }

  out.date = parseIsoDate(params.get('d'))

  return out
}

/** Serializa a query string (sin `?`). Omite defaults para URLs cortas. */
export function serializeAnalogsUrl(state: AnalogsUrlState, baseWeights: IfaWeights): string {
  const params = new URLSearchParams()

  if (state.scenario !== 'global') params.set('sc', state.scenario)

  const weightsChanged = WEIGHT_KEYS.some(
    (k) => Math.abs(state.weights[k] - baseWeights[k]) > 1e-6,
  )
  if (weightsChanged) {
    params.set(
      'w',
      WEIGHT_KEYS.map((k) => state.weights[k].toFixed(2)).join(','),
    )
  }

  if (state.selectedId) params.set('sel', state.selectedId)

  if (Math.abs(state.ifaOpacity - 0.65) > 0.01) {
    params.set('ifa', state.ifaOpacity.toFixed(2))
  }

  const active = CONTEXT_IDS.filter((id) => state.contextVisibility[id])
  if (active.length > 0) {
    params.set(
      'ctx',
      active.map((id) => `${id}:${state.contextOpacity[id].toFixed(2)}`).join(','),
    )
  }

  if (state.date && active.some((id) => id !== 'relief')) {
    params.set('d', state.date)
  }

  return params.toString()
}

export function writeAnalogsUrl(state: AnalogsUrlState, baseWeights: IfaWeights): void {
  const qs = serializeAnalogsUrl(state, baseWeights)
  const next = qs ? `${window.location.pathname}?${qs}${window.location.hash}` : `${window.location.pathname}${window.location.hash}`
  const cur = `${window.location.pathname}${window.location.search}${window.location.hash}`
  if (next !== cur) {
    window.history.replaceState(null, '', next)
  }
}
