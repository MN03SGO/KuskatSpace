import type { ReactNode } from 'react'
import { focusRing, hudCardClass } from '../../components/ui'
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
  const selectedId = useExplorerStore((s) => s.selectedResult?.sceneId)
  const busy = useExplorerStore((s) => s.process.state === 'loading')
  if (rows.length === 0 && !showEmpty) return null

  return (
    <div className="space-y-1.5">
      <h3 className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink-muted">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-ink-muted">{t('explorer.results.empty')}</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((row) => {
            const isSelected = Boolean(row.result.sceneId && selectedId === row.result.sceneId)
            return (
              <li key={row.key}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void selectResult(row.result)}
                  className={`min-h-10 w-full rounded-lg border border-line border-l-4 px-2.5 py-2 text-left text-xs transition-all ${focusRing} disabled:opacity-60 ${accent} ${
                    isSelected ? 'bg-info/10 ring-1 ring-info/50' : 'bg-raised hover:bg-line/40'
                  }`}
                >
                  <span className="block font-mono text-[11px] font-bold break-all text-ink">{row.title}</span>
                  <span className="mt-0.5 block text-[11px] text-ink-muted">{row.meta}</span>
                </button>
              </li>
            )
          })}
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
    meta: `${i.collection} · ${t('explorer.results.date', { value: i.date || na })} · ${t('explorer.results.clouds', { value: i.cloud_cover == null ? na : `${i.cloud_cover}%` })}`,
    result: {
      bbox: i.bbox,
      mode: i.collection.includes('sentinel-2')
        ? i.recommended_mode === 'sar_db'
          ? 'ndvi'
          : i.recommended_mode
        : i.recommended_mode,
      label: i.id,
      sceneId: i.collection.includes('sentinel-2') ? i.id : undefined,
      cloudCover: i.cloud_cover,
      date: i.date,
      collection: i.collection,
    },
  }))
  const earthdata: Row[] = results.live_earthdata.map((i) => ({
    key: i.id,
    title: i.title,
    meta: `${t('explorer.results.date', { value: i.date || na })}${
      i.cloud_cover == null ? '' : ` · ${t('explorer.results.clouds', { value: `${i.cloud_cover}%` })}`
    }`,
    result: {
      bbox: i.bbox,
      mode: 'ndvi',
      label: i.title,
      sceneId: i.title,
      cloudCover: i.cloud_cover ?? null,
      date: i.date,
      collection: i.collection ?? 'HLSS30',
    },
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
    <section className={`${hudCardClass} space-y-3`}>
      <p className="text-xs font-medium text-ink-muted">{t('explorer.results.hint')}</p>
      {isEarth && (
        <>
          <Group
            title={t('explorer.results.copernicus', { count: copernicus.length })}
            rows={copernicus}
            accent="border-l-ok"
            showEmpty
            t={t}
          />
          <Group
            title={t('explorer.results.earthdata', { count: earthdata.length })}
            rows={earthdata}
            accent="border-l-accent"
            showEmpty
            t={t}
          />
        </>
      )}
      {!isEarth && (
        <Group title={t('explorer.results.pds', { count: pds.length })} rows={pds} accent="border-l-warn" showEmpty t={t} />
      )}
      <Group
        title={t('explorer.results.partners', { count: partners.length })}
        rows={partners}
        accent="border-l-ink-muted"
        showEmpty
        t={t}
      />
    </section>
  )
}
