import { describe, expect, it } from 'vitest'
import en from './en.json'
import es from './es.json'
import { leafKeys, translate } from './useT'

describe('diccionarios ES/EN', () => {
  it('tienen exactamente las mismas claves', () => {
    const esKeys = leafKeys(es).sort()
    const enKeys = leafKeys(en).sort()
    expect(enKeys.filter((k) => !esKeys.includes(k))).toEqual([])
    expect(esKeys.filter((k) => !enKeys.includes(k))).toEqual([])
  })

  it('no dejan textos vacíos', () => {
    for (const dict of [es, en]) {
      for (const key of leafKeys(dict)) {
        expect(translate(dict === es ? 'es' : 'en', key), key).not.toBe('')
      }
    }
  })
})

describe('translate', () => {
  it('sustituye variables', () => {
    expect(translate('es', 'explorer.results.partners', { count: 3 })).toBe('Agencias asociadas (3)')
  })

  it('devuelve la clave si no existe', () => {
    expect(translate('en', 'no.existe')).toBe('no.existe')
  })
})
