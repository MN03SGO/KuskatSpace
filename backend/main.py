import io
import base64
from typing import Optional
import httpx
import numpy as np
import rasterio
from scipy.ndimage import uniform_filter
from PIL import Image
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Cloud GIS & Remote Sensing MVP", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Catálogo curado de recursos específicos de agencias para acceso inmediato en la demo
CURATED_AGENCY_RESOURCES = [
    {
        "id": "CSA-RCM-MARITIME-01",
        "agency": "CSA",
        "mission": "RADARSAT Constellation Mission (RCM)",
        "domain": "Earth - Maritime Surveillance & Disaster Management",
        "sensor_type": "SAR (C-Band)",
        "description": "Detección de embarcaciones, hielo marino y derrames en cualquier condición climática.",
        "sample_file": "sample_data/rcm_sar_sample.tif",
    },
    {
        "id": "CSA-RADARSAT1-ARCHIVE",
        "agency": "CSA",
        "mission": "RADARSAT-1 Open Archive",
        "domain": "Earth - Ecosystem & Coastal Monitoring",
        "sensor_type": "SAR (C-Band)",
        "description": "Archivo histórico abierto de radar con penetración de nubes y humo.",
        "sample_file": "sample_data/radarsat1_sample.tif",
    },
    {
        "id": "NASA-LRO-DIVINER-POLAR",
        "agency": "NASA PDS / LRO",
        "mission": "Lunar Reconnaissance Orbiter (Diviner & LOLA)",
        "domain": "Moon - Polar Thermal & Resource Mapping",
        "sensor_type": "Thermal Radiometer / Altimeter",
        "description": "Mapa de temperaturas extremas en polos lunares comparable con criósfera terrestre.",
        "sample_file": "sample_data/lro_diviner_polar.tif",
    },
    {
        "id": "JAXA-GPORTAL-PRECIP-VEG",
        "agency": "JAXA G-Portal",
        "mission": "GPM / GSMaP & GCOM-C",
        "domain": "Earth - Precipitation, Snow & Vegetation",
        "sensor_type": "Microwave / Optical",
        "description": "Variables geofísicas globales de precipitación, cobertura de nieve y vegetación.",
        "sample_file": "sample_data/jaxa_gportal_sample.tif",
    },
    {
        "id": "ESA-OPEN-SCIENCE-SENTINEL",
        "agency": "ESA",
        "mission": "Copernicus Data Space & Open Science Catalog",
        "domain": "Earth - Land, Oceans & Atmosphere",
        "sensor_type": "Multispectral / SAR",
        "description": "Flujos abiertos de Sentinel-1 y Sentinel-2 para monitoreo ambiental.",
        "sample_file": "sample_data/sentinel2_sample.tif",
    },
]


def lee_speckle_filter(img: np.ndarray, size: int = 5) -> np.ndarray:
    """Filtro Lee básico para reducción de ruido speckle en imágenes SAR (basado en CSA SAR Tutorial)."""
    img_mean = uniform_filter(img, size)
    img_sqr_mean = uniform_filter(img**2, size)
    img_variance = np.maximum(img_sqr_mean - img_mean**2, 0)
    overall_variance = np.var(img)
    img_weights = img_variance / (img_variance + overall_variance + 1e-8)
    return img_mean + img_weights * (img - img_mean)


def array_to_base64_png(data: np.ndarray, cmap: str = "viridis") -> str:
    """Normaliza una matriz 2D a imagen PNG en base64 para superponer en Leaflet/MapLibre."""
    valid = np.nan_to_num(data, nan=np.nanmin(data))
    vmin, vmax = np.percentile(valid, [2, 98])
    norm = np.clip((valid - vmin) / (vmax - vmin + 1e-8), 0, 1)

    # Paleta sencilla: escala térmica/espectral en RGB
    r = (norm * 255).astype(np.uint8)
    g = (np.sin(norm * np.pi) * 255).astype(np.uint8)
    b = ((1 - norm) * 255).astype(np.uint8)
    rgba = np.dstack((r, g, b, np.full_like(r, 210)))

    img = Image.fromarray(rgba, mode="RGBA")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


@app.get("/api/search")
async def federated_search(
    bbox: str = Query("-90.1,13.1,-87.6,14.5", description="min_lon,min_lat,max_lon,max_lat"),
    limit: int = Query(5, ge=1, le=20),
):
    """Búsqueda federada en vivo (NASA Earthdata CMR + Copernicus STAC) + recursos CSA/JAXA/PDS."""
    results = {"nasa_earthdata": [], "esa_copernicus": [], "partner_catalog": CURATED_AGENCY_RESOURCES}

    async with httpx.AsyncClient(timeout=10.0) as client:
        # 1. Consulta en vivo a NASA CMR (Earthdata Search)
        try:
            cmr_url = "https://cmr.earthdata.nasa.gov/search/granules.json"
            cmr_res = await client.get(cmr_url, params={"bounding_box": bbox, "page_size": limit})
            if cmr_res.status_code == 200:
                entries = cmr_res.json().get("feed", {}).get("entry", [])
                results["nasa_earthdata"] = [
                    {
                        "id": e.get("id"),
                        "title": e.get("title"),
                        "time_start": e.get("time_start"),
                        "dataset_id": e.get("dataset_id"),
                    }
                    for e in entries
                ]
        except Exception as exc:
            results["nasa_earthdata_error"] = str(exc)

        # 2. Consulta en vivo a ESA Copernicus Data Space Ecosystem (STAC API)
        try:
            coords = [float(x) for x in bbox.split(",")]
            stac_url = "https://stac.dataspace.copernicus.eu/v1/search"
            stac_res = await client.post(
                stac_url,
                json={"bbox": coords, "limit": limit, "collections": ["sentinel-2-l2a"]},
            )
            if stac_res.status_code == 200:
                features = stac_res.json().get("features", [])
                results["esa_copernicus"] = [
                    {
                        "id": f.get("id"),
                        "collection": f.get("collection"),
                        "datetime": f.get("properties", {}).get("datetime"),
                        "cloud_cover": f.get("properties", {}).get("eo:cloud_cover"),
                    }
                    for f in features
                ]
        except Exception as exc:
            results["esa_copernicus_error"] = str(exc)

    return results


@app.post("/api/process/demo")
def process_raster_demo(
    mode: str = Query("sar_db", enum=["sar_db", "ndvi", "diviner_thermal"]),
    file_path: Optional[str] = None,
):
    """
    Ejecuta procesamiento real sobre GeoTIFF local o genera matriz sintética calibrada
    si aún no se han cargado los archivos en sample_data/.
    """
    try:
        if file_path:
            with rasterio.open(file_path) as src:
                band1 = src.read(1).astype(np.float32)
                band2 = src.read(2).astype(np.float32) if src.count >= 2 else band1
                bounds = [[src.bounds.bottom, src.bounds.left], [src.bounds.top, src.bounds.right]]
        else:
            # Matriz de respaldo (256x256) para probar el pipeline antes de subir los .tif reales
            y, x = np.mgrid[0:256, 0:256]
            band1 = np.abs(np.sin(x / 20.0) * np.cos(y / 20.0)) + 0.05
            band2 = np.abs(np.cos(x / 15.0)) + 0.1
            bounds = [[13.1, -90.1], [14.5, -87.6]]

        if mode == "sar_db":
            # Calibración SAR a decibelios (sigma0) + reducción de speckle
            filtered = lee_speckle_filter(band1, size=5)
            output = 10.0 * np.log10(np.maximum(filtered, 1e-6))
            unit = "dB (Sigma0)"
        elif mode == "ndvi":
            # Índice de Vegetación de Diferencia Normalizada: (NIR - Red) / (NIR + Red)
            output = (band2 - band1) / (band2 + band1 + 1e-6)
            unit = "Índice NDVI (-1 a 1)"
        else:
            # Comparación térmica LRO Diviner (Kelvin) vs entorno criosférico terrestre
            lunar_kelvin = 40.0 + (band1 / np.max(band1)) * 350.0
            output = lunar_kelvin
            unit = "Kelvin (Perfil Térmico Polar Diviner)"

        png_b64 = array_to_base64_png(output)
        return {
            "mode": mode,
            "unit": unit,
            "stats": {
                "min": round(float(np.nanmin(output)), 3),
                "max": round(float(np.nanmax(output)), 3),
                "mean": round(float(np.nanmean(output)), 3),
            },
            "bounds": bounds,
            "overlay_png_base64": f"data:image/png;base64,{png_b64}",
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error procesando raster: {exc}")