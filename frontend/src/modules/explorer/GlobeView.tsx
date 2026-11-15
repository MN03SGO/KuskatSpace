import { useEffect, useRef, useState } from 'react'
import { mapLabel } from '../../components/ui'
import { BODIES } from '../../config/bodies'
import { GLOBE_TEXTURES } from '../../config/globeTextures'
import { useT } from '../../i18n/useT'
import { bboxAroundPoint } from '../../lib/bbox'
import { useExplorerStore } from '../../store/useExplorerStore'
import { GlobeEngine } from './globeEngine'
import { getEarthLayerMosaic, renderModelCanvas } from './planetLayerSource'
import { useActivePlanetLayer } from './usePlanetLayer'

interface Progress {
  loaded: number
  total: number
  failed: number
}

export default function GlobeView() {
  const t = useT()
  const containerRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<GlobeEngine | null>(null)
  const firstBBox = useRef(true)
  const [noWebgl, setNoWebgl] = useState(false)
  const [progress, setProgress] = useState<Progress>({ loaded: 0, total: 1, failed: 0 })
  const [layerProgress, setLayerProgress] = useState<Progress | null>(null)

  const body = useExplorerStore((s) => s.body)
  const bbox = useExplorerStore((s) => s.bbox)
  const scene = useExplorerStore((s) => s.scene)
  const opacity = useExplorerStore((s) => s.opacity)
  const layerOpacity = useExplorerStore((s) => s.planetLayerOpacity)
  const setView = useExplorerStore((s) => s.setView)
  const layer = useActivePlanetLayer()

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
        onProgress: (loaded, total, failed) => setProgress({ loaded, total, failed }),
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

  useEffect(() => {
    engineRef.current?.setPlanetLayerOpacity(layerOpacity)
  }, [layerOpacity])

  // Capa global del planeta: mosaico GIBS (Tierra) o modelo térmico (Luna/Marte).
  const layerKey = layer?.key ?? null
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    if (!layer) {
      engine.setPlanetLayer(null)
      setLayerProgress(null)
      return
    }
    if (layer.kind === 'model') {
      engine.setPlanetLayer(renderModelCanvas(layer.body, layer.time))
      setLayerProgress(null)
      return
    }
    const mosaic = getEarthLayerMosaic(layer.gibsId, layer.date, layer.equirectMatrix)
    const update = () => {
      engine.setPlanetLayer(mosaic.canvas)
      setLayerProgress({ loaded: mosaic.loaded, total: mosaic.total, failed: mosaic.failed })
    }
    mosaic.listeners.add(update)
    update()
    return () => {
      mosaic.listeners.delete(update)
    }
    // layerKey resume el cuerpo, la capa, la fecha y el minuto del modelo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerKey])

  if (noWebgl) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-sm space-y-3 text-center text-sm">
          <p>{t('explorer.globe.noWebgl')}</p>
          <button
            type="button"
            onClick={() => setView('map')}
            className="min-h-10 rounded bg-accent px-4 py-2 font-bold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info"
          >
            {t('explorer.view.map')}
          </button>
        </div>
      </div>
    )
  }

  const loading = progress.loaded < progress.total
  const layerLoading = layerProgress !== null && layerProgress.loaded < layerProgress.total

  return (
    <div className="relative h-full w-full overflow-hidden bg-canvas" role="region" aria-label={t('explorer.globe.label')}>
      <div ref={containerRef} className="absolute inset-0 cursor-grab active:cursor-grabbing" />

      {/* B21: pista completa en escritorio y corta en móvil. */}
      <p className={`absolute top-3 left-3 max-w-[calc(100%-12rem)] ${mapLabel}`}>
        <span className="hidden sm:inline">{t('explorer.globe.hint')}</span>
        <span className="sm:hidden">{t('explorer.globe.hintShort')}</span>
      </p>

      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col items-start gap-1" role="status">
        {loading && <p className={mapLabel}>{t('explorer.globe.loading', { loaded: progress.loaded, total: progress.total })}</p>}
        {!loading && progress.failed > 0 && <p className={mapLabel}>{t('explorer.globe.tileErrors')}</p>}
        {layerLoading && (
          <p className={mapLabel}>
            {t('explorer.layers.loading', { loaded: layerProgress.loaded, total: layerProgress.total })}
          </p>
        )}
        {layerProgress && !layerLoading && layerProgress.failed === layerProgress.total && (
          <p className={mapLabel}>{t('explorer.layers.failed')}</p>
        )}
      </div>

      {/* N5: el aviso de modelo se ve sobre la imagen, también en móvil. */}
      {layer?.kind === 'model' && (
        <p className={`absolute top-16 left-3 border-l-4 border-warn ${mapLabel}`}>{t('explorer.layers.modelBadge')}</p>
      )}

      <p className={`absolute right-2 bottom-2 ${mapLabel}`}>{GLOBE_TEXTURES[body].attribution}</p>
    </div>
  )
}
