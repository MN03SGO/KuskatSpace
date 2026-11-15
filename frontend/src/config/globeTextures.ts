import type { BodyId } from '../types/explorer'

/**
 * Mosaicos globales en proyección equirectangular (EPSG:4326 / lunar y marciana
 * geográfica) que se pegan como textura sobre una esfera. Niveles y tamaños
 * verificados en los WMTSCapabilities el 2026-11-14; todos sirven CORS abierto.
 */
export interface TileLevel {
  z: number
  cols: number
  rows: number
  /** Grados que cubre cada tesela (lado). Puede pasarse del borde del mundo (GIBS). */
  tileDeg: number
}

export interface EquirectTileSource {
  /** Textura 2K local (public/textures, generada con pnpm bake:textures): se ve al instante y sirve sin red. */
  baked: string
  full: TileLevel
  url: (z: number, row: number, col: number) => string
  attribution: string
}

const TREK = 'https://trek.nasa.gov/tiles'

// Trek default028mm: nivel z = 2^(z+1) × 2^z teselas de 256 px.
const TREK_FULL: TileLevel = { z: 3, cols: 16, rows: 8, tileDeg: 22.5 }

export const GLOBE_TEXTURES: Record<BodyId, EquirectTileSource> = {
  // GIBS EPSG:4326, TileMatrixSet 500m (teselas de 512 px): nivel 3 = 10 × 5 de 36°.
  earth: {
    baked: '/textures/earth-2k.jpg',
    full: { z: 3, cols: 10, rows: 5, tileDeg: 36 },
    url: (z, r, c) =>
      `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/BlueMarble_ShadedRelief_Bathymetry/default/500m/${z}/${r}/${c}.jpeg`,
    attribution: 'NASA Blue Marble · EOSDIS GIBS',
  },
  moon: {
    baked: '/textures/moon-2k.jpg',
    full: TREK_FULL,
    url: (z, r, c) => `${TREK}/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/${z}/${r}/${c}.jpg`,
    attribution: 'NASA LRO WAC · Moon Trek',
  },
  mars: {
    baked: '/textures/mars-2k.jpg',
    full: TREK_FULL,
    url: (z, r, c) =>
      `${TREK}/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/${z}/${r}/${c}.jpg`,
    attribution: 'NASA Viking MDIM 2.1 · Mars Trek',
  },
}

/** Tamaño de la textura del globo (2:1). 4096 px es compatible con casi todas las GPU. */
export const GLOBE_TEXTURE_WIDTH = 4096
export const GLOBE_TEXTURE_HEIGHT = 2048
