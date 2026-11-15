import { useEffect, useMemo, useRef, useState } from 'react'
import { Map as MapLibreMap, Marker, NavigationControl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { requestJson } from '../../api/http'
import { API_BASE } from '../../config/env'

export type TargetId = 'moon_south_pole' | 'moon_lava_tube' | 'mars'

export interface CandidateMetrics {
  elevation_mean_m?: number | null
  elevation_min_m?: number | null
  elevation_max_m?: number | null
  slope_mean_deg?: number | null
  slope_p90_deg?: number | null
  roughness_m?: number | null
  svf?: number | null
  lst_mean_k?: number | null
  lst_min_k?: number | null
  lst_day_mean_k?: number | null
  lst_night_mean_k?: number | null
  ice_persistence?: number | null
  vegetation_fraction?: number | null
  permanent_ice_fraction?: number | null
}

export interface CandidateScores {
  relieve: number
  iluminacion: number
  frio: number
  hielo: number
}

export interface AnalogCandidate {
  _id?: string
  id?: string
  name: string
  country?: string | null
  target: TargetId | string
  analog_type: string
  is_understudied?: boolean
  is_curated?: boolean
  location: {
    type: string
    coordinates: [number, number]
  }
  metrics?: CandidateMetrics | null
  scores: CandidateScores
  weighted_score?: number
  similar_values?: string[]
  similar_processes?: string[]
  earth_limits?: string[]
  exploration_use?: string
  datasets?: string[]
}

interface Weights {
  relieve: number
  iluminacion: number
  frio: number
  hielo: number
}

const TARGET_OPTIONS: Array<{ id: TargetId; label: string; subtitle: string }> = [
  {
    id: 'moon_south_pole',
    label: 'Polo Sur Lunar',
    subtitle: 'Crestas iluminadas, pendientes polares y trampas frías PSR',
  },
  {
    id: 'moon_lava_tube',
    label: 'Tubo de Lava Lunar',
    subtitle: 'Escarpes basálticos, oclusión topográfica y oquedades volcánicas',
  },
  {
    id: 'mars',
    label: 'Marte',
    subtitle: 'Planicies sedimentarias, cuencas hiperáridas y permafrost somero',
  },
]

const SLIDER_META: Array<{ key: keyof Weights; label: string; hint: string }> = [
  { key: 'relieve', label: 'Relieve', hint: 'Pendiente media (DEM 90 m)' },
  { key: 'iluminacion', label: 'Iluminación', hint: 'SVF + latitud solar' },
  { key: 'frio', label: 'Frío', hint: 'Temperatura superficial LST' },
  { key: 'hielo', label: 'Hielo', hint: 'Persistencia nival / hielo' },
]

const STANDARD_EARTH_LIMITS: Record<TargetId, string[]> = {
  moon_south_pole: [
    'Gravedad terrestre (1.0g) frente a 0.165g lunar: altera tracción y estabilidad de rovers.',
    'Presencia de atmósfera terrestre frente a vacío ultra-alto lunar (10^-10 Pa).',
    'Blindaje geomagnético/atmosférico frente a radiación GCR y eventos solares (SPE).',
  ],
  moon_lava_tube: [
    'Gravedad terrestre (1.0g) frente a 0.165g lunar: permite túneles lunares de mayor escala.',
    'Resolución DEM Copernicus 90 m: no resuelve claraboyas volcánicas individuales (< 90 m).',
    'Presencia de atmósfera y humedad frente a vacío total y ausencia de meteorización hídrica.',
  ],
  mars: [
    'Gravedad terrestre (1.0g) frente a 0.38g marciana.',
    'Atmósfera densa de N2/O2 (~101 kPa) frente a 610 Pa de CO2 en Marte.',
    'Menor flujo de radiación UV-C y cósmica en superficie respecto al entorno marciano.',
  ],
}

const AUTO_USE_BY_DIMENSION: Record<keyof CandidateScores, string> = {
  relieve: 'Pruebas de movilidad, inclinometría y navegación autónoma en pendientes',
  iluminacion: 'Ensayos de régimen solar, potencia fotovoltaica y visibilidad del horizonte',
  frio: 'Validación térmica de aviónica, baterías y mecanismos criogénicos',
  hielo: 'Prospección ISRU de volátiles y perforación en regolito helado/permafrost',
}

function getCandidateId(c: AnalogCandidate): string {
  return c.id ?? c._id ?? c.name
}

function computeWeightedScore(scores: CandidateScores, w: Weights): number {
  const totalWeight = w.relieve + w.iluminacion + w.frio + w.hielo
  if (totalWeight <= 0) return 0
  const val =
    (scores.relieve * w.relieve +
      scores.iluminacion * w.iluminacion +
      scores.frio * w.frio +
      scores.hielo * w.hielo) /
    totalWeight
  return Math.round(val * 10000) / 10000
}

function getSuggestedUse(scores: CandidateScores): string {
  const entries = Object.entries(scores) as Array<[keyof CandidateScores, number]>
  entries.sort((a, b) => b[1] - a[1])
  const topDim = entries[0]?.[0] ?? 'relieve'
  return AUTO_USE_BY_DIMENSION[topDim]
}

function scoreColor(score: number): string {
  if (score >= 0.78) return '#10b981'
  if (score >= 0.58) return '#38bdf8'
  if (score >= 0.4) return '#f59e0b'
  return '#f87171'
}

export function AnalogsView({ onOpenExplorer }: { onOpenExplorer?: () => void }) {
  const [target, setTarget] = useState<TargetId>('moon_south_pole')
  const [rawCandidates, setRawCandidates] = useState<AnalogCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [weights, setWeights] = useState<Weights>({
    relieve: 1.0,
    iluminacion: 1.0,
    frio: 1.0,
    hielo: 1.0,
  })

  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markersRef = useRef<Map<string, Marker>>(new Map())

  // Una única petición HTTP al cambiar de objetivo planetario
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    requestJson<AnalogCandidate[]>(`${API_BASE}/candidates?target=${target}&limit=200`)
      .then((data) => {
        if (cancelled) return
        const list = Array.isArray(data) ? data : []
        setRawCandidates(list)
        setSelectedId(list[0] ? getCandidateId(list[0]) : null)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Error cargando candidatos análogos')
        setRawCandidates([])
        setSelectedId(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [target])

  // Recálculo ponderado 100% en TypeScript en memoria (0 latencia)
  const rankedCandidates = useMemo(() => {
    return rawCandidates
      .map((c) => ({
        ...c,
        computedScore: computeWeightedScore(c.scores, weights),
      }))
      .sort((a, b) => b.computedScore - a.computedScore)
  }, [rawCandidates, weights])

  const selectedCandidate = useMemo(() => {
    if (!rankedCandidates.length) return null
    return (
      rankedCandidates.find((c) => getCandidateId(c) === selectedId) ?? rankedCandidates[0]
    )
  }, [rankedCandidates, selectedId])

  // Inicializar mapa MapLibre GL
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = new MapLibreMap({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap © CARTO',
          },
        },
        layers: [
          {
            id: 'osm-dark',
            type: 'raster',
            source: 'osm',
          },
        ],
      },
      center: [-20, 15],
      zoom: 1.4,
    })

    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    mapRef.current = map

    return () => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current.clear()
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Actualizar marcadores en MapLibre al cambiar ranking o selección
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    markersRef.current.forEach((m) => m.remove())
    markersRef.current.clear()

    rankedCandidates.forEach((c, idx) => {
      const id = getCandidateId(c)
      const [lon, lat] = c.location.coordinates
      const isSelected = selectedCandidate && getCandidateId(selectedCandidate) === id
      const color = scoreColor(c.computedScore)

      const el = document.createElement('button')
      el.type = 'button'
      el.title = `${c.name} (${(c.computedScore * 100).toFixed(1)}%)`
      el.style.width = isSelected ? '22px' : '15px'
      el.style.height = isSelected ? '22px' : '15px'
      el.style.borderRadius = '9999px'
      el.style.backgroundColor = color
      el.style.border = isSelected ? '3px solid #f8fafc' : '2px solid #020617'
      el.style.boxShadow = isSelected
        ? '0 0 0 3px rgba(56, 189, 248, 0.65)'
        : '0 2px 6px rgba(0, 0, 0, 0.7)'
      el.style.cursor = 'pointer'
      el.style.display = 'flex'
      el.style.alignItems = 'center'
      el.style.justifyContent = 'center'
      el.style.fontSize = '9px'
      el.style.fontWeight = '700'
      el.style.color = '#020617'
      if (idx < 3 || isSelected) {
        el.textContent = String(idx + 1)
      }

      el.addEventListener('click', () => {
        setSelectedId(id)
      })

      const marker = new Marker({ element: el }).setLngLat([lon, lat]).addTo(map)
      markersRef.current.set(id, marker)
    })
  }, [rankedCandidates, selectedCandidate])

  // Centrar mapa en candidato seleccionado
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedCandidate) return
    const [lon, lat] = selectedCandidate.location.coordinates
    map.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 3.8), duration: 700 })
  }, [selectedId])

  const activeTargetMeta = TARGET_OPTIONS.find((t) => t.id === target) ?? TARGET_OPTIONS[0]

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-canvas text-ink">
      {/* Barra superior de selección de objetivo planetario */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {TARGET_OPTIONS.map((opt) => {
            const active = opt.id === target
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTarget(opt.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-info ${
                  active
                    ? 'bg-accent text-ink shadow-sm'
                    : 'border border-line bg-raised text-ink-muted hover:text-ink'
                }`}
              >
                {opt.label}
              </button>
            )
          })}
          <span className="ml-2 hidden text-xs text-ink-muted lg:inline">
            {activeTargetMeta.subtitle}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs text-ink-muted">
          <span>
            {loading
              ? 'Cargando catálogo...'
              : `${rankedCandidates.length} sitios análogos evaluados`}
          </span>
          {onOpenExplorer && (
            <button
              type="button"
              onClick={onOpenExplorer}
              className="rounded border border-line bg-raised px-2.5 py-1 text-xs font-medium text-ink hover:border-info"
            >
              Explorador Ráster
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="border-b border-danger/40 bg-danger/10 px-4 py-2 text-xs text-danger">
          Error al consultar <code>/candidates</code>: {error}
        </div>
      )}

      {/* Cuerpo principal: Sliders + Ranking | Mapa MapLibre | Ficha 2 niveles */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-12">
        {/* Columna izquierda: Sliders en tiempo real + Ranking */}
        <aside className="flex min-h-0 flex-col border-b border-line bg-surface lg:col-span-4 lg:border-r lg:border-b-0">
          <div className="border-b border-line p-3.5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-bold tracking-wide text-ink-muted uppercase">
                Pesos en Tiempo Real (Cliente TS)
              </h2>
              <button
                type="button"
                onClick={() =>
                  setWeights({ relieve: 1.0, iluminacion: 1.0, frio: 1.0, hielo: 1.0 })
                }
                className="text-[11px] text-info hover:underline"
              >
                Reiniciar
              </button>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
              {SLIDER_META.map(({ key, label, hint }) => (
                <label key={key} className="block">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-ink">{label}</span>
                    <span className="font-mono text-[11px] text-info">
                      {weights[key].toFixed(1)}×
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={5}
                    step={0.1}
                    value={weights[key]}
                    onChange={(e) =>
                      setWeights((prev) => ({ ...prev, [key]: Number(e.target.value) }))
                    }
                    className="mt-1 w-full accent-accent"
                  />
                  <span className="block text-[10px] text-ink-muted">{hint}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
            <div className="space-y-1.5">
              {rankedCandidates.map((c, idx) => {
                const id = getCandidateId(c)
                const isSelected = selectedCandidate && getCandidateId(selectedCandidate) === id
                const pct = Math.round(c.computedScore * 100)
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedId(id)}
                    className={`w-full rounded-md border p-2.5 text-left transition ${
                      isSelected
                        ? 'border-info bg-raised'
                        : 'border-line/70 bg-canvas/50 hover:border-line hover:bg-raised/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[11px] text-ink-muted">#{idx + 1}</span>
                          <span className="truncate text-xs font-semibold text-ink">{c.name}</span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-muted">
                          {c.country && <span>{c.country}</span>}
                          <span
                            className={`rounded px-1.5 py-0.2 text-[10px] font-medium ${
                              c.is_curated
                                ? 'bg-accent/20 text-info'
                                : 'bg-line/50 text-ink-muted'
                            }`}
                          >
                            {c.is_curated ? 'Curado' : 'Malla'}
                          </span>
                          {c.is_understudied && (
                            <span className="rounded bg-warn/15 px-1.5 py-0.2 text-[10px] text-warn">
                              Subestudiado
                            </span>
                          )}
                        </div>
                      </div>
                      <span
                        className="shrink-0 font-mono text-sm font-bold"
                        style={{ color: scoreColor(c.computedScore) }}
                      >
                        {pct}%
                      </span>
                    </div>

                    <div className="mt-2 grid grid-cols-4 gap-1 text-[10px] text-ink-muted">
                      <span>Rel {(c.scores.relieve * 100).toFixed(0)}%</span>
                      <span>Ilu {(c.scores.iluminacion * 100).toFixed(0)}%</span>
                      <span>Frí {(c.scores.frio * 100).toFixed(0)}%</span>
                      <span>Hie {(c.scores.hielo * 100).toFixed(0)}%</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </aside>

        {/* Centro + Derecha: Mapa MapLibre y Ficha de Detalle en 2 Niveles */}
        <section className="grid min-h-0 grid-rows-2 lg:col-span-8 lg:grid-cols-12 lg:grid-rows-1">
          <div className="relative min-h-[260px] lg:col-span-7">
            <div ref={mapContainerRef} className="h-full w-full" />
            <div className="pointer-events-none absolute bottom-3 left-3 rounded border border-line bg-surface/90 px-2.5 py-1.5 text-[11px] text-ink-muted backdrop-blur-sm">
              Bancos de pruebas terrestres (análogos) · no indica aptitud de construcción extraterrestre
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto border-t border-line bg-surface p-4 lg:col-span-5 lg:border-t-0 lg:border-l">
            {selectedCandidate ? (
              <CandidateDetailPanel candidate={selectedCandidate} target={target} />
            ) : (
              <p className="text-xs text-ink-muted">
                Selecciona un sitio análogo en el ranking o en el mapa para inspeccionar sus métricas reales.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function CandidateDetailPanel({
  candidate,
  target,
}: {
  candidate: AnalogCandidate & { computedScore: number }
  target: TargetId
}) {
  const m = candidate.metrics
  const isCurated = Boolean(candidate.is_curated)
  const [lon, lat] = candidate.location.coordinates
  const limits =
    candidate.earth_limits && candidate.earth_limits.length > 0
      ? candidate.earth_limits
      : STANDARD_EARTH_LIMITS[target]

  const lstC =
    m?.lst_mean_k !== null && m?.lst_mean_k !== undefined
      ? (m.lst_mean_k - 273.15).toFixed(1)
      : null

  return (
    <div className="space-y-4">
      <header className="border-b border-line pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="inline-block rounded bg-raised px-2 py-0.5 text-[10px] font-semibold text-info uppercase">
              {isCurated ? 'Ficha Curada · Nivel 1' : 'Punto de Malla · Nivel 2'}
            </span>
            <h3 className="mt-1.5 text-base font-bold text-ink">{candidate.name}</h3>
            <p className="text-xs text-ink-muted">
              {candidate.country ? `${candidate.country} · ` : ''}
              {lat.toFixed(2)}°, {lon.toFixed(2)}° · Tipo: {candidate.analog_type}
            </p>
          </div>
          <div className="text-right">
            <div
              className="font-mono text-2xl font-bold"
              style={{ color: scoreColor(candidate.computedScore) }}
            >
              {(candidate.computedScore * 100).toFixed(1)}%
            </div>
            <div className="text-[10px] text-ink-muted">Similitud ponderada</div>
          </div>
        </div>
      </header>

      {/* Valores físicos reales medidos (Planetary Computer) */}
      <div>
        <h4 className="mb-2 text-xs font-bold tracking-wide text-ink-muted uppercase">
          Valores Físicos Medidos (STAC)
        </h4>
        {m ? (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <MetricCard
              label="Pendiente media"
              value={m.slope_mean_deg != null ? `${m.slope_mean_deg.toFixed(2)}°` : 'N/D'}
            />
            <MetricCard
              label="Sky View Factor (SVF)"
              value={m.svf != null ? m.svf.toFixed(3) : 'N/D'}
            />
            <MetricCard
              label="LST media"
              value={
                m.lst_mean_k != null ? `${m.lst_mean_k.toFixed(1)} K (${lstC} °C)` : 'N/D'
              }
            />
            <MetricCard
              label="Persistencia hielo"
              value={
                m.ice_persistence != null ? `${(m.ice_persistence * 100).toFixed(1)}%` : 'N/D'
              }
            />
            <MetricCard
              label="Elevación media"
              value={m.elevation_mean_m != null ? `${m.elevation_mean_m.toFixed(0)} m` : 'N/D'}
            />
            <MetricCard
              label="Vegetación WorldCover"
              value={
                m.vegetation_fraction != null
                  ? `${(m.vegetation_fraction * 100).toFixed(1)}%`
                  : 'N/D'
              }
            />
          </div>
        ) : (
          <p className="text-xs text-ink-muted">Métricas ráster sin desglose adjunto.</p>
        )}
      </div>

      {/* Puntajes por dimensión */}
      <div>
        <h4 className="mb-2 text-xs font-bold tracking-wide text-ink-muted uppercase">
          Puntajes por Dimensión
        </h4>
        <div className="space-y-1.5 text-xs">
          {(
            [
              ['Relieve', candidate.scores.relieve],
              ['Iluminación', candidate.scores.iluminacion],
              ['Frío', candidate.scores.frio],
              ['Hielo', candidate.scores.hielo],
            ] as const
          ).map(([label, val]) => (
            <div key={label}>
              <div className="flex justify-between text-[11px]">
                <span>{label}</span>
                <span className="font-mono">{(val * 100).toFixed(1)}%</span>
              </div>
              <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded bg-raised">
                <div
                  className="h-full rounded"
                  style={{ width: `${Math.round(val * 100)}%`, backgroundColor: scoreColor(val) }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contenido Nivel 1 (Curado) vs Nivel 2 (Malla) */}
      {isCurated ? (
        <>
          {candidate.similar_values && candidate.similar_values.length > 0 && (
            <DetailList title="Valores Similares" items={candidate.similar_values} />
          )}
          {candidate.similar_processes && candidate.similar_processes.length > 0 && (
            <DetailList
              title="Procesos Físicos (Proceso vs. Apariencia)"
              items={candidate.similar_processes}
            />
          )}
          {candidate.exploration_use && (
            <div>
              <h4 className="mb-1 text-xs font-bold tracking-wide text-ink-muted uppercase">
                Uso en Validación / Exploración
              </h4>
              <p className="rounded border border-line bg-canvas/60 p-2.5 text-xs leading-relaxed text-ink">
                {candidate.exploration_use}
              </p>
            </div>
          )}
        </>
      ) : (
        <div>
          <h4 className="mb-1 text-xs font-bold tracking-wide text-ink-muted uppercase">
            Uso Sugerido (Automático por Dimensión Dominante)
          </h4>
          <p className="rounded border border-info/40 bg-info/10 p-2.5 text-xs leading-relaxed text-ink">
            {getSuggestedUse(candidate.scores)}
          </p>
        </div>
      )}

      {/* Límites terrestres (siempre presentes en ambos niveles) */}
      <DetailList title="Dónde Falla este Análogo (Límites Terrestres)" items={limits} warn />
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line/70 bg-canvas/60 px-2.5 py-2">
      <div className="text-[10px] text-ink-muted">{label}</div>
      <div className="mt-0.5 font-mono text-xs font-semibold text-ink">{value}</div>
    </div>
  )
}

function DetailList({
  title,
  items,
  warn = false,
}: {
  title: string
  items: string[]
  warn?: boolean
}) {
  return (
    <div>
      <h4 className="mb-1.5 text-xs font-bold tracking-wide text-ink-muted uppercase">{title}</h4>
      <ul
        className={`space-y-1 rounded border p-2.5 text-xs leading-relaxed ${
          warn ? 'border-warn/40 bg-warn/5 text-ink' : 'border-line bg-canvas/60 text-ink'
        }`}
      >
        {items.map((item, i) => (
          <li key={i} className="flex gap-1.5">
            <span className={warn ? 'text-warn' : 'text-info'}>•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
