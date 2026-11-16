import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, requestJson } from './http'

function mockFetch(impl: (url: string, init?: RequestInit) => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(impl))
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('requestJson', () => {
  it('devuelve el JSON cuando la respuesta es correcta', async () => {
    mockFetch(
      async () =>
        new Response(JSON.stringify({ a: 1 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    )
    await expect(requestJson('/x')).resolves.toEqual({ a: 1 })
  })

  it('convierte un 500 de FastAPI en ApiError http con el detail (B1)', async () => {
    mockFetch(
      async () =>
        new Response(JSON.stringify({ detail: 'Modo no soportado' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        }),
    )
    const err = await requestJson('/x').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ kind: 'http', status: 500, detail: 'Modo no soportado' })
  })

  it('marca como parse una respuesta 200 que no es JSON', async () => {
    mockFetch(
      async () =>
        new Response('<html>spa</html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
    )
    const err = await requestJson('/x').catch((e: unknown) => e)
    expect(err).toMatchObject({
      kind: 'parse',
      status: 200,
      url: '/x',
      bodySnippet: expect.stringContaining('<html>'),
    })
  })

  it('parsea JSON cuando content-type es application/json', async () => {
    mockFetch(
      async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    )
    await expect(requestJson('/x')).resolves.toEqual({ ok: true })
  })

  it('marca como network un fallo de conexión', async () => {
    mockFetch(async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(requestJson('/x')).rejects.toMatchObject({ kind: 'network' })
  })

  it('marca como timeout cuando se supera el tiempo', async () => {
    vi.useFakeTimers()
    mockFetch(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        }),
    )
    const pending = requestJson('/x', { timeoutMs: 50 }).catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(60)
    expect(await pending).toMatchObject({ kind: 'timeout' })
  })
})
