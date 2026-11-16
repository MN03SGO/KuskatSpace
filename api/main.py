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
from pathlib import Path
from typing import List, Dict, Any, Optional

from dotenv import load_dotenv
from fastapi import Body, FastAPI, Query, HTTPException, status
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

# Separar imports: /api/search solo necesita connectors (httpx).
# processor (rasterio/scipy) es opcional para /api/process y /api/export/geotiff.
run_federated_search = None
execute_pipeline = None
export_geotiff_bytes = None
CONNECTORS_AVAILABLE = False
PROCESSOR_AVAILABLE = False
REMOTE_SENSING_IMPORT_ERROR = None

try:
    from connectors import run_federated_search as _run_federated_search
    run_federated_search = _run_federated_search
    CONNECTORS_AVAILABLE = True
    print("[teledetección] connectors OK (búsqueda federada disponible)")
except Exception as e:
    REMOTE_SENSING_IMPORT_ERROR = f"connectors: {type(e).__name__}: {e}"
    print(f"Error: {e}")
    print(f"[teledetección] Falló import de connectors → {REMOTE_SENSING_IMPORT_ERROR}")

process_real_optical = None
ProcessValidationError = None
ProcessUpstreamError = None

try:
    from processor import execute_pipeline as _execute_pipeline
    from processor import export_geotiff_bytes as _export_geotiff_bytes
    execute_pipeline = _execute_pipeline
    export_geotiff_bytes = _export_geotiff_bytes
    PROCESSOR_AVAILABLE = True
    print("[teledetección] processor OK (procesamiento ráster disponible)")
except Exception as e:
    print(f"Error: {e}")
    print(f"[teledetección] Falló import de processor → {type(e).__name__}: {e}")
    print("[teledetección] Tip: pip install httpx rasterio scipy numpy Pillow")

EarthdataAuthError = None
SceneNotFoundError = None
BandUnavailableError = None
process_real_thermal = None

try:
    from real_optical import (
        EarthdataAuthError as _EarthdataAuthError,
        ProcessUpstreamError as _ProcessUpstreamError,
        ProcessValidationError as _ProcessValidationError,
        SceneNotFoundError as _SceneNotFoundError,
        BandUnavailableError as _BandUnavailableError,
        process_real_optical as _process_real_optical,
        process_real_thermal as _process_real_thermal,
    )
    process_real_thermal = _process_real_thermal
    BandUnavailableError = _BandUnavailableError
    process_real_optical = _process_real_optical
    ProcessValidationError = _ProcessValidationError
    ProcessUpstreamError = _ProcessUpstreamError
    EarthdataAuthError = _EarthdataAuthError
    SceneNotFoundError = _SceneNotFoundError
    print("[teledetección] real_optical OK (NDVI/NDWI COG + térmico HLS L30)")
except Exception as e:
    print(f"[teledetección] Falló import de real_optical → {type(e).__name__}: {e}")

# Compatibilidad con checks legacy
REMOTE_SENSING_AVAILABLE = CONNECTORS_AVAILABLE and PROCESSOR_AVAILABLE

# Cargar variables de entorno
load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "")
DB_NAME = "nasa_space"

app = FastAPI(
    title="TerraAnáloga API",
    description="API Geoespacial de Análogos Planetarios Terrestres (Luna y Marte) - NASA Space Apps Challenge 2026",
    version="1.0.0",
)

# CORS con orígenes explícitos (requerido si allow_credentials=True; "*" falla en el navegador)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ],
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


# Scores por defecto para docs NASA/Mongo incompletos (sin IFA 5D)
DEFAULT_SCORES: Dict[str, float] = {
    "relieve": 0.0,
    "iluminacion": 0.0,
    "frio": 0.0,
    "hielo": 0.0,
    "polvo": 0.0,
}


class Scores(BaseModel):
    relieve: float = Field(..., ge=0.0, le=1.0)
    iluminacion: float = Field(..., ge=0.0, le=1.0)
    frio: float = Field(..., ge=0.0, le=1.0)
    hielo: float = Field(..., ge=0.0, le=1.0)
    polvo: Optional[float] = Field(0.5, ge=0.0, le=1.0)


class CandidateResponse(BaseModel):
    id: str = Field(..., alias="_id")
    name: str
    country: Optional[str] = None
    target: str
    location: GeoLocation
    # Dict flexible + default vacío: docs NASA sin scores no rompen response_model
    scores: Dict[str, float] = Field(default_factory=dict)
    weighted_score: Optional[float] = None
    distance_km: Optional[float] = None
    # Campos de datos-planetarios (métricas crudas / curaduría)
    metrics: Optional[Dict[str, Any]] = None
    is_curated: Optional[bool] = False

    # --- Contrato §05 (plan maestro) ---
    region_type: Optional[str] = None
    analog_category: List[str] = []
    similar_properties: List[str] = []
    similar_processes: List[str] = []
    differences_and_limits: List[str] = []
    exploration_use_cases: List[str] = []
    subsurface_and_biology: Optional[Dict[str, str]] = None
    datasets_used: List[str] = []
    orbital_previews: Optional[Dict[str, Any]] = None
    p1_cell_metrics: Optional[Dict[str, Any]] = None

    # --- Compatibilidad con documentos anteriores al §05 ---
    analog_type: Optional[str] = None
    is_understudied: Optional[bool] = False
    similar_values: List[str] = []
    earth_limits: List[str] = []
    exploration_use: Optional[str] = None
    datasets: List[str] = []

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
    """Intenta inicializar el cliente MongoDB con timeout rápido para no bloquear."""
    if not MONGO_URI or "<usuario>" in MONGO_URI:
        return None
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=2000)
        client.admin.command("ping")
        return client
    except Exception:
        return None


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


TARGET_ALIASES: Dict[str, List[str]] = {
    "mars": ["mars", "mars_surface"],
    "mars_surface": ["mars", "mars_surface"],
    "moon_lava_tube": ["moon_lava_tube", "lava_tubes"],
    "lava_tubes": ["moon_lava_tube", "lava_tubes"],
    "moon_south_pole": ["moon_south_pole"],
}


def compute_weighted_score(
    scores: Dict[str, float],
    w_relieve: float,
    w_iluminacion: float,
    w_frio: float,
    w_hielo: float,
    w_polvo: float = 1.0,
) -> float:
    """Calcula el Índice de Fidelidad Analógica (IFA §04) ponderado en las 5 dimensiones [0.0 - 1.0]."""
    has_polvo = scores.get("polvo") is not None
    eff_polvo = w_polvo if has_polvo else 0.0
    total_weight = w_relieve + w_iluminacion + w_frio + w_hielo + eff_polvo
    if total_weight <= 0:
        total_weight = 1.0

    score_val = (
        scores.get("relieve", 0.0) * w_relieve +
        scores.get("iluminacion", 0.0) * w_iluminacion +
        scores.get("frio", 0.0) * w_frio +
        scores.get("hielo", 0.0) * w_hielo +
        (scores.get("polvo", 0.0) or 0.0) * eff_polvo
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
    """Respaldo JSON completo de candidates + targets + datasets (Plan B / compatibilidad)."""
    client = get_mongo_client()
    if client:
        try:
            db = client[DB_NAME]
            return {
                "database": DB_NAME,
                "candidates": [clean_doc(d) for d in db["candidates"].find({})],
                "targets": [clean_doc(d) for d in db["targets"].find({})],
                "datasets": [clean_doc(d) for d in db["datasets"].find({})],
            }
        except PyMongoError:
            pass

    return {
        "database": DB_NAME,
        "candidates": read_local_json("candidates.json"),
        "targets": read_local_json("targets.json"),
        "datasets": read_local_json("datasets.json"),
    }


@app.get("/candidates", response_model=List[CandidateResponse], tags=["Candidatos Análogos"])
def get_candidates(
    target: Optional[str] = Query(None, description="Filtrar por objetivo: moon_south_pole, mars_surface (o mars), lava_tubes (o moon_lava_tube)"),
    relieve: float = Query(1.0, ge=0.0, le=5.0, description="Peso dinámico para relieve topográfico"),
    iluminacion: float = Query(1.0, ge=0.0, le=5.0, description="Peso dinámico para iluminación / insolación"),
    frio: float = Query(1.0, ge=0.0, le=5.0, description="Peso dinámico para frío extremo"),
    hielo: float = Query(1.0, ge=0.0, le=5.0, description="Peso dinámico para agua / hielo / permafrost"),
    polvo: float = Query(1.0, ge=0.0, le=5.0, description="Peso dinámico para polvo / aerosoles (MODIS MAIAC P1)"),
    limit: int = Query(50, ge=1, le=200, description="Límite máximo de resultados"),
):
    """
    Recalcula el puntaje de similitud en tiempo real según los sliders del usuario y
    ordena los candidatos de mayor a menor coincidencia.
    """
    candidates = []
    client = get_mongo_client()
    allowed_targets = TARGET_ALIASES.get(target, [target]) if target else None

    if client:
        try:
            db = client[DB_NAME]
            query = {"target": {"$in": allowed_targets}} if allowed_targets else {}
            candidates = list(db["candidates"].find(query))
        except PyMongoError:
            candidates = []

    if not candidates:
        # Fallback local
        raw_candidates = read_local_json("candidates.json")
        if allowed_targets:
            candidates = [c for c in raw_candidates if c.get("target") in allowed_targets]
        else:
            candidates = raw_candidates

    # Recálculo dinámico ponderado de similitud (5 dimensiones)
    # Fail-safe: docs NASA sin scores → inyectar ceros para no romper response_model / frontend
    for c in candidates:
        c["scores"] = c.get("scores") or dict(DEFAULT_SCORES)
        c["weighted_score"] = compute_weighted_score(
            c["scores"], relieve, iluminacion, frio, hielo, polvo
        )

    # Ordenar descendentemente por el puntaje resultante
    candidates.sort(key=lambda x: x.get("weighted_score", 0.0), reverse=True)

    # clean_doc: ObjectId de Mongo → str (evita 500 de validación Pydantic)
    return [clean_doc(c) for c in candidates[:limit]]


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
    allowed_targets = TARGET_ALIASES.get(target, [target]) if target else None
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
            if allowed_targets:
                query["target"] = {"$in": allowed_targets}

            mongo_results = list(db["candidates"].find(query).limit(limit))
            for doc in mongo_results:
                coords = doc.get("location", {}).get("coordinates", [0, 0])
                doc["distance_km"] = round(haversine_km(lat, lon, coords[1], coords[0]), 2)
                doc["scores"] = doc.get("scores") or dict(DEFAULT_SCORES)
                # 5D (incl. polvo) + clean_doc para serializar ObjectId
                doc["weighted_score"] = compute_weighted_score(doc["scores"], 1.0, 1.0, 1.0, 1.0, 1.0)
                results.append(clean_doc(doc))
            return results
        except PyMongoError:
            results = []

    # Fallback con cálculo de distancia Haversine
    local_candidates = read_local_json("candidates.json")
    filtered = []
    for c in local_candidates:
        if allowed_targets and c.get("target") not in allowed_targets:
            continue
        coords = c.get("location", {}).get("coordinates", [0, 0])
        dist = haversine_km(lat, lon, coords[1], coords[0])
        if dist <= search_dist_km:
            c_copy = dict(c)
            c_copy["distance_km"] = round(dist, 2)
            c_copy["scores"] = c_copy.get("scores") or dict(DEFAULT_SCORES)
            c_copy["weighted_score"] = compute_weighted_score(c_copy["scores"], 1.0, 1.0, 1.0, 1.0, 1.0)
            filtered.append(clean_doc(c_copy))

    filtered.sort(key=lambda x: x.get("distance_km", 999999))
    return filtered[:limit]


# ---------------------------------------------------------------------------
# Endpoints de Productos Geoespaciales P1 (Heatmaps GEE, Previews S1/S2 y QC)
# ---------------------------------------------------------------------------

if DATA_DIR.exists():
    app.mount("/data", StaticFiles(directory=str(DATA_DIR)), name="data")


def _sanitize_json(obj: Any) -> Any:
    """Reemplaza NaN/Infinity por None para serialización JSON estricta."""
    if isinstance(obj, float):
        return obj if math.isfinite(obj) else None
    if isinstance(obj, dict):
        return {k: _sanitize_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize_json(v) for v in obj]
    return obj


@app.get("/api/p1/heatmaps", tags=["Pipeline Terrestre P1 (GEE)"])
def get_p1_heatmaps():
    """Devuelve heatmap_bounds.json (data/ o Plan B en frontend/public/data/)."""
    for candidate_path in (
        DATA_DIR / "heatmap_bounds.json",
        DATA_DIR.parent / "frontend" / "public" / "data" / "heatmap_bounds.json",
    ):
        if candidate_path.exists():
            return json.loads(candidate_path.read_text(encoding="utf-8"))
    raise HTTPException(status_code=404, detail="heatmap_bounds.json no encontrado")


@app.get("/api/p1/orbital-previews", tags=["Pipeline Terrestre P1 (GEE)"])
def get_p1_orbital_previews():
    """Devuelve orbital_previews.json (Sentinel-2 RGB + Sentinel-1 SAR con filtro Lee)."""
    for candidate_path in (
        DATA_DIR / "orbital_previews" / "orbital_previews.json",
        DATA_DIR.parent / "frontend" / "public" / "data" / "orbital_previews" / "orbital_previews.json",
    ):
        if candidate_path.exists():
            return json.loads(candidate_path.read_text(encoding="utf-8"))
    raise HTTPException(status_code=404, detail="orbital_previews.json no encontrado")


@app.get("/api/p1/qc-report", tags=["Pipeline Terrestre P1 (GEE)"])
def get_p1_qc_report():
    """Devuelve qc_report.json + metadata.json (con fallback a frontend/public/data/)."""
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

def _mock_federated_search(
    bbox: str,
    start_date: str,
    end_date: str,
    body: str,
    variable: str,
    limit: int,
) -> Dict[str, Any]:
    """Mock de emergencia si connectors no carga (p. ej. falta httpx). No depende de GEE."""
    coords = [float(x) for x in bbox.split(",")]
    sample = {
        "id": f"MOCK-{body.upper()}-001",
        "title": f"Mock federated granule ({body})",
        "date": start_date,
        "source": "MOCK (connectors no disponible)",
        "bbox": coords,
        "recommended_mode": "ndvi" if body == "earth" else "diviner_thermal",
        "note": REMOTE_SENSING_IMPORT_ERROR or "Import de connectors falló",
    }
    partner = [
        {
            "id": "MOCK-PARTNER",
            "agency": "MOCK",
            "mission": "Emergency fallback",
            "body": body,
            "variable": variable,
            "instruments": "n/a",
            "description": "Recurso de demostración mientras se instalan deps de backend/",
            "recommended_mode": "sar_db",
            "bbox": coords,
        }
    ][:limit]
    return {
        "live_earthdata": [sample] if body == "earth" else [],
        "live_copernicus": [],
        "live_pds_planetary": [sample] if body != "earth" else [],
        "partner_resources": partner,
        "fallback": True,
    }


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
    if CONNECTORS_AVAILABLE and run_federated_search is not None:
        try:
            return await run_federated_search(bbox, start_date, end_date, body, variable, limit)
        except Exception as exc:
            print(f"Error: {exc}")
            print(f"[teledetección] run_federated_search falló en runtime → mock de emergencia")
            return _mock_federated_search(bbox, start_date, end_date, body, variable, limit)

    print(
        f"[teledetección] /api/search usando mock "
        f"(connectors no disponible: {REMOTE_SENSING_IMPORT_ERROR})"
    )
    return _mock_federated_search(bbox, start_date, end_date, body, variable, limit)


class ProcessRequest(BaseModel):
    """Cuerpo JSON de POST /api/process."""

    kind: str = Field(..., description="ndvi | ndwi | hls_thermal | sar_db | jaxa_precip | diviner_thermal")
    bbox: List[float] = Field(..., description="[min_lon, min_lat, max_lon, max_lat]")
    scene_id: Optional[str] = Field(None, description="Id de escena (S2 SAFE / Element84 / HLS)")
    source: str = Field("sentinel2", description="sentinel2 | hls (solo modo real óptico)")
    demo: bool = Field(False, description="True = forzar GeoTIFF de demostración local")
    sample_name: Optional[str] = Field(None, description="Solo demo: nombre de archivo en sample_data/")


REAL_OPTICAL_KINDS = frozenset({"ndvi", "ndwi"})
# Térmico real (HLS L30 B10). Solo real: nunca cae a simulación.
REAL_ONLY_KINDS = frozenset({"hls_thermal"})
# diviner_thermal = perfil térmico SIMULADO (solo modo Demostración)
DEMO_ONLY_KINDS = frozenset({"sar_db", "jaxa_precip", "diviner_thermal"})


def _error_detail(exc: BaseException) -> Dict[str, Any]:
    code = getattr(exc, "code", None) or "error"
    return {"code": code, "message": str(exc)}


def _real_error_to_http(exc: BaseException) -> HTTPException:
    """Traduce errores de real_optical a HTTP. Nunca incluye el token."""
    def _is(cls: Any) -> bool:
        return cls is not None and isinstance(exc, cls)

    if _is(SceneNotFoundError) or _is(BandUnavailableError):
        return HTTPException(status_code=404, detail=_error_detail(exc))
    if _is(EarthdataAuthError):
        print("[teledetección] Earthdata auth required (token missing/invalid)")
        return HTTPException(status_code=401, detail=_error_detail(exc))
    if _is(ProcessValidationError):
        return HTTPException(status_code=422, detail=_error_detail(exc))
    if _is(ProcessUpstreamError):
        return HTTPException(status_code=504, detail=_error_detail(exc))
    print(f"[teledetección] process real falló: {type(exc).__name__}")
    return HTTPException(
        status_code=500,
        detail={
            "code": "process_failed",
            "message": "Error al procesar la escena. Revisa los logs del servidor.",
        },
    )


@app.post("/api/process", tags=["Teledetección Multi-Agencia"])
def process_scene(
    body: Optional[ProcessRequest] = Body(None),
    mode: Optional[str] = Query(None, description="(legacy) alias de kind"),
    bbox: Optional[str] = Query(None, description="(legacy) bbox como string"),
    sample_name: Optional[str] = Query(None),
    demo: bool = Query(False, description="(legacy) forzar demo"),
    scene_id: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
):
    """
    Procesa índices ópticos reales (NDVI/NDWI desde COG Sentinel-2 o HLS)
    o modos de demostración con GeoTIFF locales.
    """
    if not PROCESSOR_AVAILABLE or execute_pipeline is None:
        raise HTTPException(
            status_code=503,
            detail="processor no disponible. Instalá: pip install rasterio scipy numpy Pillow",
        )

    if body is not None:
        kind = body.kind
        coords = [float(x) for x in body.bbox]
        use_demo = bool(body.demo)
        sid = body.scene_id
        sample = body.sample_name
        src = body.source or "sentinel2"
    else:
        if not mode or not bbox:
            raise HTTPException(
                status_code=422,
                detail="Envía JSON {kind, bbox, scene_id?, source?} o query mode+bbox",
            )
        kind = mode
        try:
            coords = [float(x) for x in bbox.split(",")]
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=f"bbox inválido: {exc}") from exc
        use_demo = bool(demo)
        sid = scene_id
        sample = sample_name
        src = source or "sentinel2"

    kind = kind.strip().lower()
    if kind not in REAL_OPTICAL_KINDS | REAL_ONLY_KINDS | DEMO_ONLY_KINDS:
        raise HTTPException(status_code=422, detail=f"kind no soportado: {kind}")

    if kind in DEMO_ONLY_KINDS:
        use_demo = True

    if kind in REAL_ONLY_KINDS:
        if use_demo:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "thermal_real_only",
                    "message": "hls_thermal solo usa datos reales HLS L30. El perfil térmico "
                    "simulado es kind=diviner_thermal (modo Demostración).",
                },
            )
        if process_real_thermal is None:
            raise HTTPException(status_code=503, detail="Módulo real_optical no disponible")
        if str(src).strip().lower() != "hls":
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "thermal_requires_l30",
                    "message": "El térmico real requiere source=hls y una escena HLS L30.",
                },
            )
        try:
            return process_real_thermal(bbox=coords, scene_id=str(sid or ""))
        except Exception as exc:
            raise _real_error_to_http(exc) from exc

    if kind in REAL_OPTICAL_KINDS and not use_demo:
        if not sid or not str(sid).strip():
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "scene_required",
                    "message": "Elige una escena de la lista (scene_id) para NDVI/NDWI reales. "
                    "No se usan datos de demostración por defecto.",
                },
            )
        if process_real_optical is None:
            raise HTTPException(status_code=503, detail="Módulo real_optical no disponible")
        try:
            return process_real_optical(
                kind=kind,
                bbox=coords,
                scene_id=str(sid).strip(),
                source=str(src).strip().lower(),
            )
        except Exception as exc:
            raise _real_error_to_http(exc) from exc

    try:
        file_path = os.path.join(str(BACKEND_DIR), "sample_data", sample) if sample else None
        return execute_pipeline(mode=kind, bbox=coords, sample_path=file_path)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/export/geotiff", tags=["Teledetección Multi-Agencia"])
def download_processed_geotiff(
    mode: str = Query("sar_db", description="Modo: sar_db, ndvi, ndwi, diviner_thermal, jaxa_precip"),
    bbox: str = Query("-92.5,11.5,-83.0,17.5"),
):
    """Exporta el ráster procesado a un archivo GeoTIFF binario para descarga."""
    if not PROCESSOR_AVAILABLE or export_geotiff_bytes is None:
        raise HTTPException(
            status_code=503,
            detail="processor no disponible. Instalá: pip install rasterio scipy numpy Pillow",
        )
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
    uvicorn.run("main:app", host=host, port=port, reload=True)
