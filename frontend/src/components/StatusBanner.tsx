import type { ReactNode } from 'react'

type Tone = 'error' | 'warn' | 'info'

const TONE_CLASSES: Record<Tone, string> = {
  error: 'border-danger/60 bg-danger/10 text-danger',
  warn: 'border-warn/60 bg-warn/10 text-warn',
  info: 'border-info/60 bg-info/10 text-info',
}

/** Mensaje en el panel en lugar de alert() (B4). */
export function StatusBanner({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-md border-l-4 px-3 py-2 text-xs leading-relaxed ${TONE_CLASSES[tone]}`}
    >
      {children}
    </div>
  )
}
