import { hudPanelClass, sliderClass } from '../../components/ui'
import type { ContextOpacity, ContextVisibility } from './analogsContextLayers'
import {
  CANDIDATES_LAYER,
  CONTEXT_LAYERS,
  IFA_LAYER,
  type ContextLayerId,
} from './layerRegistry'

type Props = {
  isEs: boolean
  ifaOpacity: number
  onIfaOpacity: (v: number) => void
  ifaMode: 'polygons' | 'heatmap'
  gridNotice: string | null
  candidatesVisible: boolean
  onCandidatesVisible: (v: boolean) => void
  contextVisibility: ContextVisibility
  contextOpacity: ContextOpacity
  onContextVisible: (id: ContextLayerId, v: boolean) => void
  onContextOpacity: (id: ContextLayerId, v: number) => void
}

const SENSOR_SHORT: Record<ContextLayerId, string> = {
  lst: 'MODIS 1km',
  aod: 'MERRA-2',
  snow: 'NDSI Terra',
  relief: 'ASTER GDEM',
}

export function LayerPanel({
  isEs,
  ifaOpacity,
  onIfaOpacity,
  ifaMode,
  gridNotice,
  candidatesVisible,
  onCandidatesVisible,
  contextVisibility,
  contextOpacity,
  onContextVisible,
  onContextOpacity,
}: Props) {
  return (
    <div className={`w-full space-y-2.5 p-3 ${hudPanelClass}`}>
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink-muted">
          {isEs ? 'Capas espectrales' : 'Spectral layers'}
        </p>
        <span className="font-mono text-[10px] font-bold text-ok">IFA [ON]</span>
      </div>

      {/* IFA fijo — siempre visible */}
      <div className="rounded-lg border border-line bg-raised/70 p-2">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[11px] font-semibold text-ink">
            {isEs ? IFA_LAYER.nameEs : IFA_LAYER.nameEn}
          </span>
          <span className="font-mono text-[11px] font-bold text-info">
            {Math.round(ifaOpacity * 100)}%
          </span>
        </div>
        <p className="mt-0.5 text-[10px] text-ink-muted">
          {ifaMode === 'heatmap'
            ? isEs
              ? 'IDW continuo · escáner planetario'
              : 'Continuous IDW · planetary scanner'
            : isEs
              ? 'Polígonos continuos · sin bordes'
              : 'Continuous polygons · no borders'}
        </p>
        {gridNotice && <p className="mt-0.5 text-[10px] text-warn">{gridNotice}</p>}
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={ifaOpacity}
          aria-label={isEs ? 'Opacidad IFA' : 'IFA opacity'}
          onChange={(e) => onIfaOpacity(parseFloat(e.target.value))}
          className={`mt-1.5 ${sliderClass}`}
        />
      </div>

      {/* Candidatos */}
      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-raised/50 px-2 py-1.5">
        <input
          type="checkbox"
          checked={candidatesVisible}
          onChange={(e) => onCandidatesVisible(e.target.checked)}
          className="h-3.5 w-3.5 rounded accent-accent"
        />
        <span className="text-[11px] font-semibold text-ink">
          {isEs ? CANDIDATES_LAYER.nameEs : CANDIDATES_LAYER.nameEn}
        </span>
      </label>

      {/* Contexto GIBS */}
      <div className="space-y-1.5">
        <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink-muted">
          {isEs ? 'Contexto espacial (GIBS)' : 'Spatial context (GIBS)'}
        </p>
        <div className="space-y-1">
          {CONTEXT_LAYERS.map((layer) => {
            const on = contextVisibility[layer.id]
            return (
              <div
                key={layer.id}
                className="rounded-lg border border-line/60 bg-raised/40 px-2 py-1"
              >
                <label className="flex cursor-pointer items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) => onContextVisible(layer.id, e.target.checked)}
                      className="h-3.5 w-3.5 shrink-0 rounded accent-accent"
                    />
                    <span className="truncate text-[11px] font-medium text-ink">
                      {isEs ? layer.nameEs : layer.nameEn}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[9px] text-ink-muted">
                    {SENSOR_SHORT[layer.id]}
                  </span>
                </label>
                {on && (
                  <label className="mt-1 flex items-center gap-2 pl-5 text-[10px] text-ink-muted">
                    <input
                      type="range"
                      min={0.1}
                      max={1}
                      step={0.05}
                      value={contextOpacity[layer.id]}
                      onChange={(e) =>
                        onContextOpacity(layer.id, parseFloat(e.target.value))
                      }
                      className={sliderClass}
                    />
                    <span className="w-7 shrink-0 text-right font-mono">
                      {Math.round(contextOpacity[layer.id] * 100)}%
                    </span>
                  </label>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
