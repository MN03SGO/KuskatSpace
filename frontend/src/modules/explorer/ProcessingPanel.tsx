import { exportGeotiffUrl } from '../../api/explorer'
import { StatusBanner } from '../../components/StatusBanner'
import { apiErrorText } from '../../components/apiErrorText'
import { focusRing, focusRingInset, hudCardClass, sliderClass } from '../../components/ui'
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

const MODE_ICONS: Record<ProcessMode, string> = {
  sar_db: 'bolt',
  ndvi: 'eco',
  ndwi: 'water_drop',
  hls_thermal: 'device_thermostat',
  jaxa_precip: 'rainy',
  diviner_thermal: 'thermostat',
}

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
    <section className={`${hudCardClass} space-y-3`} aria-labelledby="processing-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="processing-title" className="text-sm font-semibold text-ink">
          {processDataMode === 'real'
            ? t('explorer.processing.titleReal')
            : t('explorer.processing.titleDemo')}
        </h2>

        <div
          className="flex items-center gap-0.5 rounded-lg border border-line bg-raised p-0.5"
          role="group"
          aria-label={t('explorer.processing.modeGroup')}
        >
          {(['real', 'demo'] as const).map((m) => {
            const active = processDataMode === m
            return (
              <button
                key={m}
                type="button"
                aria-pressed={active}
                onClick={() => setProcessDataMode(m)}
                className={`rounded-md px-2 py-1 font-mono text-[10px] font-semibold transition-all ${focusRingInset} ${
                  active
                    ? 'bg-accent text-white shadow-2xs dark:text-[#002b42]'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {m === 'real' ? t('explorer.processing.modeReal') : t('explorer.processing.modeDemo')}
              </button>
            )
          })}
        </div>
      </div>

      {processDataMode === 'real' && (
        <>
          <div
            className="flex flex-wrap items-center gap-1.5"
            role="group"
            aria-label={t('explorer.processing.catalogGroup')}
          >
            {(
              [
                ['sentinel2', 'explorer.processing.catalogS2'],
                ['hls', 'explorer.processing.catalogHls'],
              ] as const
            ).map(([id, key]) => {
              const active = opticalCatalog === id
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setOpticalCatalog(id as OpticalCatalog)}
                  className={`rounded-md border px-2.5 py-1 font-mono text-[11px] font-medium transition-all ${focusRing} ${
                    active
                      ? 'border-accent bg-accent text-white shadow-xs dark:text-[#002b42]'
                      : 'border-line bg-raised text-ink-muted hover:border-info/50 hover:text-ink'
                  }`}
                >
                  {t(key)}
                </button>
              )
            })}
          </div>
          <p className="font-mono text-[11px] break-all text-ink-muted">
            {selectedResult?.sceneId
              ? t('explorer.processing.selectedScene', { id: selectedResult.sceneId })
              : t('explorer.processing.pickScene')}
          </p>
        </>
      )}

      <div className="grid grid-cols-2 gap-1.5">
        {PROCESS_MODES.filter((m) =>
          processDataMode === 'real' ? !HIDDEN_IN_REAL_MODE.has(m.id) : !REAL_ONLY_PROCESS_MODES.has(m.id),
        ).map((m) => {
          const isDemoOnly = DEMO_PROCESS_MODES.has(m.id)
          const showDemo = isDemoOnly || processDataMode === 'demo'
          const showReal = !isDemoOnly && processDataMode === 'real'
          const active = scene?.request.mode === m.id
          return (
            <button
              key={m.id}
              type="button"
              disabled={loading || !!bboxError}
              aria-pressed={active}
              onClick={() => {
                clearProcessHint()
                void runProcess(m.id)
              }}
              className={`group flex min-h-16 flex-col justify-between rounded-lg border p-2.5 text-left transition-all ${focusRing} ${
                active
                  ? 'border-info bg-info/10 shadow-xs'
                  : 'border-line bg-raised hover:border-info/50 hover:bg-surface'
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <span className="text-xs leading-snug font-medium text-ink group-hover:text-info">
                {loading && process.mode === m.id
                  ? t('explorer.processing.running')
                  : t(`explorer.processing.modes.${m.id}`)}
              </span>
              <div className="mt-2 flex items-center justify-between gap-1">
                {showDemo && (
                  <span className="rounded bg-warn/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-warn">
                    {t('explorer.processing.demoBadge')}
                  </span>
                )}
                {showReal && (
                  <span className="rounded bg-ok/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-ok">
                    {t('explorer.processing.realBadge')}
                  </span>
                )}
                <span
                  className={`material-symbols-outlined text-[16px] transition-transform group-hover:scale-110 ${
                    showReal ? 'text-ok' : 'text-ink-muted group-hover:text-info'
                  }`}
                  aria-hidden="true"
                >
                  {MODE_ICONS[m.id]}
                </span>
              </div>
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

      {/* En pantallas < lg, el resultado se muestra inline dentro del sidebar */}
      {scene && (
        <div className="border-t border-line pt-3 lg:hidden">
          <SceneResult scene={scene} t={t} />
        </div>
      )}
    </section>
  )
}

export function SceneResult({ scene, t }: { scene: ProcessedScene; t: TFunction }) {
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
    <div className="space-y-2.5 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${isDemo ? 'bg-warn' : 'bg-ok'}`} aria-hidden="true" />
            <span className="rounded border border-info/30 bg-info/10 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-info">
              {isDemo ? t('explorer.processing.demoBadge') : response.catalog ?? t('explorer.processing.realBadge')}
            </span>
          </div>
          <p className="mt-1 truncate font-mono text-xs font-bold text-ink" title={scene.label ?? undefined}>
            {scene.label ?? t(`bodies.${body}.region`)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <span className="font-mono text-xs font-bold text-ink-muted">{response.unit}</span>
        </div>
      </div>

      <div>
        <div
          role="img"
          aria-label={`${t('explorer.result.legendLow')} → ${t('explorer.result.legendHigh')} (${response.unit})`}
          className="h-2.5 rounded-full border border-line"
          style={{ background: cssGradient(stops) }}
        />
        <div className="mt-1 flex justify-between font-mono text-[10px] text-ink-muted">
          <span>{range ? `≤ ${num(range[0])}${statsUnit}` : t('explorer.result.legendLow')}</span>
          <span>{range ? `≥ ${num(range[1])}${statsUnit}` : t('explorer.result.legendHigh')}</span>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-1.5 rounded-lg border border-line bg-raised px-2.5 py-1.5 text-center">
        {(['min', 'mean', 'max'] as const).map((k) => (
          <div key={k}>
            <dt className="font-mono text-[10px] uppercase text-ink-muted">{t(`explorer.result.${k}`)}</dt>
            <dd className="font-mono text-xs font-semibold text-ink">
              {num(response.stats[k])}
              {statsUnit}
            </dd>
          </div>
        ))}
      </dl>

      {isDemo ? (
        <StatusBanner tone="warn">{t('explorer.result.demoSample', { file: response.source_file })}</StatusBanner>
      ) : (
        <div className="space-y-1">
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
          <p className="font-mono text-[10px] text-ink-muted">
            {t('explorer.result.provenanceLine', {
              product: response.product ?? response.mission ?? '—',
              date: response.scene_date ?? '—',
              clouds: clouds == null ? '—' : `${formatNumber(lang, clouds, 1)}%`,
              valid: validPct == null ? '—' : `${formatNumber(lang, validPct, 1)}%`,
              catalog: response.catalog ?? '—',
            })}
          </p>
        </div>
      )}

      {response.warning && <StatusBanner tone="warn">{response.warning}</StatusBanner>}

      <div className="flex flex-wrap items-center gap-3 pt-0.5">
        <div className="min-w-[140px] flex-1">
          <label htmlFor="overlay-opacity" className="mb-1 block font-mono text-[10px] text-ink-muted">
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
            className={sliderClass}
          />
        </div>

        {/* /api/export/geotiff solo regenera los rásteres de demostración */}
        {isDemo ? (
          <a
            href={exportGeotiffUrl(scene.request)}
            download
            className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-line bg-raised px-3 py-1.5 font-mono text-[11px] font-semibold text-ink no-underline transition-colors hover:border-info/60 hover:text-info ${focusRing}`}
          >
            <span className="material-symbols-outlined text-[16px] text-info" aria-hidden="true">
              download
            </span>
            <span>{t('explorer.result.download')}</span>
          </a>
        ) : (
          <p className="font-mono text-[10px] text-ink-muted">{t('explorer.result.downloadDemoOnly')}</p>
        )}
      </div>

      {response.cryosphere_comparison && <CryospherePanel data={response.cryosphere_comparison} t={t} lang={lang} />}
    </div>
  )
}

function CryospherePanel({ data, t, lang }: { data: CryosphereComparison; t: TFunction; lang: string }) {
  const delta = data.delta_vs_earth_ice_k
  const num = (v: number) => formatNumber(lang, v, 1)
  const sentence = t(delta < 0 ? 'explorer.cryo.colder' : 'explorer.cryo.warmer', { delta: num(Math.abs(delta)) })
  return (
    <div className="space-y-1 rounded-lg border border-info/30 border-l-4 border-l-info bg-raised p-2.5 text-[11px]">
      <p className="font-semibold text-ink">{t('explorer.cryo.title')}</p>
      <p className="font-mono text-ink-muted">{t('explorer.cryo.lunarMin', { value: num(data.lunar_psr_min_k) })}</p>
      <p className="font-mono text-ink-muted">{t('explorer.cryo.earthAvg', { value: num(data.earth_antarctica_avg_k) })}</p>
      <p className="text-ink-muted">{sentence}</p>
    </div>
  )
}
