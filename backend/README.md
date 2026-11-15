# Backend de Procesamiento Ráster y Conectores de Teledetección

## Overview
El paquete `backend` provee conectores federados y motores de procesamiento numérico de imágenes satelitales (SAR polarimétrico en banda C, reflectancia óptica multiespectral, precipitación microondas e infrarrojo térmico polar lunar) para servir capas derivadas a la interfaz gráfica.

## Interface
- [backend/connectors.py:run_federated_search](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/backend/connectors.py#L86) - Ejecuta búsquedas concurrentes y federadas en catálogos de NASA CMR, Microsoft Planetary Computer STAC y catálogos asociados para Tierra, Luna y Marte.
- [backend/connectors.py:query_nasa_cmr](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/backend/connectors.py#L122) - Consulta la API de Common Metadata Repository (CMR) de NASA Earthdata.
- [backend/connectors.py:query_planetary_computer](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/backend/connectors.py#L155) - Consulta colecciones multiespectrales en Planetary Computer STAC.
- [backend/processor.py:execute_pipeline](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/backend/processor.py#L104) - Ejecuta el pipeline de transformación matricial ráster según el modo seleccionado (`sar_db`, `ndvi`, `ndwi`, `diviner_thermal`, `jaxa_precip`), devolviendo estadísticas y PNG en base64.
- [backend/processor.py:export_geotiff_bytes](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/backend/processor.py#L129) - Genera un archivo GeoTIFF en memoria (`MemoryFile`) con perfil geoespacial WGS84 para descarga binaria.
- [backend/processor.py:lee_speckle_filter](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/backend/processor.py#L12) - Filtro Lee adaptativo para reducción de ruido de moteado (speckle) en imágenes de radar de apertura sintética (SAR).
- [backend/processor.py:render_colormap_png](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/backend/processor.py#L21) - Normaliza arreglos 2D flotantes y genera imágenes PNG codificadas en base64 con rampas cromáticas temáticas (`thermal`, `ndvi`, `precip`, `radar`).
- [backend/prepare_samples.py:generate_sample_tifs](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/backend/prepare_samples.py#L10) - Generador de archivos de muestra GeoTIFF de respaldo para pruebas locales sin conexión a internet.

## Invariants
- El canal de retrodispersión SAR debe acotarse inferiormente (`np.maximum(filtered, 1e-6)`) previo a la transformación logarítmica a decibelios ($10 \cdot \log_{10}(\sigma_0)$) para evitar indeterminaciones.
- Los índices normalizados (NDVI y NDWI) deben incluir un factor de estabilización $\epsilon = 10^{-6}$ en el denominador para prevenir divisiones entre cero en áreas oscuras o sin señal.
- Los GeoTIFFs exportados siempre deben declarar `driver="GTiff"`, `dtype="float32"` y sistema de referencia de coordenadas `EPSG:4326`.

## Side Effects
- Lectura de archivos ráster locales en `backend/sample_data/*.tif`.
- Solicitudes HTTP salientes asíncronas hacia APIs remotas de NASA CMR y Planetary Computer STAC.
- Generación y asignación de memoria para buffers binarios de imágenes ráster y codificaciones Base64.

## Verification
- Run: `python -m py_compile backend/main.py backend/processor.py backend/connectors.py backend/prepare_samples.py`
