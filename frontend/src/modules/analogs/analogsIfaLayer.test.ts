import { describe, expect, it } from 'vitest'
import {
  GRID_LAYER_ID,
  IFA_FILL_OPACITY,
  IFA_IDW_POWER,
  IFA_VALUE_TO_COLOR,
  buildGridCellIndex,
  findGridCellAt,
  gridToIdwPoints,
  nearestIdwPoint,
  polygonCentroid,
} from './analogsIfaLayer'

const W = { relieve: 0.25, iluminacion: 0.2, frio: 0.2, hielo: 0.2, polvo: 0.15 }

function square(lon: number, lat: number, d = 0.1, stepKm = 15): GeoJSON.Feature {
  return {
    type: 'Feature',
    properties: {
      step_km: stepKm,
      relief: 0.5,
      illum: 0.5,
      cold: 0.5,
      ice: 0.5,
      dust: 0.5,
      missing: 0,
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [lon, lat],
          [lon + d, lat],
          [lon + d, lat + d],
          [lon, lat + d],
          [lon, lat],
        ],
      ],
    },
  }
}

describe('analogsIfaLayer IDW continuo', () => {
  it('polygonCentroid devuelve el centro del anillo', () => {
    const c = polygonCentroid(square(-10, 20, 2).geometry)
    expect(c).not.toBeNull()
    expect(c!.lon).toBeCloseTo(-9, 5)
    expect(c!.lat).toBeCloseTo(21, 5)
  })

  it('gridToIdwPoints incluye celdas oceánicas (sin máscara de tierra)', () => {
    const ocean = square(-40, 20, 0.4, 60)
    const land = square(-68, 76)
    const fc: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [ocean, land] }
    const pts = gridToIdwPoints(fc, W, 'global')
    expect(pts).toHaveLength(2)
  })

  it('nearestIdwPoint elige el más cercano dentro del radio', () => {
    const pts = [
      { lat: 0, lon: 0, val: 0.2 },
      { lat: 1, lon: 1, val: 0.9 },
    ]
    expect(nearestIdwPoint(pts, 0.1, 0.1)?.val).toBe(0.2)
    expect(nearestIdwPoint(pts, 50, 50, 1)).toBeNull()
  })

  it('config escáner: plasma + opacity 0.65 + p suave', () => {
    expect(IFA_VALUE_TO_COLOR).toContain('vec3 valueToColor')
    expect(IFA_VALUE_TO_COLOR).toContain('0.050980')
    expect(IFA_FILL_OPACITY).toBe(0.65)
    expect(IFA_IDW_POWER).toBe(3)
    expect(GRID_LAYER_ID).toBe('grid-ifa-idw')
  })

  it('findGridCellAt: hit-test de celda para el inspector', () => {
    const fc: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [square(-68, 76, 0.5)],
    }
    const index = buildGridCellIndex(fc)
    expect(findGridCellAt(index, -67.8, 76.2)?.relief).toBe(0.5)
    expect(findGridCellAt(index, -30, 40)).toBeNull()
  })

  it('bins: la media (no el máximo) cuando hay más puntos que el tope', () => {
    const feats: GeoJSON.Feature[] = []
    for (let i = 0; i < 1300; i++) {
      const f = square(0.001 * (i % 100), 0.001 * Math.floor(i / 100), 0.0005)
      const v = i % 2 === 0 ? 0 : 1
      f.properties = { ...f.properties, relief: v, illum: v, cold: v, ice: v, dust: v }
      feats.push(f)
    }
    const pts = gridToIdwPoints({ type: 'FeatureCollection', features: feats }, W, 'global')
    expect(pts.length).toBeLessThanOrEqual(1200)
    expect(pts).toHaveLength(1)
    expect(pts[0].val).toBeCloseTo(0.5, 5)
  })
})
