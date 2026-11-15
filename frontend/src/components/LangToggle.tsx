import { type Lang, useLang, useT } from '../i18n/useT'
import { segmentClass } from './ui'

const LANGS: Lang[] = ['es', 'en']

export function LangToggle() {
  const t = useT()
  const { lang, setLang } = useLang()

  return (
    <div role="group" aria-label={t('app.lang.label')} className="flex overflow-hidden rounded-md border border-ink-muted/70">
      {LANGS.map((l) => (
        <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)} className={segmentClass(lang === l)}>
          {t(`app.lang.${l}`)}
        </button>
      ))}
    </div>
  )
}
