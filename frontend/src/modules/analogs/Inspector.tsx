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
    <div className="flex justify-between gap-2 text-[10px]">
      <span className="text-ink-muted">{label}</span>
      <span className="font-mono text-ink">{value}</span>
    </div>
  )
}

export function Inspector({ isEs, cell, candidate }: Props) {
  if (!cell && !candidate) {
    return (
      <div className="pointer-events-none absolute right-2 top-12 z-20 w-[200px] rounded border border-line bg-surface/95 p-2 shadow-md backdrop-blur-sm">
        <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
          {isEs ? 'Inspector' : 'Inspector'}
        </p>
        <p className="mt-1 text-[10px] text-ink-muted">
          {isEs
            ? 'Pasa el cursor sobre una celda IFA o un candidato.'
            : 'Hover a grid cell or candidate.'}
        </p>
      </div>
    )
  }

  return (
    <div className="pointer-events-none absolute right-2 top-12 z-20 w-[200px] rounded border border-line bg-surface/95 p-2 shadow-md backdrop-blur-sm">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
        {isEs ? 'Inspector' : 'Inspector'}
      </p>

      {candidate && (
        <div className="mb-1.5 border-b border-line/60 pb-1.5">
          <p className="text-[11px] font-semibold leading-snug text-ink">{candidate.name}</p>
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
    </div>
  )
}
