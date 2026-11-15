import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")

print("Conectando a MongoDB Atlas...")
try:
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    client.admin.command("ping")
    print("CONEXION EXITOSA! La base de datos esta lista.")

    # Coleccion de prueba aparte: nunca ensuciar `candidates` (B36 del plan P5).
    probe = client["nasa_space"]["_connection_test"]
    probe.insert_one({"test": "ok"})
    print("Documento de prueba insertado en `_connection_test`.")
    probe.delete_many({"test": "ok"})
    print("Documento de prueba eliminado.")

except Exception as exc:
    print(f"ERROR DE CONEXION: {exc}")
