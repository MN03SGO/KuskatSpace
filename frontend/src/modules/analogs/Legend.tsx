import { hudPanelClass } from '../../components/ui'
import type { ContextVisibility } from './analogsContextLayers'
import type { IfaMode } from './ifaColorExpr'
import {
  CONTEXT_LAYERS,
  IFA_PALETTE_STOPS,
  type ContextLayerId,
  type LegendSpec,
} from './layerRegistry'

type Props = {
  isEs: boolean
  scenario: IfaMode
  contextVisibility: ContextVisibility
}

function ColorBar({ legend, title, rangeLabel }: { legend: LegendSpec; title: string; rangeLabel?: string }) {
  const gradient = `linear-gradient(90deg, ${legend.stops.join(', ')})`
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between font-mono text-[10px] font-bold">
        <span className="uppercase tracking-wider text-ink-muted">{title}</span>
        {rangeLabel && <span className="text-info">{rangeLabel}</span>}
      </div>
      <div className="h-2 w-full rounded-full border border-line" style={{ background: gradient }} />
      <div className="flex justify-between font-mono text-[9px] text-ink-muted">
        <span>
          {legend.min}
          {legend.unit ? ` ${legend.unit}` : ''}
        </span>
        <span>
          {legend.max}
          {legend.unit ? ` ${legend.unit}` : ''}
        </span>
      </div>
    </div>
  )
}

export function Legend({ isEs, contextVisibility }: Props) {
  const ifaStops = [...IFA_PALETTE_STOPS]
  const ifaLegend: LegendSpec = {
    stops: ifaStops,
    min: 0,
    max: 1,
    unit: 'IFA',
  }

  const visibleCtx = CONTEXT_LAYERS.filter((l) => contextVisibility[l.id as ContextLayerId])

  return (
    <div className={`w-full space-y-2 p-3 ${hudPanelClass}`}>
      <ColorBar
        legend={ifaLegend}
        title="IFA (plasma)"
        rangeLabel="0.0 → 1.0"
      />
      {visibleCtx.map((layer) => (
        <ColorBar
          key={layer.id}
          legend={layer.legend}
          title={isEs ? layer.nameEs : layer.nameEn}
        />
      ))}
      <p className="text-[10px] leading-snug text-ink-muted">
        {isEs
          ? 'Sin color = fuera del dominio analizado'
          : 'No color = outside the analyzed domain'}
      </p>
    </div>
  )
}
