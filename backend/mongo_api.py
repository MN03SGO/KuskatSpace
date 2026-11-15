"""
Endpoints de datos del módulo A — MongoDB Atlas.

Se montan en `backend/main.py` para que todo el backend viva en una sola
aplicación (decisión D7 del plan P5), en vez de dos apps en el mismo puerto.

Colecciones: `candidates` (GeoJSON `Point` con índice `2dsphere`) y `targets`.
"""

from __future__ import annotations

import os
from typing import Any

from bson import ObjectId
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from pymongo import GEOSPHERE, MongoClient
from pymongo.collection import Collection
from pymongo.database import Database
from pymongo.errors import PyMongoError

DB_NAME = "nasa_space"

# Carga .env (raíz del repo o backend/) antes de leer MONGO_URI.
load_dotenv()

router = APIRouter(tags=["datos"])

_client: MongoClient | None = None
_db: Database | None = None


def serialize_doc(doc: dict[str, Any] | None) -> dict[str, Any] | None:
    """Convierte ObjectId y tipos BSON a algo JSON serializable."""
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
                serialize_doc(item)
                if isinstance(item, dict)
                else (str(item) if isinstance(item, ObjectId) else item)
                for item in value
            ]
        else:
            out[key] = value
    return out


def ensure_geo_index(candidates: Collection) -> None:
    """Crea el índice 2dsphere sobre `location` si todavía no existe."""
    for info in candidates.index_information().values():
        key = info.get("key") or []
        if any(field == "location" and kind in ("2dsphere", GEOSPHERE) for field, kind in key):
            return
    candidates.create_index([("location", GEOSPHERE)], name="location_2dsphere")


def get_db() -> Database:
    """
    Conexión perezosa.

    Solo los endpoints de datos fallan si Mongo no está disponible; la parte de
    búsqueda federada (`/api/*`) sigue funcionando sin base de datos.
    """
    global _client, _db
    if _db is not None:
        return _db

    uri = os.getenv("MONGO_URI")
    if not uri:
        raise HTTPException(status_code=503, detail="Falta MONGO_URI en el archivo .env")

    try:
        client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        client.admin.command("ping")
        database = client[DB_NAME]
        ensure_geo_index(database["candidates"])
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail=f"Base de datos no disponible: {exc}") from exc

    _client = client
    _db = database
    return _db


def close_db() -> None:
    global _client, _db
    if _client is not None:
        _client.close()
    _client = None
    _db = None


@router.get("/")
def root() -> dict[str, str]:
    return {"status": "ok", "service": "NASA_SPACE API"}


@router.get("/candidates")
def list_candidates() -> list[dict[str, Any]]:
    """Todos los documentos de la colección `candidates`."""
    try:
        return [serialize_doc(doc) for doc in get_db()["candidates"].find({})]  # type: ignore[misc]
    except PyMongoError as exc:
        raise HTTPException(status_code=500, detail=f"Error de MongoDB: {exc}") from exc


@router.get("/candidates/near")
def candidates_near(
    lat: float = Query(..., ge=-90, le=90, description="Latitud del punto de búsqueda"),
    lon: float = Query(..., ge=-180, le=180, description="Longitud del punto de búsqueda"),
    radius_km: float = Query(100.0, gt=0, description="Radio de búsqueda en kilómetros"),
) -> list[dict[str, Any]]:
    """Candidatos cercanos usando `$near` sobre el índice 2dsphere (metros)."""
    try:
        candidates = get_db()["candidates"]
        ensure_geo_index(candidates)
        query = {
            "location": {
                "$near": {
                    "$geometry": {"type": "Point", "coordinates": [lon, lat]},  # GeoJSON: [lon, lat]
                    "$maxDistance": radius_km * 1000.0,
                }
            }
        }
        return [serialize_doc(doc) for doc in candidates.find(query)]  # type: ignore[misc]
    except PyMongoError as exc:
        raise HTTPException(status_code=500, detail=f"Error de MongoDB: {exc}") from exc


@router.get("/targets")
def list_targets() -> list[dict[str, Any]]:
    """Todos los documentos de la colección `targets`."""
    try:
        return [serialize_doc(doc) for doc in get_db()["targets"].find({})]  # type: ignore[misc]
    except PyMongoError as exc:
        raise HTTPException(status_code=500, detail=f"Error de MongoDB: {exc}") from exc


@router.get("/datasets")
def list_datasets() -> list[dict[str, Any]]:
    """Catálogo de datasets citados en las fichas (colección `datasets`)."""
    try:
        return [serialize_doc(doc) for doc in get_db()["datasets"].find({})]  # type: ignore[misc]
    except PyMongoError as exc:
        raise HTTPException(status_code=500, detail=f"Error de MongoDB: {exc}") from exc


@router.get("/export")
def export_all() -> JSONResponse:
    """Respaldo JSON de `candidates` + `targets` (sirve para el Plan B estático)."""
    try:
        database = get_db()
        payload = {
            "database": DB_NAME,
            "candidates": [serialize_doc(doc) for doc in database["candidates"].find({})],
            "targets": [serialize_doc(doc) for doc in database["targets"].find({})],
            "datasets": [serialize_doc(doc) for doc in database["datasets"].find({})],
        }
        return JSONResponse(content=payload)
    except PyMongoError as exc:
        raise HTTPException(status_code=500, detail=f"Error de MongoDB: {exc}") from exc
