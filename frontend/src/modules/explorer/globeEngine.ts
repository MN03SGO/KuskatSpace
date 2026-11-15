import {
  AmbientLight,
  BufferGeometry,
  CanvasTexture,
  DirectionalLight,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Quaternion,
  Raycaster,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  type EquirectTileSource,
  GLOBE_TEXTURES,
  GLOBE_TEXTURE_HEIGHT as H,
  GLOBE_TEXTURE_WIDTH as W,
  type TileLevel,
} from '../../config/globeTextures'
import type { BBox, LeafletBounds } from '../../lib/bbox'
import { bboxCenter, lonLatToPixel, lonLatToXYZ, xyzToLonLat } from '../../lib/globeMath'
import type { BodyId } from '../../types/explorer'

/* ------------------------------------------------------------------ */
/* Mosaico base por cuerpo: se descarga una vez y queda en caché.      */
/* ------------------------------------------------------------------ */

interface BaseMosaic {
  /** Capa de baja resolución (fondo) y capa detallada (encima, transparente hasta que llegan sus teselas). */
  preview: HTMLCanvasElement
  full: HTMLCanvasElement
  loaded: number
  total: number
  /** Teselas en vivo que no se pudieron descargar (B24). */
  failed: number
  listeners: Set<() => void>
}

const mosaics = new Map<BodyId, BaseMosaic>()

function makeCanvas(fill?: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  if (fill) {
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = fill
    ctx.fillRect(0, 0, W, H)
  }
  return canvas
}

function loadLevel(
  mosaic: BaseMosaic,
  target: HTMLCanvasElement,
  level: TileLevel,
  url: EquirectTileSource['url'],
): Promise<void> {
  const ctx = target.getContext('2d')!
  const tileW = (level.tileDeg / 360) * W
  const tileH = (level.tileDeg / 180) * H
  const jobs: Promise<void>[] = []
  for (let row = 0; row < level.rows; row++) {
    for (let col = 0; col < level.cols; col++) {
      jobs.push(
        new Promise<void>((resolve) => {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.decoding = 'async'
          const done = () => {
            mosaic.loaded++
            mosaic.listeners.forEach((fn) => fn())
            resolve()
          }
          img.onload = () => {
            // +1 px de solape para que no se vean costuras entre teselas.
            ctx.drawImage(img, Math.floor(col * tileW), Math.floor(row * tileH), Math.ceil(tileW) + 1, Math.ceil(tileH) + 1)
            done()
          }
          img.onerror = () => {
            mosaic.failed++
            done()
          }
          img.src = url(level.z, row, col)
        }),
      )
    }
  }
  return Promise.all(jobs).then(() => undefined)
}

function getMosaic(body: BodyId): BaseMosaic {
  const cached = mosaics.get(body)
  if (cached) return cached

  const src = GLOBE_TEXTURES[body]
  const mosaic: BaseMosaic = {
    preview: makeCanvas('#1e293b'),
    full: makeCanvas(),
    loaded: 0,
    total: 1 + src.full.cols * src.full.rows,
    failed: 0,
    listeners: new Set(),
  }
  mosaics.set(body, mosaic)

  // Primero la textura 2K local (instantánea y sin depender de la red);
  // después, el detalle en vivo encima.
  const notify = () => {
    mosaic.loaded++
    mosaic.listeners.forEach((fn) => fn())
  }
  const baked = new Image()
  baked.decoding = 'async'
  baked.onload = () => {
    mosaic.preview.getContext('2d')!.drawImage(baked, 0, 0, W, H)
    notify()
    void loadLevel(mosaic, mosaic.full, src.full, src.url)
  }
  baked.onerror = () => {
    notify()
    void loadLevel(mosaic, mosaic.full, src.full, src.url)
  }
  baked.src = src.baked
  return mosaic
}

/* ------------------------------------------------------------------ */
/* Motor del globo                                                     */
/* ------------------------------------------------------------------ */

export interface GlobeCallbacks {
  onPick: (lon: number, lat: number) => void
  onProgress: (loaded: number, total: number, failed: number) => void
}

const BBOX_COLOR = '#38bdf8'
const FLY_MS = 900

export class GlobeEngine {
  private readonly container: HTMLElement
  private readonly cb: GlobeCallbacks
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(40, 1, 0.01, 200)
  private readonly controls: OrbitControls
  private readonly display = document.createElement('canvas')
  private readonly displayCtx: CanvasRenderingContext2D
  private readonly texture: CanvasTexture
  private readonly sphere: Mesh<SphereGeometry, MeshStandardMaterial>
  private readonly stars: Points<BufferGeometry, PointsMaterial>
  private readonly resizeObserver: ResizeObserver
  private readonly raycaster = new Raycaster()

  private body: BodyId | null = null
  private mosaic: BaseMosaic | null = null
  private unsubscribeMosaic: (() => void) | null = null
  private bbox: BBox | null = null
  private overlay: { img: HTMLImageElement; bounds: LeafletBounds } | null = null
  private overlayOpacity = 0.82
  /** Capa global del planeta (equirectangular, cualquier tamaño 2:1). */
  private planetLayer: HTMLCanvasElement | null = null
  private planetLayerOpacity = 0.75

  private frame = 0
  private composeQueued = false
  private fly: { from: Vector3; full: Quaternion; dist: number; start: number } | null = null
  private pointerDown: { x: number; y: number } | null = null
  private disposed = false

  constructor(container: HTMLElement, callbacks: GlobeCallbacks) {
    this.container = container
    this.cb = callbacks

    // Lanza un error si no hay WebGL; el componente lo captura y ofrece el mapa 2D.
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.domElement.style.display = 'block'
    this.renderer.domElement.style.touchAction = 'none'
    container.appendChild(this.renderer.domElement)

    this.camera.position.set(0, 0, 3.2)
    this.scene.add(this.camera)
    this.scene.add(new AmbientLight(0xffffff, 2.0))
    // La luz viaja con la cámara: la cara que miras siempre está iluminada.
    const sun = new DirectionalLight(0xffffff, 2.2)
    sun.position.set(-2, 1.5, 2)
    this.camera.add(sun)

    this.display.width = W
    this.display.height = H
    this.displayCtx = this.display.getContext('2d')!
    this.texture = new CanvasTexture(this.display)
    this.texture.colorSpace = SRGBColorSpace
    this.texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy()

    this.sphere = new Mesh(
      new SphereGeometry(1, 160, 80),
      new MeshStandardMaterial({ map: this.texture, roughness: 1, metalness: 0 }),
    )
    this.scene.add(this.sphere)
    this.stars = makeStars()
    this.scene.add(this.stars)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.enablePan = false
    this.controls.minDistance = 1.12
    this.controls.maxDistance = 6
    this.controls.zoomSpeed = 0.8

    const el = this.renderer.domElement
    el.addEventListener('pointerdown', this.handlePointerDown)
    el.addEventListener('pointerup', this.handlePointerUp)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.resize()
    this.loop()
  }

  setBody(body: BodyId): void {
    if (body === this.body) return
    this.body = body
    this.unsubscribeMosaic?.()
    this.mosaic = getMosaic(body)
    const listener = () => {
      this.cb.onProgress(this.mosaic!.loaded, this.mosaic!.total, this.mosaic!.failed)
      this.queueCompose()
    }
    this.mosaic.listeners.add(listener)
    this.unsubscribeMosaic = () => this.mosaic?.listeners.delete(listener)
    this.overlay = null
    listener()
  }

  /** Dibuja el bbox y gira la cámara hacia él (sin animar la primera vez). */
  setBBox(bbox: BBox, animate: boolean): void {
    this.bbox = bbox
    this.queueCompose()
    const { lon, lat } = bboxCenter(bbox)
    this.lookAt(lon, Math.max(-85, Math.min(85, lat)), animate)
  }

  setOverlay(url: string | null, bounds: LeafletBounds | null): void {
    if (!url || !bounds) {
      this.overlay = null
      this.queueCompose()
      return
    }
    const img = new Image()
    img.onload = () => {
      if (this.disposed) return
      this.overlay = { img, bounds }
      this.queueCompose()
    }
    img.src = url
  }

  setOverlayOpacity(opacity: number): void {
    this.overlayOpacity = opacity
    this.queueCompose()
  }

  /** Cambia la capa global; llamar de nuevo con el mismo lienzo para repintar cuando llegan teselas. */
  setPlanetLayer(canvas: HTMLCanvasElement | null): void {
    this.planetLayer = canvas
    this.queueCompose()
  }

  setPlanetLayerOpacity(opacity: number): void {
    this.planetLayerOpacity = opacity
    this.queueCompose()
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.frame)
    this.unsubscribeMosaic?.()
    this.resizeObserver.disconnect()
    const el = this.renderer.domElement
    el.removeEventListener('pointerdown', this.handlePointerDown)
    el.removeEventListener('pointerup', this.handlePointerUp)
    this.controls.dispose()
    this.sphere.geometry.dispose()
    this.sphere.material.dispose()
    this.stars.geometry.dispose()
    this.stars.material.dispose()
    this.texture.dispose()
    this.renderer.dispose()
    el.remove()
  }

  /* ---------------- internos ---------------- */

  private lookAt(lon: number, lat: number, animate: boolean): void {
    const dist = this.camera.position.length()
    const target = new Vector3(...lonLatToXYZ(lon, lat)).normalize()
    const from = this.camera.position.clone().normalize()
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (!animate || reduceMotion) {
      this.camera.position.copy(target.multiplyScalar(dist))
      this.camera.lookAt(0, 0, 0)
      this.fly = null
      return
    }
    this.fly = { from, full: new Quaternion().setFromUnitVectors(from, target), dist, start: performance.now() }
    this.controls.enabled = false
  }

  private queueCompose(): void {
    if (this.composeQueued) return
    this.composeQueued = true
    requestAnimationFrame(() => {
      this.composeQueued = false
      if (!this.disposed) this.compose()
    })
  }

  /** Mosaico base + imagen procesada + contorno del bbox → textura del globo. */
  private compose(): void {
    const ctx = this.displayCtx
    if (this.mosaic) {
      ctx.drawImage(this.mosaic.preview, 0, 0)
      ctx.drawImage(this.mosaic.full, 0, 0)
    }

    if (this.planetLayer) {
      ctx.globalAlpha = this.planetLayerOpacity
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(this.planetLayer, 0, 0, W, H)
      ctx.globalAlpha = 1
    }

    if (this.overlay) {
      const [[minLat, minLon], [maxLat, maxLon]] = this.overlay.bounds
      const [x0, y0] = lonLatToPixel(minLon, maxLat, W, H)
      const [x1, y1] = lonLatToPixel(maxLon, minLat, W, H)
      ctx.globalAlpha = this.overlayOpacity
      ctx.drawImage(this.overlay.img, x0, y0, x1 - x0, y1 - y0)
      ctx.globalAlpha = 1
    }

    if (this.bbox) {
      const [minLon, minLat, maxLon, maxLat] = this.bbox
      const [x0, y0] = lonLatToPixel(minLon, maxLat, W, H)
      const [x1, y1] = lonLatToPixel(maxLon, minLat, W, H)
      ctx.fillStyle = 'rgba(56, 189, 248, 0.10)'
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
      ctx.strokeStyle = BBOX_COLOR
      ctx.lineWidth = 5
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0)
    }
    this.texture.needsUpdate = true
  }

  private resize(): void {
    const { clientWidth: w, clientHeight: h } = this.container
    if (w === 0 || h === 0) return
    this.renderer.setSize(w, h, false)
    this.renderer.domElement.style.width = `${w}px`
    this.renderer.domElement.style.height = `${h}px`
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  private loop = (): void => {
    this.frame = requestAnimationFrame(this.loop)

    if (this.fly) {
      const t = Math.min(1, (performance.now() - this.fly.start) / FLY_MS)
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
      const q = new Quaternion().slerp(this.fly.full, eased)
      this.camera.position.copy(this.fly.from.clone().applyQuaternion(q).multiplyScalar(this.fly.dist))
      this.camera.lookAt(0, 0, 0)
      if (t >= 1) {
        this.fly = null
        this.controls.enabled = true
      }
    }

    if (!this.fly) {
      // Girar más despacio cuanto más cerca está la cámara.
      const dist = this.camera.position.length()
      this.controls.rotateSpeed = Math.min(0.9, 0.15 + 0.35 * (dist - 1))
      this.controls.update()
    }
    this.renderer.render(this.scene, this.camera)
  }

  private handlePointerDown = (e: PointerEvent): void => {
    this.pointerDown = { x: e.clientX, y: e.clientY }
  }

  private handlePointerUp = (e: PointerEvent): void => {
    const start = this.pointerDown
    this.pointerDown = null
    if (!start || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 5) return // fue un arrastre

    const rect = this.renderer.domElement.getBoundingClientRect()
    const ndc = new Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
    this.raycaster.setFromCamera(ndc, this.camera)
    const hit = this.raycaster.intersectObject(this.sphere, false)[0]
    if (!hit) return
    const { lon, lat } = xyzToLonLat(hit.point.x, hit.point.y, hit.point.z)
    this.cb.onPick(lon, lat)
  }
}

function makeStars(): Points<BufferGeometry, PointsMaterial> {
  const count = 1800
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    // Dirección aleatoria uniforme en la esfera, a distancia 60–90.
    const u = Math.random() * 2 - 1
    const theta = Math.random() * Math.PI * 2
    const r = 60 + Math.random() * 30
    const s = Math.sqrt(1 - u * u)
    positions.set([r * s * Math.cos(theta), r * u, r * s * Math.sin(theta)], i * 3)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  const material = new PointsMaterial({ color: 0xffffff, size: 0.18, transparent: true, opacity: 0.75, depthWrite: false })
  return new Points(geometry, material)
}
