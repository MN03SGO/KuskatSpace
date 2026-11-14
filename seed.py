#!/usr/bin/env python3
"""
Seed de ítems STAC desde Microsoft Planetary Computer hacia PostGIS.
Consulta Sentinel-2 L2A sobre Buenos Aires e inserta en stac_items.
"""

import json
import sys

import psycopg2
import requests

# --- Configuración de conexión ---
DB_CONFIG = {
    "host": "localhost",
    "port": "5432",
    "dbname": "Hacka_geo",
    "user": "Kuskat-space",
    "password": "kuskat-nasa",
}

STAC_SEARCH_URL = "https://planetarycomputer.microsoft.com/api/stac/v1/search"

# Bbox de Buenos Aires: [west, south, east, north]
SEARCH_PAYLOAD = {
    "collections": ["sentinel-2-l2a"],
    "bbox": [-58.5, -34.7, -58.3, -34.5],
    "limit": 15,
}

INSERT_SQL = """
    INSERT INTO stac_items (
        id,
        collection,
        datetime,
        platform,
        cloud_cover,
        bbox,
        footprint,
        assets,
        properties,
        raw
    ) VALUES (
        %s,
        %s,
        %s,
        %s,
        %s,
        %s,
        ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326),
        %s::jsonb,
        %s::jsonb,
        %s::jsonb
    )
    ON CONFLICT (id) DO NOTHING
"""


def fetch_stac_items():
    """POST a la API STAC de Planetary Computer y devuelve las features."""
    print("Consultando API STAC de Microsoft Planetary Computer...")
    response = requests.post(
        STAC_SEARCH_URL,
        json=SEARCH_PAYLOAD,
        headers={"Content-Type": "application/json"},
        timeout=60,
    )
    response.raise_for_status()
    data = response.json()
    features = data.get("features", [])
    print(f"{len(features)} imágenes encontradas")
    return features


def feature_to_row(feature):
    """Mapea un Feature STAC a una tupla lista para el INSERT."""
    props = feature.get("properties") or {}
    geometry = feature.get("geometry")
    if not geometry:
        return None

    return (
        feature.get("id"),
        feature.get("collection"),
        props.get("datetime"),
        props.get("platform"),
        props.get("eo:cloud_cover"),
        feature.get("bbox"),
        json.dumps(geometry),
        json.dumps(feature.get("assets") or {}),
        json.dumps(props),
        json.dumps(feature),
    )


def insert_items(conn, features):
    """Inserta features en stac_items. Devuelve cantidad de filas nuevas."""
    rows = [row for row in (feature_to_row(f) for f in features) if row]
    if not rows:
        print("No hay features con geometría válida para insertar.")
        return 0

    with conn.cursor() as cur:
        inserted = 0
        for row in rows:
            cur.execute(INSERT_SQL, row)
            inserted += cur.rowcount
        conn.commit()
    return inserted


def main():
    features = []
    try:
        features = fetch_stac_items()
    except requests.exceptions.RequestException as exc:
        print(f"Error de red al consultar la API STAC: {exc}", file=sys.stderr)
        sys.exit(1)

    if not features:
        print("La API no devolvió resultados. Nada que guardar.")
        sys.exit(0)

    conn = None
    try:
        print("Conectando a PostgreSQL/PostGIS...")
        conn = psycopg2.connect(**DB_CONFIG)
        inserted = insert_items(conn, features)
        print(
            f"Datos guardados con éxito "
            f"({inserted} nuevas, {len(features) - inserted} ya existían)."
        )
    except psycopg2.Error as exc:
        print(f"Error de base de datos: {exc}", file=sys.stderr)
        if conn is not None:
            conn.rollback()
        sys.exit(1)
    finally:
        if conn is not None:
            conn.close()
            print("Conexión cerrada.")


if __name__ == "__main__":
    main()
