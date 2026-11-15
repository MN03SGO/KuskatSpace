import { useState } from 'react'
import { LangToggle } from './components/LangToggle'
import { useDocumentLang, useT } from './i18n/useT'
import { AnalogsView } from './modules/analogs/AnalogsView'
import { ExplorerView } from './modules/explorer/ExplorerView'

type Tab = 'analogs' | 'explorer'
const TABS: Tab[] = ['analogs', 'explorer']

export default function App() {
  const t = useT()
  useDocumentLang()
  // Módulo A (Buscador de análogos) como vista principal unificada.
  const [tab, setTab] = useState<Tab>('analogs')

  return (
    <div className="flex h-dvh flex-col bg-canvas text-ink">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface px-4 py-2">
        <div className="mr-auto">
          <h1 className="text-base leading-tight font-bold">{t('app.title')}</h1>
          <p className="text-xs text-ink-muted">{t('app.tagline')}</p>
        </div>
        <nav aria-label={t('app.tabs.label')} className="flex gap-1">
          {TABS.map((id) => (
            <button
              key={id}
              type="button"
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => setTab(id)}
              className={`rounded px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info ${
                tab === id ? 'bg-raised text-ink' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {t(`app.tabs.${id}`)}
            </button>
          ))}
        </nav>
        <LangToggle />
      </header>

      <main className="flex min-h-0 flex-1 flex-col">
        {tab === 'explorer' ? <ExplorerView /> : <AnalogsView onOpenExplorer={() => setTab('explorer')} />}
      </main>
    </div>
  )
}
