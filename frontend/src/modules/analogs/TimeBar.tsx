import { focusRing, hudPanelClass } from '../../components/ui'
import type { ContextVisibility } from './analogsContextLayers'
import { CONTEXT_LAYERS, type ContextLayerId } from './layerRegistry'

type Props = {
  isEs: boolean
  date: string
  onDate: (iso: string) => void
  contextVisibility: ContextVisibility
}

/** Solo visible si alguna capa de contexto temporal está activa. */
export function TimeBar({ isEs, date, onDate, contextVisibility }: Props) {
  const temporalVisible = CONTEXT_LAYERS.filter(
    (l) => l.period && contextVisibility[l.id as ContextLayerId],
  )
  if (temporalVisible.length === 0) return null

  const labels = temporalVisible
    .map((l) => (isEs ? l.nameEs : l.nameEn))
    .join(' · ')

  return (
    <div
      className={`pointer-events-auto absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 px-3 py-1.5 ${hudPanelClass}`}
    >
      <span className="material-symbols-outlined text-[15px] text-info" aria-hidden="true">
        calendar_today
      </span>
      <span className="font-mono text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
        {isEs ? 'Fecha' : 'Date'}
      </span>
      <input
        type="date"
        value={date}
        onChange={(e) => onDate(e.target.value)}
        className={`rounded border border-line bg-raised px-2 py-0.5 font-mono text-[11px] text-ink ${focusRing}`}
      />
      <span className="max-w-[200px] truncate text-[10px] text-ink-muted" title={labels}>
        {labels}
      </span>
    </div>
  )
}
