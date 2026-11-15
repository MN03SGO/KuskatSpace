import { API_BASE } from '../config/env'
import { formatBBox } from '../lib/bbox'
import type { ProcessParams, ProcessResponse, SearchParams, SearchResponse } from '../types/explorer'
import { requestJson } from './http'

function bboxParam(bbox: SearchParams['bbox']): string {
  return formatBBox(bbox, 4)
}

/** La API siempre debería devolver las 4 listas; si falta alguna, se rellena con [] para no romper la UI. */
export function normalizeSearchResponse(data: Partial<SearchResponse> | null | undefined): SearchResponse {
  const list = <T>(v: T[] | undefined): T[] => (Array.isArray(v) ? v : [])
  return {
    live_earthdata: list(data?.live_earthdata),
    live_copernicus: list(data?.live_copernicus),
    live_pds_planetary: list(data?.live_pds_planetary),
    partner_resources: list(data?.partner_resources),
  }
}

export function buildSearchUrl(p: SearchParams, base = API_BASE): string {
  const qs = new URLSearchParams({
    bbox: bboxParam(p.bbox),
    body: p.body,
    variable: p.variable,
    start_date: p.startDate,
    end_date: p.endDate,
    limit: String(p.limit ?? 5),
  })
  return `${base}/api/search?${qs.toString()}`
}

export function buildProcessUrl(p: ProcessParams, base = API_BASE): string {
  const qs = new URLSearchParams({ mode: p.mode, bbox: bboxParam(p.bbox) })
  if (p.sampleName) qs.set('sample_name', p.sampleName)
  return `${base}/api/process?${qs.toString()}`
}

/** El backend todavía ignora sample_name en la exportación (B11). */
export function exportGeotiffUrl(p: ProcessParams, base = API_BASE): string {
  const qs = new URLSearchParams({ mode: p.mode, bbox: bboxParam(p.bbox) })
  return `${base}/api/export/geotiff?${qs.toString()}`
}

export async function searchCatalogs(p: SearchParams): Promise<SearchResponse> {
  // El backend consulta servicios externos; dejamos margen para evitar timeouts falsos.
  const data = await requestJson<Partial<SearchResponse>>(buildSearchUrl(p), { timeoutMs: 45000 })
  return normalizeSearchResponse(data)
}

export function processScene(p: ProcessParams): Promise<ProcessResponse> {
  return requestJson<ProcessResponse>(buildProcessUrl(p), { method: 'POST', timeoutMs: 45000 })
}
