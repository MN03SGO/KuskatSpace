# backend/ — biblioteca del backend

Aquí viven los módulos de teledetección y los scripts de datos. **La app FastAPI es
`api/main.py`** (en la raíz), que los importa añadiendo `backend/` al `sys.path`.

```
api/main.py       ← app única: /candidates, /targets, /datasets, /health, /api/*
backend/
  connectors.py   ← búsqueda federada NASA / Copernicus / PDS
  processor.py    ← pipelines SAR, NDVI, NDWI, Diviner, precipitación
  prepare_samples.py
  sample_data/    ← rásteres de ejemplo
  seed_mongo.py   ← datos de ejemplo (NO cumplen §05)
  test_db.py      ← prueba de conexión (colección `_connection_test`)
  requirements.txt
```

## Arranque

Desde la **raíz** del repo:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
cd ..
.\.venv\Scripts\python.exe -m uvicorn api.main:app --reload --port 8000
```

> El venv vive en `backend/.venv`; se puede usar desde la raíz con `backend\.venv\Scripts\python.exe`.

Abre <http://localhost:8000/docs>.

## Variables de entorno

Copia `.env.example` (raíz) a `.env`:

```
MONGO_URI=mongodb+srv://usuario:password@cluster.mongodb.net/?retryWrites=true&w=majority
```

Sin `MONGO_URI`, `api/main.py` **cae al JSON local** (`data/*.json`): el módulo A
funciona igual, sin base de datos.

## Rutas

| Método | Ruta | Fuente |
|---|---|---|
| GET | `/health` | estado |
| GET | `/candidates` | Mongo → fallback `data/candidates.json` |
| GET | `/candidates/near?lat&lon&max_distance_km` | Mongo / haversine local |
| GET | `/targets` | Mongo → fallback `data/targets.json` |
| GET | `/datasets` | Mongo → fallback `data/datasets.json` |
| GET | `/api/search` | búsqueda federada |
| POST | `/api/process` | pipeline de procesamiento |
| GET | `/api/export/geotiff` | descarga GeoTIFF |

## Cargar los datos reales (§05)

```powershell
python pipeline/normalizar_contrato.py   # deja data/candidates.json en el contrato §05
python pipeline/cargar_mongo.py          # upsert en la BD nasa_space
```

`cargar_mongo.py` sube `targets`, `candidates` y `datasets` a **`nasa_space`**.
El original sin normalizar queda en `data/candidates.raw.json`.
