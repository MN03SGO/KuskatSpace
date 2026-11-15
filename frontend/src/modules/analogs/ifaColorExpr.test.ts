import { describe, expect, it } from 'vitest'
import {
  computeGridIFA,
  ifaColorExpr,
  MARS_ARID_WEIGHTS,
  MOON_PSR_WEIGHTS,
  normalizeWeights,
  type GridCellProps,
} from './ifaColorExpr'

describe('ifaColorExpr / computeGridIFA', () => {
  const samples: GridCellProps[] = [
    { relief: 0.2, illum: 0.8, cold: 0.9, ice: 0.7, dust: 0.1, valid: 1 },
    { relief: 0.5, illum: 0.1, cold: 0.3, ice: 0.05, dust: 0.85, valid: 1 },
    { relief: 0.0, illum: 0.0, cold: 0.0, ice: 0.0, dust: 0.0, valid: 1 },
  ]

  it('computeGridIFA matches normalized weighted sum for global / Z4 / Mars', () => {
    for (const weights of [
      { relieve: 0.25, iluminacion: 0.2, frio: 0.2, hielo: 0.2, polvo: 0.15 },
      MOON_PSR_WEIGHTS,
      MARS_ARID_WEIGHTS,
    ]) {
      const w = normalizeWeights(weights)
      for (const p of samples) {
        const js = computeGridIFA(p, weights, 'global')
        const manual =
          (p.relief || 0) * w.relieve +
          (p.illum || 0) * w.iluminacion +
          (p.cold || 0) * w.frio +
          (p.ice || 0) * w.hielo +
          (p.dust || 0) * w.polvo
        expect(js).toBeCloseTo(manual, 12)
      }
    }
  })

  it('ifaColorExpr returns interpolate expression with coalesce gets', () => {
    const expr = ifaColorExpr(MOON_PSR_WEIGHTS, 'moon_psr')
    expect(Array.isArray(expr)).toBe(true)
    const arr = expr as unknown[]
    expect(arr[0]).toBe('interpolate')
    const flat = JSON.stringify(expr)
    expect(flat).toContain('"coalesce"')
    expect(flat).toContain('"relief"')
    expect(flat).toContain('"illum"')
    expect(flat).toContain('"cold"')
    expect(flat).toContain('"ice"')
    expect(flat).toContain('"dust"')
  })
})
