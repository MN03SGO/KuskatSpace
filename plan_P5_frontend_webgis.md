# Frontend WebGIS (P5 + P6): Plan de Desarrollo, Análisis y Evaluación de Calidad

**Proyecto:** TerraAnáloga v2.0 · NASA Space Apps 2026 — San Salvador
**Equipo frontend:** P5 AMIGUITO (desarrollo WebGIS) + P6 PAOLA (UI/UX, textos, coordinación y pitch)
**Rama de trabajo:** `Frontend/WebGIS` · **Gestor de paquetes:** `pnpm` (obligatorio; no usar `npm` ni `yarn`)
**Fuentes:** [plan maestro](plan_maestro_terraan_loga_v2_0_hackathon_24h.md) · informe de la rama `back-AR` (14-nov-2026, commit `f87dc3e`)

> Versiones de librerías y capas GIBS verificadas el 2026-11-14 (registro de paquetes y `WMTSCapabilities.xml` de GIBS). El código de `back-AR` y `feature/database` se leyó completo tras el `git fetch` del 14-nov (último commit remoto: `f87dc3e`, 17:25).

---

## 1. Alcance y reparto P5 / P6

> **Actualización 2026-11-14:** las tareas de P6 pasan al equipo frontend y se delegan al orquestador `nasa-space-7f`, con P5 como arquitecto/PM y revisor. El detalle está en [plan_P6_ux_pitch.md](plan_P6_ux_pitch.md). Donde esta tabla dice "P6", léase "responsable de las tareas P6".

El frontend es **responsabilidad completa del equipo P5 + P6**. P5 programa; P6 decide la experiencia y el contenido. **P5 no redacta textos finales ni cambia el diseño aprobado sin P6**, y P6 no tiene que tocar código.

| Área | P5 (desarrollo) | P6 (UI/UX y contenido) |
| :--- | :--- | :--- |
| Wireframes y flujo de pantallas | Revisa si es viable técnicamente | **Dueña**: diseña y aprueba |
| Estilo visual (colores, tipografía, espaciado) | Lo implementa como *tokens* de Tailwind | **Dueña**: define la paleta y la jerarquía |
| Textos de la interfaz ES/EN | Crea las claves en `i18n/` con texto provisional `TODO:` | **Dueña**: redacta y traduce el texto final |
| Fichas científicas (contenido) | Las muestra desde los datos | Revisa la legibilidad junto con P3 (autor científico) |
| Mapa, capas, sliders, radar, comparador | **Dueño** | Valida la usabilidad |
| Integración con la API y Plan B | **Dueño** | — |
| Pruebas automáticas | **Dueño** | — |
| Pruebas de usabilidad y QA visual | Corrige lo que salga | **Dueña**: ejecuta y registra |
| Video ≤ 30 s, deck de 7 diapositivas, guion | Graba la pantalla y deja la demo estable | **Dueña** |
| Registro de uso de IA | Anota sus usos de IA en la bitácora | **Dueña** de la bitácora |
| Control de tiempos (*check-ins*) | Reporta su avance | **Dueña** |

**Puntos de entrega P6 → P5:** wireframes (H3), paleta y tipografía (H4), textos ES/EN completos (H10), resultado de la prueba de usabilidad (H14).
**Puntos de entrega P5 → P6:** URL de vista previa en Vercel en cada PR, demo estable para grabar (H20).

---

## 2. Situación real del repositorio

> **Actualización 2026-11-14, 19:10:** `feature/database` ya está integrada en `Frontend/WebGIS` (merge `c3e2be9`) y trae una **API de MongoDB Atlas** nueva en la raíz (sección 2.5). Las secciones 2.4, 3 (D6–D8), 4.1, 4.3, 6 (B32–B38), 7, 10 y 11 se revisaron con esto. El contexto lo aportó el usuario por la sesión `nasa-space-7f`, y el PM lo verificó contra el código.

### 2.1 Estado de las ramas (revisado el 14-nov-2026 tras `git fetch`)

| Rama | Último commit | Qué contiene | Relevancia para el frontend |
| :--- | :--- | :--- | :--- |
| `Frontend/WebGIS` (la nuestra) | `c3e2be9` 19:09 | Merge de `back-AR` (`f8ba6fc`), frontend TS + globos (`093a1a8`) y merge de `feature/database` con la API de Mongo (`c3e2be9`) | Rama integrada; contiene **dos backends** (sección 2.5) |
| `main` | `47cfe92` 16:44 | README con roles y plan maestro | — |
| `back-AR` | `f87dc3e` 17:25 | Backend v0.3.0 + `App.jsx` con Leaflet | **Alta**: es el backend real de hoy (ya hay una copia local de esta rama) |
| `feature/database` | `c8e5dbc` | `docker-compose` con PostGIS 16 + MinIO + Adminer (tabla `stac_items`) **y además** la API FastAPI de MongoDB Atlas en `main.py` de la raíz, `seed_mongo.py` y `test_db.py` | **Alta**: ya integrada (`c3e2be9`); alimenta el módulo A |
| `develop` | `dcb6576` 15:54 | Versión anterior de `back-AR` + `feature/database` | Desactualizada |
| `datos-planetarios` | `394b79d` 16:42 | Igual que `main` (sin datos planetarios todavía) | Ninguna por ahora |

### 2.2 Qué trae `back-AR` (código leído completo)
- **Backend FastAPI v0.3.0**, repartido en `main.py` (rutas), `connectors.py` (búsqueda federada) y `processor.py` (procesamiento). Tiene 3 endpoints: `GET /api/search`, `POST /api/process` y `GET /api/export/geotiff` (contrato en la sección 4.2).
- **`connectors.py`:** consulta en paralelo NASA CMR y Copernicus STAC (Sentinel-2 L2A y Sentinel-1 GRD) para la Tierra, y PDS ODE para la Luna y Marte. Además tiene un catálogo fijo de 6 datasets de agencias asociadas. Si una fuente falla, **la omite sin avisar**.
- **`processor.py`:** siempre lee 4 GeoTIFF de `backend/sample_data/` (el NDWI usa el mismo archivo óptico que el NDVI); si no los encuentra, genera un patrón sintético (`source_file = "cloud_stream_model"`). Colorea con 4 paletas: `radar`, `ndvi`, `precip` y `thermal`. **El bbox no recorta nada**: solo indica dónde colocar la imagen.
- **`frontend/src/App.jsx` (393 líneas, un solo componente):** React + `react-leaflet` 5, estilos inline, JS. Vistas Tierra (EPSG:3857, base Esri + MODIS de GIBS con fecha por defecto `2024-08-15`), Luna y Marte (EPSG:4326, teselas Trek). El mapa se vuelve a montar al cambiar de cuerpo.
- **Merge:** reescribe `frontend/` (~500 líneas de diferencia) y **borra `frontend/.gitignore`**. No es grave porque el `.gitignore` de la raíz ya ignora `node_modules/`, `dist/` y `.env`, pero **habrá conflictos**.

### 2.3 `feature/database`: parte PostGIS (código leído completo)
- PostGIS con una sola tabla, `stac_items` (footprint `GEOMETRY(4326)` con índice GIST). `seed.py` carga 15 escenas de Sentinel-2 de **Buenos Aires** desde Microsoft Planetary Computer.
- No guarda candidatos y **ninguna API la consulta**. Convive con la API de Mongo (2.5), y la elección entre las dos sigue abierta (D6).
- Las credenciales están escritas directamente en `docker-compose.yml` y `seed.py`. Sirve para uso local, pero no para desplegar.

### 2.5 API de MongoDB Atlas (`main.py` de la raíz, integrada en `c3e2be9`; código leído completo)
- **FastAPI + PyMongo + python-dotenv**, base de datos `nasa_space`, colecciones `candidates` (índice `2dsphere` sobre `location`, que se crea al arrancar) y `targets`. CORS abierto.
- Endpoints: `GET /` (salud: `{status, service}`), `GET /candidates` (todos), `GET /candidates/near?lat&lon&radius_km` (por defecto 100 km, `$near` en metros), `GET /targets` y `GET /export` (respaldo JSON: `{database, candidates[], targets[]}`). Error: 500 `{detail}` o 503 si la base de datos no está disponible.
- **`MONGO_URI` es obligatoria** (`.env` en la raíz). Sin ella, el proceso se detiene al importar (`RuntimeError`). Todavía no hay `.env.example`.
- **No es un duplicado de `backend/main.py`: son dos aplicaciones distintas.** `main.py` de la raíz = datos del módulo A; `backend/main.py` (back-AR) = búsqueda y procesamiento del módulo B. **Las dos usan el puerto 8000 por defecto**, y el frontend hoy solo conoce una URL (`VITE_API_BASE`) → decisión D7.
- `requirements.txt` también son dos: el de la raíz (`fastapi`, `uvicorn`, `pymongo`, `python-dotenv`, sin versión fija) y el de `backend/` (back-AR, con versiones fijas). Pueden convivir en el mismo `.venv`.
- **Los datos de ejemplo (`seed_mongo.py`) no cumplen el contrato del plan maestro (§05):**
  - Los candidatos solo tienen `{name, target: "Marte"|"Luna", location, features{mineral, biofirma}}`: **no hay `scores`**, ni `region_type`, ni ninguno de los campos de la ficha.
  - Los 3 "candidatos" (Cráter Jezero, Valle Marineris, Cráter Shackleton) **son lugares de Marte y de la Luna, no análogos terrestres**, y sus coordenadas son marcianas o lunares. El módulo A los pintaría en el globo de la Tierra, en un sitio que no corresponde.
  - `target` usa nombres ("Marte", "Luna") en lugar de los identificadores del plan (`moon_south_pole`, `mars_surface`, `lava_tubes`), y `targets` no trae el perfil de 5 dimensiones que necesita el radar.
  - `test_db.py` inserta un documento `{"test": "ok"}` en `candidates`. Si se ejecuta después del seed, ensucia la colección.
- No se pudo probar contra Atlas desde esta máquina: no hay `MONGO_URI` (y es correcto que no esté en el repo).

### 2.4 Divergencia con el plan maestro (actualizada tras `c3e2be9`)

| Plan maestro | Hoy en `Frontend/WebGIS` |
| :--- | :--- |
| MongoDB Atlas `2dsphere` | **Hecho** en `main.py` de la raíz. El `docker-compose` de PostGIS sigue en el repo (D6) |
| `/candidates`, `/candidates/near`, `/targets` | **Existen** (más `GET /` y `GET /export`), pero en una aplicación separada de `/api/search`, `/api/process` y `/api/export/geotiff` (D7) |
| Contrato del candidato (§05) con `scores` | **No se cumple**: los datos de ejemplo no tienen `scores` ni los campos de la ficha (2.5). Bloquea el IFA |
| IFA con sliders y presets por zona | No existe (Fase 2 del frontend) |
| Fichas de candidatos análogos | No existen |
| React + TS + Tailwind + MapLibre + Recharts | React **TS** + Tailwind + three.js (globos) + Leaflet (2D); Recharts instalado |
| Plan B estático `candidates.json` | `GET /export` permite generarlo; **todavía no se ha generado** |

**Consecuencia:** el backend del módulo A ya existe, pero **sus datos todavía no sirven para el buscador**: faltan `scores` y fichas, y los candidatos no son terrestres. El cuello de botella pasa de "falta la API" a **"falta el `candidates.json` real de P3 cargado en Mongo con el contrato §05"**.

---

## 3. Decisiones que hay que cerrar en H0–H1

| # | Decisión | Recomendación | Quién decide |
| :--- | :--- | :--- | :--- |
| **D1** | ¿Qué producto mostramos? | **Uno con dos módulos:** **A · Buscador de análogos** (núcleo del reto: IFA, presets, fichas, radar, comparador; datos de `candidates.json`) y **B · Explorador de datos** (lo de `back-AR`: búsqueda federada, procesamiento SAR/NDVI/NDWI/Diviner/precipitación, descarga GeoTIFF). El módulo B demuestra el uso real de datos NASA/ESA/JAXA/CSA y no se desperdicia el trabajo del backend. | Todo el equipo (P4 + P3 + P5/P6) |
| **D2** | Mapa | **Implementado en el módulo B:** **globo 3D con three.js** para la Tierra, la Luna y Marte (vista por defecto), con textura equirectangular: una 2K local en `public/textures/` (instantánea y sin red) y encima teselas en vivo de GIBS/Trek a 4K. Se mantiene **Leaflet como "Mapa 2D"** para el detalle. MapLibre no hace falta para los globos (no lee las teselas EPSG:4326 de Trek); queda como opción para el mapa del módulo A. | P5 (informa al equipo) |
| **D3** | ¿Dónde se calcula el IFA? | **En el navegador**, a partir de los `scores` de cada candidato. Así es instantáneo y el Plan B funciona entero. | P3 + P4 + P5 |
| **D4** | ¿TypeScript + Tailwind? | **Sí, de forma gradual:** `allowJs`, los archivos nuevos en `.tsx` y el `App.jsx` de `back-AR` se migra al partirlo en componentes. | P5 |
| **D5** | Merge de `back-AR` | **Merge de `back-AR` en `Frontend/WebGIS` en H0–H1**, antes de reestructurar. Desde ese momento, **el backend no toca `frontend/`**. | P4 + P5 |
| **D6** | Base de datos del módulo A | **Seguir con MongoDB Atlas** (ya implementado, coincide con el plan maestro) y sacar del camino crítico el `docker-compose` de PostGIS/MinIO, dejándolo como experimento o eliminándolo. Sigue **abierta**: la decide P4 con el equipo. Al frontend le da igual mientras se respete el contrato JSON. | P4 + equipo |
| **D9** | Capas globales del planeta | **Implementado (2026-11-14):** panel "Capas del planeta" con temperatura, humedad y precipitación sobre todo el globo (y en el mapa 2D). **Tierra:** datos reales de NASA GIBS (AIRS L3 diario de temperatura del aire y humedad relativa en superficie; GPM IMERG de precipitación), con la fecha más reciente publicada (fecha elegida recortada a hoy − 7 días para AIRS y hoy − 2 para IMERG). **Luna y Marte:** solo temperatura, con un **modelo térmico aproximado** calculado para el momento actual a partir del punto subsolar (Mars24 para Marte; elongación lunar para la Luna) y equilibrio radiativo simplificado. Se actualiza cada minuto y se rotula como "modelo, no medición". Humedad y precipitación se desactivan con una explicación. | P5 |
| **D7** | Dos APIs en el puerto 8000 | **RESUELTO en `7f0968a`:** una sola app (`backend/main.py` monta `backend/mongo_api.py`), un `requirements.txt` y `.env.example`. El frontend vuelve a una sola URL (`VITE_API_BASE`). Texto original: | **Corto plazo (sin tocar el backend):** levantar la API de Mongo en el **puerto 8001**; el frontend usa dos URLs, `VITE_API_BASE` (back-AR, módulo B) y **`VITE_DATA_API_BASE`** (Mongo, módulo A). **Definitivo (P4):** unir las dos en una sola aplicación (routers `/api/*` + `/candidates*`, `/targets`, `/export`) y un solo `requirements.txt`. Así vuelve a bastar una URL y un solo despliegue en Render. | P4 (definitivo) · P5 (corto plazo) |
| **D8** | Fuente de datos del módulo A | **API primero** (`GET /candidates`, que se recarga al elegir objetivo) y **Plan B** = `public/data/candidates.json` generado con `GET /export` cuando P3 cargue los datos reales. `candidates.mock.json` queda **solo para desarrollo y pruebas**, nunca en la demo. Un adaptador (`lib/candidateAdapter.ts`) valida cada documento contra el contrato §05 y **descarta y cuenta** los que no lo cumplen, en lugar de inventar puntuaciones. | P5 |

---

## 4. Recursos

### 4.1 Instalación con pnpm

En este equipo Windows **no se detectaron `node` ni `pnpm` en el PATH**. Hay que instalar Node.js LTS y activar pnpm:

```bash
corepack enable pnpm
```

```bash
pnpm -v
```

Dependencias (desde `frontend/`):

```bash
pnpm add maplibre-gl react-map-gl zustand recharts react-compare-slider leaflet react-leaflet
```

```bash
pnpm add -D typescript @types/leaflet tailwindcss @tailwindcss/vite vitest @playwright/test @axe-core/playwright
```

```bash
pnpm exec playwright install chromium
```

Reglas:
- Solo se commitea `pnpm-lock.yaml`. Si aparece un `package-lock.json` o un `yarn.lock`, se borra.
- Añadir `"packageManager": "pnpm@<versión>"` en `package.json` para que Corepack y Vercel usen pnpm.
- En Vercel: Root Directory = `frontend`, Install Command = `pnpm install --frozen-lockfile`, Build = `pnpm build`.
- Scripts que se usan: `pnpm dev`, `pnpm build` (`tsc && vite build`), `pnpm typecheck`, `pnpm preview`, `pnpm lint`, `pnpm test` (Vitest), `pnpm e2e` (Playwright) y `pnpm bake:textures`.
- **Solo TypeScript:** no se añaden archivos `.jsx`/`.js` nuevos en `frontend/src/`.

**Variables de entorno y secretos:**

| Dónde | Archivo | Variables | Regla |
| :--- | :--- | :--- | :--- |
| Frontend | `frontend/.env.local` (copiado de `.env.example`) | `VITE_API_BASE` (back-AR, por defecto `http://localhost:8000`) y `VITE_DATA_API_BASE` (Mongo, por defecto `http://localhost:8001`, D7) | Nunca se commitea `.env.local`; las variables `VITE_*` son públicas en el navegador, así que **nunca llevan secretos** |
| API de Mongo (raíz) | `.env` en la raíz | **`MONGO_URI`** (obligatoria; sin ella la API no arranca) | Nunca se commitea `.env`. **Falta un `.env.example`** con `MONGO_URI=` vacío (B33) |
| Vercel / Render | Ajustes del proyecto | Las mismas variables | `MONGO_URI` solo en Render, nunca en Vercel |

**Levantar los dos backends en local** (hasta que P4 los una, D7), cada uno en su propia terminal:

```bash
cd backend && .\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

```bash
.\backend\.venv\Scripts\python.exe -m pip install pymongo python-dotenv
```

```bash
.\backend\.venv\Scripts\python.exe -m uvicorn main:app --port 8001
```

El último comando se ejecuta desde la raíz y necesita `.env` con `MONGO_URI`. No uses `--reload` en la raíz: vigilaría todo el repo, incluido `node_modules`.

### 4.2 Contrato de la API `back-AR` (módulo B)

| Endpoint | Parámetros (query) | Respuesta |
| :--- | :--- | :--- |
| `GET /api/search` | `bbox` (minLon,minLat,maxLon,maxLat), `start_date`, `end_date` (YYYY-MM-DD), `body` (`earth`/`moon`/`mars`), `variable` (`all`, `maritime`, `sar_historical`, `precipitation`, `land_ocean`, `lunar`, `planetary`), `limit` 1–20 | `live_earthdata[]`, `live_copernicus[]`, `live_pds_planetary[]`, `partner_resources[]`. Cada elemento trae `bbox[4]` y `recommended_mode` |
| `POST /api/process` | `mode` (`sar_db`, `ndvi`, `ndwi`, `diviner_thermal`, `jaxa_precip`), `bbox`, `sample_name?` | `mode`, `source_file`, `unit`, `stats{min,max,mean}`, `bounds` **en formato Leaflet `[[lat,lon],[lat,lon]]`**, `overlay_png_base64`, `cryosphere_comparison` (solo Diviner). Error: HTTP 500 `{detail}` |
| `GET /api/export/geotiff` | `mode`, `bbox` | `image/tiff` (EPSG:4326, 1 banda float32) |

Para MapLibre hay que convertir `bounds` a 4 esquinas `[lon,lat]` (arriba-izquierda, arriba-derecha, abajo-derecha, abajo-izquierda) para la `image source`.

### 4.3 Contrato del módulo A (plan maestro) y API de Mongo
- **Contrato exigido** (plan maestro §05): `_id`, `name`, `region_type`, `country`, `location` (GeoJSON `Point` `[lon, lat]` **en la Tierra**), `target` (`moon_south_pole` | `mars_surface` | `lava_tubes`), `analog_category[]`, `scores{relieve, iluminacion, frio, hielo, polvo}` en [0, 1], `similar_properties[]`, `similar_processes[]`, `differences_and_limits[]`, `exploration_use_cases[]`, `subsurface_and_biology{subsurface_potential, extremophiles_note}` y `datasets_used[]`.
- **API (Mongo, `VITE_DATA_API_BASE`):**

| Endpoint | Uso en el frontend |
| :--- | :--- |
| `GET /` | Indicador "API" de la demo (salud) |
| `GET /candidates` | Carga inicial del módulo A; IFA en el navegador (D3) |
| `GET /candidates/near?lat&lon&radius_km` | Clic en el globo → "Cerca de aquí" (Fase 5) |
| `GET /targets` | Perfil del objetivo para el radar (cuando P2/P3 entreguen el perfil de 5 dimensiones) |
| `GET /export` | **No lo llama la app**: P4/P5 lo usan para generar `public/data/candidates.json` (Plan B). No reemplaza a `/api/export/geotiff`, que descarga el GeoTIFF del módulo B |

- **Estado:** la API existe, pero los datos de ejemplo no cumplen el contrato (2.5). Mientras P3 no cargue datos reales, el adaptador mostrará "0 candidatos válidos de N" y el desarrollo seguirá con `candidates.mock.json` (D8).

### 4.4 Capas de mapa

**NASA GIBS (Tierra, EPSG:3857, CORS abierto):**
`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/{LAYER}/default/{YYYY-MM-DD}/{TMS}/{z}/{y}/{x}.{ext}`

| Uso | Capa | TMS (= `maxzoom`) | Formato | Dimensión |
| :--- | :--- | :--- | :--- | :--- |
| Base sin fecha | `BlueMarble_ShadedRelief_Bathymetry` | `GoogleMapsCompatible_Level8` | jpg | — |
| Imagen real | `MODIS_Terra_CorrectedReflectance_TrueColor` | `…_Level9` | jpg | contexto |
| Relieve | `ASTER_GDEM_Greyscale_Shaded_Relief` | `…_Level12` | jpg | Relieve |
| Temperatura | `MODIS_Terra_Land_Surface_Temp_Day` / `MODIS_Terra_L3_Land_Surface_Temp_Monthly_Day` | `…_Level7` | png | Frío |
| Nieve | `MODIS_Terra_NDSI_Snow_Cover` | `…_Level8` | png | Hielo |
| Aerosoles | `MODIS_Combined_Value_Added_AOD` / `MERRA2_Aerosol_Optical_Depth_Analysis_Monthly` | `…_Level6` | png | Polvo |
| Vegetación | `MODIS_Terra_L3_NDVI_16Day` | `…_Level9` | png | filtro |
| Etiquetas y costas | `Reference_Labels_15m`, `Coastlines_15m` | `…_Level13` | png | — |

**NASA Trek (Luna/Marte, EPSG:4326, ya usadas en `back-AR`, solo con Leaflet):**
- Luna: `https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/{z}/{y}/{x}.jpg`
- Marte: `https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg`

**Limitaciones:** las teselas EPSG:3857 llegan hasta ±85,05° (McMurdo 77,8° S y Devon 75° N se ven bien). MapLibre no reproyecta las capas polares de GIBS (EPSG:3031/3413). `back-AR` usa además Esri World Imagery: requiere atribución y no es de una agencia espacial, así que mejor usar GIBS como base por defecto.

### 4.5 Librerías (versiones al 2026-11-14)

| Necesidad | Paquete | Versión |
| :--- | :--- | :--- |
| Mapa Tierra / globo | `maplibre-gl` + `react-map-gl` (`react-map-gl/maplibre`) | 6.18.0 / 8.1.3 |
| Mapa Luna/Marte | `leaflet` + `react-leaflet` (ya en `back-AR`) | 1.9.x / 5.x |
| Radar | `recharts` | 3.10.1 |
| Comparador de imágenes | `react-compare-slider` | 4.0.0 |
| Estado | `zustand` | 5.1.0 |
| Estilos | `tailwindcss` + `@tailwindcss/vite` | 4.3.5 |
| Pruebas | `vitest` · `@playwright/test` · `@axe-core/playwright` | 5.1.0 · 1.65.1 · 4.14.0 |

i18n con un **diccionario JSON propio** (`es.json` / `en.json` + un *hook* `useT()`): no añade dependencias y P6 edita JSON directamente.

### 4.6 Documentación
GIBS <https://nasa-gibs.github.io/gibs-api-docs/> · Worldview <https://worldview.earthdata.nasa.gov/> · MapLibre <https://maplibre.org/maplibre-gl-js/docs/> · react-map-gl <https://visgl.github.io/react-map-gl/> · React Leaflet <https://react-leaflet.js.org/> · Recharts <https://recharts.github.io/> · Moon/Mars Trek <https://trek.nasa.gov/>

---

## 5. Arquitectura

### 5.1 Pantallas
- **Módulo A · Buscador de análogos** (pantalla de inicio): objetivo (Luna Z1–Z4 / Marte / Subsuelo) → presets → sliders de pesos → Top N → ficha (radar, propiedad vs proceso, límites, usos en exploración) → comparador Tierra vs Luna/Marte.
- **Módulo B · Explorador de datos** (pestaña): cuerpo Tierra/Luna/Marte → bbox (clic o texto) → rango de fechas → búsqueda federada → resultados por fuente → procesamiento → overlay con leyenda → descarga GeoTIFF → panel "Polo lunar vs Tierra" (Diviner).
- **Puente A → B:** desde una ficha, botón "Explorar datos de este sitio", que abre B con el bbox del candidato ya cargado.

### 5.2 Estructura de carpetas

```
frontend/
├─ public/data/
│  ├─ candidates.json · candidates.mock.json · targets.json
│  └─ compare/<candidate_id>/{earth.jpg, planet.jpg}
├─ src/
│  ├─ api/
│  │  ├─ http.ts            # fetch con timeout, valida res.ok, errores legibles
│  │  ├─ explorer.ts        # searchCatalogs(), processScene(), exportUrl()  (back-AR)
│  │  └─ candidates.ts      # loadCandidates(): API → fallback estático
│  ├─ config/ gibsLayers.ts · trekLayers.ts · presets.ts · env.ts (VITE_API_BASE)
│  ├─ lib/ ifa.ts · bbox.ts (parse, validar, leafletBoundsToMaplibre)
│  ├─ store/ useAnalogStore.ts · useExplorerStore.ts
│  ├─ i18n/ es.json · en.json · useT.ts
│  ├─ types/ candidate.ts · explorer.ts
│  ├─ modules/
│  │  ├─ analogs/  MapGlobe · TargetSelector · PresetButtons · WeightSliders
│  │  │            CandidateList · CandidateCard · RadarCompare · ImageCompare
│  │  └─ explorer/ BodySelector · SearchPanel · ResultsList · ProcessingPanel
│  │               PlanetMap (Leaflet) · Legend · CryospherePanel
│  └─ components/ LayerPanel · DataSourceToggle · LangToggle · StatusBanner
```

### 5.3 Flujo de datos

```mermaid
flowchart LR
    subgraph A[Módulo A · Análogos]
      L[candidates.ts] -->|API OK| S[(store)]
      L -->|timeout/error| J[/data/candidates.json/] --> S
      W[Presets + sliders] --> S
      S --> I[computeIFA] --> M[MapGlobe + Top N + Ficha]
    end
    subgraph B[Módulo B · Explorador back-AR]
      Q[SearchPanel] --> SE[GET /api/search] --> R[ResultsList]
      R -->|bbox + recommended_mode| P[POST /api/process] --> O[Overlay + Leyenda]
      O --> X[GET /api/export/geotiff con el bbox procesado]
    end
    M -->|Explorar este sitio| Q
```

---

## 6. Correcciones al integrar `back-AR` (backlog del módulo B)

> **Estado al 2026-11-14 (noche):**
> - **Resueltos por la pasada de UX:** B20 (objetivos ≥ 40 px, verificado a 375 px), B21 (pista corta en móvil), B22 (leyendas con nombre accesible), B24 (aviso si fallan teselas), B26 (`Intl.NumberFormat` en estadísticas y criósfera), B27 (estado activo con barra inferior además del color; foco `outline-ink` dentro de los grupos), B28 (rótulos opacos sobre el mapa, `text-xs`), B29 (bordes de campos `ink-muted/70`), B30 (solo pesos normal y bold) y B31 (sin medios pasos en los componentes tocados). Las clases están centralizadas en `frontend/src/components/ui.ts`.
> - **Resueltos por P4 en `7f0968a`:** B13, B32, B33 y B36.
> - **Siguen abiertos:** B34 y B35 (datos reales §05) y B37 (adaptador del módulo A, **todavía no existe**).
> - **Ajuste de textos:** "Mostrar temperatura" y "Mostrar precipitación" ahora son las capas globales. Los modos de procesamiento simulados pasaron a "Procesar perfil térmico simulado" y "Procesar precipitación simulada", para no confundirlos.
> - **Fecha GIBS por defecto:** ahora es **ayer (UTC)** y no una fecha fija, para mostrar "lo de ahora". Para grabar la demo, fija una fecha a mano.

Del informe del backend, ordenadas por prioridad. **Frontend** = lo resolvemos nosotros; **Pedir a P4** = cambio en el backend.

| # | Problema | Solución | Quién |
| :--- | :--- | :--- | :--- |
| B1 | La UI se rompe si `/api/process` devuelve 500 (no se revisa `res.ok`) | `http.ts` valida `res.ok`, lee `{detail}` y muestra el error en el panel | Frontend |
| B2 | `API_BASE` fijo en `localhost:8000` | `import.meta.env.VITE_API_BASE` (y `.env.example`) | Frontend |
| B3 | La descarga usa el bbox actual, no el procesado | Guardar `{bbox, mode, sample_name}` con cada resultado y construir el enlace con eso | Frontend |
| B4 | Errores mostrados con `alert()` | `StatusBanner` en el panel (texto de P6) | Frontend + P6 |
| B5 | Un solo `loading` para buscar y para procesar | Estados separados: `searchStatus` y `processStatus` | Frontend |
| B6 | No se envían `start_date` ni `end_date` | Selector de rango de fechas (por defecto, los últimos 30 días) | Frontend |
| B7 | El modo `ndwi` no tiene botón | Añadirlo a `ProcessingPanel` | Frontend |
| B8 | El bbox de la Luna no coincide (front `-85..-65`, back `-89.5..-80`) | Usar un único valor en `config/` y acordarlo con P4 | Frontend + P4 |
| B9 | No se muestran `source_file` ni `unit` | Leyenda con unidad, archivo de origen y escala de color por modo | Frontend |
| B10 | `/api/search` oculta los fallos de CMR, Copernicus o PDS (listas vacías) | **Pedir a P4** un campo `errors` o `status` por fuente; mientras tanto mostrar "Sin resultados o fuente no disponible" | P4 |
| B11 | El export ignora `sample_name` | **Pedir a P4** que lo acepte | P4 |
| B12 | El procesamiento siempre usa las mismas muestras, sea cual sea el bbox. **Además, las 4 muestras son sintéticas** (`prepare_samples.py`, NumPy), incluido el "Diviner" de 45–355 K (hallazgo de T6, 2026-11-14); ya corregido en los textos ("datos simulados", panel "Ejemplo simulado", botones sin atribución a agencias) | **Mostrarlo en la interfaz**: etiqueta "Muestra de demostración: `<source_file>`". No presentarlo como dato real del bbox | Frontend + P6 (texto) |
| B13 | No hay README para levantar el backend | **Pedir a P4**. Mientras tanto: desde `backend/`, `uvicorn main:app --reload` (las rutas a `sample_data/` dependen de la carpeta desde donde se ejecuta) | P4 |
| B14 | **El mapa vuelve a volar al bbox en cada render**: `MapController` recibe `parsedBboxBounds()`, que crea un arreglo nuevo cada vez, así que el `useEffect` se dispara al mover la opacidad, al escribir o al cargar | Memorizar los bounds con `useMemo` según `bbox` y volar solo cuando el bbox cambia | Frontend |
| B15 | El bbox escrito a mano no se valida (con un valor inválido vuelve en silencio a Mesoamérica) y el clic limita la longitud a ±175 | `lib/bbox.ts`: validar orden y rangos, y mostrar el error junto al campo (texto de P6) | Frontend |
| B16 | `cryosphere_comparison.insight` es un texto fijo ("~175 K más frías") que no cambia con el valor calculado (`delta_vs_earth_ice_k`) | Construir la frase en el frontend a partir de los números y la plantilla i18n de P6, o **pedir a P4** que la genere | Frontend + P6 |
| B17 | El overlay se vuelve a montar al cambiar el bbox después de procesar (`key` incluye el `bbox` actual) | `key` con `mode` + el bbox **procesado** (relacionado con B3) | Frontend |
| B18 | Base Esri World Imagery y fecha GIBS por defecto `2024-08-15` | Base GIBS `BlueMarble` por defecto (Esri opcional, con atribución) y fechas en `config/gibsLayers.ts` | Frontend |
| B20 | (T1-U1) Botones de menos de 40 px de alto en móvil | `min-h-10` en los botones de `SearchPanel`, `ProcessingPanel`, `BodySelector` y `ViewToggle` por debajo de `md` | Frontend |
| B21 | (T1-U2/U3) Sin instrucción de gestos en móvil; "clic" no sirve en pantallas táctiles | Pista corta en móvil y textos neutros ("Toca o haz clic"), con el texto de T3 | Frontend + P6 |
| B22 | (T1-U4) La leyenda de color no tiene texto accesible | `aria-label` en la leyenda con la unidad y los extremos | Frontend |
| B23 | (T1-U5) La app abre en el módulo B | Abrir en el módulo A cuando exista (Fase 2) | Frontend |
| B24 | (T1-U6) No se avisa si fallan las teselas en vivo del globo | Contar los errores y mostrar "Detalle no disponible; se usa la textura local" | Frontend |
| B25 | (T1 §3) Puente A → B | Decidido: vía `useExplorerStore` (`setBody('earth')` + `setBbox` + un campo `origin` con el nombre del candidato para el aviso "Volver a la ficha") | Frontend |
| B32 | Dos APIs en el puerto 8000 (`main.py` de la raíz y `backend/main.py`), con dos `requirements.txt` | Corto plazo: Mongo en el puerto 8001 + `VITE_DATA_API_BASE` en el frontend. **Pedir a P4:** una sola app FastAPI con routers y un solo `requirements.txt` con versiones fijas (D7) | P5 + P4 |
| B33 | Falta `.env.example` con `MONGO_URI` | **Pedir a P4:** `.env.example` en la raíz (`MONGO_URI=` vacío) y una línea en el README | P4 |
| B34 | Los datos de `seed_mongo.py` no cumplen el contrato §05 (sin `scores` ni ficha) y los "candidatos" son sitios de Marte y la Luna, no análogos terrestres | **Pedir a P3/P4:** cargar en `candidates` el `candidates.json` real con el contrato §05, coordenadas **terrestres** y `target` con los identificadores del plan. El frontend no inventa puntuaciones: descarta y cuenta los documentos inválidos (D8) | P3 + P4 |
| B35 | `targets` no trae el perfil de 5 dimensiones para el radar | **Pedir a P2/P3:** `targets` con `id` (`moon_south_pole`…) y el perfil por dimensión | P2 + P3 |
| B36 | `test_db.py` inserta `{"test":"ok"}` en `candidates` | **Pedir a P4:** que use una colección de prueba o borre el documento al terminar | P4 |
| B37 | Adaptador y cliente del módulo A | `api/candidates.ts` (`VITE_DATA_API_BASE`, timeout, respaldo a `/data/candidates.json`) + `lib/candidateAdapter.ts` (validación del contrato y conteo de descartes) + pruebas. La interfaz muestra solo el conteo (`analogs.status.invalid/allInvalid`, propuestas en `docs/p6/textos-modulo-a.md`); el detalle (`_id` y motivo) va a `console.warn` solo en desarrollo | Frontend |
| B38 | Plan B del módulo A | Generar `public/data/candidates.json` con `GET /export` en cuanto haya datos reales, y regenerarlo en el congelamiento (H20) | P4 + P5 |
| B26 | (T3-c1) Las cifras de estadísticas, criósfera y opacidad usan `toFixed` y salen con punto también en ES | Formatear con `Intl.NumberFormat(lang)` en `ProcessingPanel` (y en el IFA del módulo A) | Frontend |
| B27 | (T2-3.3c/d) El estado activo se marca solo por color y el foco interior `info` sobre `accent` da 2,41:1 | Señal no cromática en el estado activo (borde `info` de 2 px o ✓) en `BodySelector`, `ViewToggle` y `LangToggle`; contorno de foco `outline-ink` en los controles rellenos de `accent` | Frontend |
| B28 | (T2-3.3a/e) Rótulos translúcidos sobre el globo (3,05–4,39:1 sobre zonas blancas) y atribución en `text-[11px]` | `bg-surface` opaco y `text-xs` en `GlobeView` | Frontend |
| B29 | (T2-3.3b) Bordes de los campos a 1,72:1 | `border-ink-muted` en `inputClass` (`SearchPanel`); `line` solo para divisores | Frontend |
| B30 | (T2-4.2) 3 pesos tipográficos | Reducir a 400 y 700 (`font-medium` y `font-semibold` → normal o bold) | Frontend |
| B31 | (T2-5.2) Medios pasos fuera de la cuadrícula (`*-1.5`, `px-2.5`, `mt-0.5`) | Llevarlos a la escala de 4 px | Frontend |
| B19 | Las búsquedas en Luna y Marte devuelven productos PDS con un bbox fijo (no el real) | Mostrar "ubicación aproximada" en esos resultados; **pedir a P4** el footprint real si ODE lo entrega | Frontend + P4 |

---

## 7. Plan de creación por fases

Cada tarea indica el responsable. "Hecho cuando…" es el criterio para pasar a la siguiente fase.

### Fase 0 · H0–H1 — Alineación y base
- [ ] Cerrar D1–D6 en una reunión de 15 min (organiza P6).
- [x] **P5:** merge de `origin/back-AR` en `Frontend/WebGIS` (commit `f8ba6fc`; único conflicto: `.gitignore`, resuelto con la versión unificada de `back-AR`). *No se probó contra el backend real: esta máquina no tiene Python.*
- [x] **P5:** pnpm 12 (`packageManager`), TS 7 con `allowJs`, Tailwind 4 y `.env.example` con `VITE_API_BASE`.
- [ ] **P5:** proyecto en Vercel (Root `frontend`, pnpm) con vista previa por PR.
- [x] **P6:** wireframes de los módulos A y B (T1, aceptada; `docs/p6/wireframes.md`).
- [x] **P4:** API de MongoDB Atlas integrada (`c3e2be9`). Pendientes de P4: D6, D7 y B32–B36.

**Hecho cuando:** la rama compila con `pnpm build`, Vercel publica la vista previa y las decisiones D1–D6 están anotadas en el README.

### Fase 1 · H1–H4 — Esqueleto + módulo B refactorizado
- [x] **P5:** partir `App.jsx` en los componentes de `modules/explorer/` y crear `api/http.ts` + `api/explorer.ts` (resuelve B1, B2, B5, B14 y B17). Se adelantaron también B3, B4, B6, B7, B8, B9 (unidad y leyenda), B12, B15, B16, B18 y B19. 35 pruebas Vitest en verde (27 al terminar esta tarea; 8 más con el globo).
- [x] **P5:** globo 3D (three.js) de la Tierra, la Luna y Marte como vista por defecto del módulo B, con texturas 2K locales y detalle en vivo (decisión D2).
- [ ] **P5:** módulo A sobre el **globo three.js ya existente** (se reutiliza `globeEngine`, con una capa de puntos por IFA; MapLibre deja de hacer falta), con la base de la Tierra.
- [ ] **P5 (B37):** `VITE_DATA_API_BASE`, `api/candidates.ts` contra `GET /candidates` de la API de Mongo, `lib/candidateAdapter.ts` con validación del contrato §05 y aviso "N candidatos descartados por no cumplir el contrato", respaldo a `/data/candidates.json` y `DataSourceToggle`. En desarrollo se usa `candidates.mock.json` mientras la API no tenga datos válidos (D8).
- [x] **P6:** paleta, tipografía y espaciado (T2, aceptada; `ink-muted` aplicado en `index.css`; B27–B31 en el backlog).

**Hecho cuando:** en Vercel se ven los dos módulos; el B busca y procesa con back-AR, y el A carga desde la API de Mongo (o muestra el aviso de datos inválidos y usa el mock en desarrollo).

### Fase 2 · H4–H8 — Interacción científica (módulo A)
- [ ] **P5:** `lib/ifa.ts` + pruebas con los casos de P3; `presets.ts` con los pesos del plan maestro (el peso restante y el preset "Subsuelo" los define P3).
- [ ] **P5:** `WeightSliders` que recolorea y reordena sin llamar a la API; `RadarCompare`; `CandidateCard` con todos los campos del contrato.
- [ ] **P5:** capas GIBS de la sección 4.4 en `LayerPanel` con opacidad y leyenda.
- [x] **P5:** módulo B: B3, B6, B7, B8, B9, B15, B18 (adelantados en la Fase 1).
- [ ] **P3/P4 (B34, B35):** `candidates` y `targets` en Mongo con el contrato §05 y coordenadas terrestres. **Sin esto, el IFA no tiene datos reales.**
- [ ] **P6:** maqueta de la ficha y del orden de lectura (propiedad → proceso → límites → usos).

**Hecho cuando:** "Luna Z4" y "Marte" producen Top 10 claramente distintos y el módulo B descarga el GeoTIFF del bbox que se procesó.

### Fase 3 · H8–H12 — Bilingüe, pulido y checkpoint
- [ ] **P5:** `useT()` con todas las claves; ningún texto fijo en los componentes.
- [ ] **P6:** textos finales ES/EN en `es.json` / `en.json` (entrega H10), incluidos los mensajes de error, la etiqueta de B12 y la plantilla de B16.
- [ ] **P5:** cámaras "Polo Sur", "Polo Norte" y "Centroamérica"; filtro "Solo descubrimientos"; puente A → B.
- [ ] **P4/P5 (B38):** cuando la API sirva datos reales, generar `public/data/candidates.json` con `GET /export` (Plan B) y retirar el mock de la demo.
- [ ] **Juntos, H12:** guion de demo completo (sección 9.3) en ES y EN, con API y en modo estático.

**Hecho cuando:** el guion pasa entero en la URL de Vercel.

### Fase 4 · H12–H16 — Descanso escalonado + usabilidad
- [ ] **P6:** prueba de usabilidad con 3 personas ajenas al equipo (tareas de la sección 9.4) y lista de hallazgos priorizada (entrega H14).
- [ ] **P5:** turno de descanso; después, corregir los hallazgos de prioridad alta.

### Fase 5 · H16–H20 — Comparador y exploración libre
- [ ] **P5:** `ImageCompare` con los pares del Top 5 (de P1/P2); el componente se oculta si falta el par.
- [ ] **P5:** clic en el mapa → `/candidates/near` (cuando P4 lo tenga).
- [ ] **P5:** carga diferida (`lazy`) de Leaflet, Recharts y el comparador.
- [ ] **P6:** QA visual en 1280 px y 375 px.

**Hecho cuando:** cada ficha del Top 5 tiene su comparador y no hay hallazgos de usabilidad de prioridad alta abiertos.

### Fase 6 · H20–H23 — Congelamiento y entrega
- [ ] **H20: código congelado.** Solo correcciones bloqueantes, con PR revisado.
- [ ] **P5:** lista de verificación previa a la demo (9.5) y grabación de pantalla.
- [ ] **P6:** video ≤ 30 s, deck de 7 diapositivas y registro de IA (P5 aporta sus entradas).

---

## 8. Plan de análisis (que la interfaz diga la verdad)

| Qué se analiza | Cómo | Criterio | Quién |
| :--- | :--- | :--- | :--- |
| IFA idéntico al de P3 | Pruebas Vitest con 5 casos fijos de P3 | Diferencia ≤ 0,001 | P5 + P3 |
| Prueba de cordura | McMurdo y Devon con el preset por defecto | Dentro del Top 20 | P5 + P3 |
| Coordenadas | 3 candidatos contrastados con un mapa de referencia; conversión de `bounds` Leaflet → MapLibre | Ningún punto ni overlay desplazado | P5 |
| Presets | Revisión cruzada | Suman 1,0 y coinciden con el plan maestro | P5 + P3 |
| Capas GIBS | Comparar con Worldview en la misma fecha | Misma imagen; leyenda y unidad visibles | P5 |
| Honestidad del módulo B | Cada overlay muestra `source_file` y la etiqueta "muestra de demostración" | Siempre visible | P5 + P6 |
| Honestidad de la analogía | La ficha siempre muestra `differences_and_limits` | Nunca oculto; "Pendiente" si falta | P5 + P6 |
| Claridad de los textos | Lectura en voz alta de cada ficha y cada error | Sin jerga sin explicar y el mismo término en todas partes | P6 |

---

## 9. Plan de evaluación de calidad

### 9.1 Métricas y umbrales

| Dimensión | Métrica | Herramienta | Umbral | Quién |
| :--- | :--- | :--- | :--- | :--- |
| Funcional | Guion de demo automatizado | Playwright (`pnpm e2e`) | 100 % verde | P5 |
| Lógica | Cobertura de `ifa.ts`, `bbox.ts`, `http.ts`, `candidates.ts` | Vitest (`pnpm test`) | ≥ 90 % | P5 |
| Resiliencia A | API caída | Playwright bloqueando `VITE_API_BASE` | Datos estáticos en ≤ 6 s y aviso "Modo respaldo" | P5 |
| Resiliencia B | `/api/process` devuelve 500 | Playwright con una ruta simulada | Mensaje en el panel y la UI no se rompe | P5 |
| Rendimiento | Primera carga | Lighthouse | Performance ≥ 70 (móvil); LCP ≤ 3 s (escritorio) | P5 |
| Fluidez | Mover un slider con 2.000 candidatos | DevTools | ≤ 100 ms por recoloreado | P5 |
| Tamaño | JS inicial (gzip) | `pnpm build` | ≤ 450 kB; Leaflet y Recharts en *chunks* aparte | P5 |
| Accesibilidad | Violaciones | `@axe-core/playwright` | 0 críticas o serias | P5 |
| Teclado y foco | Navegación | Manual | Todo usable con Tab y flechas; foco visible | P6 |
| Contraste | Texto, leyendas, puntos del mapa | axe / DevTools | ≥ 4,5:1 en texto | P6 |
| i18n | Claves faltantes | Script que compara `es.json` con `en.json` | 0 faltantes; 0 textos fijos | P5 (script) · P6 (contenido) |
| Consistencia del texto | Términos y tono | Revisión | Glosario único (IFA, análogo, PSR…) | P6 |
| Usabilidad | Tareas completadas sin ayuda | Prueba con 3 usuarios | ≥ 80 % de las tareas | P6 |
| Responsivo | Anchos | Playwright / manual | 1280 y 375 px sin desplazamiento horizontal | P5 + P6 |
| Consola | Errores | Playwright | 0 errores (salvo 404 de teselas fuera de cobertura) | P5 |
| Dependencias | Gestor | Revisión del PR | Solo `pnpm-lock.yaml` en el repo | P5 |

### 9.2 Cuándo se evalúa

| Momento | Qué |
| :--- | :--- |
| Cada PR | `pnpm lint` + `pnpm test` + vista previa de Vercel (P6 la revisa visualmente) |
| H8 | Análisis científico (sección 8) con P3 |
| **H12** | Tabla 9.1 completa + guion en ES/EN, con API y en modo estático |
| H14 | Resultado de la prueba de usabilidad (P6) |
| H19 | Repetición completa antes de congelar |
| H22 | Lista de verificación previa a la demo |

### 9.3 Guion de demo (también es la prueba E2E)
1. Abrir la app: globo con base GIBS y candidatos.
2. **Luna → Z4 (PSR)**: el Top 10 cambia y el mapa se recolorea.
3. Mover el slider de Hielo: el orden cambia en vivo.
4. "Solo descubrimientos" → abrir el primero: ficha, radar, propiedad vs proceso, límites.
5. Comparador Tierra vs Luna.
6. "Explorar datos de este sitio" → módulo B con el bbox cargado → buscar → procesar NDVI o SAR → leyenda → descargar GeoTIFF.
7. Cambiar a Luna en el módulo B → procesar Diviner → panel "Polo lunar vs Tierra".
8. Cambiar a **EN**: todo se traduce.
9. Activar **Modo estático**: el módulo A sigue funcionando y el B muestra un aviso claro.

### 9.4 Tareas de la prueba de usabilidad (P6)
1. "Encuentra el mejor análogo terrestre para extraer hielo en el Polo Sur lunar."
2. "Explica por qué ese sitio *no* es un análogo perfecto."
3. "Compara visualmente ese sitio con la Luna."
4. "Descarga los datos procesados de una zona de Centroamérica."

Se mide si la persona completa la tarea, cuánto tarda y dónde duda.

### 9.5 Lista de verificación previa a la demo
- [ ] Abrir la URL de Render 3 minutos antes y comprobar el indicador "API".
- [ ] Probar el interruptor de Plan B.
- [ ] Fechas GIBS fijas; capas cargando.
- [ ] Sin errores en la consola.
- [ ] Versión local de respaldo: `pnpm build` y luego `pnpm preview`.
- [ ] Atribuciones NASA/ESA/JAXA/CSA (y Esri si se usa) visibles.

### 9.6 Relación con la rúbrica

| Criterio | Evidencia en el frontend |
| :--- | :--- |
| Impacto / "Surprise us" | Filtro de descubrimientos; los sitios clásicos marcados como "calibración" |
| Creatividad | IFA en vivo con presets por zona funcional; puente análogo → datos |
| Validez científica | Radar contra el perfil objetivo, propiedad vs proceso, límites visibles, honestidad sobre las muestras |
| Relevancia | "Qué probar en campo" (ISRU, EVA, rovers, hábitats) |
| Presentación | Globo, comparador, bilingüe, diseño de P6 |
| Uso de datos de agencias | GIBS, Trek, búsqueda federada CMR/Copernicus/PDS, procesamiento CSA/JAXA/LRO, `datasets_used` en cada ficha |

---

## 10. Riesgos

| Riesgo | Señal | Acción |
| :--- | :--- | :--- |
| Conflictos al hacer merge de `back-AR` | Merge bloqueado en H1 | Tomar su `App.jsx` como base (es la versión funcional) y rehacer encima la estructura nueva |
| El backend vuelve a tocar `frontend/` | Diferencias en `frontend/` en los PR de backend | Acuerdo D5 y regla de revisión: los PR de backend no tocan `frontend/` |
| No hay Node/pnpm en alguna máquina | `pnpm` no reconocido | Node LTS + `corepack enable pnpm` (sección 4.1) |
| `react-map-gl` 8 incompatible con `maplibre-gl` 6 | Errores de *peer* o mapa en blanco | `maplibre-gl` directo con `useRef` |
| `/candidates` existe pero sus datos no cumplen el contrato (B34) | El adaptador descarta todos los documentos | Desarrollo con el mock; en la demo, **no** se muestra el mock como resultado científico. Si a H12 no hay datos reales, el módulo A se presenta como "en construcción" y la demo se apoya en el módulo B |
| Dos backends en el mismo puerto (B32) | El módulo A o el B reciben 404 | Puertos 8000 y 8001 con dos URLs (D7) hasta que P4 los una |
| Falta `MONGO_URI` en el entorno de despliegue | La API de Mongo no arranca en Render | Configurar `MONGO_URI` en Render y comprobar `GET /` antes de la demo; si falla, Plan B (`candidates.json`) |
| Fuentes de `/api/search` caídas o vacías | Listas vacías | Mensaje neutro y pedir B10; los `partner_resources` siempre aparecen |
| El jurado cree que el procesamiento usa datos reales del bbox | — | Etiqueta B12 visible y explicación en el pitch (P6) |
| Dos librerías de mapa pesan demasiado | Bundle > 450 kB | Leaflet en carga diferida solo en el módulo B; si no alcanza, todo en Leaflet (D2) |
| Textos de P6 tarde | No existen a H10 | Claves con texto provisional `TODO:` que no rompen la UI; P6 los sustituye sin tocar código |
| Errores tardíos | Errores después de H16 | Congelar a H20 |

---

## 11. Preguntas abiertas
1. **Equipo:** ¿aprobamos el producto de dos módulos (D1)?
2. **P4:** ¿Mongo Atlas definitivo y PostGIS fuera del camino crítico (D6)? ¿Cuándo une las dos APIs en una sola app y un solo `requirements.txt` (D7/B32)? ¿Puede añadir `.env.example` (B33), arreglar `test_db.py` (B36), un campo `errors` por fuente en `/api/search` (B10) y `sample_name` en el export (B11)?
2b. **P3/P4:** ¿cuándo se carga en Mongo el `candidates.json` real con el contrato §05 y coordenadas terrestres (B34)? ¿Y `targets` con el perfil de 5 dimensiones (B35)?
3. **P4:** ¿cuál es el bbox de la Luna correcto (B8)? ¿Se deja de tocar `frontend/` después del merge (D5)?
4. **P3:** pesos restantes de cada preset, preset "Subsuelo" y si "Sombra persistente" (Z4) es una dimensión propia o sale de `iluminacion`.
5. **P1/P2:** formato y nombres de los pares de imágenes del comparador y del mapa de calor PNG.
6. **P6:** ¿wireframes a H3, paleta a H4 y textos a H10? ¿Se mantiene el formato JSON por clave para los textos?
