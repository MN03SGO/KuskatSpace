# TerraAnáloga — Frontend WebGIS

React 19 + TypeScript + Vite 8 + Tailwind 4. El explorador tiene dos vistas:
- **Globo 3D** (three.js, por defecto): esferas de la Tierra (Blue Marble, GIBS), la Luna (LRO WAC, Trek) y Marte (Viking MDIM 2.1, Trek). Arranca con una textura 2K local de `public/textures/` y luego carga el detalle en vivo. Para regenerar esas texturas: `pnpm bake:textures`.
- **Mapa 2D** (Leaflet): Tierra en EPSG:3857 con NASA GIBS; Luna y Marte en EPSG:4326 con NASA Trek. El buscador de análogos (MapLibre, IFA, radar) llega en la Fase 2 de [`plan_P5_frontend_webgis.md`](../plan_P5_frontend_webgis.md).

**Responsables:** P5 (desarrollo) + P6 (UI/UX y textos). Los textos de `src/i18n/*.json` y la paleta de `src/index.css` son borradores hasta que P6 los apruebe.

## Requisitos
- Node.js LTS y **pnpm** (no usar npm ni yarn; solo se commitea `pnpm-lock.yaml`).

```bash
pnpm install
```

```bash
cp .env.example .env.local
```

## Scripts

| Comando | Qué hace |
| :--- | :--- |
| `pnpm dev` | Servidor de desarrollo en http://localhost:5173 |
| `pnpm build` | Revisión de tipos (`tsc`) + build de producción |
| `pnpm test` | Pruebas unitarias (Vitest) |
| `pnpm lint` | ESLint |
| `pnpm preview` | Sirve el build localmente (respaldo para la demo) |

## Backend
El explorador consume la API de `back-AR` (`/api/search`, `/api/process`, `/api/export/geotiff`) en `VITE_API_BASE` (por defecto `http://localhost:8000`). Para levantarla en Windows, desde `backend/` (la primera vez crea el entorno con Python 3.13):

```bash
python -m venv .venv
```

```bash
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

```bash
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

Hay que ejecutarlo desde `backend/`, porque las rutas a `sample_data/` son relativas.

Sin backend, la interfaz muestra un aviso de conexión en el panel en lugar de romperse.

## Estructura
```
src/
├─ api/        http.ts (fetch con timeout y errores tipados) · explorer.ts (cliente back-AR)
├─ config/     env.ts · bodies.ts · gibsLayers.ts · processModes.ts
├─ lib/        bbox.ts (validación y conversiones Leaflet ↔ MapLibre)
├─ store/      useExplorerStore.ts (zustand)
├─ i18n/       es.json · en.json · useT.ts
├─ types/      explorer.ts (contrato de la API)
├─ components/ StatusBanner · LangToggle
└─ modules/
   ├─ explorer/ BodySelector · SearchPanel · ProcessingPanel · ResultsList · ExplorerView
   │            GlobeView + globeEngine (3D) · PlanetMap (2D)
   └─ analogs/  AnalogsView (en construcción)
```
