import { focusRingInset, hudCardClass } from '../../components/ui'
import { BODY_ORDER } from '../../config/bodies'
import { useT } from '../../i18n/useT'
import { useExplorerStore } from '../../store/useExplorerStore'

export function BodySelector() {
  const t = useT()
  const body = useExplorerStore((s) => s.body)
  const setBody = useExplorerStore((s) => s.setBody)

  return (
    <section className={`${hudCardClass} space-y-2`} aria-labelledby="body-selector-label">
      <span id="body-selector-label" className="block font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
        {t('bodies.label')}
      </span>
      <div
        role="group"
        aria-labelledby="body-selector-label"
        className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-raised p-1"
      >
        {BODY_ORDER.map((id) => {
          const active = body === id
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => setBody(id)}
              className={`flex min-h-11 flex-col items-center justify-center rounded-lg px-1.5 py-1.5 text-center transition-all ${focusRingInset} ${
                active
                  ? 'bg-accent font-semibold text-white shadow-xs dark:text-[#002b42]'
                  : 'text-ink-muted hover:bg-surface/80 hover:text-ink'
              }`}
            >
              <span className="font-mono text-[11px] leading-tight font-semibold">{t(`bodies.${id}.short`)}</span>
              <span className={`font-mono text-[10px] leading-tight ${active ? 'opacity-90' : 'opacity-70'}`}>
                {t(`bodies.${id}.sub`)}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
