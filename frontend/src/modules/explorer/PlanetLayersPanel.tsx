import { StatusBanner } from '../../components/StatusBanner'
import { segmentClass } from '../../components/ui'
import { EARTH_LAYERS, PLANET_LAYER_ORDER, isLayerAvailable } from '../../config/planetLayers'
import { useLang, useT } from '../../i18n/useT'
import { cssGradient } from '../../lib/colormap'
import { formatNumber } from '../../lib/format'
import { useExplorerStore } from '../../store/useExplorerStore'
import { type ActivePlanetLayer, useActivePlanetLayer } from './usePlanetLayer'

/** Capas globales: temperatura, humedad y precipitación sobre todo el planeta visible. */
export function PlanetLayersPanel() {
  const t = useT()
  const body = useExplorerStore((s) => s.body)
  const selected = useExplorerStore((s) => s.planetLayer)
  const toggle = useExplorerStore((s) => s.togglePlanetLayer)
  const active = useActivePlanetLayer()

  return (
    <section className="space-y-3 rounded-md bg-raised p-3" aria-labelledby="layers-title">
      <div>
        <h2 id="layers-title" className="text-sm font-bold">
          {t('explorer.layers.title')}
        </h2>
        <p className="mt-1 text-xs text-ink-muted">{t('explorer.layers.hint')}</p>
      </div>

      <div role="group" aria-labelledby="layers-title" className="grid grid-cols-3 overflow-hidden rounded-md border border-line">
        {PLANET_LAYER_ORDER.map((id) => {
          const available = isLayerAvailable(body, id)
          return (
            <button
              key={id}
              type="button"
              aria-pressed={selected === id}
              disabled={!available}
              onClick={() => toggle(id)}
              title={available ? undefined : t(`explorer.layers.unavailable.${body}`)}
              className={segmentClass(selected === id)}
            >
              {t(`explorer.layers.${id}`)}
            </button>
          )
        })}
      </div>

      {body !== 'earth' && <p className="text-xs text-ink-muted">{t(`explorer.layers.unavailable.${body}`)}</p>}

      {active && <LayerLegend layer={active} />}
    </section>
  )
}

function LayerLegend({ layer }: { layer: ActivePlanetLayer }) {
  const t = useT()
  const lang = useLang((s) => s.lang)
  const opacity = useExplorerStore((s) => s.planetLayerOpacity)
  const setOpacity = useExplorerStore((s) => s.setPlanetLayerOpacity)
  const { legend } = layer
  const num = (v: number) => formatNumber(lang, v, 1)
  const name = t(`explorer.layers.names.${layer.id}`)
  const minLabel = num(legend.min)
  const maxLabel = `${legend.log ? '≥ ' : ''}${num(legend.max)}`

  return (
    <div className="space-y-2 border-t border-line pt-3 text-xs">
      <div>
        <div
          role="img"
          aria-label={t('explorer.layers.legendLabel', { name, min: minLabel, max: maxLabel, unit: legend.unit })}
          className="h-3 rounded-sm"
          style={{ background: cssGradient(legend.stops) }}
        />
        <div className="mt-1 flex justify-between text-ink-muted">
          <span>
            {minLabel} {legend.unit}
          </span>
          {legend.log && <span>{t('explorer.layers.logScale')}</span>}
          <span>
            {maxLabel} {legend.unit}
          </span>
        </div>
      </div>

      {layer.kind === 'gibs' ? (
        <>
          <p>
            {t('explorer.layers.sourceEarth', {
              source: t(`explorer.layers.sources.${layer.id}`),
              date: layer.date,
            })}
          </p>
          {EARTH_LAYERS[layer.id].hasSwathGaps && <p className="text-ink-muted">{t('explorer.layers.gapsNote')}</p>}
        </>
      ) : (
        <>
          <StatusBanner tone="warn">
            {t('explorer.layers.sourceModel', {
              time: layer.time.toISOString().slice(11, 16),
              date: layer.time.toISOString().slice(0, 10),
            })}
          </StatusBanner>
          <p className="text-ink-muted">
            {t('explorer.layers.subsolar', { lat: num(layer.subsolar.lat), lon: num(layer.subsolar.lon) })}
          </p>
          <p className="text-ink-muted">{t(`explorer.layers.modelNote.${layer.body}`)}</p>
        </>
      )}

      <div>
        <label htmlFor="planet-layer-opacity" className="block text-ink-muted">
          {t('explorer.layers.opacity', { value: Math.round(opacity * 100) })}
        </label>
        <input
          id="planet-layer-opacity"
          type="range"
          min={0.2}
          max={1}
          step={0.05}
          value={opacity}
          onChange={(e) => setOpacity(Number(e.target.value))}
          className="h-10 w-full accent-info"
        />
      </div>
    </div>
  )
}
