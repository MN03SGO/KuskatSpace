import { useId } from 'react'
import { StatusBanner } from '../../components/StatusBanner'
import { apiErrorText } from '../../components/apiErrorText'
import { useT } from '../../i18n/useT'
import { useExplorerStore } from '../../store/useExplorerStore'
import type { BodyId } from '../../types/explorer'

/** Valores de `variable` que el backend filtra por subcadena (connectors.py). */
const VARIABLES_BY_BODY: Record<BodyId, string[]> = {
  earth: ['all', 'maritime', 'sar_historical', 'precipitation', 'land_ocean'],
  moon: ['all', 'lunar'],
  mars: ['all', 'planetary'],
}

const inputClass =
  'w-full rounded border border-line bg-surface px-2 py-1.5 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-info aria-invalid:border-danger'
const labelClass = 'mb-1 block text-xs text-ink-muted'

export function SearchPanel() {
  const t = useT()
  const ids = useId()
  const s = useExplorerStore()
  const isEarth = s.body === 'earth'
  const datesInvalid = s.startDate > s.endDate
  const loading = s.search.state === 'loading'
  const canSearch = !loading && !s.bboxError && !datesInvalid

  return (
    <section className="space-y-3 rounded-md bg-raised p-3">
      <p className="text-xs text-info">{t('explorer.mapHint')}</p>

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
            className={inputClass}
          />
        </div>
      )}

      <div>
        <label htmlFor={`${ids}-bbox`} className={labelClass}>
          {t('explorer.bbox')}
        </label>
        <input
          id={`${ids}-bbox`}
          value={s.bboxText}
          onChange={(e) => s.setBboxText(e.target.value)}
          aria-invalid={s.bboxError ? true : undefined}
          aria-describedby={s.bboxError ? `${ids}-bbox-err` : undefined}
          spellCheck={false}
          className={`${inputClass} font-mono`}
        />
        {s.bboxError && (
          <p id={`${ids}-bbox-err`} className="mt-1 text-xs text-danger">
            {t(`explorer.bboxErrors.${s.bboxError}`)}
          </p>
        )}
      </div>

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
            className={inputClass}
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
            className={inputClass}
          />
        </div>
        {datesInvalid && <p className="col-span-2 text-xs text-danger">{t('explorer.dateOrder')}</p>}
      </div>

      <div>
        <label htmlFor={`${ids}-var`} className={labelClass}>
          {t('explorer.variable')}
        </label>
        <select
          id={`${ids}-var`}
          value={s.variable}
          onChange={(e) => s.setVariable(e.target.value)}
          className={inputClass}
        >
          {VARIABLES_BY_BODY[s.body].map((v) => (
            <option key={v} value={v}>
              {t(`explorer.variables.${v}`)}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={() => void s.runSearch()}
        disabled={!canSearch}
        className="w-full rounded bg-ok px-3 py-2 text-sm font-bold text-canvas hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? t('explorer.searching') : t('explorer.search')}
      </button>

      {s.search.state === 'error' && s.search.error && (
        <StatusBanner tone="error">{apiErrorText(t, s.search.error)}</StatusBanner>
      )}
    </section>
  )
}
