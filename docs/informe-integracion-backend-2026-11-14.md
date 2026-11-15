# Informe de integración — backend unificado en `Frontend/WebGIS`

**Fecha:** 2026-11-14 (v2 — reemplaza al informe anterior)
**Repo:** `MN03SGO/NASA_SPACE`
**Ruta local:** `C:\Users\ricar\Downloads\NASA_SPACE`
**Rama:** `Frontend/WebGIS`
**Commits de la integración:** `c3e2be9` (merge) + `7f0968a` (unificación)
**Backup previo al merge:** `backup/pre-merge-20261114-1908` → `093a1a8`

---

## 1. Qué se hizo

| Commit | Qué |
|---|---|
| `c3e2be9` | Merge de `feature/database` (backend de Mongo de MN03SGO) en tu rama |
| `7f0968a` | **Unificación del backend**: una sola app FastAPI, un solo `requirements.txt` |

Con esto quedan resueltos **B32, B33, B36 y D7** del plan P5.

---

## 2. Antes vs. después

### Antes (dos backends peleando por el puerto 8000)

```
main.py              ← API Mongo   (/candidates, /targets)
requirements.txt     ← fastapi, pymongo…
seed_mongo.py
test_db.py
backend/
  main.py            ← API búsqueda (/api/search)
  requirements.txt   ← fastapi, rasterio…
```

### Después (un solo backend)

```
backend/
  main.py            ← app única: /api/* + /candidates + /targets + /export
  mongo_api.py       ← NUEVO: router con los endpoints de Mongo
  connectors.py
  processor.py
  prepare_samples.py
  seed_mongo.py      ← movido
  test_db.py         ← movido y corregido
  requirements.txt   ← unión, versiones fijas
  README.md          ← NUEVO: arranque, rutas, variables
docker-compose.yml   ← se queda en la raíz (infra del repo)
db/init.sql
.env.example         ← NUEVO
```

Eliminados de la raíz: `main.py`, `requirements.txt`, `seed_mongo.py`, `test_db.py`.

---

## 3. Rutas de la app única

| Método | Ruta | Módulo | Notas |
|---|---|---|---|
| GET | `/` | salud | `{status, service}` |
| GET | `/candidates` | A (Mongo) | contrato §05 — **pendiente de datos reales** |
| GET | `/candidates/near?lat&lon&radius_km` | A (Mongo) | `$near` + índice `2dsphere`, radio en km |
| GET | `/targets` | A (Mongo) | |
| GET | `/export` | A (Mongo) | respaldo JSON para el Plan B |
| GET | `/api/search` | B (federada) | NASA / Copernicus / PDS |
| POST | `/api/process` | B | SAR, NDVI, NDWI, Diviner, precipitación |
| GET | `/api/export/geotiff` | B | descarga GeoTIFF |

**Una sola URL en el frontend**: ya no hace falta `VITE_DATA_API_BASE`, basta `VITE_API_BASE`.

---

## 4. Verificación ejecutada (con `backend/.venv`)

```
python -m py_compile main.py mongo_api.py seed_mongo.py test_db.py   → OK
import main                                                          → APP OK
deps: fastapi 0.115.0 | pymongo 4.20.0 | python-dotenv               → OK
TestClient GET /                 → 200 {"status":"ok","service":"NASA_SPACE API"}
TestClient GET /candidates       → 503 {"detail":"Falta MONGO_URI en el archivo .env"}
```

La conexión a Mongo es **perezosa**: sin `MONGO_URI` la app arranca y la búsqueda
federada sigue funcionando; solo los endpoints de datos devuelven `503`.

También `tsc --noEmit` en `frontend/` → **exit 0**.

---

## 5. Datos: todavía NO hay datos reales ⚠️

| Cosa | Estado |
|---|---|
| `.env` con `MONGO_URI` | ❌ no existe (no está en el repo ni en el historial: es correcto) |
| `.env.example` | ✅ creado |
| Python + deps | ✅ `backend/.venv` (faltaba `pymongo`; instalado) |
| Mongo local / Docker | ❌ no hay |
| Contenido de `candidates` | ❌ 3 documentos de ejemplo (Marte/Luna) |

### El contrato real (§05 del plan maestro)

Cada candidato debe ser un **análogo terrestre** con:

```
_id, name, region_type, country,
location: GeoJSON Point [lon, lat]  (EN LA TIERRA),
target: "moon_south_pole" | "mars_surface" | "lava_tubes",
analog_category[],
scores: {relieve, iluminacion, frio, hielo, polvo}   ← [0,1]
similar_properties[], similar_processes[], differences_and_limits[],
exploration_use_cases[],
subsurface_and_biology: {subsurface_potential, extremophiles_note},
datasets_used[]
```

El seed actual **no lo cumple** (no hay `scores`, ni ficha, y son sitios de Marte y
la Luna): el adaptador `lib/candidateAdapter.ts` los descarta y la UI mostrará
"0 candidatos válidos de 3". Es el **B34** del plan.

---

## 6. Pendientes (en orden)

1. **Cargar `candidates.json` real con contrato §05** (coordenadas terrestres + `scores`).
   Necesita `MONGO_URI` de Atlas o un Mongo local.
2. **Decidir infra:** `docker-compose.yml` levanta PostGIS + MinIO + Adminer, pero el
   backend usa Mongo Atlas. O se elimina del camino crítico (D6) o se añade Mongo.
3. **`POST /api/process` sin body:** `processScene` manda POST vacío pero el endpoint
   solo acepta query params → funciona, pero conviene documentarlo o mover a body.
4. **`env.ts` del frontend:** quitar la idea de `VITE_DATA_API_BASE` (una sola URL ya).
5. **`seed_mongo.py` tiene mojibake** en los textos ("SatǸlite", "Crǭter"): hay que
   reescribirlo junto con el dataset real.

---

## 7. Bloque de contexto para el agente

```markdown
## Proyecto NASA_SPACE (MN03SGO/NASA_SPACE)

Monorepo: `frontend/` (React + TypeScript + Vite + pnpm) y `backend/` (FastAPI + PyMongo).
Rama de trabajo del frontend: `Frontend/WebGIS`.

### Backend (UNIFICADO, una sola app)
- Se arranca desde `backend/`: `.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000`
- Un solo `requirements.txt` en `backend/` (fastapi, uvicorn, httpx, numpy, scipy, rasterio,
  Pillow, python-multipart, pymongo, python-dotenv).
- `backend/main.py` monta `backend/mongo_api.py` como router.
- Rutas: GET / · GET /candidates · GET /candidates/near?lat&lon&radius_km · GET /targets ·
  GET /export · GET /api/search · POST /api/process · GET /api/export/geotiff
- Conexión a Mongo perezosa: sin MONGO_URI la app arranca y solo los endpoints de datos dan 503.
- `MONGO_URI` desde `.env` en la raíz (plantilla en `.env.example`).

### Frontend
- Una sola URL: `VITE_API_BASE` (default http://localhost:8000). `VITE_DATA_API_BASE` ya no aplica.
- TS estricto: no agregar `.jsx`. i18n en `src/i18n/{es,en}.json`.
- Módulo A (buscador de análogos) consume `/candidates` y valida con `lib/candidateAdapter.ts`.
- Módulo B (explorador) consume `/api/search`, `/api/process`, `/api/export/geotiff`.

### Contrato §05 de `candidates` (obligatorio)
_id, name, region_type, country, location (GeoJSON Point [lon,lat] TERRESTRE),
target (moon_south_pole|mars_surface|lava_tubes), analog_category[],
scores{relieve,iluminacion,frio,hielo,polvo} en [0,1], similar_properties[],
similar_processes[], differences_and_limits[], exploration_use_cases[],
subsurface_and_biology{subsurface_potential,extremophiles_note}, datasets_used[]

### Estado (2026-11-14)
- Merge `c3e2be9` + unificación `7f0968a` aplicados en local (sin push).
- PENDIENTE CRÍTICO: `candidates` solo tiene 3 documentos de ejemplo (Marte/Luna) sin
  `scores` ni ficha → el adaptador los descarta. Falta cargar el dataset real §05.
- PENDIENTE: decidir PostGIS del docker-compose vs Mongo Atlas.
- `.env` con MONGO_URI no existe todavía.

### Convenciones
- No commitear `.env`; `.env.local` en frontend.
- Ejecutar el backend siempre desde `backend/` (imports y `sample_data/` son relativos).
```

---

## 8. Cómo revertir

```powershell
# solo la unificación del backend
git revert --no-commit 7f0968a

# todo (merge + unificación)
git reset --hard backup/pre-merge-20261114-1908
```
