"""
TerraAnáloga REST API - NASA Space Apps Challenge 2026
======================================================
Reto: Identify Earth Locations that Analog Permanent Moon Base & Mars
Backend FastAPI con Soporte Híbrido MongoDB Atlas + Fallback Local JSON
"""

import os
import sys
import json
import math
from contextlib import asynccontextmanager
from pathlib import Path
from typing import List, Dict, Any, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, Query, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import pymongo
from pymongo import MongoClient
from pymongo.errors import PyMongoError

# Asegurar importación de módulos de teledetección de backend/
BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

try:
    from connectors import run_federated_search
    from processor import execute_pipeline, export_geotiff_bytes
    REMOTE_SENSING_AVAILABLE = True
except Exception:
    REMOTE_SENSING_AVAILABLE = False

# Cargar variables de entorno
load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "")
DB_NAME = "analogos"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Inicializa MongoClient una sola vez al arrancar la aplicación (sin ping por request)."""
    client: Optional[MongoClient] = None
    if MONGO_URI and "<usuario>" not in MONGO_URI:
        try:
            client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=2500)
            client.admin.command("ping")
        except Exception:
            if client is not None:
                client.close()
            client = None
    app.state.mongo_client = client
    try:
        yield
    finally:
        if app.state.mongo_client is not None:
            app.state.mongo_client.close()
            app.state.mongo_client = None


app = FastAPI(
    title="TerraAnáloga API",
    description="API Geoespacial de Análogos Planetarios Terrestres (Luna y Marte) - NASA Space Apps Challenge 2026",
    version="1.0.0",
    lifespan=lifespan,
)

# Configuración obligatoria de CORS para permitir peticiones desde cualquier frontend (Leaflet, MapLibre, React, Vite)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Modelos Pydantic de Validación
# ---------------------------------------------------------------------------

class GeoLocation(BaseModel):
    type: str = "Point"
    coordinates: List[float] = Field(..., description="[longitud, latitud] en WGS84")


class Scores(BaseModel):
    relieve: float = Field(..., ge=0.0, le=1.0)
    iluminacion: float = Field(..., ge=0.0, le=1.0)
    frio: float = Field(..., ge=0.0, le=1.0)
    hielo: float = Field(..., ge=0.0, le=1.0)
    polvo: Optional[float] = Field(None, ge=0.0, le=1.0)


class CandidateResponse(BaseModel):
    id: str = Field(..., alias="_id")
    name: str
    country: Optional[str] = None
    target: str
    analog_type: Optional[str] = None
    is_understudied: Optional[bool] = False
    is_curated: Optional[bool] = False
    location: GeoLocation
    metrics: Optional[Dict[str, Any]] = None
    scores: Scores
    weighted_score: Optional[float] = None
    distance_km: Optional[float] = None
    similar_values: List[str] = []
    similar_processes: List[str] = []
    earth_limits: List[str] = []
    exploration_use: Optional[str] = None
    datasets: List[str] = []
    orbital_previews: Optional[Dict[str, Any]] = None
    p1_cell_metrics: Optional[Dict[str, Any]] = None

    model_config = {
        "populate_by_name": True
    }


class TargetProfile(BaseModel):
    id: str = Field(..., alias="_id")
    name: str
    body: str
    description: str
    priority: int
    dimensions: Dict[str, Any]
    environmental_factors: Optional[Dict[str, str]] = None
    key_instruments: Optional[List[str]] = []

    model_config = {
        "populate_by_name": True
    }


class DatasetCatalogItem(BaseModel):
    id: str
    name: str
    agency: str
    url: str
    license: str
    dimension: str
    usage: str


class HealthStatus(BaseModel):
    status: str
    database_mode: str
    connected_to_mongo: bool
    message: str
    candidates_count: int


# ---------------------------------------------------------------------------
# Gestión de Datos: MongoDB Atlas + Plan B (Fallback Local JSON)
# ---------------------------------------------------------------------------

def locate_data_dir() -> Path:
    """Encuentra la carpeta data/ tanto si se ejecuta desde raíz como desde api/."""
    current = Path(__file__).resolve().parent
    if (current / "data").exists():
        return current / "data"
    if (current.parent / "data").exists():
        return current.parent / "data"
    return current.parent / "data"


DATA_DIR = locate_data_dir()


def read_local_json(filename: str) -> List[Dict[str, Any]]:
    """Lectura segura del respaldo JSON local."""
    filepath = DATA_DIR / filename
    if not filepath.exists():
        return []
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def get_mongo_client() -> Optional[MongoClient]:
    """Devuelve el cliente MongoDB singleton inicializado en lifespan."""
    return getattr(app.state, "mongo_client", None)


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calcula la distancia geodésica en kilómetros entre dos coordenadas WGS84."""
    r = 6371.0  # Radio medio terrestre en km
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c


def compute_weighted_score(
    scores: Dict[str, float],
    w_relieve: float,
    w_iluminacion: float,
    w_frio: float,
    w_hielo: float
) -> float:
    """Calcula el puntaje ponderado normalizado [0.0 - 1.0]."""
    total_weight = w_relieve + w_iluminacion + w_frio + w_hielo
    if total_weight <= 0:
        total_weight = 1.0

    score_val = (
        scores.get("relieve", 0.0) * w_relieve +
        scores.get("iluminacion", 0.0) * w_iluminacion +
        scores.get("frio", 0.0) * w_frio +
        scores.get("hielo", 0.0) * w_hielo
    ) / total_weight

    return round(float(score_val), 4)


# ---------------------------------------------------------------------------
# Endpoints de la API
# ---------------------------------------------------------------------------

@app.get("/health", response_model=HealthStatus, tags=["Sistema"])
def health_check():
    """
    Verifica la conectividad con MongoDB Atlas y la disponibilidad de datos.
    Si la base de datos no está disponible, reporta el modo fallback automático.
    """
    client = get_mongo_client()
    if client:
        try:
            db = client[DB_NAME]
            count = db["candidates"].count_documents({})
            return HealthStatus(
                status="healthy",
                database_mode="mongodb",
                connected_to_mongo=True,
                message="Conexión activa con MongoDB Atlas / Local.",
                candidates_count=count,
            )
        except Exception:
            pass

    # Modo fallback local
    local_candidates = read_local_json("candidates.json")
    return HealthStatus(
        status="healthy_fallback",
        database_mode="local_fallback",
        connected_to_mongo=False,
        message="MongoDB no disponible o no configurado. Operando con catálogo local en data/candidates.json.",
        candidates_count=len(local_candidates),
    )


@app.get("/targets", response_model=List[TargetProfile], tags=["Objetivos Planetarios"])
def get_targets():
    """Devuelve los perfiles de objetivos planetarios (Polo Sur Lunar, Mare Tranquillitatis y Marte)."""
    client = get_mongo_client()
    if client:
        try:
            db = client[DB_NAME]
            docs = list(db["targets"].find({}))
            if docs:
                return docs
        except PyMongoError:
            pass

    # Fallback local
    return read_local_json("targets.json")


@app.get("/datasets", response_model=List[DatasetCatalogItem], tags=["Datasets Oficiales"])
def get_datasets():
    """Devuelve el catálogo de fuentes auditadas (NASA, CSA, ESA, JAXA, Planetary Computer, Meteomatics)."""
    client = get_mongo_client()
    if client:
        try:
            db = client[DB_NAME]
            docs = list(db["datasets"].find({}))
            if docs:
                for doc in docs:
                    if "id" not in doc and "_id" in doc:
                        doc["id"] = doc["_id"]
                return docs
        except PyMongoError:
            pass

    # Fallback local
    return read_local_json("datasets.json")


def clean_doc(doc: Any) -> Any:
    """Convierte _id de MongoDB y valores no serializables a tipos compatibles con JSON."""
    if isinstance(doc, dict):
        return {str(k): clean_doc(v) if k != "_id" else str(v) for k, v in doc.items()}
    if isinstance(doc, list):
        return [clean_doc(x) for x in doc]
    return doc


@app.get("/export", tags=["Sistema"])
def export_all():
    """Respaldo JSON completo de candidates + targets (compatibilidad feature/database)."""
    client = get_mongo_client()
    if client:
        try:
            db = client[DB_NAME]
            return {
                "database": DB_NAME,
                "candidates": [clean_doc(d) for d in db["candidates"].find({})],
                "targets": [clean_doc(d) for d in db["targets"].find({})],
            }
        except PyMongoError:
            pass

    return {
        "database": DB_NAME,
        "candidates": read_local_json("candidates.json"),
        "targets": read_local_json("targets.json"),
    }


@app.get("/candidates", response_model=List[CandidateResponse], tags=["Candidatos Análogos"])
def get_candidates(
    target: Optional[str] = Query(None, description="Filtrar por objetivo: moon_south_pole, moon_lava_tube o mars"),
    relieve: float = Query(1.0, ge=0.0, le=5.0, description="Peso dinámico para relieve topográfico"),
    iluminacion: float = Query(1.0, ge=0.0, le=5.0, description="Peso dinámico para iluminación / insolación"),
    frio: float = Query(1.0, ge=0.0, le=5.0, description="Peso dinámico para frío extremo"),
    hielo: float = Query(1.0, ge=0.0, le=5.0, description="Peso dinámico para agua / hielo / permafrost"),
    limit: int = Query(200, ge=1, le=500, description="Límite máximo de resultados"),
):
    """
    Recalcula el puntaje de similitud en tiempo real según los sliders del usuario y
    ordena los candidatos de mayor a menor coincidencia.
    """
    candidates = []
    client = get_mongo_client()

    if client:
        try:
            db = client[DB_NAME]
            query = {"target": target} if target else {}
            candidates = list(db["candidates"].find(query))
        except PyMongoError:
            candidates = []

    if not candidates:
        # Fallback local
        raw_candidates = read_local_json("candidates.json")
        if target:
            candidates = [c for c in raw_candidates if c.get("target") == target]
        else:
            candidates = raw_candidates

    # Recálculo dinámico ponderado de similitud
    for c in candidates:
        scores = c.get("scores", {})
        c["weighted_score"] = compute_weighted_score(scores, relieve, iluminacion, frio, hielo)

    # Ordenar descendentemente por el puntaje resultante
    candidates.sort(key=lambda x: x.get("weighted_score", 0.0), reverse=True)

    return candidates[:limit]


@app.get("/candidates/near", response_model=List[CandidateResponse], tags=["Búsqueda Geoespacial"])
def get_candidates_near(
    lat: float = Query(..., ge=-90.0, le=90.0, description="Latitud del punto de interés"),
    lon: float = Query(..., ge=-180.0, le=180.0, description="Longitud del punto de interés"),
    max_distance_km: float = Query(2000.0, ge=1.0, le=20000.0, description="Radio de búsqueda en km"),
    radius_km: Optional[float] = Query(None, description="Alias de radio de búsqueda para compatibilidad"),
    target: Optional[str] = Query(None, description="Filtro opcional por objetivo planetario"),
    limit: int = Query(10, ge=1, le=50, description="Máximo de análogos cercanos a retornar"),
):
    """
    Busca análogos planetarios cercanos a una coordenada (clic en el mapa).
    Utiliza el operador geoespacial $near de MongoDB o cálculo geodésico Haversine en modo fallback.
    """
    search_dist_km = radius_km if radius_km is not None else max_distance_km
    client = get_mongo_client()
    results = []

    if client:
        try:
            db = client[DB_NAME]
            query: Dict[str, Any] = {
                "location": {
                    "$near": {
                        "$geometry": {
                            "type": "Point",
                            "coordinates": [lon, lat],
                        },
                        "$maxDistance": search_dist_km * 1000.0,  # En metros
                    }
                }
            }
            if target:
                query["target"] = target

            mongo_results = list(db["candidates"].find(query).limit(limit))
            for doc in mongo_results:
                coords = doc.get("location", {}).get("coordinates", [0, 0])
                doc["distance_km"] = round(haversine_km(lat, lon, coords[1], coords[0]), 2)
                doc["weighted_score"] = compute_weighted_score(doc.get("scores", {}), 1.0, 1.0, 1.0, 1.0)
                results.append(doc)
            return results
        except PyMongoError:
            results = []

    # Fallback con cálculo de distancia Haversine
    local_candidates = read_local_json("candidates.json")
    filtered = []
    for c in local_candidates:
        if target and c.get("target") != target:
            continue
        coords = c.get("location", {}).get("coordinates", [0, 0])
        dist = haversine_km(lat, lon, coords[1], coords[0])
        if dist <= search_dist_km:
            c_copy = dict(c)
            c_copy["distance_km"] = round(dist, 2)
            c_copy["weighted_score"] = compute_weighted_score(c_copy.get("scores", {}), 1.0, 1.0, 1.0, 1.0)
            filtered.append(c_copy)

    filtered.sort(key=lambda x: x.get("distance_km", 999999))
    return filtered[:limit]


# ---------------------------------------------------------------------------
# Endpoints de Productos Geoespaciales P1 (Heatmaps GEE, Previews S1/S2 y QC)
# ---------------------------------------------------------------------------

if DATA_DIR.exists():
    app.mount("/data", StaticFiles(directory=str(DATA_DIR)), name="data")


@app.get("/api/p1/heatmaps", tags=["Pipeline Terrestre P1 (GEE)"])
def get_p1_heatmaps():
    """Devuelve `data/heatmap_bounds.json` con metadatos, bounds (Leaflet/MapLibre) y capas PNG."""
    for candidate_path in (
        DATA_DIR / "heatmap_bounds.json",
        DATA_DIR.parent / "frontend" / "public" / "data" / "heatmap_bounds.json",
    ):
        if candidate_path.exists():
            return json.loads(candidate_path.read_text(encoding="utf-8"))
    raise HTTPException(status_code=404, detail="heatmap_bounds.json no encontrado")


@app.get("/api/p1/orbital-previews", tags=["Pipeline Terrestre P1 (GEE)"])
def get_p1_orbital_previews():
    """Devuelve el catálogo `orbital_previews.json` (Sentinel-2 RGB + Sentinel-1 SAR con filtro Lee)."""
    for candidate_path in (
        DATA_DIR / "orbital_previews" / "orbital_previews.json",
        DATA_DIR.parent / "frontend" / "public" / "data" / "orbital_previews" / "orbital_previews.json",
    ):
        if candidate_path.exists():
            return json.loads(candidate_path.read_text(encoding="utf-8"))
    raise HTTPException(status_code=404, detail="orbital_previews.json no encontrado")


def _sanitize_json(obj: Any) -> Any:
    """Reemplaza NaN/Infinity por None para serialización JSON estricta."""
    if isinstance(obj, float):
        return obj if math.isfinite(obj) else None
    if isinstance(obj, dict):
        return {k: _sanitize_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize_json(v) for v in obj]
    return obj


@app.get("/api/p1/qc-report", tags=["Pipeline Terrestre P1 (GEE)"])
def get_p1_qc_report():
    """Devuelve el reporte de control de calidad `qc_report.json` y `metadata.json`."""
    qc_file = DATA_DIR / "qc_report.json"
    if not qc_file.exists():
        qc_file = DATA_DIR.parent / "frontend" / "public" / "data" / "qc_report.json"
    meta_file = DATA_DIR / "metadata.json"
    if not meta_file.exists():
        meta_file = DATA_DIR.parent / "frontend" / "public" / "data" / "metadata.json"
    return _sanitize_json({
        "qc_report": json.loads(qc_file.read_text(encoding="utf-8")) if qc_file.exists() else {},
        "metadata": json.loads(meta_file.read_text(encoding="utf-8")) if meta_file.exists() else {},
    })


# ---------------------------------------------------------------------------
# Endpoints de Teledetección y Procesamiento Ráster Multi-Agencia (back-AR)
# ---------------------------------------------------------------------------

@app.get("/api/search", tags=["Teledetección Multi-Agencia"])
async def search_catalogs(
    bbox: str = Query("-90.1,13.1,-87.6,14.5", description="Bounding box en formato min_lon,min_lat,max_lon,max_lat"),
    start_date: str = Query("2026-10-01", description="Fecha de inicio YYYY-MM-DD"),
    end_date: str = Query("2026-11-10", description="Fecha fin YYYY-MM-DD"),
    body: str = Query("earth", description="Cuerpo celeste: earth, moon, mars"),
    variable: str = Query("all", description="Variable temática"),
    limit: int = Query(5, ge=1, le=20, description="Límite de resultados"),
):
    """Búsqueda federada de capas satelitales en NASA, CSA, ESA y JAXA."""
    if not REMOTE_SENSING_AVAILABLE:
        raise HTTPException(status_code=503, detail="Módulos de teledetección de backend/ no disponibles")
    return await run_federated_search(bbox, start_date, end_date, body, variable, limit)


@app.post("/api/process", tags=["Teledetección Multi-Agencia"])
def process_scene(
    mode: str = Query("sar_db", description="Modo: sar_db, ndvi, ndwi, diviner_thermal, jaxa_precip"),
    bbox: str = Query("-92.5,11.5,-83.0,17.5"),
    sample_name: Optional[str] = Query(None),
):
    """Procesa rásteres: SAR (filtro Lee), NDVI, NDWI, precipitación JAXA y radiometría térmica Diviner."""
    if not REMOTE_SENSING_AVAILABLE:
        raise HTTPException(status_code=503, detail="Módulos de teledetección de backend/ no disponibles")
    try:
        coords = [float(x) for x in bbox.split(",")]
        file_path = os.path.join(str(BACKEND_DIR), "sample_data", sample_name) if sample_name else None
        return execute_pipeline(mode=mode, bbox=coords, sample_path=file_path)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/export/geotiff", tags=["Teledetección Multi-Agencia"])
def download_processed_geotiff(
    mode: str = Query("sar_db", description="Modo: sar_db, ndvi, ndwi, diviner_thermal, jaxa_precip"),
    bbox: str = Query("-92.5,11.5,-83.0,17.5"),
):
    """Exporta el ráster procesado a un archivo GeoTIFF binario para descarga."""
    if not REMOTE_SENSING_AVAILABLE:
        raise HTTPException(status_code=503, detail="Módulos de teledetección de backend/ no disponibles")
    coords = [float(x) for x in bbox.split(",")]
    tif_bytes = export_geotiff_bytes(mode=mode, bbox=coords)
    return Response(
        content=tif_bytes,
        media_type="image/tiff",
        headers={"Content-Disposition": f"attachment; filename=resultado_{mode}.tif"},
    )


# ---------------------------------------------------------------------------
# Ejecución Directa
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    print(f"[*] Iniciando TerraAnáloga API en http://{host}:{port}")
    uvicorn.run("api.main:app", host=host, port=port, reload=True)
