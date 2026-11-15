import { useCallback, useEffect } from 'react'
import { create } from 'zustand'
import en from './en.json'
import es from './es.json'

export type Lang = 'es' | 'en'
export type TVars = Record<string, string | number>
export type TFunction = (key: string, vars?: TVars) => string

const DICTS: Record<Lang, unknown> = { es, en }
const STORAGE_KEY = 'terraanaloga.lang'

function readStoredLang(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'en' || v === 'es' ? v : 'es'
  } catch {
    return 'es'
  }
}

interface LangState {
  lang: Lang
  setLang: (lang: Lang) => void
}

export const useLang = create<LangState>((set) => ({
  lang: typeof window === 'undefined' ? 'es' : readStoredLang(),
  setLang: (lang) => {
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      // Sin almacenamiento (modo privado, etc.): el idioma solo dura esta sesión.
    }
    set({ lang })
  },
}))

function lookup(dict: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object' && part in node) return (node as Record<string, unknown>)[part]
    return undefined
  }, dict)
}

/** Busca la clave en el idioma pedido, luego en español; si no existe devuelve la clave. */
export function translate(lang: Lang, key: string, vars?: TVars): string {
  let value = lookup(DICTS[lang], key)
  if (typeof value !== 'string') value = lookup(DICTS.es, key)
  if (typeof value !== 'string') return key
  if (!vars) return value
  return value.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match))
}

export function useT(): TFunction {
  const lang = useLang((s) => s.lang)
  return useCallback((key: string, vars?: TVars) => translate(lang, key, vars), [lang])
}

/** Mantiene <html lang> sincronizado con el idioma elegido. */
export function useDocumentLang(): void {
  const lang = useLang((s) => s.lang)
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])
}

/** Todas las claves hoja de un diccionario (se usa en la prueba de paridad ES/EN). */
export function leafKeys(node: unknown, prefix = ''): string[] {
  if (!node || typeof node !== 'object') return [prefix]
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
    leafKeys(v, prefix ? `${prefix}.${k}` : k),
  )
}
