import { segmentClass } from '../../components/ui'
import { BODY_ORDER } from '../../config/bodies'
import { useT } from '../../i18n/useT'
import { useExplorerStore } from '../../store/useExplorerStore'

export function BodySelector() {
  const t = useT()
  const body = useExplorerStore((s) => s.body)
  const setBody = useExplorerStore((s) => s.setBody)

  return (
    <div role="group" aria-label={t('bodies.label')} className="grid grid-cols-3 overflow-hidden rounded-md border border-line">
      {BODY_ORDER.map((id) => (
        <button key={id} type="button" aria-pressed={body === id} onClick={() => setBody(id)} className={segmentClass(body === id)}>
          {t(`bodies.${id}.label`)}
        </button>
      ))}
    </div>
  )
}
