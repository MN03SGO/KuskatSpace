/** Formato de números según el idioma (B26): 0,45 en ES y 0.45 en EN. */

const cache = new Map<string, Intl.NumberFormat>()

export function formatNumber(lang: string, value: number, maximumFractionDigits = 1): string {
  const key = `${lang}:${maximumFractionDigits}`
  let fmt = cache.get(key)
  if (!fmt) {
    fmt = new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'es-ES', { maximumFractionDigits })
    cache.set(key, fmt)
  }
  return fmt.format(value)
}
