import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Map as MapLibreMap,
  NavigationControl,
  Popup,
  type GeoJSONSource,
  type MapLayerMouseEvent,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { focusRing } from '../../components/ui'
import { API_BASE } from '../../config/env'
import { useLang } from '../../i18n/useT'
import { ensureMaplibreWorker } from '../../lib/maplibreSetup'
import { useExplorerStore } from '../../store/useExplorerStore'
import {
  assertGridIfaParity,
  computeGridIFA,
  ifaColorExpr,
  MARS_ARID_WEIGHTS,
  MOON_PSR_WEIGHTS,
  type GridCellProps,
  type IfaMode,
  type IfaWeights,
} from './ifaColorExpr'

ensureMaplibreWorker()

/** Carto Dark Matter (vector) — sin API key; fondo oscuro espacial para resaltar la grilla IFA. */
const CARTO_DARK_MATTER_STYLE =
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

/** NO usar ±90°: en Web Mercator lat=90 → y=Infinity y el mapa crashea. */
const MERCATOR_MAX_LAT = 85.05112878

const GRID_SOURCE_ID = 'grid'
const GRID_LAYER_ID = 'grid-fill'
const GRID_GEOJSON_URL = '/data/grid.geojson'

const POINTS_SOURCE_ID = 'candidates-geojson'
const POINTS_LAYER_ID = 'candidates-circles'

type HeatmapLayer = 'combined' | 'moon_south_pole' | 'mars_surface'

function layerToMode(layer: HeatmapLayer): IfaMode {
  if (layer === 'moon_south_pole') return 'moon_psr'
  if (layer === 'mars_surface') return 'mars_arid'
  return 'global'
}

function modeDefaultWeights(mode: IfaMode, current: IfaWeights): IfaWeights {
  if (mode === 'moon_psr') return { ...MOON_PSR_WEIGHTS }
  if (mode === 'mars_arid') return { ...MARS_ARID_WEIGHTS }
  return current
}

function readGridProps(raw: Record<string, unknown> | null | undefined): GridCellProps | null {
  if (!raw) return null
  const num = (k: string): number => {
    const v = raw[k]
    return typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0
  }
  return {
    relief: num('relief'),
    illum: num('illum'),
    cold: num('cold'),
    ice: num('ice'),
    dust: num('dust'),
    valid: num('valid'),
  }
}

/** Source + capa fill de grilla (antes de candidates-circles). */
function ensureGridLayer(map: MapLibreMap, weights: IfaWeights, mode: IfaMode) {
  if (!map.getSource(GRID_SOURCE_ID)) {
    map.addSource(GRID_SOURCE_ID, {
      type: 'geojson',
      data: GRID_GEOJSON_URL,
    })
  }

  const colorExpr = ifaColorExpr(weights, mode)
  if (!map.getLayer(GRID_LAYER_ID)) {
    const beforeId = map.getLayer(POINTS_LAYER_ID) ? POINTS_LAYER_ID : undefined
    map.addLayer(
      {
        id: GRID_LAYER_ID,
        type: 'fill',
        source: GRID_SOURCE_ID,
        paint: {
          'fill-color': colorExpr as never,
          'fill-opacity': 0.8,
          'fill-outline-color': 'rgba(0,0,0,0)',
        },
      },
      beforeId,
    )
  } else {
    map.setPaintProperty(GRID_LAYER_ID, 'fill-color', colorExpr as never)
  }

  if (map.getLayer(POINTS_LAYER_ID) && map.getLayer(GRID_LAYER_ID)) {
    map.moveLayer(GRID_LAYER_ID, POINTS_LAYER_ID)
  }
}

type RankedPoint = {
  id: string
  name: string
  lon: number
  lat: number
  ifa: number
  rank: number
  selected: 0 | 1
  hasOrbital: 0 | 1
}

function toPointsGeoJSON(points: RankedPoint[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: points.map((p) => ({
      type: 'Feature',
      properties: {
        id: p.id,
        name: p.name,
        ifa: p.ifa,
        rank: p.rank,
        selected: p.selected,
        has_orbital: p.hasOrbital,
      },
      geometry: {
        type: 'Point',
        coordinates: [p.lon, p.lat],
      },
    })),
  }
}

/** Capa circle GPU (GeoJSON) — mucho más rápida que Marker HTML. */
function upsertCandidatesCircles(map: MapLibreMap, points: RankedPoint[]) {
  const data = toPointsGeoJSON(points)
  const existing = map.getSource(POINTS_SOURCE_ID) as GeoJSONSource | undefined

  if (existing) {
    existing.setData(data)
  } else {
    map.addSource(POINTS_SOURCE_ID, {
      type: 'geojson',
      data,
      // Reduce trabajo en pan/zoom
      cluster: false,
    })

    map.addLayer({
      id: POINTS_LAYER_ID,
      type: 'circle',
      source: POINTS_SOURCE_ID,
      paint: {
        'circle-radius': [
          'case',
          ['==', ['get', 'selected'], 1],
          9,
          ['<=', ['get', 'rank'], 3],
          7,
          5.5,
        ],
        'circle-color': [
          'case',
          ['==', ['get', 'selected'], 1],
          '#38bdf8',
          ['==', ['get', 'has_orbital'], 1],
          '#34d399',
          '#7dd3fc',
        ],
        'circle-stroke-width': ['case', ['==', ['get', 'selected'], 1], 2.5, 1],
        'circle-stroke-color': '#f8fafc',
        'circle-opacity': 0.95,
      },
    })
  }

  // Orden: basemap < grid-fill < círculos
  if (map.getLayer(GRID_LAYER_ID) && map.getLayer(POINTS_LAYER_ID)) {
    map.moveLayer(GRID_LAYER_ID, POINTS_LAYER_ID)
  } else if (map.getLayer(POINTS_LAYER_ID)) {
    map.moveLayer(POINTS_LAYER_ID)
  }
}

interface CandidateScores {
  relieve: number
  iluminacion: number
  frio: number
  hielo: number
  polvo?: number
}

interface OrbitalPreviews {
  site_id: string
  sentinel2_rgb_url: string
  sentinel1_sar_url: string
  sar_sensor: string
  sar_stats_db?: { min?: number; mean?: number; max?: number }
}

interface CellMetrics {
  cell_id: string
  lat: number | null
  lon: number | null
  elev_m: number | null
  slope_mean_deg: number | null
  slope_p90_deg: number | null
  relief_local_m: number | null
  shadow_frac_max: number | null
  lst_mean_k: number | null
  lst_min_k: number | null
  lst_max_k: number | null
  lst_amp_k: number | null
  snow_persist: number | null
  aod_mean: number | null
  aod_p90: number | null
  ndvi_mean: number | null
  ndvi_max: number | null
  qc_flag: number
}

interface CandidateDoc {
  _id: string
  name: string
  country?: string
  target: string
  region_type?: string
  is_understudied?: boolean
  analog_category?: string[]
  location: { type: string; coordinates: [number, number] }
  scores?: CandidateScores | null
  similar_properties?: string[]
  similar_processes?: string[]
  differences_and_limits?: string[]
  exploration_use_cases?: string[]
  subsurface_and_biology?: {
    subsurface_potential?: string
    extremophiles_note?: string
  }
  datasets_used?: string[]
  orbital_previews?: OrbitalPreviews
  p1_cell_metrics?: CellMetrics
}

type TargetFilter = 'all' | 'moon_south_pole' | 'mars_surface' | 'lava_tubes'

interface Preset {
  id: string
  target: TargetFilter
  heatmap: HeatmapLayer
  labelEs: string
  labelEn: string
  weights: { relieve: number; iluminacion: number; frio: number; hielo: number; polvo: number }
}

const PRESETS: Preset[] = [
  {
    id: 'z1',
    target: 'moon_south_pole',
    heatmap: 'moon_south_pole',
    labelEs: 'Luna Z1 · Crestas iluminadas',
    labelEn: 'Moon Z1 · Illuminated ridges',
    weights: { relieve: 0.25, iluminacion: 0.45, frio: 0.1, hielo: 0.1, polvo: 0.1 },
  },
  {
    id: 'z2',
    target: 'moon_south_pole',
    heatmap: 'moon_south_pole',
    labelEs: 'Luna Z2 · Mesetas de alunizaje',
    labelEn: 'Moon Z2 · Landing plateaus',
    weights: { relieve: 0.5, iluminacion: 0.15, frio: 0.05, hielo: 0.1, polvo: 0.2 },
  },
  {
    id: 'z4',
    target: 'moon_south_pole',
    heatmap: 'moon_south_pole',
    labelEs: 'Luna Z4 · Trampas frías (PSR)',
    labelEn: 'Moon Z4 · Cold traps (PSR)',
    weights: { relieve: 0.1, iluminacion: 0.2, frio: 0.3, hielo: 0.4, polvo: 0.0 },
  },
  {
    id: 'mars',
    target: 'mars_surface',
    heatmap: 'mars_surface',
    labelEs: 'Marte · Llanuras áridas y hielo',
    labelEn: 'Mars · Arid plains & ice',
    weights: { relieve: 0.2, iluminacion: 0.05, frio: 0.2, hielo: 0.25, polvo: 0.3 },
  },
  {
    id: 'subsurface',
    target: 'lava_tubes',
    heatmap: 'combined',
    labelEs: 'Subsuelo · Tubos de lava',
    labelEn: 'Subsurface · Lava tubes',
    weights: { relieve: 0.45, iluminacion: 0.15, frio: 0.15, hielo: 0.05, polvo: 0.2 },
  },
]

function computeIFA(
  s: CandidateScores | null | undefined,
  w: { relieve: number; iluminacion: number; frio: number; hielo: number; polvo: number },
): number {
  // Fail-safe: docs NASA sin scores → 0 en cada dimensión (evita TypeError / pantalla negra)
  const relieve = s?.relieve || 0
  const iluminacion = s?.iluminacion || 0
  const frio = s?.frio || 0
  const hielo = s?.hielo || 0
  const polvoVal = s?.polvo || 0
  const sumW = w.relieve + w.iluminacion + w.frio + w.hielo + w.polvo
  if (sumW <= 0) return 0
  return (
    (relieve * w.relieve +
      iluminacion * w.iluminacion +
      frio * w.frio +
      hielo * w.hielo +
      polvoVal * w.polvo) /
    sumW
  )
}

export function AnalogsView({ onOpenExplorer }: { onOpenExplorer: () => void }) {
  const lang = useLang((s) => s.lang)
  const isEs = lang === 'es'

  const [candidates, setCandidates] = useState<CandidateDoc[]>([])
  const [sourceMode, setSourceMode] = useState<'api' | 'backup'>('backup')
  const [loading, setLoading] = useState(true)
  const [targetFilter, setTargetFilter] = useState<TargetFilter>('all')
  const [onlyDiscoveries, setOnlyDiscoveries] = useState(false)
  const [heatmapLayer, setHeatmapLayer] = useState<HeatmapLayer>('combined')
  const [weights, setWeights] = useState({
    relieve: 0.25,
    iluminacion: 0.2,
    frio: 0.2,
    hielo: 0.2,
    polvo: 0.15,
  })
  // Ranking/mapa solo se recalculan 150ms después de soltar el slider
  const [debouncedWeights, setDebouncedWeights] = useState(weights)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const heatmapLayerRef = useRef<HeatmapLayer>(heatmapLayer)
  const weightsRef = useRef(debouncedWeights)
  const pointsRef = useRef<RankedPoint[]>([])
  const popupRef = useRef<Popup | null>(null)
  heatmapLayerRef.current = heatmapLayer
  weightsRef.current = debouncedWeights

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedWeights(weights), 150)
    return () => window.clearTimeout(t)
  }, [weights])

  // Paridad IFA JS ↔ fórmula de la expresión MapLibre (2–3 celdas)
  useEffect(() => {
    assertGridIfaParity(debouncedWeights, layerToMode(heatmapLayer))
  }, [debouncedWeights, heatmapLayer])

  // Mapa base Carto Dark Matter; grilla GeoJSON + círculos en style.load
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = new MapLibreMap({
      container: mapContainerRef.current,
      style: CARTO_DARK_MATTER_STYLE,
      center: [-20, 15],
      zoom: 1.4,
      minZoom: 1,
      renderWorldCopies: false,
    })

    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    mapRef.current = map
    popupRef.current = new Popup({
      closeButton: true,
      closeOnClick: true,
      maxWidth: '260px',
      className: 'grid-ifa-popup',
    })

    const remountCustomLayers = () => {
      const mode = layerToMode(heatmapLayerRef.current)
      ensureGridLayer(map, weightsRef.current, mode)
      upsertCandidatesCircles(map, pointsRef.current)
    }

    const onPointClick = (e: MapLayerMouseEvent) => {
      const id = e.features?.[0]?.properties?.id as string | undefined
      if (id) setSelectedId(id)
    }

    const showGridPopup = (e: MapLayerMouseEvent) => {
      const feat = e.features?.[0]
      const props = readGridProps(feat?.properties as Record<string, unknown> | undefined)
      if (!props || !e.lngLat) return
      const mode = layerToMode(heatmapLayerRef.current)
      const ifa = computeGridIFA(props, weightsRef.current, mode)
      const html = `
        <div style="font:12px/1.4 system-ui,sans-serif">
          <strong>IFA ${(ifa * 100).toFixed(1)}%</strong>
          <div style="margin-top:6px;display:grid;grid-template-columns:1fr auto;gap:2px 10px">
            <span>relief</span><span>${(props.relief * 100).toFixed(0)}%</span>
            <span>illum</span><span>${(props.illum * 100).toFixed(0)}%</span>
            <span>cold</span><span>${(props.cold * 100).toFixed(0)}%</span>
            <span>ice</span><span>${(props.ice * 100).toFixed(0)}%</span>
            <span>dust</span><span>${(props.dust * 100).toFixed(0)}%</span>
          </div>
        </div>`
      popupRef.current?.setLngLat(e.lngLat).setHTML(html).addTo(map)
    }

    const onGridEnter = () => {
      map.getCanvas().style.cursor = 'pointer'
    }
    const onGridLeave = () => {
      map.getCanvas().style.cursor = ''
    }

    map.on('load', remountCustomLayers)
    map.on('style.load', remountCustomLayers)
    map.on('click', POINTS_LAYER_ID, onPointClick)
    map.on('click', GRID_LAYER_ID, showGridPopup)
    map.on('mouseenter', GRID_LAYER_ID, onGridEnter)
    map.on('mouseleave', GRID_LAYER_ID, onGridLeave)
    map.on('mouseenter', POINTS_LAYER_ID, () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', POINTS_LAYER_ID, () => {
      map.getCanvas().style.cursor = ''
    })

    return () => {
      map.off('load', remountCustomLayers)
      map.off('style.load', remountCustomLayers)
      map.off('click', POINTS_LAYER_ID, onPointClick)
      map.off('click', GRID_LAYER_ID, showGridPopup)
      map.off('mouseenter', GRID_LAYER_ID, onGridEnter)
      map.off('mouseleave', GRID_LAYER_ID, onGridLeave)
      popupRef.current?.remove()
      popupRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Pestañas Índice Global / Luna PSR / Marte Árido → solo setPaintProperty (sin PNG)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const mode = layerToMode(heatmapLayer)
    const apply = () => {
      if (!map.getLayer(GRID_LAYER_ID)) {
        ensureGridLayer(map, debouncedWeights, mode)
        return
      }
      map.setPaintProperty(GRID_LAYER_ID, 'fill-color', ifaColorExpr(debouncedWeights, mode) as never)
    }
    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  }, [heatmapLayer, debouncedWeights])

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`${API_BASE}/candidates?limit=100`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as CandidateDoc[]
        if (active && Array.isArray(data) && data.length > 0) {
          setCandidates(data)
          setSourceMode('api')
          setSelectedId((prev) => prev ?? data[0]._id)
          setLoading(false)
          return
        }
      } catch {
        // Fallback automático a Plan B estático en /data/candidates.json
      }
      try {
        const resBackup = await fetch('/data/candidates.json')
        const dataBackup = (await resBackup.json()) as CandidateDoc[]
        if (active && Array.isArray(dataBackup)) {
          setCandidates(dataBackup)
          setSourceMode('backup')
          setSelectedId((prev) => prev ?? (dataBackup[0]?._id || null))
        }
      } catch {
        // Sin datos
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [])

  const ranked = useMemo(() => {
    return candidates
      .filter((c) => {
        if (targetFilter !== 'all') {
          if (targetFilter === 'mars_surface' && c.target !== 'mars_surface' && c.target !== 'mars') return false
          if (targetFilter === 'lava_tubes' && c.target !== 'lava_tubes' && c.target !== 'moon_lava_tube') return false
          if (targetFilter === 'moon_south_pole' && c.target !== 'moon_south_pole') return false
        }
        if (onlyDiscoveries && c.region_type !== 'understudied_discovery' && !c.is_understudied) {
          return false
        }
        return true
      })
      .map((c) => ({
        doc: c,
        ifa: computeIFA(c.scores, debouncedWeights),
      }))
      .sort((a, b) => b.ifa - a.ifa)
  }, [candidates, targetFilter, onlyDiscoveries, debouncedWeights])

  const selected = useMemo(() => {
    if (!ranked.length) return null
    return ranked.find((r) => r.doc._id === selectedId) ?? ranked[0]
  }, [ranked, selectedId])

  // Sync GeoJSON circles (GPU) — solo cuando cambia ranking debounced o selección
  useEffect(() => {
    const map = mapRef.current
    const points: RankedPoint[] = ranked.slice(0, 80).map(({ doc, ifa }, idx) => {
      const [lon, lat] = doc.location.coordinates
      return {
        id: doc._id,
        name: doc.name,
        lon,
        lat,
        ifa,
        rank: idx + 1,
        selected: (selected?.doc._id === doc._id ? 1 : 0) as 0 | 1,
        hasOrbital: (doc.orbital_previews ? 1 : 0) as 0 | 1,
      }
    })
    pointsRef.current = points
    if (!map || !map.isStyleLoaded()) return
    upsertCandidatesCircles(map, points)
  }, [ranked, selected])

  // FlyTo solo al cambiar selección (no en cada tick del slider)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selected?.doc.location?.coordinates) return
    const [lon, lat] = selected.doc.location.coordinates
    if (
      Number.isFinite(lon) &&
      Number.isFinite(lat) &&
      Math.abs(lat) <= MERCATOR_MAX_LAT &&
      Math.abs(lon) <= 180
    ) {
      map.easeTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 3.5), duration: 450 })
    }
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps -- intencional: no re-volar en cada ranked

  const applyPreset = (p: Preset) => {
    setTargetFilter(p.target)
    setHeatmapLayer(p.heatmap)
    setWeights(p.weights)
    setDebouncedWeights(p.weights)
  }

  const applyHeatmapTab = (id: HeatmapLayer) => {
    const mode = layerToMode(id)
    const next = modeDefaultWeights(mode, weights)
    setHeatmapLayer(id)
    if (mode !== 'global') {
      setWeights(next)
      setDebouncedWeights(next)
    }
  }

  const handleOpenInExplorer = (c: CandidateDoc) => {
    const [lon, lat] = c.location.coordinates
    const store = useExplorerStore.getState()
    store.setBody('earth')
    store.setBbox([
      Math.max(-180, Number((lon - 0.6).toFixed(4))),
      Math.max(-90, Number((lat - 0.6).toFixed(4))),
      Math.min(180, Number((lon + 0.6).toFixed(4))),
      Math.min(90, Number((lat + 0.6).toFixed(4))),
    ])
    onOpenExplorer()
  }

  const dimLabels: { key: keyof CandidateScores; es: string; en: string }[] = [
    { key: 'relieve', es: 'Relieve (DEM 240 m)', en: 'Relief (DEM 240 m)' },
    { key: 'iluminacion', es: 'Iluminación / Sombra', en: 'Illumination / Shadow' },
    { key: 'frio', es: 'Frío Extremo (LST)', en: 'Extreme Cold (LST)' },
    { key: 'hielo', es: 'Hielo / Criosfera', en: 'Ice / Cryosphere' },
    { key: 'polvo', es: 'Polvo (MODIS AOD)', en: 'Dust (MODIS AOD)' },
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
      {/* Panel izquierdo: Escenarios, pesos 5D y listado */}
      <aside className="flex w-full shrink-0 flex-col gap-3 border-b border-line bg-surface p-3 lg:w-96 lg:overflow-y-auto lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">
            {isEs ? '1 · Escenario y Pesos IFA (5D)' : '1 · Scenario & IFA Weights (5D)'}
          </h2>
          <span className="rounded bg-raised px-2 py-0.5 text-xs text-ink-muted">
            {sourceMode === 'api'
              ? isEs
                ? 'Fuente: API en vivo'
                : 'Source: Live API'
              : isEs
                ? 'Fuente: Respaldo local (§05)'
                : 'Source: Local backup (§05)'}
          </span>
        </div>

        {/* Presets por zona funcional */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-ink-muted">
            {isEs ? 'Escenarios rápidos (§4.3):' : 'Quick scenarios (§4.3):'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p)}
                className={`rounded border border-line bg-raised px-2 py-1 text-xs hover:border-info ${focusRing}`}
              >
                {isEs ? p.labelEs : p.labelEn}
              </button>
            ))}
          </div>
        </div>

        {/* Filtro por objetivo y descubrimientos */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="target-select" className="block text-xs text-ink-muted">
              {isEs ? 'Objetivo planetario' : 'Planetary target'}
            </label>
            <select
              id="target-select"
              value={targetFilter}
              onChange={(e) => setTargetFilter(e.target.value as TargetFilter)}
              className={`mt-1 w-full rounded border border-line bg-canvas px-2 py-1.5 text-xs text-ink ${focusRing}`}
            >
              <option value="all">{isEs ? 'Todos los objetivos' : 'All targets'}</option>
              <option value="moon_south_pole">{isEs ? 'Luna · Polo Sur' : 'Moon · South Pole'}</option>
              <option value="mars_surface">{isEs ? 'Marte · Superficie' : 'Mars · Surface'}</option>
              <option value="lava_tubes">{isEs ? 'Subsuelo · Tubos de lava' : 'Subsurface · Lava tubes'}</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex cursor-pointer items-center gap-2 rounded border border-line bg-canvas px-2.5 py-1.5 text-xs">
              <input
                type="checkbox"
                checked={onlyDiscoveries}
                onChange={(e) => setOnlyDiscoveries(e.target.checked)}
              />
              <span>{isEs ? 'Solo descubrimientos' : 'Discoveries only'}</span>
            </label>
          </div>
        </div>

        {/* Sliders de las 5 dimensiones */}
        <div className="space-y-2 rounded border border-line bg-canvas p-2.5">
          {dimLabels.map(({ key, es, en }) => (
            <div key={key} className="space-y-0.5">
              <div className="flex justify-between text-xs">
                <span>{isEs ? es : en}</span>
                <span className="font-mono text-ink-muted">{Math.round(weights[key] * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={weights[key]}
                onChange={(e) => setWeights((w) => ({ ...w, [key]: parseFloat(e.target.value) }))}
                className="w-full accent-info"
              />
            </div>
          ))}
        </div>

        {/* Lista de candidatos ordenados por IFA */}
        <div className="flex items-center justify-between pt-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
            {isEs ? `Ranking de Análogos (${ranked.length})` : `Analog Ranking (${ranked.length})`}
          </h3>
        </div>

        {loading ? (
          <p className="text-xs text-ink-muted">{isEs ? 'Cargando candidatos...' : 'Loading candidates...'}</p>
        ) : (
          <div className="flex flex-col gap-1.5 overflow-y-auto pr-1" style={{ maxHeight: '340px' }}>
            {ranked.map(({ doc, ifa }, idx) => {
              const isSelected = selected?.doc._id === doc._id
              const isDiscovery = doc.region_type === 'understudied_discovery' || doc.is_understudied
              return (
                <button
                  key={doc._id}
                  type="button"
                  onClick={() => setSelectedId(doc._id)}
                  className={`flex flex-col gap-1 rounded border p-2 text-left transition ${focusRing} ${
                    isSelected
                      ? 'border-info bg-raised shadow-sm'
                      : 'border-line bg-canvas hover:bg-raised/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold leading-snug">
                      #{idx + 1} · {doc.name}
                    </span>
                    <span className="shrink-0 rounded bg-accent px-1.5 py-0.5 font-mono text-xs font-bold text-ink">
                      IFA {(ifa * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-muted">
                    <span>{doc.country}</span>
                    <span>·</span>
                    <span
                      className={`rounded px-1.5 py-0.2 font-semibold ${
                        isDiscovery ? 'bg-info/20 text-info' : 'bg-surface text-ink-muted'
                      }`}
                    >
                      {isDiscovery
                        ? isEs
                          ? 'Descubrimiento'
                          : 'Discovery'
                        : isEs
                          ? 'Calibración'
                          : 'Calibration'}
                    </span>
                    {doc.orbital_previews && (
                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.2 font-semibold text-emerald-300">
                        S2 + SAR
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </aside>

      {/* Panel central y derecho: Mapa de calor global P1 + Ficha científica §05 */}
      <section className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        {/* Mapa de calor global GEE P1 con marcadores */}
        <div className="rounded border border-line bg-surface p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold">
                {isEs
                  ? 'Mapa Global de Fidelidad Analógica (Grilla GEE EASE-Grid 2.0 · 13.688 celdas · Escala Homóloga 240 m)'
                  : 'Global Analog Fidelity Heatmap (GEE EASE-Grid 2.0 · 13,688 cells · 240 m Homologous Scale)'}
              </h2>
              <p className="text-xs text-ink-muted">
                {isEs
                  ? 'Haz clic en cualquier marcador para inspeccionar su ficha científica y recortes orbitales Sentinel-2 / Sentinel-1 SAR.'
                  : 'Click any marker to inspect its scientific card and Sentinel-2 / Sentinel-1 SAR orbital previews.'}
              </p>
            </div>
            <div className="flex gap-1">
              {(
                [
                  ['combined', isEs ? 'Índice Global' : 'Combined Index'],
                  ['moon_south_pole', isEs ? 'Luna PSR / Frío' : 'Moon PSR / Cold'],
                  ['mars_surface', isEs ? 'Marte Árido / Polvo' : 'Mars Arid / Dust'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => applyHeatmapTab(id)}
                  className={`rounded px-2.5 py-1 text-xs ${focusRing} ${
                    heatmapLayer === id
                      ? 'bg-info font-bold text-canvas'
                      : 'border border-line bg-canvas text-ink-muted hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Contenedor MapLibre: Carto Dark Matter + capa raster GEE encima */}
          <div
            ref={mapContainerRef}
            className="relative aspect-[2/1] w-full overflow-hidden rounded border border-line"
            style={{ minHeight: 280 }}
            aria-label={
              isEs
                ? `Mapa Dark Matter con grilla IFA ${heatmapLayer}`
                : `Dark Matter map with IFA grid ${heatmapLayer}`
            }
          />
          <p className="mt-1.5 text-[11px] text-ink-muted">
            {isEs
              ? 'Fondo: Carto Dark Matter. Capa: polígonos GEE EASE-Grid (IFA en GPU). Clic en celda → popup.'
              : 'Basemap: Carto Dark Matter. Layer: GEE EASE-Grid polygons (GPU IFA). Click a cell for popup.'}
          </p>
        </div>

        {/* Ficha detallada del candidato seleccionado (Contrato §05) */}
        {selected && (
          <div className="grid grid-cols-1 gap-4 rounded border border-line bg-surface p-4 xl:grid-cols-12">
            {/* Columna izquierda de la ficha: Encabezado, 5 dimensiones, métricas GEE y recortes S2/S1 */}
            <div className="space-y-4 xl:col-span-5">
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line pb-3">
                <div>
                  <span className="text-xs font-semibold uppercase text-info">
                    {selected.doc.target === 'moon_south_pole'
                      ? isEs
                        ? 'Objetivo: Polo Sur Lunar (Artemis)'
                        : 'Target: Lunar South Pole (Artemis)'
                      : selected.doc.target === 'lava_tubes' || selected.doc.target === 'moon_lava_tube'
                        ? isEs
                          ? 'Objetivo: Tubos de Lava / Subsuelo'
                          : 'Target: Lava Tubes / Subsurface'
                        : isEs
                          ? 'Objetivo: Superficie de Marte'
                          : 'Target: Mars Surface'}
                  </span>
                  <h3 className="text-base font-bold">{selected.doc.name}</h3>
                  <p className="text-xs text-ink-muted">
                    {selected.doc.country} · Coord: {selected.doc.location.coordinates[1].toFixed(3)}°,{' '}
                    {selected.doc.location.coordinates[0].toFixed(3)}°
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenInExplorer(selected.doc)}
                  className={`rounded bg-accent px-3 py-1.5 text-xs font-bold text-ink hover:brightness-110 ${focusRing}`}
                >
                  {isEs ? 'Abrir en Globo 3D / Explorador' : 'Open in 3D Globe / Explorer'}
                </button>
              </div>

              {/* Perfil de 5 dimensiones */}
              <div className="space-y-2 rounded border border-line bg-canvas p-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase text-ink-muted">
                    {isEs ? 'Fidelidad por Dimensión (5D)' : 'Similarity by Dimension (5D)'}
                  </h4>
                  <span className="font-mono text-sm font-bold text-accent">
                    IFA {(selected.ifa * 100).toFixed(1)}%
                  </span>
                </div>
                {dimLabels.map(({ key, es, en }) => {
                  const val = selected.doc.scores?.[key] || 0
                  return (
                    <div key={key} className="space-y-0.5">
                      <div className="flex justify-between text-xs">
                        <span>{isEs ? es : en}</span>
                        <span className="font-mono font-semibold">{(val * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded bg-surface">
                        <div
                          className="h-full rounded bg-info transition-all"
                          style={{ width: `${Math.round(val * 100)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Métricas físicas reales de la celda GEE P1 */}
              {selected.doc.p1_cell_metrics && (
                <div className="rounded border border-line bg-canvas p-3">
                  <h4 className="mb-2 text-xs font-bold uppercase text-ink-muted">
                    {isEs
                      ? `Mediciones Físicas GEE (${selected.doc.p1_cell_metrics.cell_id} · Ventana 5 km)`
                      : `GEE Physical Measurements (${selected.doc.p1_cell_metrics.cell_id} · 5 km Window)`}
                  </h4>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded bg-surface p-1.5">
                      <span className="block text-[10px] text-ink-muted">Elev. / Relieve</span>
                      <span className="font-mono font-semibold">
                        {selected.doc.p1_cell_metrics.elev_m ?? '—'} m / Δ
                        {selected.doc.p1_cell_metrics.relief_local_m ?? '—'} m
                      </span>
                    </div>
                    <div className="rounded bg-surface p-1.5">
                      <span className="block text-[10px] text-ink-muted">Pendiente 240 m</span>
                      <span className="font-mono font-semibold">
                        {selected.doc.p1_cell_metrics.slope_mean_deg ?? '—'}° (p90:{' '}
                        {selected.doc.p1_cell_metrics.slope_p90_deg ?? '—'}°)
                      </span>
                    </div>
                    <div className="rounded bg-surface p-1.5">
                      <span className="block text-[10px] text-ink-muted">Sombra Solar Máx</span>
                      <span className="font-mono font-semibold">
                        {((selected.doc.p1_cell_metrics.shadow_frac_max ?? 0) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="rounded bg-surface p-1.5">
                      <span className="block text-[10px] text-ink-muted">MODIS LST Mín / Amp</span>
                      <span className="font-mono font-semibold">
                        {selected.doc.p1_cell_metrics.lst_min_k ?? '—'} K / Δ
                        {selected.doc.p1_cell_metrics.lst_amp_k ?? '—'} K
                      </span>
                    </div>
                    <div className="rounded bg-surface p-1.5">
                      <span className="block text-[10px] text-ink-muted">Nieve MOD10A2</span>
                      <span className="font-mono font-semibold">
                        {((selected.doc.p1_cell_metrics.snow_persist ?? 0) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="rounded bg-surface p-1.5">
                      <span className="block text-[10px] text-ink-muted">Polvo AOD p90 / NDVI</span>
                      <span className="font-mono font-semibold">
                        {selected.doc.p1_cell_metrics.aod_p90 ?? '—'} /{' '}
                        {selected.doc.p1_cell_metrics.ndvi_max ?? '—'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Comparador Orbital Lado a Lado: Sentinel-2 RGB vs Sentinel-1 SAR (Filtro Lee) */}
              {selected.doc.orbital_previews && (
                <div className="rounded border border-line bg-canvas p-3">
                  <h4 className="mb-2 text-xs font-bold uppercase text-ink-muted">
                    {isEs
                      ? 'Comparador Orbital P1: Óptico (Sentinel-2) vs. Radar Banda C (Sentinel-1 SAR Filtro Lee)'
                      : 'P1 Orbital Comparator: Optical (Sentinel-2) vs. C-Band Radar (Sentinel-1 SAR Lee Filter)'}
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <img
                        src={selected.doc.orbital_previews.sentinel2_rgb_url}
                        alt="Sentinel-2 True Color"
                        className="aspect-square w-full rounded border border-line object-cover"
                      />
                      <p className="mt-1 text-[11px] text-ink-muted">
                        ESA Sentinel-2 L2A RGB (10 m)
                      </p>
                    </div>
                    <div>
                      <img
                        src={selected.doc.orbital_previews.sentinel1_sar_url}
                        alt="Sentinel-1 C-Band SAR"
                        className="aspect-square w-full rounded border border-line object-cover"
                      />
                      <p className="mt-1 text-[11px] text-ink-muted">
                        Sentinel-1 SAR Banda C (σ⁰ media:{' '}
                        {selected.doc.orbital_previews.sar_stats_db?.mean ?? '—'} dB)
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Columna derecha de la ficha: Propiedades vs. Procesos, Límites, Exploración y Biología (§05) */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:col-span-7">
              <div className="rounded border border-line bg-canvas p-3">
                <h4 className="mb-1.5 text-xs font-bold text-info">
                  {isEs
                    ? '1 · Similitud de Propiedad Física'
                    : '1 · Physical Property Similarity'}
                </h4>
                <ul className="list-disc space-y-1 pl-4 text-xs">
                  {(selected.doc.similar_properties ?? []).map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded border border-line bg-canvas p-3">
                <h4 className="mb-1.5 text-xs font-bold text-info">
                  {isEs
                    ? '2 · Similitud de Proceso Dinámico'
                    : '2 · Dynamic Process Similarity'}
                </h4>
                <ul className="list-disc space-y-1 pl-4 text-xs">
                  {(selected.doc.similar_processes ?? []).map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded border border-line bg-canvas p-3">
                <h4 className="mb-1.5 text-xs font-bold text-amber-400">
                  {isEs
                    ? '3 · Diferencias y Límites de la Analogía Terrestre'
                    : '3 · Differences & Limits of the Earth Analog'}
                </h4>
                <ul className="list-disc space-y-1 pl-4 text-xs">
                  {(selected.doc.differences_and_limits ?? []).map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded border border-line bg-canvas p-3">
                <h4 className="mb-1.5 text-xs font-bold text-emerald-400">
                  {isEs
                    ? '4 · Aplicaciones de Ingeniería y Exploración'
                    : '4 · Engineering & Exploration Use Cases'}
                </h4>
                <ul className="list-disc space-y-1 pl-4 text-xs">
                  {(selected.doc.exploration_use_cases ?? []).map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded border border-line bg-canvas p-3 md:col-span-2">
                <h4 className="mb-1.5 text-xs font-bold uppercase text-ink-muted">
                  {isEs
                    ? '5 · Potencial Subterráneo y Astrobiología / Extremófilos'
                    : '5 · Subsurface Potential & Astrobiology / Extremophiles'}
                </h4>
                <div className="grid grid-cols-1 gap-2 text-xs md:grid-cols-2">
                  <div>
                    <span className="font-semibold text-ink-muted">
                      {isEs ? 'Subsuelo / Cavidades: ' : 'Subsurface / Cavities: '}
                    </span>
                    <span>{selected.doc.subsurface_and_biology?.subsurface_potential}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-ink-muted">
                      {isEs ? 'Extremófilos / Biofirmas: ' : 'Extremophiles / Biosignatures: '}
                    </span>
                    <span>{selected.doc.subsurface_and_biology?.extremophiles_note}</span>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1 border-t border-line pt-2">
                  <span className="text-[11px] text-ink-muted">
                    {isEs ? 'Datasets oficiales:' : 'Official datasets:'}
                  </span>
                  {(selected.doc.datasets_used ?? []).map((ds) => (
                    <span
                      key={ds}
                      className="rounded bg-surface px-1.5 py-0.5 font-mono text-[10px] text-ink-muted"
                    >
                      {ds}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
