# Backend — una sola app FastAPI

Todo el backend vive aquí y se sirve desde un único proceso (decisión **D7** del plan P5).
Antes había dos apps en el puerto 8000: `backend/main.py` (búsqueda federada) y un `main.py`
suelto en la raíz (MongoDB). Ya no.

## Arranque

```powershell
cd backend
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

Abre <http://localhost:8000/docs>.

> Ejecuta siempre desde `backend/`: las rutas a `sample_data/` y los imports
> (`connectors`, `processor`, `mongo_api`) son relativos a esa carpeta.

## Variables de entorno

Copia `.env.example` (raíz del repo) a `.env` y pon tu cadena de Atlas:

```
MONGO_URI=mongodb+srv://usuario:password@cluster.mongodb.net/?retryWrites=true&w=majority
```

Sin `MONGO_URI` la app **arranca igual**: solo los endpoints de datos responden `503`.

## Rutas

| Método | Ruta | Módulo |
|---|---|---|
| GET | `/` | salud |
| GET | `/candidates` | A — datos Mongo |
| GET | `/candidates/near?lat&lon&radius_km` | A — datos Mongo |
| GET | `/targets` | A — datos Mongo |
| GET | `/datasets` | A — catálogo de datasets |
| GET | `/export` | A — respaldo JSON (Plan B) |
| GET | `/api/search` | B — búsqueda federada |
| POST | `/api/process` | B — pipeline SAR/NDVI/NDWI/Diviner/precipitación |
| GET | `/api/export/geotiff` | B — descarga GeoTIFF |

## Scripts

```powershell
# Comprueba la conexión sin ensuciar `candidates`
.\.venv\Scripts\python.exe test_db.py

# Carga los datos de ejemplo (todavía NO cumplen el contrato §05)
.\.venv\Scripts\python.exe seed_mongo.py
```

## Cargar los datos reales (§05)

Los datos viven en `data/` (raíz del repo) y se cargan con el pipeline:

```powershell
# 1. Normaliza data/candidates.json al contrato §05 (idempotente)
python pipeline/normalizar_contrato.py

# 2. Upsert en Mongo (BD nasa_space) + índice 2dsphere
python pipeline/cargar_mongo.py
```

`cargar_mongo.py` sube `targets`, `candidates` y `datasets` a la BD **`nasa_space`**.
El original sin normalizar queda en `data/candidates.raw.json`.

## Pendiente

- `candidates` debe contener el `candidates.json` real con el contrato **§05**
  (`scores`, `region_type`, `country`, `target`, coordenadas **terrestres**, fichas).
  Mientras tanto `/api/search` y `/api/process` (módulo B) funcionan, pero el buscador
  de análogos (módulo A) no tiene datos válidos.
