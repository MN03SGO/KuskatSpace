import { useState } from 'react'
import { LangToggle } from './components/LangToggle'
import { type ThemeMode, focusRingInset, useDocumentTheme, useTheme } from './components/ui'
import { useDocumentLang, useT } from './i18n/useT'
import { AnalogsView } from './modules/analogs/AnalogsView'
import { ExplorerView } from './modules/explorer/ExplorerView'

type Tab = 'analogs' | 'explorer'
const TABS: Tab[] = ['analogs', 'explorer']

const THEMES: { id: ThemeMode; icon: string }[] = [
  { id: 'light', icon: 'light_mode' },
  { id: 'dark', icon: 'dark_mode' },
  { id: 'auto', icon: 'contrast' },
]

function ThemeToggle() {
  const t = useT()
  const theme = useTheme((s) => s.theme)
  const setTheme = useTheme((s) => s.setTheme)

  return (
    <div
      role="group"
      aria-label={t('app.theme.label')}
      className="flex items-center gap-0.5 rounded-lg border border-line bg-raised p-0.5"
    >
      {THEMES.map(({ id, icon }) => {
        const active = theme === id
        const label = t(`app.theme.${id}`)
        return (
          <button
            key={id}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={active}
            onClick={() => setTheme(id)}
            className={`flex min-h-8 items-center gap-1 rounded-md px-2 py-1 font-mono text-[11px] font-medium transition-colors ${focusRingInset} ${
              active
                ? 'bg-surface font-semibold text-info shadow-xs'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
              {icon}
            </span>
            <span className="hidden sm:inline">{label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default function App() {
  const t = useT()
  useDocumentLang()
  useDocumentTheme()
  const [tab, setTab] = useState<Tab>('analogs')

  return (
    <div className="flex h-dvh flex-col bg-canvas text-ink">
      <header className="z-50 flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line bg-surface/90 px-4 py-2 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-info/30 bg-info/10 text-info shadow-xs">
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                public
              </span>
            </div>
            <div className="flex flex-col">
              <h1 className="text-sm font-bold leading-none tracking-tight text-ink">
                TERRA<span className="text-info">ANÁLOGA</span>
              </h1>
              <p className="mt-0.5 hidden text-[11px] text-ink-muted sm:block">{t('app.tagline')}</p>
            </div>
          </div>
          <span
            className="hidden h-2 w-2 rounded-full bg-ok lg:inline-block"
            aria-hidden="true"
            title={t('app.title')}
          />
        </div>

        <nav
          aria-label={t('app.tabs.label')}
          className="flex items-center gap-1 rounded-xl border border-line bg-raised p-1"
        >
          {TABS.map((id) => {
            const active = tab === id
            return (
              <button
                key={id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => setTab(id)}
                className={`min-h-8 rounded-lg px-3 py-1.5 font-mono text-xs transition-all ${focusRingInset} ${
                  active
                    ? 'bg-accent font-semibold text-white shadow-xs dark:text-[#002b42]'
                    : 'font-medium text-ink-muted hover:bg-surface/70 hover:text-ink'
                }`}
              >
                {t(`app.tabs.${id}`)}
              </button>
            )
          })}
        </nav>

        <div className="flex items-center gap-2">
          <LangToggle />
          <ThemeToggle />
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col">
        {tab === 'explorer' ? <ExplorerView /> : <AnalogsView onOpenExplorer={() => setTab('explorer')} />}
      </main>
    </div>
  )
}
