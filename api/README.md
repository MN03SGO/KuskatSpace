# API REST Geoespacial TerraAnáloga

## Overview
El paquete `api` implementa el servicio REST en FastAPI que orquesta la plataforma unificada. Provee endpoints de alta disponibilidad con estrategia dual: conexión directa a MongoDB Atlas con indexación espacial `2dsphere` o conmutación transparente a modo fallback local con persistencia en archivos JSON (`data/`). Integra además los servicios de procesamiento satelital y búsqueda federada.

## Interface
- [api/main.py:app](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/api/main.py#L39) - Instancia principal de la aplicación FastAPI con middleware de CORS permisivo (`*`).
- [api/main.py:health_check](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/api/main.py#L225) - `GET /health`: Reporta el estado operativo, modo de base de datos (`mongodb` o `local_fallback`) y total de análogos indexados.
- [api/main.py:get_targets](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/api/main.py#L254) - `GET /targets`: Retorna los perfiles físicos y rangos de referencia para Luna y Marte.
- [api/main.py:get_datasets](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/api/main.py#L268) - `GET /datasets`: Catálogo auditado de misiones espaciales y sensores (NASA, CSA, ESA, JAXA, Meteomatics).
- [api/main.py:get_candidates](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/api/main.py#L283) - `GET /candidates`: Filtra candidatos y recalcula en tiempo real el puntaje ponderado normalizado según los pesos dinámicos de los sliders del frontend (`relieve`, `iluminacion`, `frio`, `hielo`).
- [api/main.py:get_candidates_near](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/api/main.py#L324) - `GET /candidates/near`: Búsqueda geoespacial por radio esférico ($near en MongoDB con GeoJSON `Point` o cálculo Haversine geodésico en fallback).
- [api/main.py:export_all](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/api/main.py#L274) - `GET /export`: Respaldo completo de la base de datos (compatibilidad feature/database).
- [api/main.py:search_catalogs](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/api/main.py#L377) - `GET /api/search`: Conector federado de escenas satelitales multi-agencia.
- [api/main.py:process_scene](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/api/main.py#L390) - `POST /api/process`: Ejecuta filtros SAR Lee, índices espectrales (NDVI/NDWI) o radiometría térmica Diviner.
- [api/main.py:download_processed_geotiff](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/api/main.py#L407) - `GET /api/export/geotiff`: Descarga de ráster GeoTIFF procesado.
- [api/main.py:compute_weighted_score](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/api/main.py#L209) - Función de ponderación normalizada con salvaguarda ante pesos nulos.
- [api/main.py:haversine_km](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/api/main.py#L198) - Cálculo de distancia geodésica esférica en kilómetros entre coordenadas WGS84.

## Invariants
- El timeout de conexión a MongoDB para verificación de disponibilidad está estrictamente acotado a 2000 ms (`serverSelectionTimeoutMS=2000`) para garantizar latencia cero al conmutar a `local_fallback`.
- Las coordenadas GeoJSON siguen obligatoriamente la convención estándar `[longitud, latitud]`.
- La suma de ponderaciones de los sliders nunca divide por cero; si los 4 pesos son cero, la suma se normaliza a 1.0.

## Side Effects
- Consultas y lecturas a la base de datos `nasa_space` en MongoDB Atlas o contenedor local `mongo`.
- Lectura de archivos JSON de respaldo en `data/candidates.json`, `data/targets.json` y `data/datasets.json`.
- Despacho de tráfico HTTP saliente asíncrono hacia NASA CMR y Planetary Computer durante búsquedas federadas.

## Verification
- Run: `python -m py_compile api/main.py`
