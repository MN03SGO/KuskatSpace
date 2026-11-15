import { describe, expect, it } from 'vitest'
import { buildProcessUrl, buildSearchUrl, exportGeotiffUrl, normalizeSearchResponse } from './explorer'

const BASE = 'http://api.test'

describe('URLs de la API de back-AR', () => {
  it('la búsqueda envía start_date y end_date (B6)', () => {
    const url = new URL(
      buildSearchUrl(
        {
          bbox: [-90.1, 13.1, -87.6, 14.5],
          body: 'earth',
          variable: 'all',
          startDate: '2026-10-15',
          endDate: '2026-11-14',
        },
        BASE,
      ),
    )
    expect(url.pathname).toBe('/api/search')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      bbox: '-90.1,13.1,-87.6,14.5',
      body: 'earth',
      variable: 'all',
      start_date: '2026-10-15',
      end_date: '2026-11-14',
      limit: '5',
    })
  })

  it('el procesamiento incluye sample_name solo si se indica', () => {
    const plain = new URL(buildProcessUrl({ mode: 'ndwi', bbox: [0, 0, 1, 1] }, BASE))
    expect(plain.searchParams.has('sample_name')).toBe(false)
    const withSample = new URL(buildProcessUrl({ mode: 'ndvi', bbox: [0, 0, 1, 1], sampleName: 'x.tif' }, BASE))
    expect(withSample.searchParams.get('sample_name')).toBe('x.tif')
  })

  it('la descarga usa el bbox y el modo de la petición procesada (B3)', () => {
    const url = new URL(exportGeotiffUrl({ mode: 'sar_db', bbox: [-30, -89.5, 30, -80] }, BASE))
    expect(url.pathname).toBe('/api/export/geotiff')
    expect(url.searchParams.get('mode')).toBe('sar_db')
    expect(url.searchParams.get('bbox')).toBe('-30,-89.5,30,-80')
  })
})

describe('normalizeSearchResponse', () => {
  it('rellena con listas vacías lo que falte', () => {
    expect(normalizeSearchResponse({ partner_resources: [] })).toEqual({
      live_earthdata: [],
      live_copernicus: [],
      live_pds_planetary: [],
      partner_resources: [],
    })
    expect(normalizeSearchResponse(null).live_earthdata).toEqual([])
  })
})
