import os
import numpy as np
import rasterio
from rasterio.transform import from_bounds

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SAMPLE_DIR = os.path.join(BASE_DIR, "sample_data")
os.makedirs(SAMPLE_DIR, exist_ok=True)

def create_geotiff(filename, bands_data, bounds=(-90.1, 13.1, -87.6, 14.5)):
    """Guarda matrices NumPy como GeoTIFF georreferenciado válido."""
    target_path = os.path.join(SAMPLE_DIR, os.path.basename(filename))
    count, height, width = bands_data.shape
    transform = from_bounds(*bounds, width, height)
    with rasterio.open(
        target_path,
        "w",
        driver="GTiff",
        height=height,
        width=width,
        count=count,
        dtype=bands_data.dtype,
        crs="EPSG:4326",
        transform=transform,
    ) as dst:
        for i in range(count):
            dst.write(bands_data[i], i + 1)

if __name__ == "__main__":
    y, x = np.mgrid[0:256, 0:256].astype(np.float32)

    # 1. Escena SAR simulada (CSA RCM / RADARSAT-1) con ruido speckle multiplicativo
    base_backscatter = 0.08 + 0.15 * np.exp(-((x - 128) ** 2 + (y - 128) ** 2) / 3000.0)
    speckle = np.random.gamma(shape=4.0, scale=0.25, size=(256, 256)).astype(np.float32)
    sar_band = np.expand_dims(base_backscatter * speckle, axis=0)
    create_geotiff("sample_data/csa_rcm_sar.tif", sar_band)

    # 2. Escena Óptica 2 bandas: Banda 1 = Rojo, Banda 2 = NIR (Sentinel-2 / Earthdata)
    red = 0.15 + 0.1 * np.sin(x / 30.0)
    nir = 0.45 + 0.35 * np.cos(y / 25.0)
    optical_bands = np.stack([red, nir]).astype(np.float32)
    create_geotiff("sample_data/esa_sentinel2_optical.tif", optical_bands)

    # 3. Perfil Térmico Polar Lunar (NASA LRO Diviner - Polo Sur Lunar en Kelvin: 40K a 360K)
    crater_shadow = 45.0 + 310.0 * (1.0 - np.exp(-((x - 128) ** 2 + (y - 128) ** 2) / 4500.0))
    diviner_band = np.expand_dims(crater_shadow.astype(np.float32), axis=0)
    create_geotiff("sample_data/nasa_lro_diviner_polar.tif", diviner_band, bounds=(-30.0, -89.5, 30.0, -80.0))

    # 4. Producto Geofísico JAXA G-Portal (Precipitación mm/h)
    precip = np.maximum(0, 12.0 * np.sin(x / 20.0) * np.cos(y / 20.0)).astype(np.float32)
    create_geotiff("sample_data/jaxa_gportal_precip.tif", np.expand_dims(precip, axis=0))

    print("Archivos GeoTIFF generados correctamente en backend/sample_data/")