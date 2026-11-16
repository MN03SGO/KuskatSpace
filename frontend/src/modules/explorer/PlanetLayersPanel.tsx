import { StatusBanner } from '../../components/StatusBanner'
import { focusRingInset, hudCardClass, sliderClass } from '../../components/ui'
import { EARTH_LAYERS, PLANET_LAYER_ORDER, type PlanetLayerId, isLayerAvailable } from '../../config/planetLayers'
import { useLang, useT } from '../../i18n/useT'
import { cssGradient } from '../../lib/colormap'
import { formatNumber } from '../../lib/format'
import { useExplorerStore } from '../../store/useExplorerStore'
import { type ActivePlanetLayer, useActivePlanetLayer } from './usePlanetLayer'

const LAYER_ICONS: Record<PlanetLayerId, { icon: string; accent: string }> = {
  temperature: { icon: 'thermostat', accent: 'text-info' },
  humidity: { icon: 'water_drop', accent: 'text-accent' },
  precipitation: { icon: 'rainy', accent: 'text-ok' },
}

/** Capas globales: temperatura, humedad y precipitación sobre todo el planeta visible. */
export function PlanetLayersPanel() {
  const t = useT()
  const body = useExplorerStore((s) => s.body)
  const selected = useExplorerStore((s) => s.planetLayer)
  const toggle = useExplorerStore((s) => s.togglePlanetLayer)
  const active = useActivePlanetLayer()

  return (
    <section className={`${hudCardClass} space-y-2.5`} aria-labelledby="layers-title">
      <div>
        <h2 id="layers-title" className="text-sm font-semibold text-ink">
          {t('explorer.layers.title')}
        </h2>
        <p className="mt-0.5 text-xs text-ink-muted">{t('explorer.layers.hint')}</p>
      </div>

      <div role="group" aria-labelledby="layers-title" className="grid grid-cols-3 gap-1.5">
        {PLANET_LAYER_ORDER.map((id) => {
          const available = isLayerAvailable(body, id)
          const isSelected = selected === id
          const meta = LAYER_ICONS[id]
          return (
            <button
              key={id}
              type="button"
              aria-pressed={isSelected}
              disabled={!available}
              onClick={() => toggle(id)}
              title={available ? undefined : t(`explorer.layers.unavailable.${body}`)}
              className={`group flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 text-center transition-all ${focusRingInset} ${
                isSelected
                  ? 'border-accent bg-accent text-white shadow-xs dark:text-[#002b42]'
                  : 'border-line bg-raised text-ink hover:border-info/50 hover:bg-surface'
              } disabled:cursor-not-allowed disabled:opacity-45`}
            >
              <span
                className={`material-symbols-outlined text-[18px] transition-transform group-hover:scale-110 ${
                  isSelected ? 'text-current' : meta.accent
                }`}
                aria-hidden="true"
              >
                {meta.icon}
              </span>
              <span className="font-mono text-[10px] leading-tight font-medium">
                {t(id === 'temperature' && body !== 'earth' ? 'explorer.layers.temperatureModel' : `explorer.layers.${id}`)}
              </span>
            </button>
          )
        })}
      </div>

      {body !== 'earth' && (
        <div className="flex items-start gap-2 rounded-lg border border-info/25 bg-info/10 p-2.5 text-xs text-ink-muted">
          <span className="material-symbols-outlined mt-0.5 shrink-0 text-[16px] text-info" aria-hidden="true">
            info
          </span>
          <p className="leading-relaxed">{t(`explorer.layers.unavailable.${body}`)}</p>
        </div>
      )}

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
    <div className="space-y-2 border-t border-line pt-2.5 text-xs">
      <div>
        <div
          role="img"
          aria-label={t(legend.log ? 'explorer.layers.legendLabelLog' : 'explorer.layers.legendLabel', {
            name,
            min: minLabel,
            max: num(legend.max),
            unit: legend.unit,
          })}
          className="h-2.5 rounded-full border border-line"
          style={{ background: cssGradient(legend.stops) }}
        />
        <div className="mt-1 flex justify-between font-mono text-[10px] text-ink-muted">
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
        <div className="space-y-1 text-[11px] text-ink-muted">
          <p className="text-ink">
            {t('explorer.layers.sourceEarth', {
              source: t(`explorer.layers.sources.${layer.id}`),
              date: layer.date,
            })}
          </p>
          {layer.date !== layer.requestedDate && (
            <p>{t('explorer.layers.dateAdjusted', { requested: layer.requestedDate })}</p>
          )}
          {EARTH_LAYERS[layer.id].hasSwathGaps && <p>{t('explorer.layers.gapsNote')}</p>}
          {layer.id === 'temperature' && <p>{t('explorer.layers.kelvinHint')}</p>}
        </div>
      ) : (
        <div className="space-y-1.5 text-[11px]">
          <StatusBanner tone="warn" live={false}>
            {t('explorer.layers.sourceModel', {
              time: layer.time.toISOString().slice(11, 16),
              date: layer.time.toISOString().slice(0, 10),
            })}
          </StatusBanner>
          <p className="font-mono text-[10px] text-ink-muted">
            {t('explorer.layers.subsolar', { lat: num(layer.subsolar.lat), lon: num(layer.subsolar.lon) })}
          </p>
          <p className="text-ink-muted">{t(`explorer.layers.modelNote.${layer.body}`)}</p>
        </div>
      )}

      <div>
        <label htmlFor="planet-layer-opacity" className="mb-1 block font-mono text-[11px] text-ink-muted">
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
          className={sliderClass}
        />
      </div>
    </div>
  )
}
