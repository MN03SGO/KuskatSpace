import { BODY_ORDER } from '../../config/bodies'
import { useT } from '../../i18n/useT'
import { useExplorerStore } from '../../store/useExplorerStore'

export function BodySelector() {
  const t = useT()
  const body = useExplorerStore((s) => s.body)
  const setBody = useExplorerStore((s) => s.setBody)

  return (
    <div role="group" aria-label={t('bodies.label')} className="grid grid-cols-3 gap-1.5">
      {BODY_ORDER.map((id) => (
        <button
          key={id}
          type="button"
          aria-pressed={body === id}
          onClick={() => setBody(id)}
          className={`rounded px-1 py-2 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info ${
            body === id ? 'bg-accent text-ink' : 'bg-raised text-ink hover:bg-line'
          }`}
        >
          {t(`bodies.${id}.label`)}
        </button>
      ))}
    </div>
  )
}
