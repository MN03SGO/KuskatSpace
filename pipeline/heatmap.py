"""P1 · Generador de mapas de calor PNG en EPSG:4326 + JSON de bounds (Plan B estático).

Alineado con `Frontend/WebGIS` (PlanetMap.tsx / GlobeView.tsx / bbox.ts):
exporta en `data/heatmap_bounds.json` tanto el formato `LeafletBounds`
(`[[minLat, minLon], [maxLat, maxLon]]`) como `MaplibreCorners`
(`[[minLon, maxLat], [maxLon, maxLat], [maxLon, minLat], [minLon, minLat]]`) y `bbox`.

Produce:
  * data/heatmap_analog_index.png (índice compuesto preliminar Luna/Marte en RGBA)
  * data/heatmap_moon_psr.png     (potencial criosférico / sombra polar)
  * data/heatmap_mars_arid.png    (potencial hiperárido / polvo / permafrost)
  * data/heatmap_bounds.json      (bounds + data URLs opcionales para overlay directo)
"""
from __future__ import annotations

import argparse
import base64
import json
from pathlib import Path

import matplotlib as mpl
import numpy as np
import pandas as pd
from PIL import Image

from common import DATA, get_logger

log = get_logger("heatmap")


def _norm01(s: pd.Series, qlow: float = 0.02, qhigh: float = 0.98) -> np.ndarray:
    arr = s.to_numpy(dtype=np.float64)
    lo, hi = np.nanquantile(arr, [qlow, qhigh])
    return np.clip((arr - lo) / (hi - lo + 1e-9), 0.0, 1.0)


def compute_preliminary_scores(df: pd.DataFrame) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Calcula un score preliminar de potencial analógico (en espera del IFA exacto de P3)."""
    # Frío extremo (menor lst_min -> mayor score)
    cold = 1.0 - _norm01(df["lst_min"].fillna(df["lst_mean"].median()))
    # Sombra máxima estacional (análogo PSR)
    sh_cols = ["shadow_frac_d1", "shadow_frac_d2", "shadow_frac_d3", "shadow_frac_d4"]
    shadow = np.nanmax(df[sh_cols].to_numpy(dtype=np.float64), axis=1)
    shadow = np.nan_to_num(shadow, nan=0.0)
    # Criosfera / nieve
    ice = np.nan_to_num(df["snow_persist"].to_numpy(dtype=np.float64), nan=0.0)
    # Aridez (bajo NDVI máximo = suelo desnudo / regolito sin vegetación)
    bare = 1.0 - np.clip(np.nan_to_num(df["ndvi_max"].to_numpy(dtype=np.float64), nan=0.1) / 0.5, 0.0, 1.0)
    # Polvo / aerosoles
    dust = _norm01(df["aod_p90"].fillna(df["aod_mean"].median()))
    # Relieve / amplitud térmica
    amp = _norm01(df["lst_amp"].fillna(20.0))

    moon_score = np.clip(0.35 * cold + 0.30 * shadow + 0.20 * ice + 0.15 * bare, 0.0, 1.0)
    mars_score = np.clip(0.35 * bare + 0.25 * dust + 0.20 * cold + 0.20 * amp, 0.0, 1.0)
    combined = np.maximum(moon_score, mars_score)
    return combined, moon_score, mars_score


def rasterize_wgs84(
    lats: np.ndarray,
    lons: np.ndarray,
    vals: np.ndarray,
    width: int = 1440,
    height: int = 720,
    cmap_name: str = "turbo",
    splat_radius: int = 1,
) -> Image.Image:
    """Rasteriza puntos (lat, lon) en una grilla equirectangular EPSG:4326 [-180,180]x[-90,90]."""
    grid_sum = np.zeros((height, width), dtype=np.float64)
    grid_cnt = np.zeros((height, width), dtype=np.float64)

    valid = np.isfinite(lats) & np.isfinite(lons) & np.isfinite(vals)
    lats_v, lons_v, vals_v = lats[valid], lons[valid], vals[valid]

    cols = np.clip(((lons_v + 180.0) / 360.0 * width).astype(int), 0, width - 1)
    rows = np.clip(((90.0 - lats_v) / 180.0 * height).astype(int), 0, height - 1)

    for dy in range(-splat_radius, splat_radius + 1):
        for dx in range(-splat_radius, splat_radius + 1):
            w = 1.0 / (1.0 + np.hypot(dx, dy))
            r = np.clip(rows + dy, 0, height - 1)
            c = np.clip(cols + dx, 0, width - 1)
            np.add.at(grid_sum, (r, c), vals_v * w)
            np.add.at(grid_cnt, (r, c), w)

    mask = grid_cnt > 0
    grid = np.zeros((height, width), dtype=np.float64)
    grid[mask] = grid_sum[mask] / grid_cnt[mask]

    vmin, vmax = (np.percentile(grid[mask], [2, 98]) if mask.any() else (0.0, 1.0))
    norm = np.clip((grid - vmin) / (vmax - vmin + 1e-9), 0.0, 1.0)

    cmap = mpl.colormaps[cmap_name]
    rgba = (cmap(norm) * 255).astype(np.uint8)
    # Transparencia en océanos/sin datos y semitransparencia gradual según intensidad
    alpha = np.where(mask, np.clip(90 + (norm * 150).astype(np.int32), 90, 235), 0).astype(np.uint8)
    rgba[..., 3] = alpha
    return Image.fromarray(rgba, mode="RGBA")


def generate_heatmaps(in_csv: Path, out_dir: Path, width: int = 1440, height: int = 720) -> dict:
    df = pd.read_csv(in_csv)
    lats = df["lat"].to_numpy(dtype=np.float64)
    lons = df["lon"].to_numpy(dtype=np.float64)
    combined, moon, mars = compute_preliminary_scores(df)

    # Ajustar radio de splat según densidad de celdas para que el mapa sea continuo
    splat = 3 if len(df) < 50000 else (2 if len(df) < 200000 else 1)

    out_dir.mkdir(parents=True, exist_ok=True)
    layers = {
        "combined": ("heatmap_analog_index.png", combined, "turbo"),
        "moon_south_pole": ("heatmap_moon_psr.png", moon, "viridis"),
        "mars_surface": ("heatmap_mars_arid.png", mars, "magma"),
    }

    layer_meta = {}
    for key, (fname, arr, cmap_name) in layers.items():
        img = rasterize_wgs84(lats, lons, arr, width=width, height=height,
                              cmap_name=cmap_name, splat_radius=splat)
        fpath = out_dir / fname
        img.save(fpath, format="PNG", optimize=True)
        # Versión reducida 720x360 en base64 para compatibilidad directa con ProcessResponse del frontend
        small = img.resize((720, 360), Image.Resampling.BILINEAR)
        import io
        buf = io.BytesIO()
        small.save(buf, format="PNG", optimize=True)
        b64 = base64.b64encode(buf.getvalue()).decode("ascii")
        layer_meta[key] = {
            "file": f"data/{fname}",
            "cmap": cmap_name,
            "stats": {
                "min": round(float(np.nanmin(arr)), 4),
                "mean": round(float(np.nanmean(arr)), 4),
                "max": round(float(np.nanmax(arr)), 4),
            },
            "overlay_png_base64": f"data:image/png;base64,{b64}",
        }
        log.info("Heatmap %s guardado en %s (%d bytes)", key, fpath, fpath.stat().st_size)

    # Formato exacto esperado por frontend/src/lib/bbox.ts
    min_lon, min_lat, max_lon, max_lat = -180.0, -90.0, 180.0, 90.0
    bounds_doc = {
        "crs": "EPSG:4326",
        "width_px": width,
        "height_px": height,
        "cell_count": int(len(df)),
        "bbox": [min_lon, min_lat, max_lon, max_lat],
        "bounds": [[min_lat, min_lon], [max_lat, max_lon]],  # LeafletBounds
        "maplibre_corners": [                                # MaplibreCorners
            [min_lon, max_lat],
            [max_lon, max_lat],
            [max_lon, min_lat],
            [min_lon, min_lat],
        ],
        "default_file": "data/heatmap_analog_index.png",
        "layers": layer_meta,
    }
    bounds_path = out_dir / "heatmap_bounds.json"
    bounds_path.write_text(json.dumps(bounds_doc, indent=2))
    log.info("Bounds guardados en %s", bounds_path)
    return bounds_doc


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--in-csv", type=Path, default=DATA / "earth_features.csv")
    ap.add_argument("--out-dir", type=Path, default=DATA)
    ap.add_argument("--width", type=int, default=1440)
    ap.add_argument("--height", type=int, default=720)
    a = ap.parse_args()
    generate_heatmaps(a.in_csv, a.out_dir, a.width, a.height)


if __name__ == "__main__":
    main()

