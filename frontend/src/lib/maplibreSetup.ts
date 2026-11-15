import { setWorkerUrl } from 'maplibre-gl'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'

/** Una sola vez por app: URL del worker compatible con Vite. */
let configured = false

export function ensureMaplibreWorker(): void {
  if (configured) return
  setWorkerUrl(maplibreWorkerUrl)
  configured = true
}
