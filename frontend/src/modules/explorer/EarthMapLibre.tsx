import { useEffect, useRef } from 'react'
import {
  Map as MapLibreMap,
  NavigationControl,
  type GeoJSONSource,
  type MapMouseEvent,
  type StyleSpecification,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { BODIES, ESRI_ATTRIBUTION, ESRI_WORLD_IMAGERY } from '../../config/bodies'
import { useT } from '../../i18n/useT'
import type { BBox } from '../../lib/bbox'
import { bboxAroundPoint } from '../../lib/bbox'
import { ensureMaplibreWorker } from '../../lib/maplibreSetup'
import {
  GIBS_LAYER_ID,
  removeGibsLayer,
  setGibsOpacity,
  updateOverlayLayer,
} from '../../lib/maplibreOverlayLayers'
import {
  PROCESS_OVERLAY_LAYER_ID,
  removeProcessOverlay,
} from '../../lib/maplibreProcessOverlay'
import { useExplorerStore } from '../../store/useExplorerStore'
import { useActivePlanetLayer } from './usePlanetLayer'

ensureMaplibreWorker()

/**
 * Basemap satelital Esri World Imagery (sin API key).
 * Estilo MapLibre mínimo: un source raster + una capa.
 */
const SATELLITE_STYLE: StyleSpecification = {
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

const BBOX_SOURCE_ID = 'search-bbox'
const BBOX_FILL_ID = 'search-bbox-fill'
const BBOX_LINE_ID = 'search-bbox-line'

const OVERLAY_OPACITY_DEFAULT = 0.7

function bboxPolygon(bbox: BBox): GeoJSON.FeatureCollection {
  const [minLon, minLat, maxLon, maxLat] = bbox
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [minLon, minLat],
            [maxLon, minLat],
            [maxLon, maxLat],
            [minLon, maxLat],
            [minLon, minLat],
          ]],
        },
      },
    ],
  }
}

/** Orden: basemap < GIBS < NDVI < bbox fill < bbox line */
function restackOverlays(map: MapLibreMap) {
  if (map.getLayer(GIBS_LAYER_ID) && map.getLayer(PROCESS_OVERLAY_LAYER_ID)) {
    map.moveLayer(GIBS_LAYER_ID, PROCESS_OVERLAY_LAYER_ID)
  }
  if (map.getLayer(PROCESS_OVERLAY_LAYER_ID) && map.getLayer(BBOX_FILL_ID)) {
    map.moveLayer(PROCESS_OVERLAY_LAYER_ID, BBOX_FILL_ID)
  }
  if (map.getLayer(GIBS_LAYER_ID) && map.getLayer(BBOX_FILL_ID) && !map.getLayer(PROCESS_OVERLAY_LAYER_ID)) {
    map.moveLayer(GIBS_LAYER_ID, BBOX_FILL_ID)
  }
  if (map.getLayer(BBOX_LINE_ID)) map.moveLayer(BBOX_LINE_ID)
}

function upsertBboxLayer(map: MapLibreMap, bbox: BBox) {
  const data = bboxPolygon(bbox)
  const src = map.getSource(BBOX_SOURCE_ID) as GeoJSONSource | undefined
  if (src) {
    src.setData(data)
  } else {
    map.addSource(BBOX_SOURCE_ID, { type: 'geojson', data })
    // Zona de selección: sin relleno; solo contorno cian punteado
    map.addLayer({
      id: BBOX_FILL_ID,
      type: 'fill',
      source: BBOX_SOURCE_ID,
      paint: { 'fill-color': '#22d3ee', 'fill-opacity': 0 },
    })
    map.addLayer({
      id: BBOX_LINE_ID,
      type: 'line',
      source: BBOX_SOURCE_ID,
      paint: {
        'line-color': '#22d3ee',
        'line-width': 1.5,
        'line-dasharray': [2, 2],
        'line-opacity': 0.95,
      },
    })
  }
  if (map.getLayer(BBOX_FILL_ID)) {
    map.setPaintProperty(BBOX_FILL_ID, 'fill-opacity', 0)
  }
  if (map.getLayer(BBOX_LINE_ID)) {
    map.setPaintProperty(BBOX_LINE_ID, 'line-color', '#22d3ee')
    map.setPaintProperty(BBOX_LINE_ID, 'line-width', 1.5)
    map.setPaintProperty(BBOX_LINE_ID, 'line-dasharray', [2, 2])
  }
  restackOverlays(map)
}

/** Vuela la cámara al BBox de estudio (zona de búsqueda / Central America, etc.). */
function fitToBbox(map: MapLibreMap, bbox: BBox, padding = 50) {
  const [minLon, minLat, maxLon, maxLat] = bbox
  map.fitBounds(
    [
      [minLon, minLat],
      [maxLon, maxLat],
    ],
    { padding, maxZoom: 10, duration: 700 },
  )
}

/**
 * Mapa Tierra (MapLibre): satélite Esri + GIBS (T/H/P) + NDVI/proceso anclado al BBox.
 */
export function EarthMapLibre() {
  const t = useT()
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  /** Última capa GIBS activada — para volar al BBox solo al seleccionar/cambiar, no al desactivar. */
  const lastGibsIdRef = useRef<string | null>(null)

  const bbox = useExplorerStore((s) => s.bbox)
  const scene = useExplorerStore((s) => s.scene)
  const opacity = useExplorerStore((s) => s.opacity)
  const planetLayerOpacity = useExplorerStore((s) => s.planetLayerOpacity)
  const setBbox = useExplorerStore((s) => s.setBbox)
  const maxLat = BODIES.earth.maxClickLat
  const activePlanet = useActivePlanetLayer()

  // Init mapa una sola vez — fondo satelital Esri
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = new MapLibreMap({
      container: mapContainerRef.current,
      style: SATELLITE_STYLE,
      center: [BODIES.earth.center[1], BODIES.earth.center[0]],
      zoom: BODIES.earth.zoom,
      maxPitch: 0,
    })
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    mapRef.current = map

    const onClick = (e: MapMouseEvent) => {
      const { lng, lat } = e.lngLat
      setBbox(bboxAroundPoint(lng, lat, { maxLat }))
    }

    const onStyleReady = () => {
      const state = useExplorerStore.getState()
      upsertBboxLayer(map, state.bbox)

      // Remontar GIBS + NDVI tras style.load
      const layer = state.planetLayer
      if (layer && state.body === 'earth') {
        // useActivePlanetLayer no está disponible aquí → se reaplica en el effect de activePlanet
      }
      if (state.scene?.response?.overlay_png_base64) {
        const eff = state.scene.response.bbox
        const overlayBbox: BBox =
          eff && eff.length === 4
            ? [eff[0], eff[1], eff[2], eff[3]]
            : state.scene.request.bbox
        updateOverlayLayer(map, 'ndvi', {
          bbox: overlayBbox,
          image: state.scene.response.overlay_png_base64,
          leafletBounds: state.scene.response.bounds,
          opacity: state.opacity > 0 ? state.opacity : OVERLAY_OPACITY_DEFAULT,
          beforeId: BBOX_FILL_ID,
        })
      }
      restackOverlays(map)
    }

    map.on('load', onStyleReady)
    map.on('style.load', onStyleReady)
    map.on('click', onClick)

    return () => {
      map.off('load', onStyleReady)
      map.off('style.load', onStyleReady)
      map.off('click', onClick)
      map.remove()
      mapRef.current = null
    }
  }, [maxLat, setBbox])

  // Rectángulo de búsqueda + cámara
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const apply = () => {
      upsertBboxLayer(map, bbox)
      fitToBbox(map, bbox)
    }
    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  }, [bbox])

  // Temperatura / Humedad / Precipitación → GIBS WMTS + zoom al BBox de estudio
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const apply = () => {
      if (!activePlanet || activePlanet.kind !== 'gibs') {
        lastGibsIdRef.current = null
        removeGibsLayer(map)
        restackOverlays(map)
        return
      }
      updateOverlayLayer(map, activePlanet.id, {
        gibsId: activePlanet.gibsId,
        date: activePlanet.date,
        mercatorMaxLevel: activePlanet.mercatorMaxLevel,
        opacity: useExplorerStore.getState().planetLayerOpacity,
        beforeId: map.getLayer(PROCESS_OVERLAY_LAYER_ID)
          ? PROCESS_OVERLAY_LAYER_ID
          : map.getLayer(BBOX_FILL_ID)
            ? BBOX_FILL_ID
            : undefined,
      })
      restackOverlays(map)

      // Tras clic en Temperatura/Humedad/Precipitación → encuadrar la zona de estudio
      const switched = lastGibsIdRef.current !== activePlanet.id
      lastGibsIdRef.current = activePlanet.id
      if (switched) {
        fitToBbox(map, useExplorerStore.getState().bbox, 50)
      }
    }

    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  }, [activePlanet])

  // Slider "Opacidad de la capa" → raster-opacity de GIBS
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    if (activePlanet?.kind === 'gibs') setGibsOpacity(map, planetLayerOpacity)
  }, [planetLayerOpacity, activePlanet])

  // Calcular NDVI / Procesar → image + raster en el BBox
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const apply = () => {
      if (!scene?.response?.overlay_png_base64) {
        removeProcessOverlay(map)
        restackOverlays(map)
        return
      }
      const eff = scene.response.bbox
      const overlayBbox: BBox =
        eff && eff.length === 4 ? [eff[0], eff[1], eff[2], eff[3]] : scene.request.bbox
      updateOverlayLayer(map, 'ndvi', {
        // Preferir bbox efectivo del ráster (recorte real), no el pedido por el usuario
        bbox: overlayBbox,
        image: scene.response.overlay_png_base64,
        leafletBounds: scene.response.bounds,
        opacity: opacity > 0 ? opacity : OVERLAY_OPACITY_DEFAULT,
        beforeId: BBOX_FILL_ID,
      })
      restackOverlays(map)
    }

    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  }, [scene, opacity])

  return (
    <div
      ref={mapContainerRef}
      className="h-full w-full"
      role="region"
      aria-label={t('explorer.mapLabel')}
    />
  )
}
