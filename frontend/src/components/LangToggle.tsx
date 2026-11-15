import { type Lang, useLang, useT } from '../i18n/useT'

const LANGS: Lang[] = ['es', 'en']

export function LangToggle() {
  const t = useT()
  const { lang, setLang } = useLang()

  return (
    <div role="group" aria-label={t('app.lang.label')} className="flex overflow-hidden rounded-md border border-line">
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
          className={`px-2.5 py-1 text-xs font-semibold focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-info ${
            lang === l ? 'bg-accent text-ink' : 'bg-raised text-ink-muted hover:text-ink'
          }`}
        >
          {t(`app.lang.${l}`)}
        </button>
      ))}
    </div>
  )
}
