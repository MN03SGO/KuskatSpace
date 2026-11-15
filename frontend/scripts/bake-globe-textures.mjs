#!/usr/bin/env node
/**
 * Genera texturas equirectangulares 2048×1024 de la Tierra, la Luna y Marte en
 * public/textures/ a partir de teselas públicas de NASA (GIBS y Trek).
 * El globo las muestra al instante y encima carga el detalle en vivo; si los
 * servidores fallan durante la demo, la textura local sigue funcionando.
 *
 * Uso (desde frontend/):  pnpm bake:textures
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import jpeg from 'jpeg-js'

const OUT_W = 2048
const OUT_H = 1024
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'textures')
const TREK = 'https://trek.nasa.gov/tiles'

/** Teselas de origen: el mismo esquema que src/config/globeTextures.ts. */
const SOURCES = {
  earth: {
    z: 2,
    cols: 5,
    rows: 3,
    tileDeg: 72,
    url: (z, r, c) =>
      `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/BlueMarble_ShadedRelief_Bathymetry/default/500m/${z}/${r}/${c}.jpeg`,
  },
  moon: {
    z: 2,
    cols: 8,
    rows: 4,
    tileDeg: 45,
    url: (z, r, c) => `${TREK}/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/${z}/${r}/${c}.jpg`,
  },
  mars: {
    z: 2,
    cols: 8,
    rows: 4,
    tileDeg: 45,
    url: (z, r, c) =>
      `${TREK}/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/${z}/${r}/${c}.jpg`,
  },
}

async function fetchTile(url, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'terraanaloga-texture-baker' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return jpeg.decode(Buffer.from(await res.arrayBuffer()), { useTArray: true, formatAsRGBA: true })
    } catch (err) {
      if (i === attempts) throw new Error(`${url}: ${err.message}`)
      await new Promise((r) => setTimeout(r, 500 * i))
    }
  }
}

/** Ejecuta las tareas con un máximo de `limit` a la vez. */
async function pool(tasks, limit) {
  const results = new Array(tasks.length)
  let next = 0
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < tasks.length) {
        const i = next++
        results[i] = await tasks[i]()
      }
    }),
  )
  return results
}

async function bake(name, src) {
  const coords = []
  for (let r = 0; r < src.rows; r++) for (let c = 0; c < src.cols; c++) coords.push([r, c])
  process.stdout.write(`${name}: descargando ${coords.length} teselas... `)
  const decoded = await pool(
    coords.map(([r, c]) => () => fetchTile(src.url(src.z, r, c))),
    6,
  )
  const tiles = new Map(coords.map(([r, c], i) => [`${r}/${c}`, decoded[i]]))
  const size = decoded[0].width

  const out = Buffer.alloc(OUT_W * OUT_H * 4)
  const sample = (lon, lat) => {
    // Posición continua en píxeles del mosaico de origen.
    const gx = ((lon + 180) / src.tileDeg) * size
    const gy = ((90 - lat) / src.tileDeg) * size
    const px = (x, y) => {
      const c = Math.min(src.cols - 1, Math.max(0, Math.floor(x / size)))
      const r = Math.min(src.rows - 1, Math.max(0, Math.floor(y / size)))
      const t = tiles.get(`${r}/${c}`)
      const tx = Math.min(size - 1, Math.max(0, Math.floor(x - c * size)))
      const ty = Math.min(size - 1, Math.max(0, Math.floor(y - r * size)))
      const o = (ty * t.width + tx) * 4
      return [t.data[o], t.data[o + 1], t.data[o + 2]]
    }
    // Interpolación bilineal.
    const x0 = Math.floor(gx - 0.5)
    const y0 = Math.floor(gy - 0.5)
    const fx = gx - 0.5 - x0
    const fy = gy - 0.5 - y0
    const a = px(x0, y0)
    const b = px(x0 + 1, y0)
    const c = px(x0, y0 + 1)
    const d = px(x0 + 1, y0 + 1)
    return a.map((_, k) => (a[k] * (1 - fx) + b[k] * fx) * (1 - fy) + (c[k] * (1 - fx) + d[k] * fx) * fy)
  }

  for (let y = 0; y < OUT_H; y++) {
    const lat = 90 - ((y + 0.5) / OUT_H) * 180
    for (let x = 0; x < OUT_W; x++) {
      const lon = ((x + 0.5) / OUT_W) * 360 - 180
      const [r, g, b] = sample(lon, lat)
      const o = (y * OUT_W + x) * 4
      out[o] = r
      out[o + 1] = g
      out[o + 2] = b
      out[o + 3] = 255
    }
  }

  const file = join(OUT_DIR, `${name}-2k.jpg`)
  const encoded = jpeg.encode({ data: out, width: OUT_W, height: OUT_H }, 82)
  await writeFile(file, encoded.data)
  console.log(`listo (${(encoded.data.length / 1024).toFixed(0)} KB)`)
}

await mkdir(OUT_DIR, { recursive: true })
for (const [name, src] of Object.entries(SOURCES)) {
  await bake(name, src)
}
