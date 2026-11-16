import { useId } from 'react'
import { StatusBanner } from '../../components/StatusBanner'
import { apiErrorText } from '../../components/apiErrorText'
import { focusRing, hudCardClass, inputClass, labelClass, primaryButton, selectClass } from '../../components/ui'
import { BODIES } from '../../config/bodies'
import { useT } from '../../i18n/useT'
import { useExplorerStore } from '../../store/useExplorerStore'
import type { BodyId } from '../../types/explorer'

/** Valores de `variable` que el backend filtra por subcadena (connectors.py). */
const VARIABLES_BY_BODY: Record<BodyId, string[]> = {
  earth: ['all', 'maritime', 'sar_historical', 'precipitation', 'land_ocean'],
  moon: ['all', 'lunar'],
  mars: ['all', 'planetary'],
}

export function SearchPanel() {
  const t = useT()
  const ids = useId()
  const s = useExplorerStore()
  const isEarth = s.body === 'earth'
  const datesInvalid = s.startDate > s.endDate
  const loading = s.search.state === 'loading'
  const canSearch = !loading && !s.bboxError && !datesInvalid

  return (
    <section className={`${hudCardClass} space-y-3`} aria-labelledby={`${ids}-title`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px] text-info" aria-hidden="true">
            crop_free
          </span>
          <h2 id={`${ids}-title`} className="text-sm font-semibold text-ink">
            {t('explorer.bboxTitle')}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => s.setBbox(BODIES[s.body].defaultBBox)}
          className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ink-muted transition-colors hover:bg-raised hover:text-info ${focusRing}`}
        >
          {t('explorer.resetBbox')}
        </button>
      </div>

      <p className="text-xs text-ink-muted">{t('explorer.mapHint')}</p>

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <label htmlFor={`${ids}-bbox`} className="font-mono text-[11px] font-medium text-ink-muted">
            {t('explorer.bbox')}
          </label>
          <span className="font-mono text-[10px] font-semibold text-info">WGS84</span>
        </div>
        <div className="relative">
          <input
            id={`${ids}-bbox`}
            value={s.bboxText}
            onChange={(e) => s.setBboxText(e.target.value)}
            aria-invalid={s.bboxError ? true : undefined}
            aria-describedby={s.bboxError ? `${ids}-bbox-err` : undefined}
            spellCheck={false}
            className={`${inputClass} pr-8 font-mono text-xs`}
          />
          <span
            className="material-symbols-outlined pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[16px] text-ink-muted"
            aria-hidden="true"
          >
            pin_drop
          </span>
        </div>
        {s.bboxError && (
          <p id={`${ids}-bbox-err`} className="mt-1 text-xs text-danger">
            {t(`explorer.bboxErrors.${s.bboxError}`)}
          </p>
        )}
      </div>

      {isEarth && (
        <div>
          <label htmlFor={`${ids}-gibs`} className={labelClass}>
            {t('explorer.gibsDate')}
          </label>
          <input
            id={`${ids}-gibs`}
            type="date"
            value={s.gibsDate}
            max={s.endDate}
            onChange={(e) => e.target.value && s.setGibsDate(e.target.value)}
            className={`${inputClass} font-mono text-xs`}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={`${ids}-start`} className={labelClass}>
            {t('explorer.startDate')}
          </label>
          <input
            id={`${ids}-start`}
            type="date"
            value={s.startDate}
            onChange={(e) => e.target.value && s.setStartDate(e.target.value)}
            aria-invalid={datesInvalid ? true : undefined}
            className={`${inputClass} font-mono text-xs`}
          />
        </div>
        <div>
          <label htmlFor={`${ids}-end`} className={labelClass}>
            {t('explorer.endDate')}
          </label>
          <input
            id={`${ids}-end`}
            type="date"
            value={s.endDate}
            onChange={(e) => e.target.value && s.setEndDate(e.target.value)}
            aria-invalid={datesInvalid ? true : undefined}
            className={`${inputClass} font-mono text-xs`}
          />
        </div>
        {datesInvalid && <p className="col-span-2 text-xs text-danger">{t('explorer.dateOrder')}</p>}
      </div>

      <div>
        <label htmlFor={`${ids}-var`} className={labelClass}>
          {t('explorer.variable')}
        </label>
        <div className="relative">
          <select
            id={`${ids}-var`}
            value={s.variable}
            onChange={(e) => s.setVariable(e.target.value)}
            className={`${selectClass} text-xs`}
          >
            {VARIABLES_BY_BODY[s.body].map((v) => (
              <option key={v} value={v}>
                {t(`explorer.variables.${v}`)}
              </option>
            ))}
          </select>
          <span
            className="material-symbols-outlined pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[18px] text-ink-muted"
            aria-hidden="true"
          >
            expand_more
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void s.runSearch()}
        disabled={!canSearch}
        className={`flex w-full items-center justify-center gap-2 ${primaryButton}`}
      >
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
          radar
        </span>
        <span>{loading ? t('explorer.searching') : t('explorer.search')}</span>
      </button>

      {s.search.state === 'error' && s.search.error && (
        <StatusBanner tone="error">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>{apiErrorText(t, s.search.error)}</span>
            <button
              type="button"
              onClick={() => void s.runSearch()}
              disabled={!canSearch}
              className={`shrink-0 rounded border border-danger/40 bg-canvas px-2.5 py-1 text-xs font-semibold text-danger hover:bg-danger/10 ${focusRing} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {t('errors.retry')}
            </button>
          </div>
        </StatusBanner>
      )}
    </section>
  )
}
