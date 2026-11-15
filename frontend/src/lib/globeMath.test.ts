import { describe, expect, it } from 'vitest'
import { bboxCenter, lonLatToPixel, lonLatToXYZ, xyzToLonLat } from './globeMath'

describe('globeMath', () => {
  it('ubica lon 0 en +X, lon -90 en +Z y el polo norte en +Y', () => {
    const close = (v: number[], e: number[]) => v.forEach((x, i) => expect(x).toBeCloseTo(e[i], 9))
    close(lonLatToXYZ(0, 0), [1, 0, 0])
    close(lonLatToXYZ(-90, 0), [0, 0, 1])
    close(lonLatToXYZ(90, 0), [0, 0, -1])
    close(lonLatToXYZ(0, 90), [0, 1, 0])
  })

  it.each([
    [-88.9, 13.8],
    [0, -84.75],
    [137.5, -4.5],
    [-179.9, 10],
    [179.9, -45],
  ])('ida y vuelta lon %d, lat %d', (lon, lat) => {
    const [x, y, z] = lonLatToXYZ(lon, lat, 2)
    const back = xyzToLonLat(x, y, z)
    expect(back.lon).toBeCloseTo(lon, 6)
    expect(back.lat).toBeCloseTo(lat, 6)
  })

  it('calcula el centro de un bbox', () => {
    expect(bboxCenter([-30, -89.5, 30, -80])).toEqual({ lon: 0, lat: -84.75 })
  })

  it('convierte lon/lat a píxel equirectangular', () => {
    expect(lonLatToPixel(-180, 90, 4096, 2048)).toEqual([0, 0])
    expect(lonLatToPixel(0, 0, 4096, 2048)).toEqual([2048, 1024])
    expect(lonLatToPixel(180, -90, 4096, 2048)).toEqual([4096, 2048])
  })
})
