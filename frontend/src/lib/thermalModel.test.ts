import { describe, expect, it } from 'vitest'
import { cosIncidence, marsSubsolarPoint, modelTemperature, moonSubsolarPoint } from './thermalModel'

/** Diferencia angular mínima entre dos longitudes (°). */
const angDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180)

describe('moonSubsolarPoint', () => {
  it('luna llena (2024-01-25 17:54 UTC): el Sol está sobre la cara visible (lon ≈ 0°)', () => {
    expect(angDiff(moonSubsolarPoint(new Date('2024-01-25T17:54:00Z')).lon, 0)).toBeLessThan(10)
  })

  it('luna nueva (2024-01-11 11:57 UTC): el Sol está sobre la cara oculta (lon ≈ 180°)', () => {
    expect(angDiff(moonSubsolarPoint(new Date('2024-01-11T11:57:00Z')).lon, 180)).toBeLessThan(10)
  })

  it('cuarto creciente (2024-01-18 03:53 UTC): lon ≈ +90°', () => {
    expect(angDiff(moonSubsolarPoint(new Date('2024-01-18T03:53:00Z')).lon, 90)).toBeLessThan(12)
  })
})

describe('marsSubsolarPoint (Mars24)', () => {
  it('reproduce el ejemplo de Allison y McEwen (2000-01-06 00:00 UTC): Ls ≈ 277,19°', () => {
    const p = marsSubsolarPoint(new Date('2000-01-06T00:00:00Z'))
    expect(p.ls).toBeCloseTo(277.19, 1)
    expect(p.lat).toBeGreaterThan(-26)
    expect(p.lat).toBeLessThan(-24.5)
  })

  it('devuelve longitudes en [-180, 180)', () => {
    const p = marsSubsolarPoint(new Date('2026-11-14T12:00:00Z'))
    expect(p.lon).toBeGreaterThanOrEqual(-180)
    expect(p.lon).toBeLessThan(180)
  })
})

describe('modelTemperature', () => {
  const sun = { lat: 0, lon: 0 }

  it('cos(i) = 1 en el punto subsolar y negativo en el antisolar', () => {
    expect(cosIncidence(0, 0, sun)).toBeCloseTo(1, 9)
    expect(cosIncidence(0, 180, sun)).toBeCloseTo(-1, 9)
  })

  it('Luna: ≈ 390 K bajo el Sol, ≈ 95 K de noche en el ecuador y ≈ 40 K en el polo', () => {
    expect(modelTemperature('moon', 0, 0, sun)).toBeCloseTo(392, 0)
    expect(modelTemperature('moon', 0, 180, sun)).toBeCloseTo(95, 0)
    expect(modelTemperature('moon', -90, 0, sun)).toBeCloseTo(40, 0)
  })

  it('Marte: ≈ 290 K bajo el Sol y nunca por debajo de 150 K', () => {
    expect(modelTemperature('mars', 0, 0, sun)).toBeCloseTo(290, 0)
    expect(modelTemperature('mars', 89, 180, sun)).toBeGreaterThanOrEqual(150)
  })
})
