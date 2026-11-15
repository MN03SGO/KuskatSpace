"""P1 · Extracción de recortes orbitales Sentinel-2 (óptico) y Sentinel-1 (SAR banda C).

Sustituye operativamente a RADARSAT-1 / RCM (Desviación D2 de PLAN_P1.md) usando
Sentinel-1 GRD (banda C, 5.405 GHz) y aplica el filtro Lee de reducción de speckle
del tutorial SAR de la CSA (idéntico al usado en `backend/processor.py`).

Guarda en `data/orbital_previews/`:
  * `<site_id>_s2_rgb.png`      (color verdadero B4/B3/B2 a 10-30 m)
  * `<site_id>_s1_sar.png`      (retrodispersión VV en dB con filtro Lee)
  * `orbital_previews.json`     (metadatos, stats y `overlay_png_base64` para P5)
"""
from __future__ import annotations

import argparse
import base64
import io
import json
from pathlib import Path

import numpy as np
import requests
from PIL import Image

from common import DATA, S1_ID, S2_ID, get_logger, init_ee
from qc import REFERENCE_SITES

log = get_logger("orbital_previews")


def _box_mean(arr: np.ndarray, size: int = 5) -> np.ndarray:
    """Media móvil rápida en ventana `size x size` con reflect padding en NumPy puro."""
    r = size // 2
    pad = np.pad(arr.astype(np.float64), r, mode="reflect")
    # Suma acumulada 2D (integral image)
    cs = np.pad(pad, ((1, 0), (1, 0)), mode="constant").cumsum(0).cumsum(1)
    h, w = arr.shape
    total = cs[size:size + h, size:size + w] - cs[:h, size:size + w] - cs[size:size + h, :w] + cs[:h, :w]
    return (total / float(size * size)).astype(np.float32)


def lee_speckle_filter(img: np.ndarray, size: int = 5) -> np.ndarray:
    """Filtro Lee para reducción de speckle SAR (CSA SAR Tutorial)."""
    img_mean = _box_mean(img, size)
    img_sqr_mean = _box_mean(img ** 2, size)
    img_variance = np.maximum(img_sqr_mean - img_mean ** 2, 0.0)
    overall_variance = float(np.var(img))
    weights = img_variance / (img_variance + overall_variance + 1e-8)
    return img_mean + weights * (img - img_mean)


def fetch_png_array(url: str) -> Image.Image:
    res = requests.get(url, timeout=60)
    res.raise_for_status()
    return Image.open(io.BytesIO(res.content)).convert("RGB")


def generate_previews(out_dir: Path, half_deg: float = 0.18) -> dict:
    ee = init_ee()
    out_dir.mkdir(parents=True, exist_ok=True)
    catalog = {}

    for sid, lat, lon, label in REFERENCE_SITES:
        cos_lat = max(0.25, float(np.cos(np.radians(lat))))
        dlon = round(half_deg / cos_lat, 4)
        dlat = half_deg
        bbox = [round(lon - dlon, 4), round(lat - dlat, 4),
                round(lon + dlon, 4), round(lat + dlat, 4)]
        region = ee.Geometry.Rectangle(bbox, "EPSG:4326", False)

        entry = {
            "site_id": sid,
            "label": label,
            "center": {"lat": lat, "lon": lon},
            "bbox": bbox,
            "bounds": [[bbox[1], bbox[0]], [bbox[3], bbox[2]]],  # LeafletBounds
        }

        # 1. Sentinel-2 RGB (mediana libre de nubes en verano local)
        try:
            s2_col = (ee.ImageCollection(S2_ID)
                      .filterBounds(region)
                      .filterDate("2019-01-01", "2024-11-01"))
            if abs(lat) > 65:
                # Ártico/Antártida: verano iluminado. SH: Dic OR Ene–Feb
                # (calendarRange(12, 2) no envuelve el año → 0 imágenes).
                if lat > 0:
                    season = ee.Filter.calendarRange(6, 8, "month")
                else:
                    season = ee.Filter.Or(
                        ee.Filter.calendarRange(12, 12, "month"),
                        ee.Filter.calendarRange(1, 2, "month"),
                    )
                s2_col = (s2_col
                          .filter(season)
                          .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 60)))
            else:
                s2_col = s2_col.filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 25))
            s2 = s2_col.select(["B4", "B3", "B2"]).median()
            s2_url = s2.getThumbURL({
                "region": region,
                "dimensions": "384x384",
                "format": "png",
                "min": 300,
                "max": 4500 if abs(lat) > 65 else 3500,
                "gamma": 1.25,
            })
            s2_img = fetch_png_array(s2_url)
            s2_path = out_dir / f"{sid}_s2_rgb.png"
            s2_img.save(s2_path, format="PNG", optimize=True)
            entry["sentinel2_rgb_file"] = f"data/orbital_previews/{s2_path.name}"
            log.info("[%s] Sentinel-2 RGB OK -> %s (%d B)", sid, s2_path.name, s2_path.stat().st_size)
        except Exception as exc:  # noqa: BLE001
            log.warning("[%s] Sentinel-2 falló: %s", sid, exc)

        # 2. Sentinel-1 SAR C-Band (sustituto de RADARSAT-1 / RCM) + filtro Lee local
        try:
            s1_col = (ee.ImageCollection(S1_ID)
                      .filterBounds(region)
                      .filterDate("2019-01-01", "2024-11-01"))
            # Probar VV primero y caer a HH si VV está vacío (ej. Ártico/Canadá subártico/Antártida)
            vv_col = s1_col.filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
            pol = "VV" if vv_col.size().getInfo() > 0 else "HH"
            s1 = s1_col.filter(ee.Filter.listContains("transmitterReceiverPolarisation", pol)).select(pol).median()
            s1_url = s1.getThumbURL({
                "region": region,
                "dimensions": "384x384",
                "format": "png",
                "min": -25,
                "max": 0,
            })
            raw_img = fetch_png_array(s1_url).convert("L")
            arr_db = -25.0 + (np.asarray(raw_img, dtype=np.float32) / 255.0) * 25.0
            filtered_db = lee_speckle_filter(arr_db, size=5)
            norm = np.clip((filtered_db + 25.0) / 25.0, 0.0, 1.0)
            sar_u8 = (norm * 255).astype(np.uint8)
            sar_img = Image.fromarray(sar_u8, mode="L")
            s1_path = out_dir / f"{sid}_s1_sar.png"
            sar_img.save(s1_path, format="PNG", optimize=True)

            buf = io.BytesIO()
            sar_img.resize((256, 256)).save(buf, format="PNG", optimize=True)
            entry["sar_cband"] = {
                "sensor": f"Sentinel-1 C-Band GRD ({pol}) — sustituto RADARSAT-1/RCM (filtro Lee 5x5)",
                "file": f"data/orbital_previews/{s1_path.name}",
                "unit": f"dB (Sigma0 {pol})",
                "stats": {
                    "min": round(float(np.min(filtered_db)), 2),
                    "mean": round(float(np.mean(filtered_db)), 2),
                    "max": round(float(np.max(filtered_db)), 2),
                },
                "overlay_png_base64": f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode('ascii')}",
            }
            log.info("[%s] Sentinel-1 SAR (%s) OK -> %s", sid, pol, s1_path.name)
        except Exception as exc:  # noqa: BLE001
            log.warning("[%s] Sentinel-1 SAR falló: %s", sid, exc)

        catalog[sid] = entry

    meta_path = out_dir / "orbital_previews.json"
    meta_path.write_text(json.dumps(catalog, indent=2, ensure_ascii=False))
    log.info("Catálogo de recortes orbitales escrito en %s", meta_path)
    return catalog


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out-dir", type=Path, default=DATA / "orbital_previews")
    a = ap.parse_args()
    generate_previews(a.out_dir)


if __name__ == "__main__":
    main()
