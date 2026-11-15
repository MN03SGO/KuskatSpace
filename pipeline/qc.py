"""P1 · Control de calidad (QC) sobre earth_features_raw.csv → earth_features.csv.

Valida el esquema exacto del contrato, verifica rangos físicos plausibles,
asigna el bitmask `qc_flag` por celda, reemplaza valores físicamente imposibles
por NaN, y escribe:
  * data/earth_features.csv (o la ruta --out)
  * data/qc_report.json (estadísticas, % de nulos, conteo por flag y prueba de cordura)

Bitmask `qc_flag` (entero):
  0  = OK (todas las variables presentes y dentro de rango físico)
  1  = Cobertura DEM incompleta (<50% de píxeles válidos en la ventana de 5 km)
  2  = LST nulo (alguno de lst_mean, lst_min, lst_max, lst_amp es nulo)
  4  = Nieve nula (snow_persist es nulo)
  8  = AOD nulo (aod_mean o aod_p90 es nulo; frecuente en criósfera extrema por alto albedo)
  16 = NDVI nulo (ndvi_mean o ndvi_max es nulo)
  32 = Valor fuera de rango físico detectado y enmascarado a NaN
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

from common import DATA, get_logger

log = get_logger("qc")

CONTRACT_COLS = [
    "cell_id", "lat", "lon",
    "elev_m", "slope_mean", "slope_p90", "relief_local",
    "shadow_frac_d1", "shadow_frac_d2", "shadow_frac_d3", "shadow_frac_d4",
    "lst_mean", "lst_min", "lst_max", "lst_amp",
    "snow_persist", "aod_mean", "aod_p90", "ndvi_mean", "ndvi_max",
    "qc_flag",
]

# Rangos físicos plausibles en la superficie terrestre
PHYSICAL_RANGES: dict[str, tuple[float, float]] = {
    "lat": (-90.0, 90.0),
    "lon": (-180.0, 180.0),
    "elev_m": (-500.0, 9000.0),         # Depresión del Mar Muerto (-430 m) a Everest (8849 m)
    "slope_mean": (0.0, 90.0),
    "slope_p90": (0.0, 90.0),
    "relief_local": (0.0, 6000.0),      # Desnivel máximo en ventana de 5 km
    "shadow_frac_d1": (0.0, 1.0),
    "shadow_frac_d2": (0.0, 1.0),
    "shadow_frac_d3": (0.0, 1.0),
    "shadow_frac_d4": (0.0, 1.0),
    "lst_mean": (170.0, 355.0),         # ~175 K Vostok invierno a ~350 K Lut verano
    "lst_min": (160.0, 340.0),
    "lst_max": (180.0, 365.0),
    "lst_amp": (-15.0, 80.0),           # Día - Noche medio; puede ser levemente <0 en invierno polar
    "snow_persist": (0.0, 1.0),
    "aod_mean": (0.0, 5.0),
    "aod_p90": (0.0, 5.0),
    "ndvi_mean": (-1.0, 1.0),
    "ndvi_max": (-1.0, 1.0),
}

# Sitios de calibración y descubrimiento del plan_maestro (lat, lon, nombre)
REFERENCE_SITES = [
    ("mcmurdo_dry_valleys", -77.55, 161.85, "Valles Secos de McMurdo (calibración)"),
    ("devon_island_haughton", 75.38, -89.68, "Isla Devon / Cráter Haughton (calibración)"),
    ("atacama_hyperarid", -23.00, -69.00, "Núcleo hiperárido de Atacama (calibración)"),
    ("qaidam_basin", 38.12, 92.45, "Cuenca de Qaidam (descubrimiento P3)"),
    ("pingualuit_crater", 61.28, -73.66, "Cráter Pingualuit, Nunavik (descubrimiento P3)"),
    ("puna_atacama_salar", -25.15, -67.85, "Puna de Atacama / Salares altos (descubrimiento)"),
    ("iceland_highlands", 64.85, -16.75, "Tierras Altas de Islandia / Askja (calibración)"),
    ("central_america_volcanic", 13.85, -89.63, "Campo Volcánico Santa Ana / Izalco, C.A. (zoom regional)"),
]


def run_qc(in_path: Path, out_path: Path, report_path: Path) -> dict:
    df = pd.read_csv(in_path)
    df = df.drop_duplicates(subset=["cell_id"]).sort_values(["lat", "lon"]).reset_index(drop=True)

    flags = np.zeros(len(df), dtype=np.int32)
    out_of_range_counts: dict[str, int] = {}

    # 1. Cobertura DEM
    if "_dem_cov" in df.columns:
        low_dem = df["_dem_cov"].isna() | (df["_dem_cov"] < 0.5)
        flags |= np.where(low_dem, 1, 0)

    # 2. Validación de rangos físicos
    for col, (vmin, vmax) in PHYSICAL_RANGES.items():
        if col not in df.columns:
            df[col] = np.nan
            continue
        s = pd.to_numeric(df[col], errors="coerce")
        bad = s.notna() & ((s < vmin) | (s > vmax))
        n_bad = int(bad.sum())
        out_of_range_counts[col] = n_bad
        if n_bad > 0:
            flags |= np.where(bad, 32, 0)
            s = s.mask(bad, np.nan)
        df[col] = s

    # 3. Flags de nulos por familia de sensores
    lst_null = df[["lst_mean", "lst_min", "lst_max", "lst_amp"]].isna().any(axis=1)
    snow_null = df["snow_persist"].isna()
    aod_null = df[["aod_mean", "aod_p90"]].isna().any(axis=1)
    ndvi_null = df[["ndvi_mean", "ndvi_max"]].isna().any(axis=1)

    flags |= np.where(lst_null, 2, 0)
    flags |= np.where(snow_null, 4, 0)
    flags |= np.where(aod_null, 8, 0)
    flags |= np.where(ndvi_null, 16, 0)

    df["qc_flag"] = flags

    # Redondeo limpio para reducir tamaño de CSV sin perder precisión física
    round_map = {
        "lat": 5, "lon": 5,
        "elev_m": 2, "slope_mean": 3, "slope_p90": 3, "relief_local": 2,
        "shadow_frac_d1": 4, "shadow_frac_d2": 4, "shadow_frac_d3": 4, "shadow_frac_d4": 4,
        "lst_mean": 2, "lst_min": 2, "lst_max": 2, "lst_amp": 2,
        "snow_persist": 4, "aod_mean": 4, "aod_p90": 4, "ndvi_mean": 4, "ndvi_max": 4,
    }
    for col, nd in round_map.items():
        df[col] = df[col].round(nd)

    out_df = df[CONTRACT_COLS]
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_df.to_csv(out_path, index=False)

    # Búsqueda de celda más cercana a cada sitio de referencia (prueba de cordura para P3)
    sanity_sites = {}
    if len(out_df) > 0:
        lats = out_df["lat"].to_numpy()
        lons = out_df["lon"].to_numpy()
        for sid, slat, slon, label in REFERENCE_SITES:
            d2 = (lats - slat) ** 2 + ((lons - slon) * np.cos(np.radians(slat))) ** 2
            idx = int(np.argmin(d2))
            dist_km = float(np.sqrt(d2[idx]) * 111.32)
            row = out_df.iloc[idx].to_dict()
            row["dist_km"] = round(dist_km, 2)
            row["label"] = label
            sanity_sites[sid] = row

    # Resumen estadístico
    null_pct = {c: round(float(out_df[c].isna().mean() * 100), 2) for c in CONTRACT_COLS}
    stats = {}
    for c in CONTRACT_COLS[1:-1]:
        s = out_df[c].dropna()
        if len(s) > 0:
            stats[c] = {
                "min": round(float(s.min()), 4),
                "p10": round(float(s.quantile(0.10)), 4),
                "median": round(float(s.median()), 4),
                "mean": round(float(s.mean()), 4),
                "p90": round(float(s.quantile(0.90)), 4),
                "max": round(float(s.max()), 4),
            }

    flag_counts = {str(k): int(v) for k, v in out_df["qc_flag"].value_counts().sort_index().items()}
    report = {
        "total_cells": int(len(out_df)),
        "unique_cell_ids": int(out_df["cell_id"].nunique()),
        "contract_columns": CONTRACT_COLS,
        "null_percent_by_column": null_pct,
        "out_of_range_masked_counts": out_of_range_counts,
        "qc_flag_distribution": flag_counts,
        "qc_flag_ok_percent": round(float((out_df["qc_flag"] == 0).mean() * 100), 2) if len(out_df) else 0.0,
        "qc_flag_usable_percent": round(float(out_df["qc_flag"].isin([0, 8]).mean() * 100), 2) if len(out_df) else 0.0,
        "summary_stats": stats,
        "reference_sites_nearest_cell": sanity_sites,
    }
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False))
    log.info("QC completado: %d celdas → %s | OK=%s%% usable(0|8)=%s%%",
             len(out_df), out_path, report["qc_flag_ok_percent"], report["qc_flag_usable_percent"])
    return report


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--in-csv", type=Path, default=DATA / "earth_features_raw.csv")
    ap.add_argument("--out-csv", type=Path, default=DATA / "earth_features.csv")
    ap.add_argument("--report", type=Path, default=DATA / "qc_report.json")
    a = ap.parse_args()
    run_qc(a.in_csv, a.out_csv, a.report)


if __name__ == "__main__":
    main()

