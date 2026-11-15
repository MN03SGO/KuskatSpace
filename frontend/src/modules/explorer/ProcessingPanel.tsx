import { exportGeotiffUrl } from '../../api/explorer'
import { StatusBanner } from '../../components/StatusBanner'
import { apiErrorText } from '../../components/apiErrorText'
import { focusRing, secondaryButton } from '../../components/ui'
import { PALETTE_BY_MODE, PALETTE_STOPS, PROCESS_MODES } from '../../config/processModes'
import { type TFunction, useLang, useT } from '../../i18n/useT'
import { cssGradient } from '../../lib/colormap'
import { formatNumber } from '../../lib/format'
import { useExplorerStore } from '../../store/useExplorerStore'
import type { CryosphereComparison, ProcessedScene } from '../../types/explorer'

export function ProcessingPanel() {
  const t = useT()
  const process = useExplorerStore((s) => s.process)
  const scene = useExplorerStore((s) => s.scene)
  const runProcess = useExplorerStore((s) => s.runProcess)
  const bboxError = useExplorerStore((s) => s.bboxError)
  const loading = process.state === 'loading'

  return (
    <section className="space-y-3 rounded-md bg-raised p-3" aria-labelledby="processing-title">
      <h2 id="processing-title" className="text-sm font-bold">
        {t('explorer.processing.title')}
      </h2>
      <div className="grid grid-cols-2 gap-2">
        {PROCESS_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            disabled={loading || !!bboxError}
            aria-pressed={scene?.request.mode === m.id}
            onClick={() => void runProcess(m.id)}
            className={secondaryButton}
          >
            {loading && process.mode === m.id ? t('explorer.processing.running') : t(`explorer.processing.modes.${m.id}`)}
          </button>
        ))}
      </div>

      {process.state === 'error' && process.error && (
        <StatusBanner tone="error">{apiErrorText(t, process.error)}</StatusBanner>
      )}

      {scene && <SceneResult scene={scene} t={t} />}
    </section>
  )
}

function SceneResult({ scene, t }: { scene: ProcessedScene; t: TFunction }) {
  const lang = useLang((s) => s.lang)
  const body = useExplorerStore((s) => s.body)
  const opacity = useExplorerStore((s) => s.opacity)
  const setOpacity = useExplorerStore((s) => s.setOpacity)
  const { response } = scene
  const stops = PALETTE_STOPS[PALETTE_BY_MODE[response.mode]]
  const num = (v: number) => formatNumber(lang, v, 3)

  return (
    <div className="space-y-2 border-t border-line pt-3 text-xs">
      <p className="font-bold break-all text-info">{scene.label ?? t(`bodies.${body}.region`)}</p>
      <p>
        <span className="font-bold">{t('explorer.result.unit')}:</span> {response.unit}
      </p>

      <div>
        {/* B22: la leyenda tiene nombre accesible con su unidad. */}
        <div
          role="img"
          aria-label={`${t('explorer.result.legendLow')} → ${t('explorer.result.legendHigh')} (${response.unit})`}
          className="h-3 rounded-sm"
          style={{ background: cssGradient(stops) }}
        />
        <div className="mt-1 flex justify-between text-ink-muted">
          <span>{t('explorer.result.legendLow')}</span>
          <span>{t('explorer.result.legendHigh')}</span>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-1 text-center">
        {(['min', 'mean', 'max'] as const).map((k) => (
          <div key={k} className="rounded bg-surface p-1">
            <dt className="text-ink-muted">{t(`explorer.result.${k}`)}</dt>
            <dd className="font-mono">{num(response.stats[k])}</dd>
          </div>
        ))}
      </dl>

      {/* B12: el backend usa datos simulados; se dice explícitamente. */}
      <StatusBanner tone="warn">{t('explorer.result.demoSample', { file: response.source_file })}</StatusBanner>

      <div>
        <label htmlFor="overlay-opacity" className="block text-ink-muted">
          {t('explorer.result.opacity', { value: Math.round(opacity * 100) })}
        </label>
        <input
          id="overlay-opacity"
          type="range"
          min={0.2}
          max={1}
          step={0.05}
          value={opacity}
          onChange={(e) => setOpacity(Number(e.target.value))}
          className="h-10 w-full accent-info"
        />
      </div>

      {/* B3: la descarga usa el bbox y el modo con los que se procesó. */}
      <a
        href={exportGeotiffUrl(scene.request)}
        download
        className={`flex min-h-10 items-center justify-center rounded bg-accent px-3 py-2 text-center font-bold text-ink no-underline hover:brightness-110 ${focusRing}`}
      >
        {t('explorer.result.download')}
      </a>

      {response.cryosphere_comparison && <CryospherePanel data={response.cryosphere_comparison} t={t} lang={lang} />}
    </div>
  )
}

/** B16: la conclusión se arma con los números calculados, no con el texto fijo del backend. */
function CryospherePanel({ data, t, lang }: { data: CryosphereComparison; t: TFunction; lang: string }) {
  const delta = data.delta_vs_earth_ice_k
  const num = (v: number) => formatNumber(lang, v, 1)
  const sentence = t(delta < 0 ? 'explorer.cryo.colder' : 'explorer.cryo.warmer', { delta: num(Math.abs(delta)) })
  return (
    <div className="space-y-1 rounded border-l-4 border-info bg-surface p-2">
      <p className="font-bold">{t('explorer.cryo.title')}</p>
      <p>{t('explorer.cryo.lunarMin', { value: num(data.lunar_psr_min_k) })}</p>
      <p>{t('explorer.cryo.earthAvg', { value: num(data.earth_antarctica_avg_k) })}</p>
      <p className="text-ink-muted">{sentence}</p>
    </div>
  )
}
