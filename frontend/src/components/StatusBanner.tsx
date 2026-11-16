import type { ReactNode } from 'react'

type Tone = 'error' | 'warn' | 'info' | 'ok'

const TONE_CLASSES: Record<Tone, string> = {
  error: 'border-danger/50 bg-danger/10 text-danger',
  warn: 'border-warn/50 bg-warn/10 text-warn',
  info: 'border-info/40 bg-info/10 text-ink',
  ok: 'border-ok/40 bg-ok/10 text-ok',
}

const TONE_ICONS: Record<Tone, string> = {
  error: 'error',
  warn: 'warning',
  info: 'info',
  ok: 'check_circle',
}

const TONE_ICON_COLOR: Record<Tone, string> = {
  error: 'text-danger',
  warn: 'text-warn',
  info: 'text-info',
  ok: 'text-ok',
}

/**
 * Mensaje en el panel en lugar de alert() (B4).
 * `live={false}` evita que un aviso que se vuelve a pintar (p. ej. cada minuto)
 * se anuncie una y otra vez en el lector de pantalla (N4 de la auditoría).
 */
export function StatusBanner({ tone, children, live = true }: { tone: Tone; children: ReactNode; live?: boolean }) {
  const role = !live ? undefined : tone === 'error' ? 'alert' : 'status'
  return (
    <div
      role={role}
      className={`flex items-start gap-2 rounded-lg border border-l-4 px-3 py-2 text-xs leading-relaxed ${TONE_CLASSES[tone]}`}
    >
      <span className={`material-symbols-outlined mt-0.5 shrink-0 text-[16px] ${TONE_ICON_COLOR[tone]}`} aria-hidden="true">
        {TONE_ICONS[tone]}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
