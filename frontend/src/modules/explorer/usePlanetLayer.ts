import { useEffect, useMemo, useState } from 'react'
import {
  EARTH_LAYERS,
  type LegendSpec,
  MODEL_STOPS,
  type PlanetLayerId,
  isLayerAvailable,
  layerDate,
} from '../../config/planetLayers'
import { MODEL_RANGE, type SubsolarPoint, subsolarPoint } from '../../lib/thermalModel'
import { useExplorerStore } from '../../store/useExplorerStore'
import type { BodyId } from '../../types/explorer'

export type ActivePlanetLayer =
  | {
      kind: 'gibs'
      id: PlanetLayerId
      body: 'earth'
      gibsId: string
      date: string
      /** Fecha elegida por la persona; distinta de `date` si se recortó (N3 de la auditoría). */
      requestedDate: string
      legend: LegendSpec
      hasSwathGaps: boolean
      key: string
    }
  | {
      kind: 'model'
      id: 'temperature'
      body: 'moon' | 'mars'
      time: Date
      subsolar: SubsolarPoint
      legend: LegendSpec
      key: string
    }

/** Hora actual redondeada al minuto; se actualiza sola cada minuto. */
function useMinuteClock(enabled: boolean): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 60000) * 60000)
  useEffect(() => {
    if (!enabled) return
    const tick = () => setNow(Math.floor(Date.now() / 60000) * 60000)
    tick()
    const id = window.setInterval(tick, 30000)
    return () => window.clearInterval(id)
  }, [enabled])
  return now
}

export function resolvePlanetLayer(
  body: BodyId,
  layer: PlanetLayerId | null,
  gibsDate: string,
  nowMs: number,
): ActivePlanetLayer | null {
  if (!layer || !isLayerAvailable(body, layer)) return null
  if (body === 'earth') {
    const def = EARTH_LAYERS[layer]
    const date = layerDate(gibsDate, def.lagDays)
    return {
      kind: 'gibs',
      id: layer,
      body,
      gibsId: def.gibsId,
      date,
      requestedDate: gibsDate,
      legend: def.legend,
      hasSwathGaps: def.hasSwathGaps,
      key: `${def.gibsId}:${date}`,
    }
  }
  const time = new Date(nowMs)
  const { min, max } = MODEL_RANGE[body]
  return {
    kind: 'model',
    id: 'temperature',
    body,
    time,
    subsolar: subsolarPoint(body, time),
    legend: { stops: MODEL_STOPS, min, max, unit: 'K' },
    key: `model:${body}:${nowMs}`,
  }
}

/** Capa global activa para el cuerpo y el momento actuales (o null). */
export function useActivePlanetLayer(): ActivePlanetLayer | null {
  const body = useExplorerStore((s) => s.body)
  const layer = useExplorerStore((s) => s.planetLayer)
  const gibsDate = useExplorerStore((s) => s.gibsDate)
  const nowMs = useMinuteClock(layer !== null && body !== 'earth')
  return useMemo(() => resolvePlanetLayer(body, layer, gibsDate, nowMs), [body, layer, gibsDate, nowMs])
}
