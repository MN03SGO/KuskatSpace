import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect, useMemo } from 'react'
import { ImageOverlay, MapContainer, Rectangle, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { BODIES, baseTiles } from '../../config/bodies'
import { useT } from '../../i18n/useT'
import { type BBox, type LeafletBounds, bboxAroundPoint, toLeafletBounds } from '../../lib/bbox'
import { useExplorerStore } from '../../store/useExplorerStore'

const WORLD_BOUNDS: LeafletBounds = [
  [-90, -180],
  [90, 180],
]

/** Vuela solo cuando cambian los bounds (B14: antes se disparaba en cada render). */
function FlyToBounds({ bounds }: { bounds: LeafletBounds }) {
  const map = useMap()
  useEffect(() => {
    map.flyToBounds(bounds, { padding: [40, 40], maxZoom: 6, duration: 0.7 })
  }, [map, bounds])
  return null
}

function ClickToBBox({ maxLat, onSelect }: { maxLat: number; onSelect: (bbox: BBox) => void }) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng.wrap()
      onSelect(bboxAroundPoint(lng, lat, { maxLat }))
    },
  })
  return null
}

export default function PlanetMap() {
  const t = useT()
  const body = useExplorerStore((s) => s.body)
  const bbox = useExplorerStore((s) => s.bbox)
  const gibsDate = useExplorerStore((s) => s.gibsDate)
  const scene = useExplorerStore((s) => s.scene)
  const opacity = useExplorerStore((s) => s.opacity)
  const setBbox = useExplorerStore((s) => s.setBbox)

  const cfg = BODIES[body]
  const bounds = useMemo(() => toLeafletBounds(bbox), [bbox])
  const tiles = useMemo(() => baseTiles(body, gibsDate), [body, gibsDate])

  return (
    <div className="h-full w-full" role="region" aria-label={t('explorer.mapLabel')}>
      <MapContainer
        key={body}
        crs={cfg.crs === 'EPSG3857' ? L.CRS.EPSG3857 : L.CRS.EPSG4326}
        center={cfg.center}
        zoom={cfg.zoom}
        minZoom={1}
        maxZoom={cfg.maxZoom}
        maxBounds={WORLD_BOUNDS}
        maxBoundsViscosity={1}
        worldCopyJump={false}
        className="h-full w-full"
      >
        {tiles.map((tile) => (
          <TileLayer
            key={tile.id}
            url={tile.url}
            attribution={tile.attribution}
            maxNativeZoom={tile.maxNativeZoom}
            opacity={tile.opacity ?? 1}
            noWrap
            bounds={WORLD_BOUNDS}
          />
        ))}

        <FlyToBounds bounds={bounds} />
        <ClickToBBox maxLat={cfg.maxClickLat} onSelect={setBbox} />
        <Rectangle bounds={bounds} pathOptions={{ color: '#38bdf8', weight: 2, fillOpacity: 0.05 }} />

        {/* B17: la clave depende de la escena procesada, no del bbox actual. */}
        {scene && (
          <ImageOverlay
            key={scene.id}
            url={scene.response.overlay_png_base64}
            bounds={scene.response.bounds}
            opacity={opacity}
          />
        )}
      </MapContainer>
    </div>
  )
}
