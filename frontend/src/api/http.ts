export type ApiErrorKind = 'network' | 'timeout' | 'http' | 'parse'

/** Error de API con un tipo estable, para que la UI muestre un texto traducido. */
export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status?: number
  readonly detail?: string
  /** Código estable del backend (p. ej. scene_not_found_in_cog_catalog). */
  readonly code?: string
  /** URL pedida (solo para logs de desarrollo; no se muestra al usuario). */
  readonly url?: string
  /** Fragmento del cuerpo no-JSON (solo logs). */
  readonly bodySnippet?: string

  constructor(
    kind: ApiErrorKind,
    opts: { status?: number; detail?: string; code?: string; url?: string; bodySnippet?: string } = {},
  ) {
    super(opts.detail ? `${kind}: ${opts.detail}` : kind)
    this.name = 'ApiError'
    this.kind = kind
    this.status = opts.status
    this.detail = opts.detail
    this.code = opts.code
    this.url = opts.url
    this.bodySnippet = opts.bodySnippet
  }
}

export interface RequestOptions extends Omit<RequestInit, 'signal'> {
  timeoutMs?: number
}

function readDetail(data: unknown): string | undefined {
  if (!data || typeof data !== 'object' || !('detail' in data)) return undefined
  const detail = (data as { detail: unknown }).detail
  if (typeof detail === 'string') return detail
  if (detail && typeof detail === 'object') {
    const obj = detail as { message?: unknown; code?: unknown }
    if (typeof obj.message === 'string') {
      return typeof obj.code === 'string' ? `${obj.code}: ${obj.message}` : obj.message
    }
  }
  try {
    return JSON.stringify(detail)
  } catch {
    return undefined
  }
}

/** Extrae code de respuestas FastAPI `{detail:{code,message}}`. */
export function readErrorCode(data: unknown): string | undefined {
  if (!data || typeof data !== 'object' || !('detail' in data)) return undefined
  const detail = (data as { detail: unknown }).detail
  if (detail && typeof detail === 'object' && 'code' in (detail as object)) {
    const code = (detail as { code: unknown }).code
    return typeof code === 'string' ? code : undefined
  }
  return undefined
}

function isJsonContentType(res: Response): boolean {
  const ct = res.headers.get('content-type') ?? ''
  return ct.includes('application/json') || ct.includes('+json')
}

function snippet(text: string, max = 200): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max)}…`
}

function logDevParseFailure(err: ApiError): void {
  if (!import.meta.env.DEV) return
  console.error('[API] respuesta inválida', {
    status: err.status,
    url: err.url,
    detail: err.detail,
    bodySnippet: err.bodySnippet,
  })
}

/**
 * fetch + JSON con timeout. Valida `res.ok` y content-type antes de parsear.
 * Fallos → ApiError (network | timeout | http | parse).
 */
export async function requestJson<T>(url: string, { timeoutMs = 45000, ...init }: RequestOptions = {}): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let res: Response
  try {
    res = await fetch(url, { ...init, signal: controller.signal })
  } catch (err) {
    clearTimeout(timer)
    if (controller.signal.aborted) throw new ApiError('timeout', { url })
    throw new ApiError('network', {
      url,
      detail: err instanceof Error ? err.message : String(err),
    })
  }

  let text: string
  try {
    text = await res.text()
  } catch {
    clearTimeout(timer)
    throw new ApiError(controller.signal.aborted ? 'timeout' : 'network', {
      status: res.status,
      url,
    })
  } finally {
    clearTimeout(timer)
  }

  const bodySnippet = text ? snippet(text) : ''

  if (!res.ok) {
    let data: unknown
    if (text && isJsonContentType(res)) {
      try {
        data = JSON.parse(text)
      } catch {
        data = undefined
      }
    }
    throw new ApiError('http', {
      status: res.status,
      url,
      code: readErrorCode(data),
      detail: readDetail(data) ?? (bodySnippet || res.statusText),
      bodySnippet: bodySnippet || undefined,
    })
  }

  if (!text) {
    const err = new ApiError('parse', {
      status: res.status,
      url,
      detail: `HTTP ${res.status} cuerpo vacío`,
    })
    logDevParseFailure(err)
    throw err
  }

  if (!isJsonContentType(res)) {
    const err = new ApiError('parse', {
      status: res.status,
      url,
      detail: `HTTP ${res.status} content-type no JSON (${res.headers.get('content-type') ?? 'ausente'})`,
      bodySnippet,
    })
    logDevParseFailure(err)
    throw err
  }

  try {
    return JSON.parse(text) as T
  } catch {
    const err = new ApiError('parse', {
      status: res.status,
      url,
      detail: `HTTP ${res.status} JSON inválido`,
      bodySnippet,
    })
    logDevParseFailure(err)
    throw err
  }
}
