import { CONTEXT_LAYERS, type ContextLayerId } from './layerRegistry'
import type { ContextVisibility } from './analogsContextLayers'

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
    <div className="pointer-events-auto absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded border border-line bg-surface/95 px-3 py-1.5 shadow-md backdrop-blur-sm">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
        {isEs ? 'Fecha' : 'Date'}
      </span>
      <input
        type="date"
        value={date}
        onChange={(e) => onDate(e.target.value)}
        className="rounded border border-line bg-canvas px-2 py-0.5 font-mono text-[11px] text-ink"
      />
      <span className="max-w-[220px] truncate text-[9px] text-ink-muted" title={labels}>
        {labels}
      </span>
    </div>
  )
}
