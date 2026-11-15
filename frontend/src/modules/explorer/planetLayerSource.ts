import { GIBS_EQUIRECT_GRID, MODEL_STOPS, gibsEquirectTileUrl } from '../../config/planetLayers'
import { parseColor, sampleColormap } from '../../lib/colormap'
import { MODEL_RANGE, type ModelBody, modelTemperature, subsolarPoint } from '../../lib/thermalModel'

const W = 2048
const H = 1024

/* ---------------- Tierra: mosaico equirectangular de GIBS ---------------- */

export interface EarthLayerMosaic {
  canvas: HTMLCanvasElement
  loaded: number
  failed: number
  total: number
  listeners: Set<() => void>
}

const earthCache = new Map<string, EarthLayerMosaic>()

/** Descarga (una vez por capa y fecha) las 15 teselas del nivel 2 y las compone en un lienzo 2048 × 1024. */
export function getEarthLayerMosaic(gibsId: string, date: string, equirectMatrix = '2km'): EarthLayerMosaic {
  const key = `${gibsId}:${date}:${equirectMatrix}`
  const cached = earthCache.get(key)
  if (cached) return cached

  const { cols, rows, tileDeg } = GIBS_EQUIRECT_GRID
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const mosaic: EarthLayerMosaic = { canvas, loaded: 0, failed: 0, total: cols * rows, listeners: new Set() }
  earthCache.set(key, mosaic)

  const tileW = (tileDeg / 360) * W
  const tileH = (tileDeg / 180) * H
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.decoding = 'async'
      const done = () => {
        mosaic.loaded++
        mosaic.listeners.forEach((fn) => fn())
      }
      img.onload = () => {
        ctx.drawImage(img, col * tileW, row * tileH, tileW + 1, tileH + 1)
        done()
      }
      img.onerror = () => {
        mosaic.failed++
        done()
      }
      img.src = gibsEquirectTileUrl(gibsId, date, row, col, equirectMatrix)
    }
  }
  return mosaic
}

/* ---------------- Luna y Marte: modelo térmico ---------------- */

const MODEL_RGB = MODEL_STOPS.map(parseColor)

/** Pinta el modelo térmico de todo el cuerpo para el instante dado (equirectangular). */
export function renderModelCanvas(body: ModelBody, date: Date, width = 720, height = 360): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(width, height)
  const sun = subsolarPoint(body, date)
  const { min, max } = MODEL_RANGE[body]
  for (let y = 0; y < height; y++) {
    const lat = 90 - ((y + 0.5) / height) * 180
    for (let x = 0; x < width; x++) {
      const lon = ((x + 0.5) / width) * 360 - 180
      const t = (modelTemperature(body, lat, lon, sun) - min) / (max - min)
      const [r, g, b] = sampleColormap(MODEL_RGB, t)
      const o = (y * width + x) * 4
      img.data[o] = r
      img.data[o + 1] = g
      img.data[o + 2] = b
      img.data[o + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}
