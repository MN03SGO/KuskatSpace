/**
 * Validación del GeoJSON de VISUALIZACIÓN IFA.
 * - 0 celdas con Δlat/Δlon > 3°
 * - candidatos conocidos dentro / < 1 celda de su polígono
 * - ≥95% celdas con IFA calculable (≥3/5 variables)
 * Cobertura latitudinal: solo se REPORTA (dataset por ROI, no global).
 * Nunca activa PNG por huecos de cobertura.
 */

export const MAX_CELL_DEG = 3
export const MIN_IFA_CALCULABLE_RATIO = 0.95
/** Distancia máxima candidato→centroide ≈ 1 celda 15 km (diagonal/2 ~ 10.6 → usamos 15 km). */
export const MAX_CANDIDATE_KM = 15

export type GridGeometryReport = {
  valid: boolean
  featureCount: number
  oversizeCount: number
  oversizeRatio: number
  ifaCalculableRatio: number
  candidateHits: number
  candidateTotal: number
  candidateFailIds: string[]
  reason: string | null
  /** Solo informativo — no invalida. */
  emptyLandBands: string[]
  widthDeg: { p50: number; p95: number; max: number }
  heightDeg: { p50: number; p95: number; max: number }
}

type CandRef = {
  id: string
  cellId: string
  lon: number
  lat: number
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const i = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * (sorted.length - 1))))
  return sorted[i]
}

function ringBounds(ring: number[][]): { w: number; h: number; lon: number; lat: number } {
  const xs = ring.slice(0, -1).map((c) => c[0])
  const ys = ring.slice(0, -1).map((c) => c[1])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  return {
    w: maxX - minX,
    h: maxY - minY,
    lon: 0.5 * (minX + maxX),
    lat: 0.5 * (minY + maxY),
  }
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toR = (d: number) => (d * Math.PI) / 180
  const dLat = toR(lat2 - lat1)
  const dLon = toR(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)))
}

function pointInRing(lon: number, lat: number, ring: number[][]): boolean {
  // ray casting
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0]
    const yi = ring[i][1]
    const xj = ring[j][0]
    const yj = ring[j][1]
    const intersect =
      yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-15) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function availableVars(props: Record<string, unknown>): number {
  const missing = Number(props.missing)
  if (Number.isFinite(missing)) return Math.max(0, 5 - missing)
  // fallback: count finite dims
  let n = 0
  for (const k of ['relief', 'illum', 'cold', 'ice', 'dust']) {
    const v = Number(props[k])
    if (Number.isFinite(v)) n += 1
  }
  return n
}

const LAND_BANDS = [
  '[-90,-80)',
  '[-80,-70)',
  '[-70,-60)',
  '[-60,-50)',
  '[-50,-40)',
  '[-40,-30)',
  '[-30,-20)',
  '[-20,-10)',
  '[-10,0)',
  '[0,10)',
  '[10,20)',
  '[20,30)',
  '[30,40)',
  '[40,50)',
  '[50,60)',
  '[60,70)',
  '[70,80)',
  '[80,90)',
]

function latBand(lat: number): string {
  let lo = Math.floor(lat / 10) * 10
  if (lo < -90) lo = -90
  if (lo >= 90) lo = 80
  return `[${lo},${lo + 10})`
}

export function analyzeGridFeatureCollection(
  fc: GeoJSON.FeatureCollection,
  candidates: CandRef[] = [],
): GridGeometryReport {
  const widths: number[] = []
  const heights: number[] = []
  let oversize = 0
  let ifaOk = 0
  const byCellId = new Map<string, { ring: number[][]; lon: number; lat: number; stepKm: number }>()
  const occupiedBands = new Set<string>()

  for (const ft of fc.features) {
    if (!ft.geometry || ft.geometry.type !== 'Polygon') continue
    const ring = ft.geometry.coordinates[0]
    if (!ring || ring.length < 4) continue
    const b = ringBounds(ring as number[][])
    widths.push(b.w)
    heights.push(b.h)
    if (b.w > MAX_CELL_DEG || b.h > MAX_CELL_DEG) oversize += 1
    occupiedBands.add(latBand(b.lat))

    const props = (ft.properties ?? {}) as Record<string, unknown>
    if (availableVars(props) >= 3) ifaOk += 1

    const cid = String(props.cell_id ?? '')
    if (cid) {
      byCellId.set(cid, {
        ring: ring as number[][],
        lon: b.lon,
        lat: b.lat,
        stepKm: Number(props.step_km) || 15,
      })
    }
  }

  widths.sort((a, b) => a - b)
  heights.sort((a, b) => a - b)
  const n = fc.features.length
  const oversizeRatio = n > 0 ? oversize / n : 1
  const ifaCalculableRatio = n > 0 ? ifaOk / n : 0

  const emptyLandBands = LAND_BANDS.filter((b) => !occupiedBands.has(b))
  // Report-only
  if (emptyLandBands.length > 0) {
    console.info(
      '[AnalogsView] Bandas lat con tierra típica y sin celdas (informativo, no invalida):',
      emptyLandBands.join(', '),
    )
  }
  console.info(
    '[AnalogsView] Cobertura lat (celdas):',
    LAND_BANDS.filter((b) => occupiedBands.has(b)).join(', '),
  )

  const candidateFailIds: string[] = []
  let candidateHits = 0
  const e15Cands = candidates.filter((c) => c.cellId.startsWith('E'))
  for (const c of e15Cands) {
    const cell = byCellId.get(c.cellId)
    if (!cell) {
      // candidato cuyo polígono fue excluido (polar) — no falla el validador de viz
      continue
    }
    const inside = pointInRing(c.lon, c.lat, cell.ring)
    const d = haversineKm(c.lat, c.lon, cell.lat, cell.lon)
    const maxD = Math.max(MAX_CANDIDATE_KM, cell.stepKm)
    if (inside || d <= maxD) {
      candidateHits += 1
    } else {
      candidateFailIds.push(c.id)
    }
  }
  const candidateTotal = e15Cands.filter((c) => byCellId.has(c.cellId)).length

  let reason: string | null = null
  if (n === 0) {
    reason = 'GeoJSON vacío'
  } else if (oversize > 0) {
    reason = `${oversize} celdas con Δlat/Δlon > ${MAX_CELL_DEG}°`
  } else if (ifaCalculableRatio < MIN_IFA_CALCULABLE_RATIO) {
    reason = `IFA calculable ${(ifaCalculableRatio * 100).toFixed(1)}% < ${MIN_IFA_CALCULABLE_RATIO * 100}%`
  } else if (candidateTotal > 0 && candidateFailIds.length > 0) {
    reason = `${candidateFailIds.length} candidatos lejos de su polígono`
  }

  return {
    valid: reason === null,
    featureCount: n,
    oversizeCount: oversize,
    oversizeRatio,
    ifaCalculableRatio,
    candidateHits,
    candidateTotal,
    candidateFailIds,
    reason,
    emptyLandBands,
    widthDeg: {
      p50: percentile(widths, 50),
      p95: percentile(widths, 95),
      max: percentile(widths, 100),
    },
    heightDeg: {
      p50: percentile(heights, 50),
      p95: percentile(heights, 95),
      max: percentile(heights, 100),
    },
  }
}

async function loadCandidateRefs(): Promise<CandRef[]> {
  try {
    const res = await fetch('/data/candidates.json')
    if (!res.ok) return []
    const data = (await res.json()) as Array<{
      _id: string
      location?: { coordinates?: [number, number] }
      p1_cell_metrics?: { cell_id?: string }
    }>
    const out: CandRef[] = []
    for (const c of data) {
      const cellId = c.p1_cell_metrics?.cell_id
      const coords = c.location?.coordinates
      if (!cellId || !coords) continue
      out.push({ id: c._id, cellId, lon: coords[0], lat: coords[1] })
    }
    return out
  } catch {
    return []
  }
}

export async function fetchAndValidateGrid(url: string): Promise<{
  fc: GeoJSON.FeatureCollection | null
  report: GridGeometryReport
}> {
  const emptyReport = (reason: string): GridGeometryReport => ({
    valid: false,
    featureCount: 0,
    oversizeCount: 0,
    oversizeRatio: 1,
    ifaCalculableRatio: 0,
    candidateHits: 0,
    candidateTotal: 0,
    candidateFailIds: [],
    reason,
    emptyLandBands: LAND_BANDS,
    widthDeg: { p50: 0, p95: 0, max: 0 },
    heightDeg: { p50: 0, p95: 0, max: 0 },
  })

  try {
    const res = await fetch(url)
    if (!res.ok) {
      return { fc: null, report: emptyReport(`HTTP ${res.status} al cargar ${url}`) }
    }
    const fc = (await res.json()) as GeoJSON.FeatureCollection
    const cands = await loadCandidateRefs()
    const report = analyzeGridFeatureCollection(fc, cands)
    return { fc, report }
  } catch (err) {
    return {
      fc: null,
      report: emptyReport(err instanceof Error ? err.message : 'error de red'),
    }
  }
}
