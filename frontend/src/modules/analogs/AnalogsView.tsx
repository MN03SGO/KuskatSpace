import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Map as MapLibreMap,
  Popup,
  type GeoJSONSource,
  type MapLayerMouseEvent,
  type MapMouseEvent,
  type StyleSpecification,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import {
  focusRing,
  focusRingInset,
  hudCardClass,
  hudPanelClass,
  ifaBadgeClass,
  sliderClass,
} from '../../components/ui'
import { ESRI_ATTRIBUTION, ESRI_WORLD_IMAGERY } from '../../config/bodies'
import { API_BASE } from '../../config/env'
import { useLang } from '../../i18n/useT'
import { ensureMaplibreWorker } from '../../lib/maplibreSetup'
import { useExplorerStore } from '../../store/useExplorerStore'
import {
  applyAllContextState,
  ensureAllContextLayers,
  setContextDate,
  setContextOpacity,
  setContextVisibility,
  type ContextOpacity,
  type ContextVisibility,
} from './analogsContextLayers'
import {
  ensureIfaLayers,
  ensureIfaPlaceholder,
  GRID_LAYER_ID,
  POINTS_LAYER_ID,
  buildGridCellIndex,
  findGridCellAt,
  setIfaFillColor,
  setIfaOpacity,
  type GridCellIndex,
} from './analogsIfaLayer'
import { parseAnalogsUrl, writeAnalogsUrl } from './analogsUrlState'
import { fetchAndValidateGrid, type GridGeometryReport } from './gridGeometry'
import {
  assertGridIfaParity,
  computeGridIFA,
  MARS_ARID_WEIGHTS,
  MOON_PSR_WEIGHTS,
  type IfaMode,
  type IfaWeights,
} from './ifaColorExpr'
import { Inspector, type InspectorCandidate, type InspectorCell } from './Inspector'
import { LayerPanel } from './LayerPanel'
import { CONTEXT_LAYERS, type ContextLayerId } from './layerRegistry'
import { Legend } from './Legend'
import { TimeBar } from './TimeBar'

ensureMaplibreWorker()

/** Basemap satelital real (Esri World Imagery) — aspecto tipo NASA / Google Earth. */
const ESRI_SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  name: 'Esri World Imagery',
  sources: {
    'esri-world-imagery': {
      type: 'raster',
      tiles: [ESRI_WORLD_IMAGERY],
      tileSize: 256,
      attribution: ESRI_ATTRIBUTION,
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'esri-world-imagery-layer',
      type: 'raster',
      source: 'esri-world-imagery',
      minzoom: 0,
      maxzoom: 22,
    },
  ],
}

/** NO usar ±90°: en Web Mercator lat=90 → y=Infinity y el mapa crashea. */
const MERCATOR_MAX_LAT = 85.05112878

const GRID_GEOJSON_URL = '/data/grid.geojson'

const POINTS_SOURCE_ID = 'candidates-geojson'

const BASE_WEIGHTS: IfaWeights = {
  relieve: 0.25,
  iluminacion: 0.2,
  frio: 0.2,
  hielo: 0.2,
  polvo: 0.15,
}

type HeatmapLayer = 'combined' | 'moon_south_pole' | 'mars_surface'

function layerToMode(layer: HeatmapLayer): IfaMode {
  if (layer === 'moon_south_pole') return 'moon_psr'
  if (layer === 'mars_surface') return 'mars_arid'
  return 'global'
}

function modeToHeatmapLayer(mode: IfaMode): HeatmapLayer {
  if (mode === 'moon_psr') return 'moon_south_pole'
  if (mode === 'mars_arid') return 'mars_surface'
  return 'combined'
}

function modeDefaultWeights(mode: IfaMode, current: IfaWeights): IfaWeights {
  if (mode === 'moon_psr') return { ...MOON_PSR_WEIGHTS }
  if (mode === 'mars_arid') return { ...MARS_ARID_WEIGHTS }
  return current
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
  try {
    const data = toPointsGeoJSON(points)
    const existing = map.getSource(POINTS_SOURCE_ID) as GeoJSONSource | undefined

    if (existing) {
      existing.setData(data)
    } else {
      map.addSource(POINTS_SOURCE_ID, {
        type: 'geojson',
        data,
        cluster: false,
      })

      if (!map.getLayer(POINTS_LAYER_ID)) {
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
    }

    // Candidatos siempre encima
    if (map.getLayer(POINTS_LAYER_ID)) {
      map.moveLayer(POINTS_LAYER_ID)
    }
  } catch (err) {
    console.error('[AnalogsView] candidatos', err)
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
  similar_values?: string[]
  earth_limits?: string[]
  exploration_use?: string
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

  const urlBoot = useMemo(
    () => parseAnalogsUrl(typeof window !== 'undefined' ? window.location.search : '', BASE_WEIGHTS),
    [],
  )

  const [candidates, setCandidates] = useState<CandidateDoc[]>([])
  const [sourceMode, setSourceMode] = useState<'api' | 'backup'>('backup')
  const [apiFallbackReason, setApiFallbackReason] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [targetFilter, setTargetFilter] = useState<TargetFilter>('all')
  const [onlyDiscoveries, setOnlyDiscoveries] = useState(false)
  const [heatmapLayer, setHeatmapLayer] = useState<HeatmapLayer>(() =>
    modeToHeatmapLayer(urlBoot.scenario),
  )
  const [weights, setWeights] = useState<IfaWeights>(() => ({ ...urlBoot.weights }))
  // Ranking/mapa solo se recalculan 150ms después de soltar el slider
  const [debouncedWeights, setDebouncedWeights] = useState<IfaWeights>(() => ({ ...urlBoot.weights }))
  const [selectedId, setSelectedId] = useState<string | null>(() => urlBoot.selectedId)
  const [ifaOpacity, setIfaOpacityState] = useState(urlBoot.ifaOpacity)
  const [candidatesVisible, setCandidatesVisible] = useState(true)
  const [contextVisibility, setContextVisibilityState] = useState<ContextVisibility>(
    () => ({ ...urlBoot.contextVisibility }),
  )
  const [contextOpacity, setContextOpacityState] = useState<ContextOpacity>(
    () => ({ ...urlBoot.contextOpacity }),
  )
  const [contextDate, setContextDateState] = useState(
    () => urlBoot.date ?? '2026-11-01',
  )
  const [gridNotice, setGridNotice] = useState<string | null>(null)
  const [gridMeta, setGridMeta] = useState<{ n_cells: number; n_regions: number } | null>(null)
  const [inspectorCell, setInspectorCell] = useState<InspectorCell | null>(null)
  const [inspectorCandidate, setInspectorCandidate] = useState<InspectorCandidate | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(true)

  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const heatmapLayerRef = useRef<HeatmapLayer>(heatmapLayer)
  const weightsRef = useRef(debouncedWeights)
  const ifaOpacityRef = useRef(ifaOpacity)
  const gridFcRef = useRef<GeoJSON.FeatureCollection | null>(null)
  const gridReportRef = useRef<GridGeometryReport | null>(null)
  const contextVisRef = useRef(contextVisibility)
  const contextOpRef = useRef(contextOpacity)
  const pointsRef = useRef<RankedPoint[]>([])
  const popupRef = useRef<Popup | null>(null)
  heatmapLayerRef.current = heatmapLayer
  weightsRef.current = debouncedWeights
  ifaOpacityRef.current = ifaOpacity
  contextVisRef.current = contextVisibility
  contextOpRef.current = contextOpacity

  useEffect(() => {
    void fetch('/data/grid_meta.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((m: { n_cells?: number; n_regions?: number } | null) => {
        if (m?.n_cells && m?.n_regions) setGridMeta({ n_cells: m.n_cells, n_regions: m.n_regions })
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedWeights(weights), 150)
    return () => window.clearTimeout(t)
  }, [weights])

  // Paridad IFA JS ↔ fórmula de la expresión MapLibre (2–3 celdas)
  useEffect(() => {
    assertGridIfaParity(debouncedWeights, layerToMode(heatmapLayer))
  }, [debouncedWeights, heatmapLayer])

  /** Índice de celdas reales para hit-test (la custom layer no es consultable). */
  const cellIndexRef = useRef<GridCellIndex>(new Map())

  /** Aplica IFA como heatmap IDW continuo (sin círculos ni bloques). */
  function applyIfaData(map: MapLibreMap) {
    const mode = layerToMode(heatmapLayerRef.current)
    const opac = ifaOpacityRef.current
    const fc = gridFcRef.current
    try {
      if (fc) {
        cellIndexRef.current = buildGridCellIndex(fc)
        ensureIfaLayers(map, weightsRef.current, mode, opac, fc)
      } else {
        cellIndexRef.current = new Map()
        ensureIfaPlaceholder(map, weightsRef.current, mode, opac)
      }
    } catch (err) {
      console.error('[AnalogsView] applyIfaData', err)
    }
  }

  /** Orden en 'load': IFA → GIBS (ocultas) → candidatos. Cada paso aislado. */
  function mountCustomLayers(map: MapLibreMap) {
    applyIfaData(map)
    try {
      ensureAllContextLayers(map, GRID_LAYER_ID)
      applyAllContextState(map, contextVisRef.current, contextOpRef.current)
    } catch (err) {
      console.error('[AnalogsView] contexto GIBS', err)
    }
    try {
      upsertCandidatesCircles(map, pointsRef.current)
    } catch (err) {
      console.error('[AnalogsView] candidatos', err)
    }
  }

  // 1) Mapa SÍNCRONO al montar — sin await/fetch antes de new Map
  useEffect(() => {
    const el = mapContainerRef.current
    if (!el) return

    // StrictMode: limpiar instancia previa del mismo contenedor si quedó huérfana
    if (mapRef.current) {
      try {
        mapRef.current.remove()
      } catch {
        /* ignore */
      }
      mapRef.current = null
    }

    let cancelled = false
    let loadHandled = false
    let map: MapLibreMap
    try {
      map = new MapLibreMap({
        container: el,
        style: ESRI_SATELLITE_STYLE,
        center: [-20, 15],
        zoom: 1.4,
        minZoom: 0,
        renderWorldCopies: false,
      })
    } catch (err) {
      console.error('[AnalogsView] new Map', err)
      return
    }

    mapRef.current = map
    popupRef.current = new Popup({
      closeButton: true,
      closeOnClick: true,
      maxWidth: '260px',
      className: 'grid-ifa-popup',
    })

    const onMapError = (e: unknown) => {
      const err = e && typeof e === 'object' && 'error' in e ? (e as { error: unknown }).error : e
      console.error('[MapLibre]', err)
    }

    const onLoad = () => {
      if (cancelled || loadHandled) return
      loadHandled = true
      map.resize()
      mountCustomLayers(map)
      // 2) Grid DESPUÉS de 'load' (no bloquea basemap)
      void (async () => {
        try {
          const { fc, report } = await fetchAndValidateGrid(GRID_GEOJSON_URL)
          if (cancelled || mapRef.current !== map) return
          gridFcRef.current = fc
          gridReportRef.current = report
          if (report.valid) {
            setGridNotice(null)
            console.info(
              '[AnalogsView] Geometría IFA VÁLIDA → heatmap IDW continuo (escáner).',
              `celdas=${report.featureCount}`,
              `oversize=${report.oversizeCount}`,
              `ifaOk=${(report.ifaCalculableRatio * 100).toFixed(1)}%`,
              `candidatos=${report.candidateHits}/${report.candidateTotal}`,
              `maxΔlon=${report.widthDeg.max.toFixed(3)}°`,
              `maxΔlat=${report.heightDeg.max.toFixed(3)}°`,
            )
          } else {
            // Aviso discreto; NO activar PNG (mismos datos sesgados)
            setGridNotice(isEs ? 'Grilla en revisión' : 'Grid under review')
            console.warn('[AnalogsView] Geometría IFA con avisos (sin PNG):', report.reason, report)
          }
          if (report.emptyLandBands.length > 0) {
            console.info(
              '[AnalogsView] Bandas sin celdas (ROI dataset, no invalida):',
              report.emptyLandBands.join(', '),
            )
          }
          applyIfaData(map)
          try {
            ensureAllContextLayers(map, GRID_LAYER_ID)
          } catch (err) {
            console.error('[AnalogsView] contexto tras grid', err)
          }
          try {
            upsertCandidatesCircles(map, pointsRef.current)
          } catch (err) {
            console.error('[AnalogsView] candidatos tras grid', err)
          }
        } catch (err) {
          console.error('[AnalogsView] fetch grid', err)
        }
      })()
    }

    const onPointClick = (e: MapLayerMouseEvent) => {
      const id = e.features?.[0]?.properties?.id as string | undefined
      if (id) setSelectedId(id)
    }

    const showIdwPopup = (e: MapMouseEvent) => {
      if (!e.lngLat) return
      // Solo dentro de una celda real (fuera de la máscara no hay IFA)
      const hit = findGridCellAt(cellIndexRef.current, e.lngLat.lng, e.lngLat.lat)
      if (!hit) return
      const ifa = computeGridIFA(hit, weightsRef.current, layerToMode(heatmapLayerRef.current))
      const html = `
        <div style="font:12px/1.4 system-ui,sans-serif">
          <strong>IFA ${(ifa * 100).toFixed(1)}%</strong>
          <div style="margin-top:6px;display:grid;grid-template-columns:1fr auto;gap:2px 10px">
            <span>relief</span><span>${(hit.relief * 100).toFixed(0)}%</span>
            <span>illum</span><span>${(hit.illum * 100).toFixed(0)}%</span>
            <span>cold</span><span>${(hit.cold * 100).toFixed(0)}%</span>
            <span>ice</span><span>${(hit.ice * 100).toFixed(0)}%</span>
            <span>dust</span><span>${(hit.dust * 100).toFixed(0)}%</span>
          </div>
          <div style="margin-top:4px;color:#64748b">Celda ${hit.stepKm} km</div>
        </div>`
      popupRef.current?.setLngLat(e.lngLat).setHTML(html).addTo(map)
    }


    const onMousemove = (e: MapMouseEvent) => {
      const layers: string[] = []
      if (map.getLayer(POINTS_LAYER_ID)) layers.push(POINTS_LAYER_ID)
      let cand: InspectorCandidate | null = null
      if (layers.length > 0) {
        const feats = map.queryRenderedFeatures(e.point, { layers })
        for (const f of feats) {
          if (f.layer?.id === POINTS_LAYER_ID && !cand) {
            const name = String(f.properties?.name ?? '')
            const ifa = Number(f.properties?.ifa ?? 0)
            if (name) cand = { name, ifa }
          }
        }
      }
      // Hit-test IFA por celda real (capa custom no es consultable)
      let cell: InspectorCell | null = null
      const hit = e.lngLat ? findGridCellAt(cellIndexRef.current, e.lngLat.lng, e.lngLat.lat) : null
      if (hit) {
        const { relief, illum, cold, ice, dust } = hit
        cell = {
          relief,
          illum,
          cold,
          ice,
          dust,
          ifa: computeGridIFA(hit, weightsRef.current, layerToMode(heatmapLayerRef.current)),
        }
      }
      setInspectorCell(cell)
      setInspectorCandidate(cand)
    }

    map.on('error', onMapError)
    map.on('load', onLoad)
    map.on('click', POINTS_LAYER_ID, onPointClick)
    map.on('click', showIdwPopup)
    map.on('mousemove', onMousemove)
    map.on('mouseenter', POINTS_LAYER_ID, () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', POINTS_LAYER_ID, () => {
      map.getCanvas().style.cursor = ''
      setInspectorCandidate(null)
    })

    // Por si el estilo ya estaba cacheado
    if (map.loaded()) {
      onLoad()
    }

    return () => {
      cancelled = true
      map.off('error', onMapError)
      map.off('load', onLoad)
      map.off('click', POINTS_LAYER_ID, onPointClick)
      map.off('click', showIdwPopup)
      map.off('mousemove', onMousemove)
      popupRef.current?.remove()
      popupRef.current = null
      try {
        map.remove()
      } catch (err) {
        console.error('[AnalogsView] map.remove', err)
      }
      if (mapRef.current === map) mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mapa una vez al montar
  }, [])

  // Escenario / pesos → recalcula vals IDW (sin recrear la custom layer)
  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded()) return
    const mode = layerToMode(heatmapLayer)
    try {
      const fc = gridFcRef.current
      setIfaFillColor(map, debouncedWeights, mode, fc)
      setIfaOpacity(map, ifaOpacity)
    } catch (err) {
      console.error('[AnalogsView] update IFA IDW', err)
    }
  }, [heatmapLayer, debouncedWeights, ifaOpacity])

  // Visibilidad / opacidad contexto → solo layout/paint
  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded()) return
    applyAllContextState(map, contextVisibility, contextOpacity)
  }, [contextVisibility, contextOpacity])

  // Fecha GIBS → setTiles en capas temporales visibles
  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded()) return
    for (const def of CONTEXT_LAYERS) {
      if (!def.period) continue
      if (!contextVisibility[def.id]) continue
      setContextDate(map, def.id, contextDate)
    }
  }, [contextDate, contextVisibility])

  // Candidatos visible
  useEffect(() => {
    const map = mapRef.current
    if (!map?.getLayer(POINTS_LAYER_ID)) return
    map.setLayoutProperty(POINTS_LAYER_ID, 'visibility', candidatesVisible ? 'visible' : 'none')
  }, [candidatesVisible])

  // URL compartible
  useEffect(() => {
    writeAnalogsUrl(
      {
        scenario: layerToMode(heatmapLayer),
        weights: debouncedWeights,
        selectedId,
        contextVisibility,
        contextOpacity,
        date: CONTEXT_LAYERS.some((l) => l.period && contextVisibility[l.id])
          ? contextDate
          : null,
        ifaOpacity,
      },
      BASE_WEIGHTS,
    )
  }, [
    heatmapLayer,
    debouncedWeights,
    selectedId,
    contextVisibility,
    contextOpacity,
    contextDate,
    ifaOpacity,
  ])

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      let fallbackReason: string | null = null
      const url = `${API_BASE}/candidates?limit=100`
      try {
        const res = await fetch(url)
        const ct = res.headers.get('content-type') ?? ''
        const text = await res.text()
        if (!res.ok) {
          fallbackReason = `HTTP ${res.status} en candidatos`
          throw new Error(fallbackReason)
        }
        if (!ct.includes('application/json') && !ct.includes('+json')) {
          fallbackReason = `respuesta no JSON (${ct || 'sin content-type'})`
          if (import.meta.env.DEV) {
            console.error('[AnalogsView] API candidatos inválida', {
              status: res.status,
              url,
              bodySnippet: text.replace(/\s+/g, ' ').trim().slice(0, 200),
            })
          }
          throw new Error(fallbackReason)
        }
        const data = JSON.parse(text) as CandidateDoc[]
        if (active && Array.isArray(data) && data.length > 0) {
          setCandidates(data)
          setSourceMode('api')
          setApiFallbackReason(null)
          setSelectedId((prev) => {
            if (prev && data.some((d) => d._id === prev)) return prev
            return prev ?? data[0]._id
          })
          setLoading(false)
          return
        }
        fallbackReason = 'API devolvió lista vacía'
      } catch (err) {
        if (!fallbackReason) {
          fallbackReason =
            err instanceof TypeError
              ? 'no se pudo conectar con la API'
              : err instanceof Error
                ? err.message
                : 'error desconocido'
        }
        if (import.meta.env.DEV) {
          console.warn('[AnalogsView] cayendo a respaldo local:', fallbackReason, err)
        }
      }
      try {
        const resBackup = await fetch('/data/candidates.json')
        const dataBackup = (await resBackup.json()) as CandidateDoc[]
        if (active && Array.isArray(dataBackup)) {
          setCandidates(dataBackup)
          setSourceMode('backup')
          setApiFallbackReason(fallbackReason ?? 'API no disponible')
          setSelectedId((prev) => {
            if (prev && dataBackup.some((d) => d._id === prev)) return prev
            return prev ?? (dataBackup[0]?._id || null)
          })
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

  const handleIfaOpacity = (v: number) => {
    setIfaOpacityState(v)
    const map = mapRef.current
    if (map) setIfaOpacity(map, v)
  }

  const handleContextVisible = (id: ContextLayerId, v: boolean) => {
    setContextVisibilityState((prev) => ({ ...prev, [id]: v }))
    const map = mapRef.current
    if (map) {
      setContextVisibility(map, id, v)
      if (v) {
        const def = CONTEXT_LAYERS.find((l) => l.id === id)
        if (def?.period) setContextDate(map, id, contextDate)
      }
    }
  }

  const handleContextOpacity = (id: ContextLayerId, v: number) => {
    setContextOpacityState((prev) => ({ ...prev, [id]: v }))
    const map = mapRef.current
    if (map) setContextOpacity(map, id, v)
  }

  const handleContextDate = (iso: string) => {
    setContextDateState(iso)
    const map = mapRef.current
    if (!map) return
    for (const def of CONTEXT_LAYERS) {
      if (!def.period || !contextVisibility[def.id]) continue
      setContextDate(map, def.id, iso)
    }
  }

  const perspectiveTabs = [
    { id: 'combined' as const, icon: 'public', label: isEs ? 'Índice Global' : 'Combined Index' },
    { id: 'moon_south_pole' as const, icon: 'ac_unit', label: isEs ? 'Luna PSR / Frío' : 'Moon PSR / Cold' },
    { id: 'mars_surface' as const, icon: 'landscape', label: isEs ? 'Marte Árido / Polvo' : 'Mars Arid / Dust' },
  ]

  const dimShortLabels: { key: keyof CandidateScores; es: string; en: string; bar: string; text: string }[] = [
    { key: 'relieve', es: 'Relieve (DEM 240 m)', en: 'Relief (DEM 240 m)', bar: 'bg-accent', text: 'text-info' },
    { key: 'iluminacion', es: 'Iluminación / Sombra', en: 'Illumination / Shadow', bar: 'bg-accent', text: 'text-info' },
    { key: 'frio', es: 'Frío Extremo (LST)', en: 'Extreme Cold (LST)', bar: 'bg-ok', text: 'text-ok' },
    { key: 'hielo', es: 'Hielo / Criosfera', en: 'Ice / Cryosphere', bar: 'bg-ok', text: 'text-ok' },
    { key: 'polvo', es: 'Polvo (MODIS AOD)', en: 'Dust (MODIS AOD)', bar: 'bg-ink-muted', text: 'text-ink-muted' },
  ]

  const simProperties = selected?.doc.similar_properties?.length
    ? selected.doc.similar_properties
    : (selected?.doc.similar_values ?? [])
  const simProcesses = selected?.doc.similar_processes ?? []
  const diffLimits = selected?.doc.differences_and_limits?.length
    ? selected.doc.differences_and_limits
    : (selected?.doc.earth_limits ?? [])
  const useCases = selected?.doc.exploration_use_cases?.length
    ? selected.doc.exploration_use_cases
    : selected?.doc.exploration_use
      ? [selected.doc.exploration_use]
      : []

  return (
    <div className="custom-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto bg-canvas">
      {/* WORKBENCH CARTOGRÁFICO SUPERIOR */}
      <div className="relative flex flex-col lg:h-[calc(100dvh-3.5rem)] lg:min-h-[600px] lg:shrink-0 lg:overflow-hidden">
        {/* Contenedor del Mapa MapLibre (protagonista) */}
        <div className="relative h-[460px] w-full shrink-0 lg:absolute lg:inset-0 lg:h-full">
          <div
            ref={mapContainerRef}
            className="h-full w-full"
            aria-label={
              isEs
                ? `Mapa satelital Esri con grilla IFA ${heatmapLayer}`
                : `Esri satellite map with IFA grid ${heatmapLayer}`
            }
          />

          {/* Barra HUD flotante superior */}
          <div className="pointer-events-none absolute top-3 right-3 left-3 z-20 flex flex-wrap items-center justify-between gap-2">
            <div className={`pointer-events-auto flex items-center gap-2.5 px-3 py-1.5 ${hudPanelClass}`}>
              <span className="h-2 w-2 rounded-full bg-ok" aria-hidden="true" />
              <span
                className="text-xs font-bold tracking-tight text-ink"
                title={
                  isEs
                    ? '240 m es la escala del DEM dentro de cada celda (homóloga a LOLA/MOLA), no el tamaño de la celda (15 o 60 km).'
                    : '240 m is the DEM scale inside each cell (homologous to LOLA/MOLA), not the cell size (15 or 60 km).'
                }
              >
                {isEs ? 'Fidelidad analógica' : 'Analog fidelity'}
              </span>
              {gridMeta && (
                <span className="hidden font-mono text-[10px] text-ink-muted sm:inline">
                  {isEs
                    ? `${gridMeta.n_cells.toLocaleString('es-ES')} celdas · ${gridMeta.n_regions} regiones`
                    : `${gridMeta.n_cells.toLocaleString('en-US')} cells · ${gridMeta.n_regions} regions`}
                </span>
              )}
            </div>

            <div
              role="group"
              aria-label={isEs ? 'Perspectiva de mapa IFA' : 'IFA map perspective'}
              className={`pointer-events-auto flex items-center gap-1 p-1 ${hudPanelClass}`}
            >
              {perspectiveTabs.map(({ id, icon, label }) => {
                const active = heatmapLayer === id
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => applyHeatmapTab(id)}
                    className={`flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono text-[11px] transition-all ${focusRingInset} ${
                      active
                        ? 'bg-accent font-semibold text-white shadow-xs dark:text-[#002b42]'
                        : 'font-medium text-ink-muted hover:bg-raised hover:text-ink'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                      {icon}
                    </span>
                    <span>{label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Pila flotante derecha: controles de zoom + Inspector + LayerPanel + Legend */}
          <div className="pointer-events-none absolute top-16 right-3 bottom-9 z-20 hidden w-64 flex-col items-end gap-2.5 overflow-y-auto pr-0.5 custom-scrollbar md:flex">
            <div className={`pointer-events-auto flex flex-col gap-1 p-1 ${hudPanelClass}`}>
              <button
                type="button"
                onClick={() => mapRef.current?.zoomIn()}
                title={isEs ? 'Aumentar zoom' : 'Zoom in'}
                aria-label={isEs ? 'Aumentar zoom' : 'Zoom in'}
                className={`flex h-8 w-8 items-center justify-center rounded-lg bg-raised text-ink transition-colors hover:bg-line ${focusRing}`}
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  add
                </span>
              </button>
              <button
                type="button"
                onClick={() => mapRef.current?.zoomOut()}
                title={isEs ? 'Disminuir zoom' : 'Zoom out'}
                aria-label={isEs ? 'Disminuir zoom' : 'Zoom out'}
                className={`flex h-8 w-8 items-center justify-center rounded-lg bg-raised text-ink transition-colors hover:bg-line ${focusRing}`}
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  remove
                </span>
              </button>
              <button
                type="button"
                onClick={() => mapRef.current?.easeTo({ center: [-20, 15], zoom: 1.4, duration: 450 })}
                title={isEs ? 'Restablecer vista global' : 'Reset global view'}
                aria-label={isEs ? 'Restablecer vista global' : 'Reset global view'}
                className={`flex h-8 w-8 items-center justify-center rounded-lg bg-raised text-info transition-colors hover:bg-line ${focusRing}`}
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  restart_alt
                </span>
              </button>
            </div>

            <div className="pointer-events-auto w-full">
              <Inspector isEs={isEs} cell={inspectorCell} candidate={inspectorCandidate} />
            </div>

            <div className="pointer-events-auto w-full">
              <LayerPanel
                isEs={isEs}
                ifaOpacity={ifaOpacity}
                onIfaOpacity={handleIfaOpacity}
                ifaMode="heatmap"
                gridNotice={gridNotice}
                candidatesVisible={candidatesVisible}
                onCandidatesVisible={setCandidatesVisible}
                contextVisibility={contextVisibility}
                contextOpacity={contextOpacity}
                onContextVisible={handleContextVisible}
                onContextOpacity={handleContextOpacity}
              />
            </div>

            <div className="pointer-events-auto w-full">
              <Legend
                isEs={isEs}
                scenario={layerToMode(heatmapLayer)}
                contextVisibility={contextVisibility}
              />
            </div>
          </div>

          <TimeBar
            isEs={isEs}
            date={contextDate}
            onDate={handleContextDate}
            contextVisibility={contextVisibility}
          />

          {/* Franja inferior de créditos del mapa */}
          <div className="pointer-events-none absolute right-0 bottom-0 left-0 z-10 flex items-center justify-between border-t border-line bg-surface/85 px-4 py-1 font-mono text-[10px] text-ink-muted backdrop-blur-md">
            <span className="truncate">
              {isEs
                ? 'Fondo: Esri World Imagery · IFA: polígonos continuos sin bordes · Sin color = fuera del dominio · Contexto: NASA GIBS'
                : 'Basemap: Esri World Imagery · IFA: continuous borderless polygons · No color = outside domain · Context: NASA GIBS'}
            </span>
            <span className="hidden shrink-0 items-center gap-1 rounded border border-line bg-raised px-2 py-0.5 text-ink sm:flex">
              <span>Esri World Imagery | MapLibre GL</span>
            </span>
          </div>
        </div>

        {/* Botón flotante para colapsar/expandir el drawer izquierdo en escritorio */}
        <button
          type="button"
          onClick={() => setDrawerOpen((v) => !v)}
          title={drawerOpen ? (isEs ? 'Colapsar panel' : 'Collapse panel') : isEs ? 'Abrir panel' : 'Open panel'}
          aria-label={drawerOpen ? (isEs ? 'Colapsar panel' : 'Collapse panel') : isEs ? 'Abrir panel' : 'Open panel'}
          className={`pointer-events-auto hidden h-8 w-8 items-center justify-center rounded-full border border-line bg-surface text-info shadow-lg transition-all hover:bg-raised lg:absolute lg:top-16 lg:z-30 lg:flex ${
            drawerOpen ? 'lg:left-[380px]' : 'lg:left-3'
          } ${focusRing}`}
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            {drawerOpen ? 'chevron_left' : 'chevron_right'}
          </span>
        </button>

        {/* DRAWER PARAMÉTRICO IZQUIERDO (flotante en lg+, flujo normal en < lg) */}
        <aside
          aria-label={isEs ? 'Configuración de escenario, pesos IFA y ranking' : 'Scenario, IFA weights and ranking'}
          className={`flex w-full shrink-0 flex-col border-b border-line bg-surface lg:absolute lg:top-16 lg:bottom-9 lg:left-3 lg:z-20 lg:w-[370px] lg:overflow-hidden lg:rounded-2xl lg:hud-panel ${
            drawerOpen ? '' : 'lg:hidden'
          }`}
        >
          {/* Cabecera del drawer */}
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <span className="h-4 w-1.5 rounded-full bg-accent" aria-hidden="true" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-ink">
                {isEs ? '1 · Escenario y Pesos IFA (5D)' : '1 · Scenario & IFA Weights (5D)'}
              </h2>
            </div>
            <span
              className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold ${
                sourceMode === 'api'
                  ? 'border border-ok/30 bg-ok/15 text-ok'
                  : 'border border-warn/40 bg-warn/15 text-warn'
              }`}
              title={apiFallbackReason ?? undefined}
            >
              {sourceMode === 'api'
                ? isEs
                  ? 'API en vivo'
                  : 'Live API'
                : isEs
                  ? 'Respaldo local'
                  : 'Local backup'}
            </span>
          </div>

          {/* Contenido scrollable del drawer */}
          <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto p-3.5">
            {sourceMode === 'backup' && apiFallbackReason && (
              <p className="rounded-lg border border-warn/40 bg-warn/10 px-2.5 py-1.5 text-[11px] text-warn">
                {isEs
                  ? `Usando candidatos en disco (${apiFallbackReason}).`
                  : `Using on-disk candidates (${apiFallbackReason}).`}
              </p>
            )}

            {/* Presets rápidos (§4.3) */}
            <div className="space-y-1.5">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                {isEs ? 'Escenarios rápidos (§4.3)' : 'Quick scenarios (§4.3)'}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className={`rounded-lg border border-line bg-raised px-2 py-1 font-mono text-[11px] text-ink transition-colors hover:border-info/60 hover:text-info ${focusRing}`}
                  >
                    {isEs ? p.labelEs : p.labelEn}
                  </button>
                ))}
              </div>
            </div>

            {/* Filtro por objetivo y descubrimientos */}
            <div className="space-y-1.5 rounded-xl border border-line bg-raised/70 p-2.5">
              <label htmlFor="target-select" className="block font-mono text-[10px] font-bold uppercase text-ink-muted">
                {isEs ? 'Objetivo planetario' : 'Planetary target'}
              </label>
              <div className="flex items-center gap-2">
                <select
                  id="target-select"
                  value={targetFilter}
                  onChange={(e) => setTargetFilter(e.target.value as TargetFilter)}
                  className={`min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-ink ${focusRing}`}
                >
                  <option value="all">{isEs ? 'Todos los objetivos' : 'All targets'}</option>
                  <option value="moon_south_pole">{isEs ? 'Luna · Polo Sur' : 'Moon · South Pole'}</option>
                  <option value="mars_surface">{isEs ? 'Marte · Superficie' : 'Mars · Surface'}</option>
                  <option value="lava_tubes">{isEs ? 'Subsuelo · Tubos de lava' : 'Subsurface · Lava tubes'}</option>
                </select>
                <label className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1.5 text-[11px] font-medium text-ink">
                  <input
                    type="checkbox"
                    checked={onlyDiscoveries}
                    onChange={(e) => setOnlyDiscoveries(e.target.checked)}
                    className="h-3.5 w-3.5 rounded accent-accent"
                  />
                  <span>{isEs ? 'Descubrimientos' : 'Discoveries'}</span>
                </label>
              </div>
            </div>

            {/* Sliders 5D */}
            <div className="space-y-2 rounded-xl border border-line bg-raised/50 p-2.5">
              <div className="flex items-center justify-between border-b border-line pb-1">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                  {isEs ? 'Ponderación IFA (Vector 5D)' : 'IFA Weighting (5D Vector)'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setWeights(BASE_WEIGHTS)
                    setDebouncedWeights(BASE_WEIGHTS)
                  }}
                  className={`font-mono text-[10px] font-semibold text-info hover:underline ${focusRing}`}
                >
                  {isEs ? 'Restablecer' : 'Reset'}
                </button>
              </div>
              {dimLabels.map(({ key, es, en }) => {
                const isColdOrIce = key === 'frio' || key === 'hielo'
                return (
                  <div key={key} className="space-y-0.5">
                    <div className="flex justify-between font-mono text-[11px]">
                      <span className="text-ink">{isEs ? es : en}</span>
                      <span className={`font-bold ${isColdOrIce ? 'text-ok' : 'text-info'}`}>
                        {Math.round(weights[key] * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={weights[key]}
                      onChange={(e) => setWeights((w) => ({ ...w, [key]: parseFloat(e.target.value) }))}
                      className={`${sliderClass} ${isColdOrIce ? 'accent-ok' : ''}`}
                    />
                  </div>
                )
              })}
            </div>

            {/* Ranking de candidatos */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                  {isEs ? `Ranking de Análogos (${ranked.length})` : `Analog Ranking (${ranked.length})`}
                </h3>
                {(targetFilter !== 'all' || onlyDiscoveries) && (
                  <span className="rounded border border-ok/30 bg-ok/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-ok">
                    {isEs ? 'Filtro activo' : 'Filter active'}
                  </span>
                )}
              </div>

              {loading ? (
                <p className="text-xs text-ink-muted">{isEs ? 'Cargando candidatos...' : 'Loading candidates...'}</p>
              ) : (
                <div className="custom-scrollbar flex max-h-[300px] flex-col gap-1.5 overflow-y-auto pr-1">
                  {ranked.map(({ doc, ifa }, idx) => {
                    const isSelected = selected?.doc._id === doc._id
                    const isDiscovery = doc.region_type === 'understudied_discovery' || doc.is_understudied
                    return (
                      <button
                        key={doc._id}
                        type="button"
                        onClick={() => setSelectedId(doc._id)}
                        className={`flex flex-col gap-1 rounded-xl border p-2.5 text-left transition-all ${focusRing} ${
                          isSelected
                            ? 'border-info bg-info/10 shadow-xs'
                            : 'border-line bg-surface hover:bg-raised'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs leading-snug font-bold text-ink">
                            <span className={`mr-1 font-mono ${isSelected ? 'text-info' : 'text-ink-muted'}`}>
                              #{idx + 1}
                            </span>
                            {doc.name}
                          </span>
                          <span className={`shrink-0 ${ifaBadgeClass(ifa)}`}>
                            IFA {(ifa * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-muted">
                          <span>{doc.country}</span>
                          <span>·</span>
                          <span
                            className={`rounded px-1.5 py-0.2 font-mono text-[10px] font-semibold ${
                              isDiscovery ? 'bg-ok/15 text-ok' : 'bg-raised text-ink-muted'
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
                            <span className="rounded bg-info/15 px-1.5 py-0.2 font-mono text-[10px] font-semibold text-info">
                              S2 + SAR
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Pie de telemetría del drawer */}
          {selected && (
            <div className="flex shrink-0 items-center justify-between border-t border-line bg-raised/70 px-3.5 py-2 font-mono text-[10px] text-ink-muted">
              <span>COPERNICUS · SENTINEL 2/1</span>
              <span className="font-semibold text-info">
                {selected.doc.location.coordinates[1].toFixed(2)}°, {selected.doc.location.coordinates[0].toFixed(2)}°
              </span>
            </div>
          )}
        </aside>
      </div>

      {/* Controles móviles de capas/leyenda (visibles solo en < md donde la pila derecha se oculta) */}
      <div className="space-y-3 border-b border-line bg-surface p-3 md:hidden">
        <Inspector isEs={isEs} cell={inspectorCell} candidate={inspectorCandidate} />
        <LayerPanel
          isEs={isEs}
          ifaOpacity={ifaOpacity}
          onIfaOpacity={handleIfaOpacity}
          ifaMode="polygons"
          gridNotice={gridNotice}
          candidatesVisible={candidatesVisible}
          onCandidatesVisible={setCandidatesVisible}
          contextVisibility={contextVisibility}
          contextOpacity={contextOpacity}
          onContextVisible={handleContextVisible}
          onContextOpacity={handleContextOpacity}
        />
        <Legend isEs={isEs} scenario={layerToMode(heatmapLayer)} contextVisibility={contextVisibility} />
      </div>

      {/* DOSSIER CIENTÍFICO INFERIOR (§05) */}
      {selected && (
        <section className="space-y-4 border-t border-line bg-canvas p-4 sm:p-6">
          {/* Barra de encabezado de la región seleccionada */}
          <div className={`${hudCardClass} flex flex-col justify-between gap-4 p-4 lg:flex-row lg:items-center`}>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-info/30 bg-info/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-info">
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
                <span className="font-mono text-[11px] text-ink-muted">
                  {selected.doc.country} · Coord: {selected.doc.location.coordinates[1].toFixed(3)}°,{' '}
                  {selected.doc.location.coordinates[0].toFixed(3)}°
                </span>
              </div>
              <h3 className="text-xl font-bold tracking-tight text-ink">{selected.doc.name}</h3>
            </div>

            <button
              type="button"
              onClick={() => handleOpenInExplorer(selected.doc)}
              className={`inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 font-mono text-xs font-bold text-white shadow-sm transition-all hover:brightness-110 dark:text-[#002b42] ${focusRing}`}
            >
              <span className="material-symbols-outlined text-[17px]" aria-hidden="true">
                travel_explore
              </span>
              <span>{isEs ? 'Abrir en Globo 3D / Explorador' : 'Open in 3D Globe / Explorer'}</span>
            </button>
          </div>

          {/* Banda horizontal 5D IFA */}
          <div className={`${hudCardClass} space-y-3 p-4`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-info" aria-hidden="true">
                  equalizer
                </span>
                <h4 className="text-xs font-bold uppercase tracking-wider text-ink">
                  {isEs ? 'Fidelidad por Dimensión (IFA 5D)' : 'Similarity by Dimension (5D)'}
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-ink-muted">
                  {isEs ? 'Índice Global Ponderado:' : 'Weighted Global Index:'}
                </span>
                <span className={ifaBadgeClass(selected.ifa)}>
                  {(selected.ifa * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
              {dimShortLabels.map(({ key, es, en, bar, text }) => {
                const val = selected.doc.scores?.[key] || 0
                return (
                  <div key={key} className="space-y-1.5 rounded-xl border border-line bg-raised/60 p-3">
                    <div className="flex justify-between gap-2 font-mono text-[11px]">
                      <span className="truncate text-ink-muted">{isEs ? es : en}</span>
                      <span className={`font-bold ${text}`}>{(val * 100).toFixed(0)}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${bar}`}
                        style={{ width: `${Math.round(val * 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 4 Tarjetas científicas cualitativas (§05) */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className={`${hudCardClass} space-y-2.5 p-4`}>
              <div className="flex items-center gap-2 text-info">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-info/15">
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                    science
                  </span>
                </span>
                <h4 className="text-sm font-bold text-ink">
                  {isEs ? '1 · Similitud de Propiedad Física' : '1 · Physical Property Similarity'}
                </h4>
              </div>
              <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-ink-muted">
                {simProperties.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>

            <div className={`${hudCardClass} space-y-2.5 p-4`}>
              <div className="flex items-center gap-2 text-ok">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ok/15">
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                    cyclone
                  </span>
                </span>
                <h4 className="text-sm font-bold text-ink">
                  {isEs ? '2 · Similitud de Proceso Dinámico' : '2 · Dynamic Process Similarity'}
                </h4>
              </div>
              <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-ink-muted">
                {simProcesses.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>

            <div className={`${hudCardClass} space-y-2.5 p-4`}>
              <div className="flex items-center gap-2 text-warn">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-warn/15">
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                    warning
                  </span>
                </span>
                <h4 className="text-sm font-bold text-ink">
                  {isEs ? '3 · Diferencias y Límites' : '3 · Differences & Limits'}
                </h4>
              </div>
              <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-ink-muted">
                {diffLimits.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>

            <div className={`${hudCardClass} space-y-2.5 p-4`}>
              <div className="flex items-center gap-2 text-accent">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15">
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                    precision_manufacturing
                  </span>
                </span>
                <h4 className="text-sm font-bold text-ink">
                  {isEs ? '4 · Ingeniería y Exploración' : '4 · Engineering & Exploration'}
                </h4>
              </div>
              <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-ink-muted">
                {useCases.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Mediciones físicas GEE, comparador orbital S2/S1 y astrobiología */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            {selected.doc.p1_cell_metrics && (
              <div className={`${hudCardClass} space-y-2.5 p-4 xl:col-span-5`}>
                <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-ink-muted">
                  {isEs
                    ? `Mediciones Físicas GEE (${selected.doc.p1_cell_metrics.cell_id} · Ventana 5 km)`
                    : `GEE Physical Measurements (${selected.doc.p1_cell_metrics.cell_id} · 5 km Window)`}
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                  <div className="rounded-lg border border-line bg-raised/60 p-2">
                    <span className="block text-[10px] text-ink-muted">Elev. / Relieve</span>
                    <span className="font-mono font-semibold text-ink">
                      {selected.doc.p1_cell_metrics.elev_m ?? '—'} m / Δ
                      {selected.doc.p1_cell_metrics.relief_local_m ?? '—'} m
                    </span>
                  </div>
                  <div className="rounded-lg border border-line bg-raised/60 p-2">
                    <span className="block text-[10px] text-ink-muted">Pendiente 240 m</span>
                    <span className="font-mono font-semibold text-ink">
                      {selected.doc.p1_cell_metrics.slope_mean_deg ?? '—'}° (p90:{' '}
                      {selected.doc.p1_cell_metrics.slope_p90_deg ?? '—'}°)
                    </span>
                  </div>
                  <div className="rounded-lg border border-line bg-raised/60 p-2">
                    <span className="block text-[10px] text-ink-muted">Sombra Solar Máx</span>
                    <span className="font-mono font-semibold text-ink">
                      {((selected.doc.p1_cell_metrics.shadow_frac_max ?? 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="rounded-lg border border-line bg-raised/60 p-2">
                    <span className="block text-[10px] text-ink-muted">MODIS LST Mín / Amp</span>
                    <span className="font-mono font-semibold text-ink">
                      {selected.doc.p1_cell_metrics.lst_min_k ?? '—'} K / Δ
                      {selected.doc.p1_cell_metrics.lst_amp_k ?? '—'} K
                    </span>
                  </div>
                  <div className="rounded-lg border border-line bg-raised/60 p-2">
                    <span className="block text-[10px] text-ink-muted">Nieve MOD10A2</span>
                    <span className="font-mono font-semibold text-ink">
                      {((selected.doc.p1_cell_metrics.snow_persist ?? 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="rounded-lg border border-line bg-raised/60 p-2">
                    <span className="block text-[10px] text-ink-muted">Polvo AOD p90 / NDVI</span>
                    <span className="font-mono font-semibold text-ink">
                      {selected.doc.p1_cell_metrics.aod_p90 ?? '—'} /{' '}
                      {selected.doc.p1_cell_metrics.ndvi_max ?? '—'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {selected.doc.orbital_previews && (
              <div className={`${hudCardClass} space-y-2.5 p-4 xl:col-span-4`}>
                <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-ink-muted">
                  {isEs
                    ? 'Comparador Orbital P1: Sentinel-2 vs. Sentinel-1 SAR (Lee)'
                    : 'P1 Orbital Comparator: Sentinel-2 vs. Sentinel-1 SAR (Lee)'}
                </h4>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <img
                      src={selected.doc.orbital_previews.sentinel2_rgb_url}
                      alt="Sentinel-2 True Color"
                      className="aspect-square w-full rounded-lg border border-line object-cover"
                    />
                    <p className="mt-1 font-mono text-[10px] text-ink-muted">
                      ESA Sentinel-2 L2A RGB (10 m)
                    </p>
                  </div>
                  <div>
                    <img
                      src={selected.doc.orbital_previews.sentinel1_sar_url}
                      alt="Sentinel-1 C-Band SAR"
                      className="aspect-square w-full rounded-lg border border-line object-cover"
                    />
                    <p className="mt-1 font-mono text-[10px] text-ink-muted">
                      S1 SAR C-Band (σ⁰ media: {selected.doc.orbital_previews.sar_stats_db?.mean ?? '—'} dB)
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div
              className={`${hudCardClass} space-y-2.5 p-4 ${
                selected.doc.p1_cell_metrics && selected.doc.orbital_previews
                  ? 'xl:col-span-3'
                  : selected.doc.p1_cell_metrics || selected.doc.orbital_previews
                    ? 'xl:col-span-7'
                    : 'xl:col-span-12'
              }`}
            >
              <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-ink-muted">
                {isEs
                  ? '5 · Potencial Subterráneo y Astrobiología'
                  : '5 · Subsurface & Astrobiology'}
              </h4>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="font-semibold text-ink">
                    {isEs ? 'Subsuelo / Cavidades: ' : 'Subsurface / Cavities: '}
                  </span>
                  <span className="text-ink-muted">
                    {selected.doc.subsurface_and_biology?.subsurface_potential ?? '—'}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-ink">
                    {isEs ? 'Extremófilos / Biofirmas: ' : 'Extremophiles / Biosignatures: '}
                  </span>
                  <span className="text-ink-muted">
                    {selected.doc.subsurface_and_biology?.extremophiles_note ?? '—'}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 border-t border-line pt-2">
                <span className="text-[11px] text-ink-muted">
                  {isEs ? 'Datasets oficiales:' : 'Official datasets:'}
                </span>
                {(selected.doc.datasets_used ?? []).map((ds) => (
                  <span
                    key={ds}
                    className="rounded border border-line bg-raised px-1.5 py-0.5 font-mono text-[10px] text-ink-muted"
                  >
                    {ds}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
