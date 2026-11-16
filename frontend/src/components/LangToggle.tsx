import { type Lang, useLang, useT } from '../i18n/useT'
import { focusRingInset } from './ui'

const LANGS: Lang[] = ['es', 'en']

export function LangToggle() {
  const t = useT()
  const { lang, setLang } = useLang()

  return (
    <div
      role="group"
      aria-label={t('app.lang.label')}
      className="flex items-center gap-0.5 rounded-lg border border-line bg-raised p-0.5"
    >
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
          className={`min-h-8 rounded-md px-2 py-1 font-mono text-[11px] font-semibold transition-colors ${focusRingInset} ${
            lang === l
              ? 'bg-surface text-info shadow-xs'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          {t(`app.lang.${l}`)}
        </button>
      ))}
    </div>
  )
}
