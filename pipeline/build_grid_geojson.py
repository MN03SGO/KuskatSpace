"""Genera frontend/public/data/grid.geojson: un polígono por celda EASE-Grid 2.0.

IMPORTANTE — grilla real de GEE (pipeline/features.py), NO 240 m / polar:
  * CRS nativo de TODA la grilla: EPSG:6933 (EASE-Grid 2.0 Global, CEA).
  * Paso de celda: 60 km (backbone) o 15 km (ROIs). El 240 m es solo
    DEM_SCALE (agregación homóloga dentro de la ventana), no el tamaño de celda.

Geometría: bounds row/col en metros 6933 → 4 esquinas → EPSG:4326.
Celdas con Δlat>3° o Δlon>3° (artefacto CEA→Mercator) se EXCLUYEN del
GeoJSON de visualización y se escriben en grid_excluded.csv (CSV fuente intacto).

Properties: cell_id, relief, illum, cold, ice, dust, valid, missing, step_km.
"""
from __future__ import annotations

import argparse
import json
import math
import re
from collections import Counter
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
MERCATOR_MAX_LAT = 85.05112878
# Umbral de visualización: artefactos cilíndricos cerca del polo
MAX_VIS_DEG = 3.0


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
    """Esquinas de la celda GEE en EPSG:6933 → lon/lat."""
    x0 = col * step_m
    x1 = (col + 1) * step_m
    y0 = row * step_m
    y1 = (row + 1) * step_m
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


def ring_centroid(ring: list[tuple[float, float]]) -> tuple[float, float]:
    xs = [c[0] for c in ring[:-1]]
    ys = [c[1] for c in ring[:-1]]
    return 0.5 * (min(xs) + max(xs)), 0.5 * (min(ys) + max(ys))


def ring_exceeds_mercator(ring: list[tuple[float, float]]) -> bool:
    return any(abs(c[1]) > MERCATOR_MAX_LAT for c in ring)


def count_missing(row: pd.Series) -> int:
    """Variables IFA faltantes en el CSV crudo (antes de fillna)."""
    missing = 0
    if pd.isna(row.get("slope_mean")) and pd.isna(row.get("relief_local")):
        missing += 1  # relief
    sh = [row.get(f"shadow_frac_d{i}") for i in range(1, 5)]
    if all(pd.isna(v) for v in sh):
        missing += 1  # illum
    if pd.isna(row.get("lst_min")):
        missing += 1  # cold
    if pd.isna(row.get("snow_persist")):
        missing += 1  # ice
    if pd.isna(row.get("aod_p90")) and pd.isna(row.get("aod_mean")):
        missing += 1  # dust
    return missing


def compute_normalized_props(df: pd.DataFrame) -> pd.DataFrame:
    """5 dimensiones 0–1; valid=1 si hay LST+DEM."""
    sh_cols = ["shadow_frac_d1", "shadow_frac_d2", "shadow_frac_d3", "shadow_frac_d4"]
    shadow = np.nanmax(df[sh_cols].to_numpy(dtype=np.float64), axis=1)
    shadow = np.nan_to_num(shadow, nan=0.0)

    has_lst = df["lst_min"].notna().to_numpy()
    lst_median = float(df["lst_min"].median()) if has_lst.any() else 270.0
    cold = 1.0 - _norm01(df["lst_min"].fillna(lst_median))
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


def lat_band_label(lat: float) -> str:
    lo = int(math.floor(lat / 10.0) * 10)
    if lo < -90:
        lo = -90
    if lo >= 90:
        lo = 80
    return f"[{lo},{lo + 10})"


def print_stats(features: list[dict], n_input: int, drops: dict[str, int], excluded_by_band: dict) -> dict:
    widths: list[float] = []
    heights: list[float] = []
    lats: list[float] = []
    n_valid_prop = 0

    for ft in features:
        props = ft["properties"]
        if int(props.get("valid", 0)) == 1:
            n_valid_prop += 1
        coords = ft["geometry"]["coordinates"][0]
        xs = [c[0] for c in coords[:-1]]
        ys = [c[1] for c in coords[:-1]]
        widths.append(max(xs) - min(xs))
        heights.append(max(ys) - min(ys))
        lats.append(0.5 * (min(ys) + max(ys)))

    w_arr = np.array(widths, dtype=np.float64) if widths else np.array([0.0])
    h_arr = np.array(heights, dtype=np.float64) if heights else np.array([0.0])
    bins = list(range(-90, 100, 10))
    hist, _ = np.histogram(lats, bins=bins) if lats else (np.zeros(len(bins) - 1), bins)
    lat_hist = {f"[{bins[i]},{bins[i+1]})": int(hist[i]) for i in range(len(hist))}

    # Regiones: bins 10°×30° con ≥1 celda
    region_keys = set()
    for ft in features:
        coords = ft["geometry"]["coordinates"][0]
        ys = [c[1] for c in coords[:-1]]
        xs = [c[0] for c in coords[:-1]]
        lat = 0.5 * (min(ys) + max(ys))
        lon = 0.5 * (min(xs) + max(xs))
        region_keys.add((int(math.floor(lat / 10) * 10), int(math.floor(lon / 30) * 30)))

    stats = {
        "n_input_csv": n_input,
        "n_features": len(features),
        "n_regions_bins": len(region_keys),
        "n_valid_prop_1": n_valid_prop,
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
        "excluded_by_lat_band_10deg": excluded_by_band,
        "drops": drops,
        "grid_note": (
            "Viz GeoJSON excludes Δlat/Δlon > 3° (CEA polar artefact). "
            "CSV/ranking untouched. 240 m = DEM scale inside cell, not cell size."
        ),
    }
    print(json.dumps(stats, indent=2))
    return stats


def build_geojson(in_csv: Path, out_path: Path, excluded_path: Path) -> dict:
    df = pd.read_csv(in_csv)
    props = compute_normalized_props(df)
    inv = Transformer.from_crs(6933, 4326, always_xy=True)

    features: list[dict] = []
    excluded_rows: list[dict] = []
    drops = {
        "bad_id": 0,
        "invalid_geom": 0,
        "beyond_mercator": 0,
        "no_dem": 0,
        "vis_delta_gt_3": 0,
    }
    excluded_band: Counter[str] = Counter()

    for idx, row in df.iterrows():
        cell_id = str(row["cell_id"])
        parsed = parse_cell_id(cell_id)
        if parsed is None:
            drops["bad_id"] += 1
            continue
        step_m, grow, gcol = parsed
        step_km = int(round(step_m / 1000))

        if pd.isna(row.get("elev_m")) and pd.isna(row.get("slope_mean")):
            drops["no_dem"] += 1
            continue

        ring = cell_corners_4326_from_rowcol(step_m, grow, gcol, inv)
        if ring is None:
            drops["invalid_geom"] += 1
            continue

        lon_w = ring_lon_width(ring)
        lat_h = ring_lat_height(ring)
        clon, clat = ring_centroid(ring)
        missing = count_missing(row)

        if ring_exceeds_mercator(ring):
            drops["beyond_mercator"] += 1
            excluded_rows.append(
                {
                    "cell_id": cell_id,
                    "step_km": step_km,
                    "lat": round(clat, 5),
                    "lon": round(clon, 5),
                    "dlat_deg": round(lat_h, 4),
                    "dlon_deg": round(lon_w, 4),
                    "reason": "beyond_mercator",
                }
            )
            excluded_band[lat_band_label(clat)] += 1
            continue

        # Artefacto CEA polar → fuera del GeoJSON de visualización (CSV intacto)
        if lat_h > MAX_VIS_DEG or lon_w > MAX_VIS_DEG:
            drops["vis_delta_gt_3"] += 1
            reason = []
            if lat_h > MAX_VIS_DEG:
                reason.append(f"dlat>{MAX_VIS_DEG}")
            if lon_w > MAX_VIS_DEG:
                reason.append(f"dlon>{MAX_VIS_DEG}")
            excluded_rows.append(
                {
                    "cell_id": cell_id,
                    "step_km": step_km,
                    "lat": round(clat, 5),
                    "lon": round(clon, 5),
                    "dlat_deg": round(lat_h, 4),
                    "dlon_deg": round(lon_w, 4),
                    "reason": "+".join(reason),
                }
            )
            excluded_band[lat_band_label(clat)] += 1
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
                    "cell_id": cell_id,
                    "step_km": step_km,
                    "relief": float(props.at[idx, "relief"]),
                    "illum": float(props.at[idx, "illum"]),
                    "cold": float(props.at[idx, "cold"]),
                    "ice": float(props.at[idx, "ice"]),
                    "dust": float(props.at[idx, "dust"]),
                    "valid": int(props.at[idx, "valid"]),
                    "missing": int(missing),
                },
                "geometry": {"type": "Polygon", "coordinates": [exterior]},
            }
        )

    fc = {"type": "FeatureCollection", "features": features}
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(fc, separators=(",", ":")), encoding="utf-8")
    size_mb = out_path.stat().st_size / (1024 * 1024)

    excluded_path.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(excluded_rows).to_csv(excluded_path, index=False)

    # Meta ligera para la UI
    meta = print_stats(features, len(df), drops, dict(sorted(excluded_band.items())))
    meta["size_mb"] = round(size_mb, 3)
    meta["out"] = str(out_path)
    meta["excluded_csv"] = str(excluded_path)
    meta["n_excluded"] = len(excluded_rows)
    meta_path = out_path.with_name("grid_meta.json")
    meta_path.write_text(
        json.dumps(
            {
                "n_cells": len(features),
                "n_regions": meta["n_regions_bins"],
                "n_excluded": len(excluded_rows),
                "excluded_by_lat_band_10deg": meta["excluded_by_lat_band_10deg"],
                "note_es": (
                    "Fidelidad analógica por regiones de interés (15 km) y dorsal global (60 km). "
                    "240 m = escala del DEM dentro de cada celda, no el tamaño de la celda."
                ),
                "note_en": (
                    "Analog fidelity for priority regions (15 km) and global backbone (60 km). "
                    "240 m = DEM scale inside each cell, not the cell size."
                ),
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    log.info(
        "grid.geojson: %d features (csv=%d), excluded=%d → %s | %.3f MB | drops=%s",
        len(features),
        len(df),
        len(excluded_rows),
        excluded_path.name,
        size_mb,
        drops,
    )
    print("\n=== Excluidas por banda 10° ===")
    for band, n in sorted(excluded_band.items()):
        print(f"  {band}: {n}")
    print(json.dumps({"size_mb": round(size_mb, 3), "out": str(out_path), "excluded": str(excluded_path)}, indent=2))
    return meta


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--in-csv", type=Path, default=DATA / "earth_features.csv")
    ap.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "frontend" / "public" / "data" / "grid.geojson",
    )
    ap.add_argument(
        "--excluded",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "frontend" / "public" / "data" / "grid_excluded.csv",
    )
    a = ap.parse_args()
    build_geojson(a.in_csv, a.out, a.excluded)


if __name__ == "__main__":
    main()
