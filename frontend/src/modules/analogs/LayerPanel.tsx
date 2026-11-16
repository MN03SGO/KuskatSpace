import {
  CANDIDATES_LAYER,
  CONTEXT_LAYERS,
  IFA_LAYER,
  type ContextLayerId,
} from './layerRegistry'
import type { ContextOpacity, ContextVisibility } from './analogsContextLayers'

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
    <div className="pointer-events-auto absolute left-2 top-2 z-20 w-[220px] rounded border border-line bg-surface/95 p-2 shadow-md backdrop-blur-sm">
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
        {isEs ? 'Capas' : 'Layers'}
      </p>

      {/* IFA fijo — siempre visible */}
      <div className="mb-1.5 rounded border border-line/80 bg-canvas/80 px-2 py-1.5">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[11px] font-semibold text-ink">
            {isEs ? IFA_LAYER.nameEs : IFA_LAYER.nameEn}
          </span>
          <span className="rounded bg-info/15 px-1 py-0.5 text-[9px] font-semibold text-info">
            ON
          </span>
        </div>
        <p className="mt-0.5 text-[9px] text-ink-muted">
          {ifaMode === 'heatmap'
            ? isEs
              ? 'Modo aviso'
              : 'Notice mode'
            : isEs
              ? 'Círculos (z<4) · polígonos (z≥4)'
              : 'Circles (z<4) · polygons (z≥4)'}
        </p>
        {gridNotice && (
          <p className="mt-0.5 text-[9px] text-amber-600 dark:text-amber-400">{gridNotice}</p>
        )}
        <label className="mt-1 flex items-center gap-2 text-[10px] text-ink-muted">
          <span className="w-8 shrink-0">{isEs ? 'Opac.' : 'Opac.'}</span>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={ifaOpacity}
            onChange={(e) => onIfaOpacity(parseFloat(e.target.value))}
            className="w-full accent-info"
          />
          <span className="w-7 shrink-0 font-mono text-right">
            {Math.round(ifaOpacity * 100)}%
          </span>
        </label>
      </div>

      {/* Candidatos */}
      <div className="mb-1.5 rounded border border-line/80 bg-canvas/80 px-2 py-1.5">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={candidatesVisible}
            onChange={(e) => onCandidatesVisible(e.target.checked)}
            className="accent-info"
          />
          <span className="text-[11px] font-semibold text-ink">
            {isEs ? CANDIDATES_LAYER.nameEs : CANDIDATES_LAYER.nameEn}
          </span>
        </label>
      </div>

      {/* Contexto GIBS */}
      <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-ink-muted">
        {isEs ? 'Contexto (GIBS)' : 'Context (GIBS)'}
      </p>
      <div className="flex flex-col gap-1">
        {CONTEXT_LAYERS.map((layer) => {
          const on = contextVisibility[layer.id]
          return (
            <div
              key={layer.id}
              className="rounded border border-line/60 bg-canvas/60 px-2 py-1"
            >
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) => onContextVisible(layer.id, e.target.checked)}
                  className="mt-0.5 accent-info"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-medium leading-tight text-ink">
                    {isEs ? layer.nameEs : layer.nameEn}
                  </span>
                  <span className="block text-[9px] text-ink-muted">
                    {isEs ? layer.helpEs : layer.helpEn}
                  </span>
                </span>
              </label>
              {on && (
                <label className="mt-1 flex items-center gap-2 pl-5 text-[10px] text-ink-muted">
                  <span className="w-8 shrink-0">{isEs ? 'Opac.' : 'Opac.'}</span>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={contextOpacity[layer.id]}
                    onChange={(e) =>
                      onContextOpacity(layer.id, parseFloat(e.target.value))
                    }
                    className="w-full accent-info"
                  />
                  <span className="w-7 shrink-0 font-mono text-right">
                    {Math.round(contextOpacity[layer.id] * 100)}%
                  </span>
                </label>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
