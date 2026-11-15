import type { BBox } from './bbox'

const D2R = Math.PI / 180

/**
 * Posición sobre la esfera para un lon/lat, siguiendo el mapeo UV de
 * THREE.SphereGeometry (u = (lon + 180) / 360). Lon 0 queda en +X y lon -90 en +Z.
 */
export function lonLatToXYZ(lon: number, lat: number, radius = 1): [number, number, number] {
  const phi = (lon + 180) * D2R
  const la = lat * D2R
  return [-Math.cos(phi) * Math.cos(la) * radius, Math.sin(la) * radius, Math.sin(phi) * Math.cos(la) * radius]
}

/** Inversa de lonLatToXYZ (para saber dónde se hizo clic en el globo). */
export function xyzToLonLat(x: number, y: number, z: number): { lon: number; lat: number } {
  const r = Math.hypot(x, y, z)
  const lat = Math.asin(Math.max(-1, Math.min(1, y / r))) / D2R
  let phi = Math.atan2(z, -x)
  if (phi < 0) phi += 2 * Math.PI
  let lon = phi / D2R - 180
  if (lon > 180) lon -= 360
  return { lon, lat }
}

export function bboxCenter(bbox: BBox): { lon: number; lat: number } {
  const [minLon, minLat, maxLon, maxLat] = bbox
  return { lon: (minLon + maxLon) / 2, lat: (minLat + maxLat) / 2 }
}

/** Píxel de una textura equirectangular de width × height para un lon/lat. */
export function lonLatToPixel(lon: number, lat: number, width: number, height: number): [number, number] {
  return [((lon + 180) / 360) * width, ((90 - lat) / 180) * height]
}
