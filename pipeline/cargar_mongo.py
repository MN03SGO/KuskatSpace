"""
Carga e Indexación Geoespacial en MongoDB Atlas / Local
======================================================
Proyecto: TerraAnáloga - NASA Space Apps Challenge 2026
Reto: Identify Earth Locations that Analog Permanent Moon Base & Mars

Este script:
1. Lee MONGO_URI desde el archivo .env.
2. Carga data/targets.json, data/candidates.json y data/datasets.json.
3. Realiza upsert en la base de datos 'nasa_space' para colecciones 'targets',
   'candidates' y 'datasets'.
4. Crea el índice 2dsphere en candidates.location y un índice en candidates.target.
"""

import os
import json
import sys
from pathlib import Path
from typing import List, Dict, Any
from dotenv import load_dotenv
import pymongo
from pymongo import MongoClient
from pymongo.errors import PyMongoError, ServerSelectionTimeoutError

# Cargar variables de entorno
load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "")
DB_NAME = "nasa_space"
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"


def load_json_file(filename: str) -> List[Dict[str, Any]]:
    """Carga un archivo JSON desde el directorio data/."""
    file_path = DATA_DIR / filename
    if not file_path.exists():
        raise FileNotFoundError(f"No se encontró el archivo: {file_path}")
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


def sync_collection(
    db: pymongo.database.Database,
    collection_name: str,
    documents: List[Dict[str, Any]],
    prune: bool = False,
) -> int:
    """Inserta o actualiza (upsert) documentos según su _id y opcionalmente poda obsoletos."""
    coll = db[collection_name]
    upserted_count = 0
    active_ids = []
    for doc in documents:
        doc_id = doc.get("_id") or doc.get("id")
        if not doc_id:
            continue
        if "_id" not in doc and "id" in doc:
            doc["_id"] = doc["id"]

        coll.replace_one({"_id": doc_id}, doc, upsert=True)
        active_ids.append(doc_id)
        upserted_count += 1
    if prune and active_ids:
        coll.delete_many({"_id": {"$nin": active_ids}})
    return upserted_count


def setup_indexes(db: pymongo.database.Database) -> None:
    """Crea los índices geoespaciales y relacionales obligatorios."""
    candidates_coll = db["candidates"]

    # 1. Índice geoespacial 2dsphere para consultas de proximidad ($near, $geoWithin)
    print("[*] Creando índice geoespacial 2dsphere en candidates.location...")
    candidates_coll.create_index([("location", pymongo.GEOSPHERE)], name="idx_candidates_location_2dsphere")

    # 2. Índice en target para filtrado rápido por cuerpo celeste
    print("[*] Creando índice en candidates.target...")
    candidates_coll.create_index([("target", pymongo.ASCENDING)], name="idx_candidates_target")

    # 3. Índice en targets._id
    db["targets"].create_index([("_id", pymongo.ASCENDING)], name="idx_targets_id")
    # 4. Índice en datasets._id
    db["datasets"].create_index([("_id", pymongo.ASCENDING)], name="idx_datasets_id")


def main():
    print("=" * 65)
    print(" TerraAnáloga - Sincronización y Carga a MongoDB")
    print("=" * 65)

    if not MONGO_URI or "cluster.mongodb.net" in MONGO_URI and "<usuario>" in MONGO_URI:
        print("[!] ERROR: MONGO_URI no está configurada o contiene credenciales de ejemplo en .env.")
        print("[!] Por favor actualiza MONGO_URI en tu .env o usa mongodb://localhost:27017/nasa_space")
        sys.exit(1)

    print(f"[*] Conectando a MongoDB...")
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        # Test de conexión
        client.admin.command("ping")
        print("[+] Conexión exitosa a MongoDB.")
    except ServerSelectionTimeoutError as e:
        print(f"[!] ERROR de tiempo de espera al conectar a MongoDB: {e}")
        sys.exit(1)
    except PyMongoError as e:
        print(f"[!] ERROR de autenticación o red en MongoDB: {e}")
        sys.exit(1)

    db = client[DB_NAME]

    # Cargar y sincronizar
    try:
        targets_data = load_json_file("targets.json")
        candidates_data = load_json_file("candidates.json")
        datasets_data = load_json_file("datasets.json")

        n_targets = sync_collection(db, "targets", targets_data, prune=True)
        print(f"[+] Colección 'targets': {n_targets} documentos sincronizados.")

        n_candidates = sync_collection(db, "candidates", candidates_data, prune=True)
        print(f"[+] Colección 'candidates': {n_candidates} documentos sincronizados.")

        n_datasets = sync_collection(db, "datasets", datasets_data)
        print(f"[+] Colección 'datasets': {n_datasets} documentos sincronizados.")

        # Índices
        setup_indexes(db)
        print("[+] Todos los índices fueron verificados y creados exitosamente.")
        print("=" * 65)
        print("[✓] Pipeline de base de datos completado.")
    except Exception as e:
        print(f"[!] ERROR durante la carga de datos: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
