import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")

print("Conectando a MongoDB Atlas...")
try:
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    client.admin.command('ping')
    print(" CONEXIÓN EXITOSA! La base de datos está lista.")
    
    # Creamos la base de datos y una colección de prueba
    db = client["nasa_space"]
    collection = db["candidates"]
    collection.insert_one({"test": "ok", "target": "Marte"})
    print("Dato de prueba insertado correctamente.")
    
except Exception as e:
    print(f"ERROR DE CONEXIÓN: {e}")