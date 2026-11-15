export type ApiErrorKind = 'network' | 'timeout' | 'http' | 'parse'

/** Error de API con un tipo estable, para que la UI muestre un texto traducido. */
export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status?: number
  readonly detail?: string

  constructor(kind: ApiErrorKind, opts: { status?: number; detail?: string } = {}) {
    super(opts.detail ? `${kind}: ${opts.detail}` : kind)
    this.name = 'ApiError'
    this.kind = kind
    this.status = opts.status
    this.detail = opts.detail
  }
}

export interface RequestOptions extends Omit<RequestInit, 'signal'> {
  timeoutMs?: number
}

function readDetail(data: unknown): string | undefined {
  if (data && typeof data === 'object' && 'detail' in data) {
    const detail = (data as { detail: unknown }).detail
    return typeof detail === 'string' ? detail : JSON.stringify(detail)
  }
  return undefined
}

/**
 * fetch + JSON con timeout. Siempre valida `res.ok` (B1) y convierte
 * cualquier fallo en un ApiError.
 */
export async function requestJson<T>(url: string, { timeoutMs = 20000, ...init }: RequestOptions = {}): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let res: Response
  try {
    res = await fetch(url, { ...init, signal: controller.signal })
  } catch (err) {
    clearTimeout(timer)
    if (controller.signal.aborted) throw new ApiError('timeout')
    throw new ApiError('network', { detail: err instanceof Error ? err.message : String(err) })
  }

  let text: string
  try {
    text = await res.text()
  } catch {
    throw new ApiError(controller.signal.aborted ? 'timeout' : 'network', { status: res.status })
  } finally {
    clearTimeout(timer)
  }

  let data: unknown = undefined
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = undefined
    }
  }

  if (!res.ok) {
    throw new ApiError('http', { status: res.status, detail: readDetail(data) ?? res.statusText })
  }
  if (data === undefined) {
    throw new ApiError('parse', { status: res.status })
  }
  return data as T
}
