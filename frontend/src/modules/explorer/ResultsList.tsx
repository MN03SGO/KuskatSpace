import type { ReactNode } from 'react'
import { focusRing } from '../../components/ui'
import { type TFunction, useT } from '../../i18n/useT'
import { useExplorerStore } from '../../store/useExplorerStore'
import type { SelectableResult } from '../../types/explorer'

interface Row {
  key: string
  title: string
  meta: ReactNode
  result: SelectableResult
}

function Group({
  title,
  rows,
  accent,
  showEmpty,
  t,
}: {
  title: string
  rows: Row[]
  accent: string
  showEmpty: boolean
  t: TFunction
}) {
  const selectResult = useExplorerStore((s) => s.selectResult)
  const busy = useExplorerStore((s) => s.process.state === 'loading')
  if (rows.length === 0 && !showEmpty) return null

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-bold">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-ink-muted">{t('explorer.results.empty')}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.key}>
              <button
                type="button"
                disabled={busy}
                onClick={() => void selectResult(row.result)}
                className={`min-h-10 w-full rounded border-l-4 bg-raised px-2 py-2 text-left text-xs hover:bg-line ${focusRing} disabled:opacity-60 ${accent}`}
              >
                <span className="block font-bold break-all">{row.title}</span>
                <span className="block text-ink-muted">{row.meta}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function ResultsList() {
  const t = useT()
  const results = useExplorerStore((s) => s.results)
  const body = useExplorerStore((s) => s.body)
  const searchState = useExplorerStore((s) => s.search.state)
  if (!results || searchState !== 'success') return null

  const na = t('explorer.results.notAvailable')
  const isEarth = body === 'earth'

  const copernicus: Row[] = results.live_copernicus.map((i) => ({
    key: i.id,
    title: i.id,
    meta: `${i.collection} · ${t('explorer.results.clouds', { value: i.cloud_cover == null ? na : `${i.cloud_cover}%` })}`,
    result: { bbox: i.bbox, mode: i.recommended_mode, label: i.id },
  }))
  const earthdata: Row[] = results.live_earthdata.map((i) => ({
    key: i.id,
    title: i.title,
    meta: t('explorer.results.date', { value: i.date || na }),
    result: { bbox: i.bbox, mode: i.recommended_mode, label: i.title },
  }))
  const pds: Row[] = results.live_pds_planetary.map((i, idx) => ({
    key: `${i.id}-${idx}`,
    title: i.id,
    // B19: el backend asigna un bbox fijo a los productos PDS.
    meta: `${t('explorer.results.instrument', { value: i.instrument })} · ${t('explorer.results.approxLocation')}`,
    result: { bbox: i.bbox, mode: i.recommended_mode, label: i.id },
  }))
  const partners: Row[] = results.partner_resources.map((r) => ({
    key: r.id,
    title: `[${r.agency}] ${r.mission}`,
    meta: (
      <>
        {r.instruments}
        <br />
        {r.description}
      </>
    ),
    result: { bbox: r.bbox, mode: r.recommended_mode, label: r.mission },
  }))

  return (
    <section className="space-y-3">
      <p className="text-xs text-ink-muted">{t('explorer.results.hint')}</p>
      {/* B10: una lista vacía puede ser "sin resultados" o "fuente caída"; el backend aún no lo distingue. */}
      {isEarth && (
        <>
          <Group
            title={t('explorer.results.copernicus', { count: copernicus.length })}
            rows={copernicus}
            accent="border-ok"
            showEmpty
            t={t}
          />
          <Group
            title={t('explorer.results.earthdata', { count: earthdata.length })}
            rows={earthdata}
            accent="border-accent"
            showEmpty
            t={t}
          />
        </>
      )}
      {!isEarth && (
        <Group title={t('explorer.results.pds', { count: pds.length })} rows={pds} accent="border-warn" showEmpty t={t} />
      )}
      <Group
        title={t('explorer.results.partners', { count: partners.length })}
        rows={partners}
        accent="border-line"
        showEmpty
        t={t}
      />
    </section>
  )
}
