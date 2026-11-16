import type { ApiError } from '../api/http'
import type { TFunction } from '../i18n/useT'

/** Mensaje claro para la UI (sin rutas internas ni trazas). */
export function apiErrorText(t: TFunction, error: ApiError): string {
  if (error.code === 'scene_not_found_in_cog_catalog') {
    return t('errors.sceneNotFoundCog')
  }
  if (error.code === 'earthdata_auth_required') {
    return t('errors.earthdataAuth')
  }
  if (error.code === 'no_valid_pixels') {
    return t('errors.noValidPixels')
  }
  if (error.code === 'thermal_requires_l30') {
    return t('errors.thermalRequiresL30')
  }
  if (
    error.code === 'thermal_band_unavailable' ||
    error.code === 'thermal_no_data_in_bbox' ||
    error.code === 'qa_band_unavailable'
  ) {
    return t('errors.thermalUnavailable')
  }
  if (error.code === 'thermal_real_only') {
    return t('errors.thermalRealOnly')
  }
  switch (error.kind) {
    case 'network':
      return t('errors.network')
    case 'timeout':
      return t('errors.timeout')
    case 'parse':
      return t('errors.parse')
    case 'http': {
      // Mensajes 4xx del backend ya son legibles; quitar prefijo "code: "
      if (error.detail && error.status && error.status < 500) {
        const cleaned = error.detail.replace(/^[a-z0-9_]+:\s*/i, '')
        return cleaned
      }
      return t('errors.http', { status: error.status ?? '?' })
    }
  }
}
