import { Suspense, lazy, useEffect, useState } from 'react'
import { focusRing, focusRingInset, hudPanelClass } from '../../components/ui'
import { BODIES } from '../../config/bodies'
import { useT } from '../../i18n/useT'
import { type ExplorerViewMode, useExplorerStore } from '../../store/useExplorerStore'
import type { BodyId } from '../../types/explorer'
import { BodySelector } from './BodySelector'
import { PlanetLayersPanel } from './PlanetLayersPanel'
import { ProcessingPanel, SceneResult } from './ProcessingPanel'
import { ResultsList } from './ResultsList'
import { SearchPanel } from './SearchPanel'

// Three.js y Leaflet se cargan solo cuando se usa cada vista.
const GlobeView = lazy(() => import('./GlobeView'))
const PlanetMap = lazy(() => import('./PlanetMap'))

const VIEWS: { id: ExplorerViewMode; icon: string }[] = [
  { id: 'globe', icon: 'globe' },
  { id: 'map', icon: 'map' },
]

const BODY_ICONS: Record<BodyId, string> = {
  earth: 'public',
  moon: 'brightness_2',
  mars: 'blur_on',
}

function ViewToggle() {
  const t = useT()
  const view = useExplorerStore((s) => s.view)
  const setView = useExplorerStore((s) => s.setView)
  const body = useExplorerStore((s) => s.body)
  const setBbox = useExplorerStore((s) => s.setBbox)

  return (
    <div className="pointer-events-auto absolute top-3 right-3 z-[1000] flex items-center gap-2">
      <div
        role="group"
        aria-label={t('explorer.view.label')}
        className={`flex items-center gap-0.5 p-1 ${hudPanelClass}`}
      >
        {VIEWS.map(({ id, icon }) => {
          const active = view === id
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => setView(id)}
              className={`flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono text-[11px] font-semibold transition-all ${focusRingInset} ${
                active
                  ? 'bg-accent text-white shadow-xs dark:text-[#002b42]'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                {icon}
              </span>
              <span>{t(`explorer.view.${id}`)}</span>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        title={t('explorer.recenter')}
        aria-label={t('explorer.recenter')}
        onClick={() => setBbox(BODIES[body].defaultBBox)}
        className={`flex h-10 w-10 items-center justify-center text-ink-muted transition-colors hover:text-info ${hudPanelClass} ${focusRing}`}
      >
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
          my_location
        </span>
      </button>
    </div>
  )
}

export function ExplorerView() {
  const t = useT()
  const view = useExplorerStore((s) => s.view)
  const body = useExplorerStore((s) => s.body)
  const scene = useExplorerStore((s) => s.scene)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [hudMinimized, setHudMinimized] = useState(false)

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'))
    })
    return () => window.cancelAnimationFrame(id)
  }, [sidebarOpen])

  return (
    <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
      {sidebarOpen && (
        <aside
          aria-label={t('bodies.label')}
          className="order-2 flex min-h-0 flex-1 flex-col border-t border-line bg-surface/95 backdrop-blur-2xl md:order-1 md:w-[400px] md:flex-none md:border-t-0 md:border-r"
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-info/30 bg-info/10 text-info">
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  {BODY_ICONS[body]}
                </span>
              </div>
              <span className="truncate text-sm font-bold uppercase tracking-tight text-ink">
                {t(`bodies.${body}.short`)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              title={t('explorer.sidebar.collapse')}
              aria-label={t('explorer.sidebar.collapse')}
              className={`hidden h-8 w-8 items-center justify-center rounded-lg border border-line bg-raised text-ink-muted transition-colors hover:text-ink md:flex ${focusRing}`}
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                left_panel_close
              </span>
            </button>
          </div>

          <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto p-3.5">
            <BodySelector />
            <PlanetLayersPanel />
            <SearchPanel />
            <ProcessingPanel />
            <ResultsList />
          </div>
        </aside>
      )}

      <div className="relative order-1 h-[45dvh] min-h-0 shrink-0 md:order-2 md:h-auto md:flex-1">
        {!sidebarOpen && (
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            title={t('explorer.sidebar.expand')}
            aria-label={t('explorer.sidebar.expand')}
            className={`pointer-events-auto absolute top-3 left-3 z-[1000] flex h-10 w-10 items-center justify-center text-ink transition-colors hover:text-info ${hudPanelClass} ${focusRing}`}
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              tune
            </span>
          </button>
        )}

        <ViewToggle />

        <Suspense fallback={<div className="h-full w-full bg-[#030712]" />}>
          {view === 'globe' ? <GlobeView sidebarOpen={sidebarOpen} /> : <PlanetMap />}
        </Suspense>

        {/* HUD flotante inferior izquierdo con el diagnóstico de la escena procesada en escritorio */}
        {scene && (
          <div className="pointer-events-auto absolute bottom-3 left-3 z-[900] hidden max-w-[calc(100%-2rem)] lg:block lg:w-[460px]">
            <div className={`${hudPanelClass} p-3`}>
              <div className="mb-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => setHudMinimized((v) => !v)}
                  className={`rounded p-0.5 text-ink-muted hover:text-ink ${focusRing}`}
                  aria-expanded={!hudMinimized}
                  aria-label={hudMinimized ? t('explorer.sidebar.expand') : t('explorer.sidebar.collapse')}
                >
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                    {hudMinimized ? 'expand_less' : 'expand_more'}
                  </span>
                </button>
              </div>
              {hudMinimized ? (
                <p className="truncate font-mono text-xs font-bold text-ink">
                  {scene.label ?? scene.response.unit}
                </p>
              ) : (
                <SceneResult scene={scene} t={t} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
