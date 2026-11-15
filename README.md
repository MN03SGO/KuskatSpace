# TerraAnáloga Blueprint

## System Overview
**TerraAnáloga** es una plataforma integral desarrollada para el NASA Space Apps Challenge 2026 (Reto: *Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars*). El sistema compara ubicaciones terrestres con objetivos planetarios prioritarios (Polo Sur Lunar, Tubo de Lava de Mare Tranquillitatis y Marte) integrando cuatro dimensiones físicas críticas: **relieve, iluminación, frío extremo y presencia de hielo/agua**, acompañadas de factores ambientales (radiación GCR/SPE, presión atmosférica y procesos eólicos).

La arquitectura combina pipelines de extracción geoespacial y climatológica offline, una base de datos distribuida MongoDB Atlas con indexación espacial esférica `2dsphere` (con soporte complementario para PostGIS y MinIO), un motor REST unificado en FastAPI con tolerancia a fallos mediante conmutación automática a catálogos locales JSON, capacidades de procesamiento de imágenes de teledetección (radar SAR, índices espectrales ópticos y radiometría térmica) y un visualizador WebGIS bilingüe en React 19 + TypeScript con globo 3D (Three.js), mapas 2D (Leaflet) y capas satelitales NASA GIBS / Trek.

## Subdirectories & System Boundaries
- [api](./api/README.md) - Servicio API REST en FastAPI que expone endpoints de consulta ponderada de análogos, cálculo geoespacial `$near`, catálogo de fuentes y operaciones de procesamiento ráster y búsqueda federada.
- [backend](./backend/README.md) - Conectores federados a NASA CMR y Planetary Computer STAC, pipelines de filtrado SAR Lee, generación de productos espectrales (NDVI/NDWI) y exportación GeoTIFF binaria.
- [data](./data/README.md) - Esquemas de datos JSON y contratos estandarizados (`targets.json`, `candidates.json`, `datasets.json`) que actúan como almacén canónico y respaldo para contingencias (Plan B).
- [docs](./docs/informe-integracion-backend-2026-11-14.md) - Documentación de integración técnica y entregables de UI/UX, guion de video, registro de IA y tokens de diseño del equipo P6.
- [frontend](./frontend/README.md) - Aplicación de interfaz WebGIS en React, TypeScript y Three.js para exploración cartográfica en la Tierra, la Luna y Marte con integración de capas satelitales NASA Worldview.
- [pipeline](./pipeline/README.md) - Scripts offline para extracción de DEM Copernicus (90m) y MODIS LST desde Planetary Computer STAC, series climáticas históricas desde Meteomatics API e ingesta a MongoDB con índices `2dsphere`.

## Global Invariants
- **Referencia Geoespacial Unificada**: Todos los sistemas terrestres operan bajo el elipsoide WGS84 (`EPSG:4326`) con orden de coordenadas GeoJSON canónico `[longitud, latitud]`.
- **Tolerancia a Fallos de Hackathon (Plan B)**: Toda la plataforma es funcional de forma autónoma sin conexión a internet ni a MongoDB Atlas mediante el respaldo en `data/candidates.json`. Si el cliente MongoDB excede un umbral de 2000 ms, la API conmuta automáticamente a modo `local_fallback` sin propagar errores HTTP 500 al cliente.
- **Normalización de Ponderación**: En el cálculo de similitud de análogos, la suma de pesos de los sliders de los usuarios se normaliza sobre $[0.0, 1.0]$; ante una entrada con todos los pesos en cero, el denominador se estabiliza a 1.0.

## Global Side Effects
- Mutación de documentos e índices espaciales en la base de datos `analogos` en MongoDB Atlas o contenedor Docker local.
- Conexiones de red salientes hacia servicios de agencias espaciales: NASA CMR, Microsoft Planetary Computer STAC y Meteomatics Weather API.
- Despliegue de puertos locales de red `8000:8000` (FastAPI), `27017:27017` (MongoDB), `5432:5432` (PostGIS) y `9000/9001` (MinIO) orquestados mediante Docker Compose.

## System Verification
- Run: `docker compose up --build -d && docker exec terraanaloga_api python -c "import urllib.request; print(urllib.request.urlopen('http://localhost:8000/health').read().decode())"`

---

## Anexo: Distribución del Equipo
* **P1 JORGE — Ingeniero de Datos Terrestres:** Google Earth Engine, Copernicus DEM, MODIS (LST, Nieve, AOD, NDVI), JAXA G-Portal y procesamiento SAR (RADARSAT-1/RCM).
* **P2 ANSORJE — Científico de Datos Planetarios:** NASA PDS, LRO (LOLA, Diviner, LEND, Mini-RF, LROC), MOLA/THEMIS (Marte) y catálogo de datasets.
* **P3 ABEL — Algoritmo, Ciencia y Fichas:** Fórmula IFA, filtro de sitios obvios vs. descubrimientos, redacción científica de procesos físicos, biofirmas y límites terrestres.
* **P4 ANTHONY — Backend y Base de Datos:** MongoDB Atlas (`2dsphere`), FastAPI en Render, endpoints `/candidates`, `/candidates/near`, `/targets` y exportación de respaldo JSON.
* **P5 AMIGUITO — Frontend WebGIS:** React + MapLibre GL JS / Three.js (proyección polar/globo 3D), capas NASA Worldview (GIBS), *sliders* interactivos, gráficos radar y comparador visual.
* **P6 PAOLA — UI/UX, Coordinación y Pitch:** Wireframes, textos bilingües (ES/EN), control de tiempos (*check-ins*), guion de video (≤ 30 s), deck de 7 diapositivas y registro de uso de IA.
