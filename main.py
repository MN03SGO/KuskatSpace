"""
API FastAPI para NASA_SPACE — MongoDB Atlas (nasa_space).
Colecciones: candidates (GeoJSON 2dsphere) y targets.
"""

import os
from typing import Any
from fastapi.middleware.cors import CORSMiddleware
from bson import ObjectId
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse
from pymongo import GEOSPHERE, MongoClient
from pymongo.collection import Collection
from pymongo.database import Database
from pymongo.errors import PyMongoError

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = "nasa_space"
EARTH_RADIUS_KM = 6378.1

if not MONGO_URI:
    raise RuntimeError("Falta la variable de entorno MONGO_URI en el archivo .env")

app = FastAPI(
    title="NASA_SPACE API",
    description="Endpoints de candidatos espaciales y targets (MongoDB Atlas)",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Permite conexiones de cualquier lado (ideal para hackathon)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client: MongoClient | None = None
db: Database | None = None


def serialize_doc(doc: dict[str, Any] | None) -> dict[str, Any] | None:
    """Convierte ObjectId y tipos BSON a JSON serializable."""
    if doc is None:
        return None
    out: dict[str, Any] = {}
    for key, value in doc.items():
        if isinstance(value, ObjectId):
            out[key] = str(value)
        elif isinstance(value, dict):
            out[key] = serialize_doc(value)
        elif isinstance(value, list):
            out[key] = [
                serialize_doc(item) if isinstance(item, dict) else (
                    str(item) if isinstance(item, ObjectId) else item
                )
                for item in value
            ]
        else:
            out[key] = value
    return out


def get_db() -> Database:
    if db is None:
        raise HTTPException(status_code=503, detail="Base de datos no disponible")
    return db


def ensure_geo_index(candidates: Collection) -> None:
    """Crea índice 2dsphere en location si aún no existe."""
    existing = candidates.index_information()
    for info in existing.values():
        key = info.get("key") or []
        if ("location", "2dsphere") in key or ("location", GEOSPHERE) in key:
            return
        # pymongo reporta 2dsphere como ("location", "2dsphere")
        if any(field == "location" and kind == "2dsphere" for field, kind in key):
            return
    candidates.create_index([("location", GEOSPHERE)], name="location_2dsphere")


@app.on_event("startup")
def startup() -> None:
    global client, db
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        client.admin.command("ping")
        db = client[DB_NAME]
        ensure_geo_index(db["candidates"])
        print(f"Conectado a MongoDB Atlas — DB '{DB_NAME}' lista (índice 2dsphere OK)")
    except PyMongoError as exc:
        print(f"Error al conectar a MongoDB: {exc}")
        raise


@app.on_event("shutdown")
def shutdown() -> None:
    global client, db
    if client is not None:
        client.close()
    client = None
    db = None


@app.get("/")
def root() -> dict[str, str]:
    return {"status": "ok", "service": "NASA_SPACE API"}


@app.get("/candidates")
def list_candidates() -> list[dict[str, Any]]:
    """Devuelve todos los documentos de la colección candidates."""
    try:
        cursor = get_db()["candidates"].find({})
        return [serialize_doc(doc) for doc in cursor]  # type: ignore[misc]
    except PyMongoError as exc:
        raise HTTPException(status_code=500, detail=f"Error de MongoDB: {exc}") from exc


@app.get("/candidates/near")
def candidates_near(
    lat: float = Query(..., ge=-90, le=90, description="Latitud del punto de búsqueda"),
    lon: float = Query(..., ge=-180, le=180, description="Longitud del punto de búsqueda"),
    radius_km: float = Query(100.0, gt=0, description="Radio de búsqueda en kilómetros"),
) -> list[dict[str, Any]]:
    """
    Busca candidatos cercanos usando índice 2dsphere sobre `location` (GeoJSON).
    Usa $near con $maxDistance en metros.
    """
    try:
        candidates = get_db()["candidates"]
        ensure_geo_index(candidates)

        query = {
            "location": {
                "$near": {
                    "$geometry": {
                        "type": "Point",
                        "coordinates": [lon, lat],  # GeoJSON: [lon, lat]
                    },
                    "$maxDistance": radius_km * 1000.0,  # metros
                }
            }
        }
        cursor = candidates.find(query)
        return [serialize_doc(doc) for doc in cursor]  # type: ignore[misc]
    except PyMongoError as exc:
        raise HTTPException(status_code=500, detail=f"Error de MongoDB: {exc}") from exc


@app.get("/targets")
def list_targets() -> list[dict[str, Any]]:
    """Devuelve todos los documentos de la colección targets."""
    try:
        cursor = get_db()["targets"].find({})
        return [serialize_doc(doc) for doc in cursor]  # type: ignore[misc]
    except PyMongoError as exc:
        raise HTTPException(status_code=500, detail=f"Error de MongoDB: {exc}") from exc


@app.get("/export")
def export_all() -> JSONResponse:
    """Respaldo JSON de candidates + targets."""
    try:
        database = get_db()
        payload = {
            "database": DB_NAME,
            "candidates": [serialize_doc(doc) for doc in database["candidates"].find({})],
            "targets": [serialize_doc(doc) for doc in database["targets"].find({})],
        }
        return JSONResponse(content=payload)
    except PyMongoError as exc:
        raise HTTPException(status_code=500, detail=f"Error de MongoDB: {exc}") from exc
