import { exportGeotiffUrl } from '../../api/explorer'
import { StatusBanner } from '../../components/StatusBanner'
import { apiErrorText } from '../../components/apiErrorText'
import { PALETTE_BY_MODE, PALETTE_STOPS, PROCESS_MODES } from '../../config/processModes'
import { type TFunction, useT } from '../../i18n/useT'
import { useExplorerStore } from '../../store/useExplorerStore'
import type { CryosphereComparison, ProcessedScene } from '../../types/explorer'

const buttonClass =
  'rounded bg-surface px-2 py-2 text-xs font-medium text-ink ring-1 ring-line hover:bg-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info disabled:cursor-not-allowed disabled:opacity-60 aria-pressed:ring-2 aria-pressed:ring-info'

export function ProcessingPanel() {
  const t = useT()
  const process = useExplorerStore((s) => s.process)
  const scene = useExplorerStore((s) => s.scene)
  const runProcess = useExplorerStore((s) => s.runProcess)
  const bboxError = useExplorerStore((s) => s.bboxError)
  const loading = process.state === 'loading'

  return (
    <section className="space-y-3 rounded-md bg-raised p-3">
      <h2 className="text-sm font-semibold">{t('explorer.processing.title')}</h2>
      <div className="grid grid-cols-2 gap-1.5">
        {PROCESS_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            disabled={loading || !!bboxError}
            aria-pressed={scene?.request.mode === m.id}
            onClick={() => void runProcess(m.id)}
            className={buttonClass}
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
  const body = useExplorerStore((s) => s.body)
  const opacity = useExplorerStore((s) => s.opacity)
  const setOpacity = useExplorerStore((s) => s.setOpacity)
  const { response } = scene
  const stops = PALETTE_STOPS[PALETTE_BY_MODE[response.mode]]

  return (
    <div className="space-y-2 border-t border-line pt-3 text-xs">
      <p className="font-bold break-all text-info">{scene.label ?? t(`bodies.${body}.region`)}</p>
      <p>
        <span className="font-semibold">{t('explorer.result.unit')}:</span> {response.unit}
      </p>

      <div>
        <div
          className="h-2.5 rounded-sm"
          style={{ background: `linear-gradient(to right, ${stops.join(', ')})` }}
          aria-hidden="true"
        />
        <div className="mt-0.5 flex justify-between text-ink-muted">
          <span>{t('explorer.result.legendLow')}</span>
          <span>{t('explorer.result.legendHigh')}</span>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-1 text-center">
        {(['min', 'mean', 'max'] as const).map((k) => (
          <div key={k} className="rounded bg-surface px-1 py-1">
            <dt className="text-ink-muted">{t(`explorer.result.${k}`)}</dt>
            <dd className="font-mono">{response.stats[k]}</dd>
          </div>
        ))}
      </dl>

      {/* B12: el backend siempre usa muestras de ejemplo; se dice explícitamente. */}
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
          className="w-full accent-info"
        />
      </div>

      {/* B3: la descarga usa el bbox y el modo con los que se procesó, no el bbox actual. */}
      <a
        href={exportGeotiffUrl(scene.request)}
        download
        className="block rounded bg-accent px-3 py-2 text-center font-bold text-ink no-underline hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info"
      >
        {t('explorer.result.download')}
      </a>

      {response.cryosphere_comparison && <CryospherePanel data={response.cryosphere_comparison} t={t} />}
    </div>
  )
}

/** B16: la conclusión se arma con los números calculados, no con el texto fijo del backend. */
function CryospherePanel({ data, t }: { data: CryosphereComparison; t: TFunction }) {
  const delta = data.delta_vs_earth_ice_k
  const sentence = t(delta < 0 ? 'explorer.cryo.colder' : 'explorer.cryo.warmer', {
    delta: Math.abs(delta).toFixed(1),
  })
  return (
    <div className="space-y-1 rounded border-l-4 border-info bg-surface p-2">
      <p className="font-semibold">{t('explorer.cryo.title')}</p>
      <p>{t('explorer.cryo.lunarMin', { value: data.lunar_psr_min_k })}</p>
      <p>{t('explorer.cryo.earthAvg', { value: data.earth_antarctica_avg_k })}</p>
      <p className="text-ink-muted">{sentence}</p>
    </div>
  )
}
