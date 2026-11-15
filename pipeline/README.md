# Pipeline de Extracción e Ingesta de Datos

## Overview
El paquete `pipeline` contiene los módulos batch y offline encargados de la extracción de métricas geoespaciales desde Microsoft Planetary Computer STAC, perfiles meteorológicos y climáticos desde Meteomatics REST API, y la sincronización indexada hacia la base de datos MongoDB Atlas (colecciones `targets`, `candidates` y `datasets`).

## Interface
- [pipeline/fetch_planetary_computer.py:get_bounding_box](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/pipeline/fetch_planetary_computer.py#L25) - Genera un bounding box geográfico WGS84 alrededor de una coordenada y buffer en kilómetros.
- [pipeline/fetch_planetary_computer.py:compute_terrain_metrics](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/pipeline/fetch_planetary_computer.py#L42) - Calcula elevación media/min/max, pendiente media, percentil 90 y rugosidad local (TRI) sobre arreglos DEM.
- [pipeline/fetch_planetary_computer.py:fetch_planetary_metrics](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/pipeline/fetch_planetary_computer.py#L82) - Consulta STAC `cop-dem-glo-90` y `modis-11A2-061` con tokens SAS de Planetary Computer.
- [pipeline/fetch_meteomatics.py:fetch_meteomatics_weather](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/pipeline/fetch_meteomatics.py#L43) - Extrae series temporales y perfiles climáticos (temperatura mínima/media, precipitación, nieve, viento) con HTTP Basic Auth y reintentos ante límites de tasa (HTTP 429).
- [pipeline/fetch_meteomatics.py:parse_meteomatics_response](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/pipeline/fetch_meteomatics.py#L127) - Agrega y normaliza las series meteorológicas en métricas estadísticas anuales.
- [pipeline/fetch_meteomatics.py:get_cache_filename](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/pipeline/fetch_meteomatics.py#L35) - Genera la ruta al archivo JSON de caché local para desacoplar cuotas de red.
- [pipeline/cargar_mongo.py:load_json_file](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/pipeline/cargar_mongo.py#L34) - Carga y valida archivos JSON de catálogo desde el directorio `data/`.
- [pipeline/cargar_mongo.py:sync_collection](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/pipeline/cargar_mongo.py#L43) - Realiza upsert idempotente de documentos sobre colecciones de MongoDB (`_id`).
- [pipeline/cargar_mongo.py:setup_indexes](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/pipeline/cargar_mongo.py#L59) - Crea índices `2dsphere` en `candidates.location`, índice en `candidates.target` e índices de catálogo.

## Invariants
- Todos los cálculos espaciales operan bajo el sistema de referencia geodésico WGS84 (`EPSG:4326`).
- El radio de buffer espacial nunca debe generar divisiones por cero en latitudes polares extremas (`cos_lat = max(cos(lat), 0.01)`).
- Las consultas a colecciones de MongoDB Atlas o locales son idempotentes mediante reemplazo por clave primaria `_id`.

## Side Effects
- Escritura y lectura de archivos de caché en disco (`data/cache_meteomatics_*.json`).
- Solicitudes HTTP salientes autenticadas hacia `https://planetarycomputer.microsoft.com/api/stac/v1` y `https://api.meteomatics.com`.
- Conexión TCP y mutaciones de base de datos en MongoDB Atlas / contenedor local `analogos`.

## Verification
- Run: `python -m py_compile pipeline/fetch_planetary_computer.py pipeline/fetch_meteomatics.py pipeline/cargar_mongo.py`
