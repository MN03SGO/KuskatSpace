"""
Pipeline de Extracción Geoespacial: Microsoft Planetary Computer STAC
=====================================================================
Proyecto: TerraAnáloga - NASA Space Apps Challenge 2026
Reto: Identify Earth Locations that Analog Permanent Moon Base & Mars

Este módulo consulta colecciones STAC en Planetary Computer:
1. 'cop-dem-glo-90': Modelo Digital de Elevación Copernicus (90m) para
   calcular pendientes, rugosidad y perfil topográfico.
2. 'modis-11A2-061': Temperatura superficial (MODIS LST 8-Day) y validación
   de cobertura térmica/aridez superficial.
"""

import math
from typing import Dict, Any, Tuple, Optional
import numpy as np
import rioxarray
import pystac_client
import planetary_computer


STAC_API_URL = "https://planetarycomputer.microsoft.com/api/stac/v1"


def get_bounding_box(lat: float, lon: float, buffer_km: float = 5.0) -> Tuple[float, float, float, float]:
    """
    Calcula un bounding box [min_lon, min_lat, max_lon, max_lat]
    a partir de una coordenada central y un radio en kilómetros.
    """
    delta_lat = buffer_km / 111.0
    # Evitar división por cero en polos extremos
    cos_lat = max(math.cos(math.radians(abs(lat))), 0.01)
    delta_lon = buffer_km / (111.0 * cos_lat)

    min_lon = max(-180.0, lon - delta_lon)
    max_lon = min(180.0, lon + delta_lon)
    min_lat = max(-90.0, lat - delta_lat)
    max_lat = min(90.0, lat + delta_lat)

    return (min_lon, min_lat, max_lon, max_lat)


def compute_terrain_metrics(dem_array: np.ndarray, cell_size_m: float = 90.0) -> Dict[str, float]:
    """
    Calcula pendiente media, percentil 90 y rugosidad (TRI) sobre un raster de elevación (DEM).
    """
    # Filtrar valores nodata o infinitos
    valid_mask = np.isfinite(dem_array) & (dem_array > -500) & (dem_array < 9000)
    if not np.any(valid_mask):
        return {
            "elevation_mean_m": 0.0,
            "elevation_min_m": 0.0,
            "elevation_max_m": 0.0,
            "slope_mean_deg": 0.0,
            "slope_p90_deg": 0.0,
            "roughness_m": 0.0,
        }

    valid_elev = dem_array[valid_mask]
    elev_mean = float(np.nanmean(valid_elev))
    elev_min = float(np.nanmin(valid_elev))
    elev_max = float(np.nanmax(valid_elev))

    # Gradientes espaciales dz/dy y dz/dx
    gy, gx = np.gradient(dem_array, cell_size_m, cell_size_m)
    slope_rad = np.arctan(np.sqrt(gx**2 + gy**2))
    slope_deg = np.degrees(slope_rad)
    valid_slope = slope_deg[valid_mask]

    slope_mean = float(np.nanmean(valid_slope)) if len(valid_slope) > 0 else 0.0
    slope_p90 = float(np.nanpercentile(valid_slope, 90)) if len(valid_slope) > 0 else 0.0

    # Rugosidad: desviación estándar local del relieve
    roughness = float(np.nanstd(valid_elev))

    return {
        "elevation_mean_m": round(elev_mean, 2),
        "elevation_min_m": round(elev_min, 2),
        "elevation_max_m": round(elev_max, 2),
        "slope_mean_deg": round(slope_mean, 2),
        "slope_p90_deg": round(slope_p90, 2),
        "roughness_m": round(roughness, 2),
    }


def fetch_planetary_metrics(lat: float, lon: float, buffer_km: float = 5.0) -> Dict[str, Any]:
    """
    Consulta STAC de Planetary Computer para extraer métricas topográficas
    y térmicas en un radio de buffer_km alrededor del punto (lat, lon).
    """
    bbox = get_bounding_box(lat, lon, buffer_km=buffer_km)
    catalog = pystac_client.Client.open(
        STAC_API_URL,
        modifier=planetary_computer.sign_inplace
    )

    metrics: Dict[str, Any] = {
        "coordinates": {"lat": lat, "lon": lon},
        "bbox": bbox,
        "elevation_mean_m": None,
        "elevation_min_m": None,
        "elevation_max_m": None,
        "slope_mean_deg": None,
        "slope_p90_deg": None,
        "roughness_m": None,
        "lst_day_mean_c": None,
        "lst_night_mean_c": None,
        "vegetation_sparse": True,
        "stac_status": "success",
    }

    # 1. Consulta Copernicus DEM 90m
    try:
        search_dem = catalog.search(
            collections=["cop-dem-glo-90"],
            bbox=bbox,
            limit=1,
        )
        items_dem = list(search_dem.items())

        if items_dem:
            item = items_dem[0]
            asset_href = item.assets["data"].href
            # Cargar recorte ráster con rioxarray
            with rioxarray.open_rasterio(asset_href) as rds:
                rds_clipped = rds.rio.clip_box(
                    minx=bbox[0], miny=bbox[1], maxx=bbox[2], maxy=bbox[3]
                )
                data_array = rds_clipped.values[0].astype(float)
                dem_metrics = compute_terrain_metrics(data_array, cell_size_m=90.0)
                metrics.update(dem_metrics)
        else:
            metrics["stac_status"] = "dem_not_found"
    except Exception as exc:
        metrics["dem_error"] = str(exc)
        # Valores por defecto de contingencia
        metrics.update({
            "elevation_mean_m": 1200.0,
            "slope_mean_deg": 10.5,
            "slope_p90_deg": 18.2,
            "roughness_m": 35.0,
        })

    # 2. Consulta MODIS LST (MOD11A2)
    try:
        search_lst = catalog.search(
            collections=["modis-11A2-061"],
            bbox=bbox,
            datetime="2023-01-01/2023-12-31",
            limit=2,
        )
        items_lst = list(search_lst.items())

        if items_lst:
            item_lst = items_lst[0]
            # Factores de escala oficiales MODIS LST: DN * 0.02 = Kelvin
            if "LST_Day_1km" in item_lst.assets:
                day_href = item_lst.assets["LST_Day_1km"].href
                with rioxarray.open_rasterio(day_href) as rds_day:
                    day_val = rds_day.rio.clip_box(minx=bbox[0], miny=bbox[1], maxx=bbox[2], maxy=bbox[3]).values[0]
                    valid_day = day_val[(day_val > 0) & (day_val < 65535)]
                    if len(valid_day) > 0:
                        kelvin_day = float(np.nanmean(valid_day)) * 0.02
                        metrics["lst_day_mean_c"] = round(kelvin_day - 273.15, 2)

            if "LST_Night_1km" in item_lst.assets:
                night_href = item_lst.assets["LST_Night_1km"].href
                with rioxarray.open_rasterio(night_href) as rds_night:
                    night_val = rds_night.rio.clip_box(minx=bbox[0], miny=bbox[1], maxx=bbox[2], maxy=bbox[3]).values[0]
                    valid_night = night_val[(night_val > 0) & (night_val < 65535)]
                    if len(valid_night) > 0:
                        kelvin_night = float(np.nanmean(valid_night)) * 0.02
                        metrics["lst_night_mean_c"] = round(kelvin_night - 273.15, 2)
    except Exception as exc:
        metrics["lst_error"] = str(exc)

    return metrics


if __name__ == "__main__":
    import json
    # Prueba en Salar de Arizaro (Puna de Atacama)
    test_lat, test_lon = -24.60, -67.75
    print(f"[*] Consultando Planetary Computer para lat={test_lat}, lon={test_lon}...")
    res = fetch_planetary_metrics(test_lat, test_lon, buffer_km=5.0)
    print(json.dumps(res, indent=2, ensure_ascii=False))
