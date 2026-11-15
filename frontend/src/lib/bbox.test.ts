import { describe, expect, it } from 'vitest'
import { bboxAroundPoint, formatBBox, leafletBoundsToMaplibreCorners, parseBBox, toLeafletBounds } from './bbox'

describe('parseBBox', () => {
  it('acepta 4 números con espacios', () => {
    expect(parseBBox(' -90.1, 13.1 ,-87.6,14.5 ')).toEqual({ ok: true, bbox: [-90.1, 13.1, -87.6, 14.5] })
  })

  it.each([
    ['', 'format'],
    ['1,2,3', 'format'],
    ['a,2,3,4', 'format'],
    ['1,2,,4', 'format'],
    ['-190,0,10,10', 'range'],
    ['0,-95,10,10', 'range'],
    ['10,0,5,10', 'order'],
    ['0,10,10,10', 'order'],
  ])('rechaza %j con error %s', (text, error) => {
    expect(parseBBox(text)).toEqual({ ok: false, error })
  })
})

describe('bboxAroundPoint', () => {
  it('crea ±1.5° × ±1° alrededor del punto', () => {
    expect(bboxAroundPoint(-88.9, 13.8)).toEqual([-90.4, 12.8, -87.4, 14.8])
  })

  it('se desplaza para no salir del mundo ni de la latitud máxima', () => {
    expect(bboxAroundPoint(179.5, 84.9, { maxLat: 85 })).toEqual([177, 83, 180, 85])
    expect(bboxAroundPoint(-180, -90)).toEqual([-180, -90, -177, -88])
  })
})

describe('conversiones de bounds', () => {
  it('pasa de bbox a Leaflet (lat primero)', () => {
    expect(toLeafletBounds([-90.1, 13.1, -87.6, 14.5])).toEqual([
      [13.1, -90.1],
      [14.5, -87.6],
    ])
  })

  it('pasa de bounds de Leaflet a las 4 esquinas [lon,lat] de MapLibre', () => {
    expect(
      leafletBoundsToMaplibreCorners([
        [13.1, -90.1],
        [14.5, -87.6],
      ]),
    ).toEqual([
      [-90.1, 14.5],
      [-87.6, 14.5],
      [-87.6, 13.1],
      [-90.1, 13.1],
    ])
  })

  it('formatea con los decimales pedidos', () => {
    expect(formatBBox([-90.123456, 13.1, -87.6, 14.5], 2)).toBe('-90.12,13.1,-87.6,14.5')
  })
})
