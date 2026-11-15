import { useEffect, useRef, useState } from 'react'
import { BODIES } from '../../config/bodies'
import { GLOBE_TEXTURES } from '../../config/globeTextures'
import { useT } from '../../i18n/useT'
import { bboxAroundPoint } from '../../lib/bbox'
import { useExplorerStore } from '../../store/useExplorerStore'
import { GlobeEngine } from './globeEngine'

export default function GlobeView() {
  const t = useT()
  const containerRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<GlobeEngine | null>(null)
  const firstBBox = useRef(true)
  const [noWebgl, setNoWebgl] = useState(false)
  const [progress, setProgress] = useState({ loaded: 0, total: 1 })

  const body = useExplorerStore((s) => s.body)
  const bbox = useExplorerStore((s) => s.bbox)
  const scene = useExplorerStore((s) => s.scene)
  const opacity = useExplorerStore((s) => s.opacity)
  const setView = useExplorerStore((s) => s.setView)

  // Crear y destruir el motor 3D.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let engine: GlobeEngine
    try {
      engine = new GlobeEngine(container, {
        onPick: (lon, lat) => {
          const { body: current, setBbox: set } = useExplorerStore.getState()
          set(bboxAroundPoint(lon, lat, { maxLat: BODIES[current].maxClickLat }))
        },
        onProgress: (loaded, total) => setProgress({ loaded, total }),
      })
    } catch {
      setNoWebgl(true)
      return
    }
    engineRef.current = engine
    return () => {
      engine.dispose()
      engineRef.current = null
      firstBBox.current = true
    }
  }, [])

  useEffect(() => {
    engineRef.current?.setBody(body)
    // Al cambiar de cuerpo la cámara salta directo al bbox; después, vuela.
    firstBBox.current = true
  }, [body])

  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    engine.setBBox(bbox, !firstBBox.current)
    firstBBox.current = false
  }, [bbox, body])

  useEffect(() => {
    engineRef.current?.setOverlay(scene?.response.overlay_png_base64 ?? null, scene?.response.bounds ?? null)
  }, [scene])

  useEffect(() => {
    engineRef.current?.setOverlayOpacity(opacity)
  }, [opacity])

  if (noWebgl) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-sm space-y-3 text-center text-sm">
          <p>{t('explorer.globe.noWebgl')}</p>
          <button
            type="button"
            onClick={() => setView('map')}
            className="rounded bg-accent px-4 py-2 font-bold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info"
          >
            {t('explorer.view.map')}
          </button>
        </div>
      </div>
    )
  }

  const loading = progress.loaded < progress.total

  return (
    <div className="relative h-full w-full overflow-hidden bg-canvas" role="region" aria-label={t('explorer.globe.label')}>
      <div ref={containerRef} className="absolute inset-0 cursor-grab active:cursor-grabbing" />

      <p className="pointer-events-none absolute top-3 left-3 hidden max-w-[calc(100%-12rem)] rounded sm:block bg-surface/80 px-2.5 py-1 text-xs text-ink-muted">
        {t('explorer.globe.hint')}
      </p>

      {loading && (
        <p
          role="status"
          className="pointer-events-none absolute bottom-8 left-3 rounded bg-surface/80 px-2 py-1 text-xs text-info"
        >
          {t('explorer.globe.loading', { loaded: progress.loaded, total: progress.total })}
        </p>
      )}

      <p className="pointer-events-none absolute right-2 bottom-2 rounded bg-surface/70 px-1.5 py-0.5 text-[11px] text-ink-muted">
        {GLOBE_TEXTURES[body].attribution}
      </p>
    </div>
  )
}
