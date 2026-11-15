import type { ProcessMode } from '../types/explorer'

export type Palette = 'radar' | 'ndvi' | 'precip' | 'thermal'

export interface ProcessModeConfig {
  id: ProcessMode
  palette: Palette
}

/** Orden de los botones de procesamiento (B7: incluye NDWI). */
export const PROCESS_MODES: ProcessModeConfig[] = [
  { id: 'sar_db', palette: 'radar' },
  { id: 'ndvi', palette: 'ndvi' },
  { id: 'ndwi', palette: 'precip' },
  { id: 'jaxa_precip', palette: 'precip' },
  { id: 'diviner_thermal', palette: 'thermal' },
]

export const PALETTE_BY_MODE: Record<ProcessMode, Palette> = Object.fromEntries(
  PROCESS_MODES.map((m) => [m.id, m.palette]),
) as Record<ProcessMode, Palette>

/**
 * Colores en 0, 25, 50, 75 y 100 % calculados con las mismas fórmulas que
 * render_colormap_png() en backend/processor.py, para que la leyenda coincida.
 */
export const PALETTE_STOPS: Record<Palette, string[]> = {
  radar: ['rgb(0,0,0)', 'rgb(64,64,64)', 'rgb(128,128,128)', 'rgb(191,191,191)', 'rgb(255,255,255)'],
  ndvi: ['rgb(230,0,0)', 'rgb(172,61,42)', 'rgb(115,122,60)', 'rgb(57,184,42)', 'rgb(0,245,0)'],
  precip: ['rgb(40,0,102)', 'rgb(30,57,140)', 'rgb(20,114,179)', 'rgb(10,171,217)', 'rgb(0,190,255)'],
  thermal: ['rgb(0,0,255)', 'rgb(102,0,191)', 'rgb(204,77,128)', 'rgb(255,179,64)', 'rgb(255,255,0)'],
}
