# Catálogo de Datos y Respaldos JSON

## Overview
El paquete `data` alberga los esquemas de datos oficiales y archivos JSON estructurados que actúan como contrato formal de la plataforma y mecanismo primario de contingencia (Plan B) ante interrupciones de conectividad con la base de datos o fallos de red durante demostraciones en vivo.

## Interface
- [data/targets.json](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/data/targets.json) - Especificaciones dimensionales físicas (media, percentil 10, percentil 90) para el Polo Sur Lunar (`moon_south_pole`), Tubo de Lava de Mare Tranquillitatis (`moon_lava_tube`) y Marte (`mars`).
- [data/candidates.json](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/data/candidates.json) - Registro canónico de los 6 sitios análogos clave (Valles Secos de McMurdo, Cráter Haughton, Cuenca de Qaidam, Cráter Pingualuit, El Boquerón, Salar de Arizaro) con geometría GeoJSON `Point`, puntajes en 4 dimensiones y descriptores científicos.
- [data/datasets.json](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/data/datasets.json) - Catálogo auditado de fuentes de datos satelitales oficiales (NASA PDS/LRO, Earthdata GIBS, CSA RCM y RADARSAT-1, ESA Copernicus DEM y Sentinel-2, JAXA G-Portal, Planetary Computer y Meteomatics).

## Invariants
- Todos los documentos en `candidates.json` deben declarar obligatoriamente la propiedad `location` con esquema GeoJSON canónico `{"type": "Point", "coordinates": [longitud, latitud]}`.
- Los puntajes de las 4 dimensiones (`scores.relieve`, `scores.iluminacion`, `scores.frio`, `scores.hielo`) deben estar acotados estrictamente en el intervalo flotante cerrado $[0.0, 1.0]$.
- Cada candidato debe estar asociado a uno de los tres identificadores de objetivo válidos: `moon_south_pole`, `moon_lava_tube` o `mars`.

## Side Effects
- Los archivos en este directorio son leídos de manera síncrona por `api/main.py` ante desconexión de MongoDB, y por `pipeline/cargar_mongo.py` durante la sincronización a la base de datos.
- Archivos de caché climática generados en tiempo de ejecución (`data/cache_meteomatics_*.json`) son persistidos en este directorio y están excluidos del control de versiones vía `.gitignore`.

## Verification
- Run: `python -c "import json; [json.load(open(f'data/{f}', encoding='utf-8')) for f in ['targets.json', 'candidates.json', 'datasets.json']]; print('JSONs validos')"`
