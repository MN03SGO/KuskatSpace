/**
 * Modelo térmico APROXIMADO de la superficie de la Luna y de Marte para un
 * instante dado. NO es una medición: usa la posición del Sol (punto subsolar)
 * y un equilibrio radiativo simplificado, sin inercia térmica, relieve ni
 * albedo local. Sirve para visualizar el lado día/noche y el gradiente polar.
 */

const D2R = Math.PI / 180

export interface SubsolarPoint {
  /** Latitud subsolar (°). */
  lat: number
  /** Longitud subsolar, este positivo, en [-180, 180) (°). */
  lon: number
}

export type ModelBody = 'moon' | 'mars'

const norm360 = (x: number) => ((x % 360) + 360) % 360
const norm180 = (x: number) => norm360(x + 180) - 180

export function julianDay(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5
}

/**
 * Punto subsolar lunar aproximado (±~8°): la longitud se obtiene de la
 * elongación Luna–Sol (luna nueva → 180°, llena → 0°). Se ignoran las
 * libraciones y la latitud subsolar (|δ| < 1,6°).
 */
export function moonSubsolarPoint(date: Date): SubsolarPoint {
  const T = (julianDay(date) - 2451545.0) / 36525
  const D = 297.8501921 + 445267.1114034 * T // elongación media
  const M = 357.5291092 + 35999.0502909 * T // anomalía media del Sol
  const Mp = 134.9633964 + 477198.8675055 * T // anomalía media de la Luna
  const s = (deg: number) => Math.sin(deg * D2R)
  const elongation = D + 6.289 * s(Mp) + 1.274 * s(2 * D - Mp) + 0.658 * s(2 * D) - 1.915 * s(M)
  return { lat: 0, lon: norm180(180 - elongation) }
}

/**
 * Punto subsolar de Marte según el algoritmo Mars24 (Allison y McEwen, 2000),
 * sin los términos de perturbación (error < 0,1°).
 */
export function marsSubsolarPoint(date: Date): SubsolarPoint & { ls: number } {
  const jdTT = julianDay(date) + 69.184 / 86400
  const dt = jdTT - 2451545.0
  const M = 19.3871 + 0.52402073 * dt
  const alphaFMS = 270.3871 + 0.524038496 * dt
  const s = (k: number) => Math.sin(k * M * D2R)
  const nuMinusM = (10.691 + 3.0e-7 * dt) * s(1) + 0.623 * s(2) + 0.05 * s(3) + 0.005 * s(4) + 0.0005 * s(5)
  const ls = norm360(alphaFMS + nuMinusM)
  const sinLs = Math.sin(ls * D2R)
  const lat = Math.asin(0.42565 * sinLs) / D2R + 0.25 * sinLs
  const eot = 2.861 * Math.sin(2 * ls * D2R) - 0.071 * Math.sin(4 * ls * D2R) + 0.002 * Math.sin(6 * ls * D2R) - nuMinusM
  const msd = (jdTT - 2451549.5) / 1.0274912517 + 44796.0 - 0.0009626
  const mst = (((msd % 1) + 1) % 1) * 24
  const lonWest = norm360(mst * 15 + eot + 180)
  return { lat, lon: norm180(-lonWest), ls }
}

export function subsolarPoint(body: ModelBody, date: Date): SubsolarPoint {
  return body === 'moon' ? moonSubsolarPoint(date) : marsSubsolarPoint(date)
}

/** Coseno del ángulo de incidencia solar en (lat, lon). Negativo = noche. */
export function cosIncidence(lat: number, lon: number, sun: SubsolarPoint): number {
  const la = lat * D2R
  const ls = sun.lat * D2R
  return Math.sin(la) * Math.sin(ls) + Math.cos(la) * Math.cos(ls) * Math.cos((lon - sun.lon) * D2R)
}

/** Rango de la escala de color del modelo (K). */
export const MODEL_RANGE: Record<ModelBody, { min: number; max: number }> = {
  moon: { min: 40, max: 400 },
  mars: { min: 140, max: 300 },
}

/**
 * Temperatura modelada (K).
 * Luna: día ≈ 392·cos(i)^¼ (≈ 390 K en el punto subsolar); noche ≈ 95 K en el
 * ecuador y ≈ 40 K en los polos (orden de magnitud de las mediciones de Diviner).
 * Marte: día ≈ 290·cos(i)^¼; noche ≈ 190 K en el ecuador y 150 K en los polos
 * (escarcha de CO₂).
 */
export function modelTemperature(body: ModelBody, lat: number, lon: number, sun: SubsolarPoint): number {
  const mu = cosIncidence(lat, lon, sun)
  const polar = Math.abs(lat) / 90
  if (body === 'moon') {
    const night = 95 - 55 * polar ** 4
    const day = mu > 0 ? 392 * mu ** 0.25 : 0
    return Math.max(night, day)
  }
  const night = 190 - 40 * polar ** 2
  const day = mu > 0 ? 290 * mu ** 0.25 : 0
  return Math.max(150, night, day)
}
