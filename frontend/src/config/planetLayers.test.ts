import { describe, expect, it } from 'vitest'
import { gibsEquirectTileUrl, gibsMercatorTemplate, isLayerAvailable, layerDate } from './planetLayers'

describe('planetLayers', () => {
  it('solo la temperatura existe en la Luna y Marte', () => {
    expect(isLayerAvailable('earth', 'humidity')).toBe(true)
    expect(isLayerAvailable('moon', 'temperature')).toBe(true)
    expect(isLayerAvailable('moon', 'precipitation')).toBe(false)
    expect(isLayerAvailable('mars', 'humidity')).toBe(false)
  })

  it('recorta la fecha a la más reciente publicada', () => {
    const today = new Date('2026-11-14T12:00:00Z')
    expect(layerDate('2026-11-13', 7, today)).toBe('2026-11-07')
    expect(layerDate('2026-10-01', 7, today)).toBe('2026-10-01')
  })

  it('arma las URL de GIBS', () => {
    expect(gibsEquirectTileUrl('IMERG_Precipitation_Rate', '2026-11-12', 1, 4)).toBe(
      'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/IMERG_Precipitation_Rate/default/2026-11-12/2km/2/1/4.png',
    )
    expect(gibsMercatorTemplate('X', '2026-11-12')).toContain('/X/default/2026-11-12/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png')
    expect(gibsMercatorTemplate('MODIS_Terra_L3_Land_Surface_Temp_8Day_Day', '2026-10-16', 7)).toContain(
      '/MODIS_Terra_L3_Land_Surface_Temp_8Day_Day/default/2026-10-16/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png',
    )
  })
})
