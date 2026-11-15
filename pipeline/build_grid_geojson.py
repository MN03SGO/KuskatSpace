"""Genera frontend/public/data/grid.geojson: un polígono por celda EASE-Grid 2.0.

IMPORTANTE — grilla real de GEE (pipeline/features.py), NO 240 m / polar:
  * CRS nativo de TODA la grilla: EPSG:6933 (EASE-Grid 2.0 Global, CEA).
    No se usa EPSG:6931/6932: GEE muestreó pixelCoordinates en 6933.
  * Paso de celda: 60 km (backbone) o 15 km (ROIs). El 240 m es solo
    DEM_SCALE (agregación homóloga dentro de la ventana), no el tamaño de celda.

Geometría: bounds exactos row/col en metros 6933 → 4 esquinas → EPSG:4326.
Properties: relief, illum, cold, ice, dust, valid (0–1, 3 decimales).
"""
from __future__ import annotations

import argparse
import json
import math
import re
from pathlib import Path

import numpy as np
import pandas as pd
from pyproj import Transformer
from shapely.geometry import Polygon
from shapely.validation import make_valid

from common import DATA, get_logger

log = get_logger("build_grid_geojson")

CELL_ID_RE = re.compile(r"^E(\d+)_r(-?\d+)_c(-?\d+)$")
COORD_DECIMALS = 5
PROP_DECIMALS = 3
# Web Mercator / MapLibre: vértices más allá de esto se renderizan como bloques enormes
MERCATOR_MAX_LAT = 85.05112878
MAX_LON_WIDTH_DEG = 5.0
MAX_LAT_HEIGHT_DEG = 5.0


def _norm01(s: pd.Series, qlow: float = 0.02, qhigh: float = 0.98) -> np.ndarray:
    arr = s.to_numpy(dtype=np.float64)
    finite = arr[np.isfinite(arr)]
    if finite.size == 0:
        return np.zeros(len(arr), dtype=np.float64)
    lo, hi = np.nanquantile(finite, [qlow, qhigh])
    return np.clip((arr - lo) / (hi - lo + 1e-9), 0.0, 1.0)


def _round_ring(coords: list[tuple[float, float]], nd: int = COORD_DECIMALS) -> list[list[float]]:
    return [[round(x, nd), round(y, nd)] for x, y in coords]


def parse_cell_id(cell_id: str) -> tuple[float, int, int] | None:
    """Devuelve (step_m, row, col) desde E{km}_r{row}_c{col}."""
    m = CELL_ID_RE.match(str(cell_id))
    if not m:
        return None
    step_km = int(m.group(1))
    row = int(m.group(2))
    col = int(m.group(3))
    return float(step_km * 1000), row, col


def cell_corners_4326_from_rowcol(
    step_m: float,
    row: int,
    col: int,
    inv: Transformer,
) -> list[tuple[float, float]] | None:
    """Esquinas de la celda GEE en EPSG:6933 (bounds enteros) → lon/lat.

    En GEE: x,y = pixelCoordinates(grid); col=floor(x), row=floor(y).
    Celda = [col*step, (col+1)*step] × [row*step, (row+1)*step] en metros 6933.
    """
    x0 = col * step_m
    x1 = (col + 1) * step_m
    y0 = row * step_m
    y1 = (row + 1) * step_m
    # CCW: SW → SE → NE → NW → SW (en ejes EASE: x=easting, y=northing)
    xy = [
        (x0, y0),
        (x1, y0),
        (x1, y1),
        (x0, y1),
        (x0, y0),
    ]
    ring: list[tuple[float, float]] = []
    for cx, cy in xy:
        lon_i, lat_i = inv.transform(cx, cy)
        if not (math.isfinite(lon_i) and math.isfinite(lat_i)):
            return None
        ring.append((float(lon_i), float(lat_i)))
    return ring


def ring_lon_width(ring: list[tuple[float, float]]) -> float:
    lons = [c[0] for c in ring[:-1]]
    return max(lons) - min(lons)


def ring_lat_height(ring: list[tuple[float, float]]) -> float:
    lats = [c[1] for c in ring[:-1]]
    return max(lats) - min(lats)


def ring_exceeds_mercator(ring: list[tuple[float, float]]) -> bool:
    return any(abs(c[1]) > MERCATOR_MAX_LAT for c in ring)


def compute_normalized_props(df: pd.DataFrame) -> pd.DataFrame:
    """5 dimensiones 0–1; valid=1 si hay LST+DEM."""
    sh_cols = ["shadow_frac_d1", "shadow_frac_d2", "shadow_frac_d3", "shadow_frac_d4"]
    shadow = np.nanmax(df[sh_cols].to_numpy(dtype=np.float64), axis=1)
    shadow = np.nan_to_num(shadow, nan=0.0)

    has_lst = df["lst_min"].notna().to_numpy()
    lst_median = float(df["lst_min"].median()) if has_lst.any() else 270.0
    cold = 1.0 - _norm01(df["lst_min"].fillna(lst_median))
    # Sin LST real → cold=0 (no inventar frío polar)
    cold = np.where(has_lst, cold, 0.0)

    ice = np.clip(np.nan_to_num(df["snow_persist"].to_numpy(dtype=np.float64), nan=0.0), 0.0, 1.0)

    aod_median = float(df["aod_p90"].median()) if df["aod_p90"].notna().any() else 0.2
    dust = _norm01(df["aod_p90"].fillna(aod_median))
    dust = np.where(df["aod_p90"].notna().to_numpy() | df["aod_mean"].notna().to_numpy(), dust, 0.0)

    relief = 0.55 * _norm01(df["slope_mean"].fillna(0.0)) + 0.45 * _norm01(df["relief_local"].fillna(0.0))
    illum = np.clip(shadow, 0.0, 1.0)

    has_dem = df["slope_mean"].notna().to_numpy() & df["elev_m"].notna().to_numpy()
    valid = (has_lst & has_dem).astype(np.int8)

    return pd.DataFrame(
        {
            "relief": np.round(relief, PROP_DECIMALS),
            "illum": np.round(illum, PROP_DECIMALS),
            "cold": np.round(cold, PROP_DECIMALS),
            "ice": np.round(ice, PROP_DECIMALS),
            "dust": np.round(dust, PROP_DECIMALS),
            "valid": valid,
        },
        index=df.index,
    )


def print_stats(features: list[dict], n_input: int, drops: dict[str, int]) -> dict:
    """Estadísticas de bounds, validez e histograma latitudinal."""
    widths: list[float] = []
    heights: list[float] = []
    lats: list[float] = []
    n_valid_prop = 0
    n_valid0 = 0
    n_geom_ok = 0

    for ft in features:
        props = ft["properties"]
        if int(props.get("valid", 0)) == 1:
            n_valid_prop += 1
        else:
            n_valid0 += 1
        coords = ft["geometry"]["coordinates"][0]
        xs = [c[0] for c in coords[:-1]]
        ys = [c[1] for c in coords[:-1]]
        w = max(xs) - min(xs)
        h = max(ys) - min(ys)
        widths.append(w)
        heights.append(h)
        lats.append(0.5 * (min(ys) + max(ys)))
        if w > 0 and h > 0 and abs(w) < 180:
            n_geom_ok += 1

    w_arr = np.array(widths, dtype=np.float64) if widths else np.array([0.0])
    h_arr = np.array(heights, dtype=np.float64) if heights else np.array([0.0])
    bins = list(range(-90, 100, 10))
    hist, _ = np.histogram(lats, bins=bins) if lats else (np.zeros(len(bins) - 1), bins)
    lat_hist = {f"[{bins[i]},{bins[i+1]})": int(hist[i]) for i in range(len(hist))}

    stats = {
        "n_input_csv": n_input,
        "n_features": len(features),
        "pct_geom_valid": round(100.0 * n_geom_ok / max(len(features), 1), 2),
        "n_valid_prop_1": n_valid_prop,
        "n_valid_prop_0": n_valid0,
        "width_deg": {
            "min": round(float(w_arr.min()), 4),
            "p50": round(float(np.median(w_arr)), 4),
            "p95": round(float(np.percentile(w_arr, 95)), 4),
            "max": round(float(w_arr.max()), 4),
        },
        "height_deg": {
            "min": round(float(h_arr.min()), 4),
            "p50": round(float(np.median(h_arr)), 4),
            "p95": round(float(np.percentile(h_arr, 95)), 4),
            "max": round(float(h_arr.max()), 4),
        },
        "lat_histogram_10deg": lat_hist,
        "drops": drops,
        "grid_note": (
            "GEE grid = EPSG:6933 @ 15 km / 60 km cell step; "
            "240 m is DEM homologous scale only; polar EPSG:6931/6932 NOT used by pipeline"
        ),
    }
    print(json.dumps(stats, indent=2))
    return stats


def build_geojson(in_csv: Path, out_path: Path) -> dict:
    df = pd.read_csv(in_csv)
    props = compute_normalized_props(df)

    # Solo 6933↔4326: coincide con EASE_WKT de features.py
    inv = Transformer.from_crs(6933, 4326, always_xy=True)

    features: list[dict] = []
    drops = {
        "bad_id": 0,
        "invalid_geom": 0,
        "lon_width_gt_5": 0,
        "lat_height_gt_5": 0,
        "beyond_mercator": 0,
        "no_dem": 0,
    }

    for idx, row in df.iterrows():
        parsed = parse_cell_id(str(row["cell_id"]))
        if parsed is None:
            drops["bad_id"] += 1
            continue
        step_m, grow, gcol = parsed

        # Sin DEM no hay celda física útil
        if pd.isna(row.get("elev_m")) and pd.isna(row.get("slope_mean")):
            drops["no_dem"] += 1
            continue

        ring = cell_corners_4326_from_rowcol(step_m, grow, gcol, inv)
        if ring is None:
            drops["invalid_geom"] += 1
            continue

        lon_w = ring_lon_width(ring)
        lat_h = ring_lat_height(ring)
        if lon_w > MAX_LON_WIDTH_DEG:
            drops["lon_width_gt_5"] += 1
            continue
        # CEA cerca del polo: ±30 km en Y → varios grados de lat; MapLibre/Mercator explota
        if lat_h > MAX_LAT_HEIGHT_DEG:
            drops["lat_height_gt_5"] += 1
            continue
        if ring_exceeds_mercator(ring):
            drops["beyond_mercator"] += 1
            continue

        poly = make_valid(Polygon(ring))
        if poly.is_empty:
            drops["invalid_geom"] += 1
            continue
        if poly.geom_type == "MultiPolygon":
            poly = max(poly.geoms, key=lambda g: g.area)
        if poly.geom_type != "Polygon":
            drops["invalid_geom"] += 1
            continue

        exterior = _round_ring(list(poly.exterior.coords))
        if exterior[0] != exterior[-1]:
            exterior.append(exterior[0])

        features.append(
            {
                "type": "Feature",
                "properties": {
                    "relief": float(props.at[idx, "relief"]),
                    "illum": float(props.at[idx, "illum"]),
                    "cold": float(props.at[idx, "cold"]),
                    "ice": float(props.at[idx, "ice"]),
                    "dust": float(props.at[idx, "dust"]),
                    "valid": int(props.at[idx, "valid"]),
                },
                "geometry": {"type": "Polygon", "coordinates": [exterior]},
            }
        )

    fc = {"type": "FeatureCollection", "features": features}
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(fc, separators=(",", ":")), encoding="utf-8")
    size_mb = out_path.stat().st_size / (1024 * 1024)

    log.info(
        "grid.geojson: %d features (csv=%d), %.3f MB | drops=%s",
        len(features),
        len(df),
        size_mb,
        drops,
    )
    stats = print_stats(features, len(df), drops)
    stats["size_mb"] = round(size_mb, 3)
    stats["out"] = str(out_path)
    if size_mb > 6.0:
        log.warning("Archivo > 6 MB (%.3f MB). Considerar tippecanoe → grid.pmtiles.", size_mb)
    print(json.dumps({"size_mb": round(size_mb, 3), "out": str(out_path)}, indent=2))
    return stats


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--in-csv", type=Path, default=DATA / "earth_features.csv")
    ap.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "frontend" / "public" / "data" / "grid.geojson",
    )
    a = ap.parse_args()
    build_geojson(a.in_csv, a.out)


if __name__ == "__main__":
    main()
