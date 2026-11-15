import type { ApiError } from '../api/http'
import { API_BASE } from '../config/env'
import type { TFunction } from '../i18n/useT'

export function apiErrorText(t: TFunction, error: ApiError): string {
  switch (error.kind) {
    case 'network':
      return t('errors.network', { api: API_BASE })
    case 'timeout':
      return t('errors.timeout')
    case 'parse':
      return t('errors.parse')
    case 'http':
      return t('errors.http', { status: error.status ?? '?', detail: error.detail ?? '' })
  }
}
