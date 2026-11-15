import { lazy, Suspense } from 'react'
import { segmentClass } from '../../components/ui'
import { useT } from '../../i18n/useT'
import { type ExplorerViewMode, useExplorerStore } from '../../store/useExplorerStore'
import { BodySelector } from './BodySelector'
import { PlanetLayersPanel } from './PlanetLayersPanel'
import { ProcessingPanel } from './ProcessingPanel'
import { ResultsList } from './ResultsList'
import { SearchPanel } from './SearchPanel'

// Three.js y Leaflet se cargan solo cuando se usa cada vista.
const GlobeView = lazy(() => import('./GlobeView'))
const PlanetMap = lazy(() => import('./PlanetMap'))

const VIEWS: ExplorerViewMode[] = ['globe', 'map']

function ViewToggle() {
  const t = useT()
  const view = useExplorerStore((s) => s.view)
  const setView = useExplorerStore((s) => s.setView)
  return (
    <div
      role="group"
      aria-label={t('explorer.view.label')}
      className="absolute top-3 right-3 z-[1000] flex overflow-hidden rounded-md border border-line shadow-lg"
    >
      {VIEWS.map((v) => (
        <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={segmentClass(view === v)}>
          {t(`explorer.view.${v}`)}
        </button>
      ))}
    </div>
  )
}

export function ExplorerView() {
  const view = useExplorerStore((s) => s.view)

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <aside className="order-2 min-h-0 flex-1 space-y-3 overflow-y-auto border-line bg-surface p-4 md:order-1 md:w-[400px] md:flex-none md:border-r">
        <BodySelector />
        <PlanetLayersPanel />
        <SearchPanel />
        <ProcessingPanel />
        <ResultsList />
      </aside>
      <div className="relative order-1 h-[45dvh] shrink-0 md:order-2 md:h-auto md:flex-1">
        <ViewToggle />
        <Suspense fallback={<div className="h-full w-full bg-canvas" />}>
          {view === 'globe' ? <GlobeView /> : <PlanetMap />}
        </Suspense>
      </div>
    </div>
  )
}
