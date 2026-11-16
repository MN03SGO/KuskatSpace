import { hudPanelClass } from '../../components/ui'
import type { GridCellProps } from './ifaColorExpr'

export type InspectorCell = GridCellProps & {
  ifa: number
}

export type InspectorCandidate = {
  name: string
  ifa: number
}

type Props = {
  isEs: boolean
  cell: InspectorCell | null
  candidate: InspectorCandidate | null
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 text-[11px]">
      <span className="text-ink-muted">{label}</span>
      <span className="font-mono font-medium text-ink">{value}</span>
    </div>
  )
}

export function Inspector({ isEs, cell, candidate }: Props) {
  return (
    <div className={`w-full p-3 ${hudPanelClass}`}>
      <div className="mb-1.5 flex items-center gap-1.5 text-info">
        <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
          save_as
        </span>
        <p className="font-mono text-[10px] font-bold uppercase tracking-wider">
          {isEs ? 'Inspector de celda' : 'Cell inspector'}
        </p>
      </div>

      {!cell && !candidate ? (
        <p className="text-[11px] leading-snug text-ink-muted">
          {isEs
            ? 'Pasa el cursor sobre una celda IFA o un candidato.'
            : 'Hover a grid cell or candidate.'}
        </p>
      ) : (
        <>
          {candidate && (
            <div className="mb-1.5 border-b border-line pb-1.5">
              <p className="text-xs leading-snug font-semibold text-ink">{candidate.name}</p>
              <Row label="IFA" value={(candidate.ifa * 100).toFixed(1) + '%'} />
            </div>
          )}

          {cell && (
            <div className="space-y-0.5">
              <Row label="IFA" value={(cell.ifa * 100).toFixed(1) + '%'} />
              <Row label={isEs ? 'Relieve' : 'Relief'} value={cell.relief.toFixed(3)} />
              <Row label={isEs ? 'Iluminación' : 'Illumination'} value={cell.illum.toFixed(3)} />
              <Row label={isEs ? 'Frío' : 'Cold'} value={cell.cold.toFixed(3)} />
              <Row label={isEs ? 'Hielo' : 'Ice'} value={cell.ice.toFixed(3)} />
              <Row label={isEs ? 'Polvo' : 'Dust'} value={cell.dust.toFixed(3)} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
