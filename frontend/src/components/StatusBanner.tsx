import type { ReactNode } from 'react'

type Tone = 'error' | 'warn' | 'info' | 'ok'

const TONE_CLASSES: Record<Tone, string> = {
  error: 'border-danger/60 bg-danger/10 text-danger',
  warn: 'border-warn/60 bg-warn/10 text-warn',
  info: 'border-info/60 bg-info/10 text-info',
  ok: 'border-ok/60 bg-ok/10 text-ok',
}

/**
 * Mensaje en el panel en lugar de alert() (B4).
 * `live={false}` evita que un aviso que se vuelve a pintar (p. ej. cada minuto)
 * se anuncie una y otra vez en el lector de pantalla (N4 de la auditoría).
 */
export function StatusBanner({ tone, children, live = true }: { tone: Tone; children: ReactNode; live?: boolean }) {
  const role = !live ? undefined : tone === 'error' ? 'alert' : 'status'
  return (
    <div role={role} className={`rounded-md border-l-4 px-3 py-2 text-xs leading-relaxed ${TONE_CLASSES[tone]}`}>
      {children}
    </div>
  )
}
