/** Caja geográfica [minLon, minLat, maxLon, maxLat] en grados (EPSG:4326). */
export type BBox = readonly [number, number, number, number]

/** Formato de Leaflet: [[lat, lon] suroeste, [lat, lon] noreste]. */
export type LeafletBounds = [[number, number], [number, number]]

/** Esquinas para una image source de MapLibre: [lon, lat] arriba-izq, arriba-der, abajo-der, abajo-izq. */
export type MaplibreCorners = [[number, number], [number, number], [number, number], [number, number]]

export type BBoxError = 'format' | 'range' | 'order'

export type BBoxParseResult = { ok: true; bbox: BBox } | { ok: false; error: BBoxError }

export function validateBBox(values: readonly number[]): BBoxParseResult {
  if (values.length !== 4 || values.some((v) => !Number.isFinite(v))) {
    return { ok: false, error: 'format' }
  }
  const [minLon, minLat, maxLon, maxLat] = values
  const lonOk = [minLon, maxLon].every((v) => v >= -180 && v <= 180)
  const latOk = [minLat, maxLat].every((v) => v >= -90 && v <= 90)
  if (!lonOk || !latOk) return { ok: false, error: 'range' }
  if (minLon >= maxLon || minLat >= maxLat) return { ok: false, error: 'order' }
  return { ok: true, bbox: [minLon, minLat, maxLon, maxLat] }
}

/** Interpreta "minLon,minLat,maxLon,maxLat" (acepta espacios). */
export function parseBBox(text: string): BBoxParseResult {
  const parts = text.split(',').map((p) => p.trim())
  if (parts.length !== 4 || parts.some((p) => p === '')) return { ok: false, error: 'format' }
  return validateBBox(parts.map(Number))
}

export function formatBBox(bbox: BBox, digits = 2): string {
  return bbox.map((v) => Number(v.toFixed(digits))).join(',')
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/**
 * Caja de ±halfLon × ±halfLat alrededor de un punto, desplazada para que
 * quede siempre dentro de [-180, 180] × [-maxLat, maxLat].
 */
export function bboxAroundPoint(
  lon: number,
  lat: number,
  { halfLon = 1.5, halfLat = 1.0, maxLat = 90 }: { halfLon?: number; halfLat?: number; maxLat?: number } = {},
): BBox {
  const cLon = clamp(lon, -180 + halfLon, 180 - halfLon)
  const cLat = clamp(lat, -maxLat + halfLat, maxLat - halfLat)
  const r = (v: number) => Number(v.toFixed(2))
  return [r(cLon - halfLon), r(cLat - halfLat), r(cLon + halfLon), r(cLat + halfLat)]
}

export function toLeafletBounds(bbox: BBox): LeafletBounds {
  const [minLon, minLat, maxLon, maxLat] = bbox
  return [
    [minLat, minLon],
    [maxLat, maxLon],
  ]
}

/** Convierte los `bounds` que devuelve /api/process (formato Leaflet) a esquinas de MapLibre. */
export function leafletBoundsToMaplibreCorners(bounds: LeafletBounds): MaplibreCorners {
  const [[minLat, minLon], [maxLat, maxLon]] = bounds
  return [
    [minLon, maxLat],
    [maxLon, maxLat],
    [maxLon, minLat],
    [minLon, minLat],
  ]
}

export function sameBBox(a: BBox, b: BBox): boolean {
  return a.every((v, i) => v === b[i])
}
