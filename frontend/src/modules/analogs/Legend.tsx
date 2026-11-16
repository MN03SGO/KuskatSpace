import {
  CONTEXT_LAYERS,
  IFA_INFERNO_STOPS,
  IFA_VIRIDIS_STOPS,
  type ContextLayerId,
  type LegendSpec,
} from './layerRegistry'
import type { IfaMode } from './ifaColorExpr'
import type { ContextVisibility } from './analogsContextLayers'

type Props = {
  isEs: boolean
  scenario: IfaMode
  contextVisibility: ContextVisibility
}

function ColorBar({ legend, title }: { legend: LegendSpec; title: string }) {
  const gradient = `linear-gradient(90deg, ${legend.stops.join(', ')})`
  return (
    <div className="mb-1.5 last:mb-0">
      <p className="mb-0.5 text-[10px] font-semibold text-ink">{title}</p>
      <div className="h-2 w-full rounded-sm" style={{ background: gradient }} />
      <div className="mt-0.5 flex justify-between font-mono text-[9px] text-ink-muted">
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

export function Legend({ isEs, scenario, contextVisibility }: Props) {
  const ifaStops =
    scenario === 'mars_arid' ? [...IFA_INFERNO_STOPS] : [...IFA_VIRIDIS_STOPS]
  const ifaLegend: LegendSpec = {
    stops: ifaStops,
    min: 0,
    max: 1,
    unit: 'IFA',
  }

  const visibleCtx = CONTEXT_LAYERS.filter((l) => contextVisibility[l.id as ContextLayerId])

  return (
    <div className="pointer-events-none absolute bottom-10 left-2 z-20 w-[200px] rounded border border-line bg-surface/95 p-2 shadow-md backdrop-blur-sm">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
        {isEs ? 'Leyenda' : 'Legend'}
      </p>
      <ColorBar
        legend={ifaLegend}
        title={
          scenario === 'mars_arid'
            ? isEs
              ? 'IFA (inferno)'
              : 'IFA (inferno)'
            : isEs
              ? 'IFA (viridis)'
              : 'IFA (viridis)'
        }
      />
      {visibleCtx.map((layer) => (
        <ColorBar
          key={layer.id}
          legend={layer.legend}
          title={isEs ? layer.nameEs : layer.nameEn}
        />
      ))}
      <p className="mt-1 text-[9px] leading-snug text-ink-muted">
        {isEs
          ? 'Sin color = fuera del dominio analizado'
          : 'No color = outside the analyzed domain'}
      </p>
    </div>
  )
}
