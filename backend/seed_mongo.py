import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()
client = MongoClient(os.getenv("MONGO_URI"))
db = client["nasa_space"]

# 1. Colección TARGETS
db.targets.delete_many({})
db.targets.insert_many([
    {"name": "Marte", "description": "Planeta Rojo", "type": "planet"},
    {"name": "Luna", "description": "Satélite natural", "type": "moon"}
])
print("✅ Targets insertados")

# 2. Colección CANDIDATES (Coordenadas en [lon, lat])
db.candidates.delete_many({})
db.candidates.insert_many([
    {
        "name": "Cráter Jezero", 
        "target": "Marte", 
        "location": {"type": "Point", "coordinates": [77.45, 18.38]},
        "features": {"mineral": "Arcillas", "biofirma": "Alta"}
    },
    {
        "name": "Valle Marineris", 
        "target": "Marte", 
        "location": {"type": "Point", "coordinates": [-59.4, -14.0]},
        "features": {"mineral": "Sulfatos", "biofirma": "Media"}
    },
    {
        "name": "Crater Shackleton", 
        "target": "Luna", 
        "location": {"type": "Point", "coordinates": [129.2, -89.9]},
        "features": {"mineral": "Hielo", "biofirma": "Alta"}
    }
])
print("✅ Candidates insertados")

# Crear índice geoespacial (por si acaso)
db.candidates.create_index([("location", "2dsphere")])
print("🚀 ¡Base de datos poblada y lista para el Frontend!")