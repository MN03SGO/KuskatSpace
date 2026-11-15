# PLAN_P1 — Datos Terrestres (P1 JORGE) · TerraAnáloga v2.0

> Rama: `feature/p1-datos-terrestres` · Presupuesto: **5 h reales** · Zona: `/pipeline`, `/data`
> Fuente de verdad: [plan_maestro_terraan_loga_v2_0_hackathon_24h.md](plan_maestro_terraan_loga_v2_0_hackathon_24h.md)

## 1. Auditoría del repo (estado al 2026-11-14 18:15)

| Ruta | Estado | Notas |
|---|---|---|
| `/pipeline` | **no existía** → creado por P1 | Python 3.13, venv local `pipeline/.venv` (ignorado) |
| `/data` | **no existía** → creado por P1 | salidas P1 |
| `/api` | **no existe** | El backend real está en `backend/` (FastAPI MVP genérico: `/api/search`, `/api/process/demo`; sin MongoDB). Deps: `backend/requirements.txt` (fastapi, uvicorn, httpx, numpy, scipy, rasterio, Pillow) |
| `/web` | **no existe** | El frontend real está en `frontend/` (React 19 + Vite, JS; **sin** MapLibre, TypeScript ni Tailwind aún — `frontend/package.json`) |
| Build/deploy | **no existe** | Sin CI, Dockerfile, ni config Render/Vercel |
| Contrato CSV `earth_features.csv` | **no existe en repo** | Solo definido en el brief de P1 (se fija aquí, §4) |
| Contrato JSON | existe | Esquema `candidates` (plan_maestro L107-145) — lo producen P3/P4, no P1 |
| `.env` | ignorado por `.gitignore` L25 | ✅ no versionado |

Observaciones para otros roles (no tocadas por P1): `backend/__pycache__/main.cpython-313.pyc` está versionado (P4); las carpetas reales son `backend/`/`frontend/` y no `/api`/`/web` como dice plan_maestro L164.

## 2. Tareas P1 extraídas del plan_maestro y dependencias

| # | Tarea P1 | Ref. plan_maestro | Consumidor |
|---|---|---|---|
| T1 | Verificar accesos (Earthdata, CDSE, G-Portal) | L164 | — |
| T2 | Grilla terrestre ~5 km | L165 | P3, P4 |
| T3 | Pendientes Copernicus DEM a escala homóloga (~240 m, ventanas ~5 km) | L62, L73, L165 | P3 (dim. Relieve) — homólogo a LOLA/MOLA de **P2** |
| T4 | Sombra solar en 4 fechas | L165 | P3 (dim. Iluminación) — compara con iluminación LOLA de **P2** |
| T5 | Carga de polvo MODIS AOD | L60, L165 | P3 (dim. Polvo) |
| T6 | MODIS LST, nieve MODIS/JAXA, filtro NDVI | L60, L64, L166 | P3 (Frío, Hielo, filtro vegetación) |
| T7 | Exportar `earth_features.csv` + mapa de calor PNG | L166 | P3 → `candidates.json` → **P4** (Mongo) → **P5** (mapa) |
| T8 | Imágenes Sentinel-2 + SAR (RADARSAT-1/RCM) para Top candidatos | L65-66, L169 | P3 fichas, P5 comparador |
| T9 | Plan B: grilla 15 km / prefiltrado si GEE tarda | L180 | — |
| T10 | `metadata.json` (fuente, versión, fechas, licencia) | L170 | **P6** |

## 3. Decisiones (ambigüedades resueltas)

### 3.1 Grilla
- Tierra emergida ≈ 149 M km². Grilla completa 5 km (25 km²/celda) ≈ **5,9 M celdas** → inviable en 5 h con 4 sombras + 4 productos MODIS multianuales (cuota 150 h EECU, peticiones concurrentes limitadas en nivel Comunidad).
- Grilla 15 km completa ≈ **0,66 M celdas**; prefiltrado (áridas + montaña + |lat|>50°) a 5 km sigue en ≈ 3–3,5 M celdas.
- **Decisión:** grilla **equal-area EASE-Grid 2.0 (EPSG:6933), paso 15 km**, y en cada celda se calculan estadísticas sobre una **ventana central de 5 km de diámetro** (buffer 2,5 km del centro). Así se conserva la *ventana homóloga de ~5 km* (plan_maestro L73) con ~0,66 M filas y 1/9 del área a procesar.
- Máscara de tierra = cobertura del DEM GLO-30 en el centro de celda. EPSG:6933 cubre ±86° → se pierde el casquete >86°S (meseta antártica interior, homogénea); documentado.
- `cell_id = E15_r{fila}_c{col}` (determinista, derivado de EPSG:6933).
- Agregación con `reduceRegions` por teselas de latitud (bandas de 2° × 30° lon) vía `ee.data.computeFeatures` (sin exportar rásters).
- **Plan B:** paso 30 km (≈0,17 M celdas) o prefiltrado `|lat|>50° ∨ elev>1500 m ∨ ndvi_max<0,3`.

### 3.2 Sombra solar en 4 fechas
- Fechas (solo fijan la declinación δ; el DEM es estático): **d1 = 2024-03-20 (δ≈0°), d2 = 2024-06-20 (δ=+23,44°), d3 = 2024-09-22 (δ≈0°), d4 = 2024-12-21 (δ=−23,44°)**.
- Geometría: sol al **mediodía solar local** → elevación `h = 90° − |lat − δ|`, azimut 180° si `lat>δ`, 0° si no. Se calcula por banda de 2° de latitud (error ≤1° en h).
- Método GEE: `ee.Terrain.hillShadow(dem240, azimut, cenit=90−h, neighborhoodSize=100 px≈24 km)` sobre DEM a 240 m; `shadow_frac_dX` = fracción de píxeles en sombra en la ventana de 5 km. Si `h ≤ 0` (noche polar) → `1.0`.
- **Justificación frente al Polo Sur Lunar** (sol rasante ≤ ~1,5°, eje inclinado 1,54°): la Tierra no tiene un sol rasante permanente salvo en altas latitudes; con esta definición, a |lat| ≳ 65° el sol de invierno al mediodía queda entre 0° y ~1,5° — **la misma geometría lunar** — y el relieve proyecta sombras largas. Así `shadow_frac_d1..d4` mide *iluminación real terrestre* (similitud de propiedad) y su ciclo estacional, y P3 puede usar `max(d1..d4)` como análogo de PSR. Mediodía = caso más iluminado del día → sombra conservadora (no sobreestima análogos).
- Variante opcional (requiere acuerdo con P3 → **cambio de contrato, no se hace sin aviso**): `shadow_frac_lunar` con h = 1,5° fijo y 4 azimuts.

### 3.3 Remuestreo 30 m → 240 m
- `COPERNICUS/DEM/GLO30_2024_1` (colección; se hace `mosaic()` + `setDefaultProjection(EPSG:4326, 30 m)`) y se evalúa en `reduceRegions(scale=240, crs=EPSG:6933)`: GEE remuestrea por pirámides (media) a 240 m antes de `ee.Terrain.slope`, como recomienda el catálogo para esta colección. Pendiente, relieve y sombra se calculan **a 240 m** (homólogo a LOLA/MOLA ~240 m de P2).
- `slope_mean`, `slope_p90` = media y p90 espacial de la pendiente (°) en la ventana; `relief_local` = máx − mín de elevación (m) en la ventana; `elev_m` = media.

### 3.4 EMIT y MERRA-2: **opcionales** (bloque 4:15-5:00 o fichas). IDs verificados: `NASA/EMIT/L2A/RFL`, `NASA/GSFC/MERRA/aer/2`.

### 3.5 Climatología MODIS
- **2019-01-01 → 2023-12-31 (5 años completos)**: suficiente para promediar variabilidad interanual (p. ej. ENSO, años de polvo extremo) sin arrastrar tendencias largas; todos los productos C6.1 completos y estables en ese periodo; mismas fechas para todos → reproducible.
- `lst_mean` = media de (Día+Noche)/2 (K); `lst_min` = mínimo de las 12 medias mensuales nocturnas; `lst_max` = máximo de las 12 medias mensuales diurnas; `lst_amp` = media de (LST_Día − LST_Noche) (amplitud diurna, proceso térmico clave frente a la Luna).
- `snow_persist` = fracción de compuestos 8 días con nieve (`Maximum_Snow_Extent == 200`) sobre compuestos válidos (MOD10A2, más barato que MOD10A1 diario).
- `aod_mean`, `aod_p90` = media y p90 temporal por píxel de `Optical_Depth_055` (MAIAC), luego media en la ventana. Si el coste es alto → reducir a 2022-2023 (Plan B, se reportará).
- `ndvi_mean`, `ndvi_max` = media y máx de NDVI 16 días (MOD13A2).

## 4. Contrato `/data/earth_features.csv` (sin cambios respecto al brief)
`cell_id, lat, lon, elev_m, slope_mean, slope_p90, relief_local, shadow_frac_d1, shadow_frac_d2, shadow_frac_d3, shadow_frac_d4, lst_mean, lst_min, lst_max, lst_amp, snow_persist, aod_mean, aod_p90, ndvi_mean, ndvi_max, qc_flag`
- WGS84, lat/lon = centro de celda; valores físicos crudos (m, °, fracción 0-1, K, AOD adimensional, NDVI −1..1).
- `qc_flag` (bitmask entero): 1 DEM incompleto · 2 LST nulo · 4 nieve nula · 8 AOD nulo · 16 NDVI nulo · 32 valor fuera de rango físico (se pone a nulo) · 0 = OK.

## 5. Datasets verificados en el catálogo STAC de GEE (consultado 2026-11-14)

| Variable | ID GEE | Versión / periodo | Licencia |
|---|---|---|---|
| DEM | `COPERNICUS/DEM/GLO30_2024_1` | release 2024_1 (2010-12 → 2020-11). ⚠️ `COPERNICUS/DEM/GLO30` está **deprecado** | Copernicus DEM licence (libre salvo AM/AZ) |
| LST | `MODIS/061/MOD11A2` | C6.1, DOI 10.5067/MODIS/MOD11A2.061 | NASA EOSDIS abierta |
| Nieve | `MODIS/061/MOD10A2` (8 d) / `MOD10A1` (diario) | C6.1 | NASA abierta |
| AOD | `MODIS/061/MCD19A2_GRANULES` | C6.1 MAIAC, DOI 10.5067/MODIS/MCD19A2.061 | NASA abierta |
| NDVI | `MODIS/061/MOD13A2` | C6.1 | NASA abierta |
| SAR sustituto | `COPERNICUS/S1_GRD` | 2014 → hoy | Copernicus Sentinel |
| Óptico | `COPERNICUS/S2_SR_HARMONIZED` | 2017 → hoy | Copernicus Sentinel |
| Opc. | `NASA/EMIT/L2A/RFL`, `NASA/GSFC/MERRA/aer/2` | — | NASA abierta |

## 6. Checklist por bloques (5 h)

### 0:00-0:30 — Accesos + prueba de humo + contrato
- [x] Rama `feature/p1-datos-terrestres` verificada
- [x] venv + `pipeline/requirements.txt` (earthengine-api 1.7.52, pandas, numpy, matplotlib, pystac-client)
- [x] `earthengine authenticate` completado por Jorge
- [x] IDs de datasets verificados en catálogo (tabla §5)
- [ ] **BLOQUEO:** `GEE_PROJECT_ID` en `.env` es un placeholder → Jorge debe poner el ID real del proyecto Cloud registrado en GEE
- [ ] Prueba de humo `pipeline/smoke_test.py` (DEM + LST en McMurdo) — terminado = imprime elev y LST plausibles · 5 min
- [ ] Earthdata token válido (consulta CMR autenticada) · 5 min
- [x] Contrato CSV fijado (§4)

### 0:30-2:30 — Camino crítico: grilla, DEM, sombra, AOD (`pipeline/features.py`)
- [ ] Grilla EASE 15 km + ventanas 5 km (T2) · consumidor P3/P4 · 20 min · terminado = nº celdas ≈ 0,6 M estimado y prueba en 1 tesela
- [ ] DEM: elev, slope_mean, slope_p90, relief_local (T3) · 30 min · terminado = valores plausibles en tesela de prueba (Andes/Antártida)
- [ ] Sombra 4 fechas (T4) · 30 min · terminado = noche polar → 1, trópicos ≈ 0
- [ ] AOD climatología (T5) · 20 min · terminado = Sahara/Taklamakán altos, Antártida bajos
- [ ] Prueba de rendimiento en región pequeña → decidir escala global vs Plan B

### 2:30-3:30 — LST, nieve, NDVI + exportación (T6, T7)
- [ ] LST (4 campos), snow_persist, NDVI (2 campos) en el mismo `reduceRegions`
- [ ] Ejecución global por teselas en paralelo con reintentos y caché por tesela (`data/tiles/`)
- [ ] `data/earth_features.csv` ensamblado

### 3:30-4:15 — QC + mapa de calor + metadata
- [ ] `pipeline/qc.py`: rangos físicos, % nulos por columna, `qc_flag` · informe `data/qc_report.json`
- [ ] `pipeline/heatmap.py`: PNG EPSG:4326 + `data/heatmap_bounds.json` (P5)
- [ ] `data/metadata.json` (P6)

### 4:15-5:00 — Opcional
- [ ] Sentinel-2 RGB miniaturas para Top candidatos (cuando P3 tenga Top 5)
- [ ] SAR: Sentinel-1 GRD como sustituto (⚠️ desviación, ver §7)
- [ ] G-Portal (GCOM-C/AMSR2) si se aprueba la cuenta

## 7. Desviaciones (requieren aprobación del equipo)
- **D1** `COPERNICUS/DEM/GLO30` deprecado → se usa `COPERNICUS/DEM/GLO30_2024_1` (mismo producto, release 2024).
- **D2** RADARSAT-1/RCM sin acceso → **Sentinel-1 GRD** (banda C, misma frecuencia) para textura radar del Top 5.
- **D3** JAXA G-Portal pendiente → nieve solo con MODIS MOD10A2; validación cruzada GCOM-C/AMSR2 si llega el acceso.
- **D4** Grilla: paso 15 km con ventana de 5 km (en lugar de grilla contigua de 5 km).
- **D5** Casquete >86°S no cubierto (límite de EPSG:6933).
