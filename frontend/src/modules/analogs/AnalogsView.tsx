import { useT } from '../../i18n/useT'

/** Módulo A (Buscador de análogos): se construye en la Fase 2 del plan. */
export function AnalogsView({ onOpenExplorer }: { onOpenExplorer: () => void }) {
  const t = useT()
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="max-w-md space-y-3 text-center">
        <h2 className="text-lg font-semibold">{t('analogs.placeholderTitle')}</h2>
        <p className="text-sm text-ink-muted">{t('analogs.placeholderBody')}</p>
        <button
          type="button"
          onClick={onOpenExplorer}
          className="rounded bg-accent px-4 py-2 text-sm font-bold text-ink hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info"
        >
          {t('analogs.placeholderAction')}
        </button>
      </div>
    </div>
  )
}
