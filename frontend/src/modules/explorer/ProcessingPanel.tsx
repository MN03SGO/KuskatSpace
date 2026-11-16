import { exportGeotiffUrl } from '../../api/explorer'
import { StatusBanner } from '../../components/StatusBanner'
import { apiErrorText } from '../../components/apiErrorText'
import { focusRing, secondaryButton } from '../../components/ui'
import {
  DEMO_PROCESS_MODES,
  HIDDEN_IN_REAL_MODE,
  PALETTE_BY_MODE,
  PALETTE_STOPS,
  PROCESS_MODES,
  REAL_ONLY_PROCESS_MODES,
} from '../../config/processModes'
import { type TFunction, useLang, useT } from '../../i18n/useT'
import { cssGradient } from '../../lib/colormap'
import { formatNumber } from '../../lib/format'
import { useExplorerStore } from '../../store/useExplorerStore'
import type { CryosphereComparison, OpticalCatalog, ProcessMode, ProcessedScene } from '../../types/explorer'

export function ProcessingPanel() {
  const t = useT()
  const process = useExplorerStore((s) => s.process)
  const scene = useExplorerStore((s) => s.scene)
  const runProcess = useExplorerStore((s) => s.runProcess)
  const bboxError = useExplorerStore((s) => s.bboxError)
  const processDataMode = useExplorerStore((s) => s.processDataMode)
  const setProcessDataMode = useExplorerStore((s) => s.setProcessDataMode)
  const opticalCatalog = useExplorerStore((s) => s.opticalCatalog)
  const setOpticalCatalog = useExplorerStore((s) => s.setOpticalCatalog)
  const selectedResult = useExplorerStore((s) => s.selectedResult)
  const processHint = useExplorerStore((s) => s.processHint)
  const clearProcessHint = useExplorerStore((s) => s.clearProcessHint)
  const loading = process.state === 'loading'

  return (
    <section className="space-y-3 rounded-md bg-raised p-3" aria-labelledby="processing-title">
      <h2 id="processing-title" className="text-sm font-bold">
        {processDataMode === 'real'
          ? t('explorer.processing.titleReal')
          : t('explorer.processing.titleDemo')}
      </h2>

      <div className="flex flex-wrap gap-2" role="group" aria-label={t('explorer.processing.modeGroup')}>
        {(['real', 'demo'] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={processDataMode === m}
            onClick={() => setProcessDataMode(m)}
            className={`${secondaryButton} ${processDataMode === m ? 'ring-2 ring-info' : ''}`}
          >
            {m === 'real' ? t('explorer.processing.modeReal') : t('explorer.processing.modeDemo')}
          </button>
        ))}
      </div>

      {processDataMode === 'real' && (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('explorer.processing.catalogGroup')}>
            {(
              [
                ['sentinel2', 'explorer.processing.catalogS2'],
                ['hls', 'explorer.processing.catalogHls'],
              ] as const
            ).map(([id, key]) => (
              <button
                key={id}
                type="button"
                aria-pressed={opticalCatalog === id}
                onClick={() => setOpticalCatalog(id as OpticalCatalog)}
                className={`${secondaryButton} ${opticalCatalog === id ? 'ring-2 ring-ok' : ''}`}
              >
                {t(key)}
              </button>
            ))}
          </div>
          <p className="text-xs text-ink-muted">
            {selectedResult?.sceneId
              ? t('explorer.processing.selectedScene', { id: selectedResult.sceneId })
              : t('explorer.processing.pickScene')}
          </p>
        </>
      )}

      <div className="grid grid-cols-2 gap-2">
        {PROCESS_MODES.filter((m) =>
          processDataMode === 'real' ? !HIDDEN_IN_REAL_MODE.has(m.id) : !REAL_ONLY_PROCESS_MODES.has(m.id),
        ).map((m) => {
          const isDemoOnly = DEMO_PROCESS_MODES.has(m.id)
          const showDemo = isDemoOnly || processDataMode === 'demo'
          const showReal = !isDemoOnly && processDataMode === 'real'
          return (
            <button
              key={m.id}
              type="button"
              disabled={loading || !!bboxError}
              aria-pressed={scene?.request.mode === m.id}
              onClick={() => {
                clearProcessHint()
                void runProcess(m.id)
              }}
              className={`${secondaryButton} relative`}
            >
              <span className="block">
                {loading && process.mode === m.id
                  ? t('explorer.processing.running')
                  : t(`explorer.processing.modes.${m.id}`)}
              </span>
              {showDemo && (
                <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                  {t('explorer.processing.demoBadge')}
                </span>
              )}
              {showReal && (
                <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wide text-ok">
                  {t('explorer.processing.realBadge')}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {processHint === 'needScene' && (
        <StatusBanner tone="warn">{t('explorer.processing.needScene')}</StatusBanner>
      )}
      {processHint === 'needL30Scene' && (
        <StatusBanner tone="warn">{t('explorer.processing.needL30Scene')}</StatusBanner>
      )}

      {process.state === 'error' && process.error && (
        <StatusBanner tone="error">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>{apiErrorText(t, process.error)}</span>
            {process.mode && (
              <button
                type="button"
                onClick={() => void runProcess(process.mode as ProcessMode)}
                disabled={loading || !!bboxError}
                className={`shrink-0 rounded border border-danger/40 bg-canvas px-2.5 py-1 text-xs font-semibold text-danger hover:bg-danger/10 ${focusRing} disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {t('errors.retry')}
              </button>
            )}
          </div>
        </StatusBanner>
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
  const statsUnit = response.stats_unit ? ` ${response.stats_unit}` : ''
  const num = (v: number) => formatNumber(lang, v, response.stats_unit ? 2 : 3)
  const range = response.color_range
  const isDemo = response.demo === true || response.source_mode === 'demo'
  const clouds = response.cloud_cover_scene ?? response.cloud_cover
  const validPct = response.valid_pixel_pct

  return (
    <div className="space-y-2 border-t border-line pt-3 text-xs">
      <p className="font-bold break-all text-info">{scene.label ?? t(`bodies.${body}.region`)}</p>
      <p>
        <span className="font-bold">{t('explorer.result.unit')}:</span> {response.unit}
      </p>

      <div>
        <div
          role="img"
          aria-label={`${t('explorer.result.legendLow')} → ${t('explorer.result.legendHigh')} (${response.unit})`}
          className="h-3 rounded-sm"
          style={{ background: cssGradient(stops) }}
        />
        <div className="mt-1 flex justify-between text-ink-muted">
          <span>{range ? `≤ ${num(range[0])}${statsUnit}` : t('explorer.result.legendLow')}</span>
          <span>{range ? `≥ ${num(range[1])}${statsUnit}` : t('explorer.result.legendHigh')}</span>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-1 text-center">
        {(['min', 'mean', 'max'] as const).map((k) => (
          <div key={k} className="rounded bg-surface p-1">
            <dt className="text-ink-muted">{t(`explorer.result.${k}`)}</dt>
            <dd className="font-mono">
              {num(response.stats[k])}
              {statsUnit}
            </dd>
          </div>
        ))}
      </dl>

      {isDemo ? (
        <StatusBanner tone="warn">{t('explorer.result.demoSample', { file: response.source_file })}</StatusBanner>
      ) : (
        <>
          <StatusBanner tone="ok">
            {response.provenance ??
              t('explorer.result.realMeta', {
                mission: response.mission ?? '—',
                date: response.scene_date ?? '—',
                clouds: clouds == null ? '—' : `${formatNumber(lang, clouds, 1)}%`,
                min: `${num(response.stats.min)}${statsUnit}`,
                mean: `${num(response.stats.mean)}${statsUnit}`,
                max: `${num(response.stats.max)}${statsUnit}`,
              })}
          </StatusBanner>
          <p className="text-ink-muted">
            {t('explorer.result.provenanceLine', {
              product: response.product ?? response.mission ?? '—',
              date: response.scene_date ?? '—',
              clouds: clouds == null ? '—' : `${formatNumber(lang, clouds, 1)}%`,
              valid: validPct == null ? '—' : `${formatNumber(lang, validPct, 1)}%`,
              catalog: response.catalog ?? '—',
            })}
          </p>
        </>
      )}

      {response.warning && <StatusBanner tone="warn">{response.warning}</StatusBanner>}

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

      {/* /api/export/geotiff solo regenera los rásteres de demostración: no ofrecerlo para
          resultados reales, o se descargaría un archivo simulado con apariencia de real. */}
      {isDemo ? (
        <a
          href={exportGeotiffUrl(scene.request)}
          download
          className={`flex min-h-10 items-center justify-center rounded bg-accent px-3 py-2 text-center font-bold text-ink no-underline hover:brightness-110 ${focusRing}`}
        >
          {t('explorer.result.download')}
        </a>
      ) : (
        <p className="text-ink-muted">{t('explorer.result.downloadDemoOnly')}</p>
      )}

      {response.cryosphere_comparison && <CryospherePanel data={response.cryosphere_comparison} t={t} lang={lang} />}
    </div>
  )
}

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
