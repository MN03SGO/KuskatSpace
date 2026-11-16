import type { ProcessMode } from '../types/explorer'

export type Palette = 'radar' | 'ndvi' | 'precip' | 'thermal' | 'inferno'

export interface ProcessModeConfig {
  id: ProcessMode
  palette: Palette
}

/** Orden de los botones de procesamiento (B7: incluye NDWI). */
export const PROCESS_MODES: ProcessModeConfig[] = [
  { id: 'sar_db', palette: 'radar' },
  { id: 'ndvi', palette: 'ndvi' },
  { id: 'ndwi', palette: 'precip' },
  { id: 'hls_thermal', palette: 'inferno' },
  { id: 'jaxa_precip', palette: 'precip' },
  { id: 'diviner_thermal', palette: 'thermal' },
]

/** Modos que aún no tienen fuente real: siempre demostración. */
export const DEMO_PROCESS_MODES = new Set<ProcessMode>(['sar_db', 'jaxa_precip', 'diviner_thermal'])

/** Modos que solo existen con datos reales (nunca caen a simulación). */
export const REAL_ONLY_PROCESS_MODES = new Set<ProcessMode>(['hls_thermal'])

/** El perfil térmico simulado solo se ofrece en modo Demostración. */
export const HIDDEN_IN_REAL_MODE = new Set<ProcessMode>(['diviner_thermal'])

/** ¿Es un granule HLS L30 (Landsat, con bandas térmicas TIRS)? */
export function isHlsL30(sceneId?: string | null, collection?: string | null): boolean {
  return collection === 'HLSL30' || /^HLS\.L30\./i.test(sceneId ?? '')
}

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
  // matplotlib "inferno" en 0/25/50/75/100 % (mismos stops que INFERNO_STOPS en backend/real_optical.py)
  inferno: ['rgb(0,0,4)', 'rgb(87,16,110)', 'rgb(188,55,84)', 'rgb(249,142,9)', 'rgb(252,255,164)'],
}
