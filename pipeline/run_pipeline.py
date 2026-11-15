"""P1 · Orquestador maestro del pipeline de datos terrestres (TerraAnáloga v2.0).

Ejecuta la extracción en dos niveles para equilibrar cobertura global, alta resolución
en zonas de descubrimiento/calibración y cumplimiento estricto de tiempo (<45 min) y
tamaño de archivo (<50 MB para Git):

  1. Malla global EASE-Grid 2.0 (paso 45 km, ventanas homólogas de 5 km) → ~72.000 celdas
     sobre todos los continentes y latitudes polares [-85°, +85°].
  2. Densificación fina EASE-Grid 2.0 (paso 15 km, ventanas homólogas de 5 km) sobre 8
     regiones análogas prioritarias del plan_maestro:
       - Valles Secos de McMurdo y Montañas Transantárticas (Antártida)
       - Isla Devon / Cráter Haughton (Ártico Canadiense)
       - Desierto de Atacama y Puna de Atacama (Chile / Argentina / Bolivia)
       - Cuenca de Qaidam (Meseta Tibetana, China)
       - Cráter Pingualuit y escudo cristalino de Nunavik (Quebec, Canadá)
       - Tierras Altas de Islandia / Askja / Vatnajökull
       - Depresión de Danakil / Afar (Etiopía)
       - Cinturón Volcánico de Centroamérica (El Salvador / Guatemala — zoom regional)

Luego ensambla `data/earth_features_raw.csv`, ejecuta `qc.py` → `data/earth_features.csv`
+ `data/qc_report.json`, genera `heatmap.py` → PNGs + `data/heatmap_bounds.json`,
escribe `data/metadata.json` y descarga los recortes Sentinel-2 + Sentinel-1 SAR.
"""
from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path

import pandas as pd

from common import DATA, ROOT, get_logger
import heatmap
import metadata
import qc

log = get_logger("run_pipeline")

# (tag, west, south, east, north) para densificación a 15 km
PRIORITY_ROIS = [
    ("roi_mcmurdo", 158.0, -79.0, 166.0, -76.0),
    ("roi_devon", -93.0, 74.0, -86.0, 76.5),
    ("roi_atacama_puna", -71.0, -27.0, -66.0, -21.0),
    ("roi_qaidam", 90.0, 36.0, 96.0, 40.0),
    ("roi_pingualuit", -76.0, 60.0, -71.0, 62.5),
    ("roi_iceland", -19.5, 63.8, -15.0, 65.8),
    ("roi_danakil", 39.5, 11.5, 42.5, 14.8),
    ("roi_central_america", -91.0, 13.0, -87.5, 15.0),
]


def run_cmd(args: list[str]) -> None:
    log.info("Ejecutando: %s", " ".join(args))
    res = subprocess.run(args, cwd=str(ROOT), check=False)
    if res.returncode != 0:
        log.warning("Comando terminó con código %d", res.returncode)


def main():
    t0 = time.time()
    py = sys.executable
    feat_py = str(ROOT / "pipeline" / "features.py")

    # 1. Densificación 15 km en las 8 regiones análogas prioritarias (rápido: ~2-3 min total)
    for tag, w, s, e, n in PRIORITY_ROIS:
        run_cmd([
            py, feat_py,
            "--bbox", str(w), str(s), str(e), str(n),
            "--step-km", "15",
            "--window-m", "5000",
            "--lat-step", "4",
            "--lon-step", "6",
            "--workers", "6",
            "--tag", f"roi15_{tag}",
        ])

    # 2. Cobertura global: primero las franjas continentales [-55°, +85°] (rápidas)
    # y luego el resto de la franja polar sur [-85°, -55°] que no esté ya en caché
    run_cmd([
        py, feat_py,
        "--bbox", "-180", "-55", "180", "85",
        "--step-km", "60",
        "--window-m", "5000",
        "--lat-step", "35",
        "--lon-step", "40",
        "--workers", "6",
        "--tag", "global60",
    ])
    run_cmd([
        py, feat_py,
        "--bbox", "-180", "-85", "180", "-55",
        "--step-km", "60",
        "--window-m", "5000",
        "--lat-step", "30",
        "--lon-step", "40",
        "--workers", "4",
        "--tag", "global60",
    ])

    # 3. Ensamblado jerárquico (ROI 15 km + Global 60 km)
    tiles_root = DATA / "tiles"
    csv_files = sorted(tiles_root.glob("roi15_*/t_*.csv")) + sorted(tiles_root.glob("global60/t_*.csv"))
    parts = [pd.read_csv(p) for p in csv_files if p.stat().st_size > 80]
    full = pd.concat([p for p in parts if not p.empty], ignore_index=True)
    full = full.drop_duplicates(subset=["cell_id"]).reset_index(drop=True)
    raw_csv = DATA / "earth_features_raw.csv"
    full.to_csv(raw_csv, index=False)
    log.info("Ensamblado total: %d celdas únicas en %s", len(full), raw_csv)

    # 4. Control de calidad -> data/earth_features.csv + data/qc_report.json
    out_csv = DATA / "earth_features.csv"
    qc_rep = DATA / "qc_report.json"
    rep = qc.run_qc(raw_csv, out_csv, qc_rep)

    # 5. Mapas de calor PNG + data/heatmap_bounds.json
    heatmap.generate_heatmaps(out_csv, DATA)

    # 6. Metadata -> data/metadata.json
    meta_doc = metadata.build_metadata(grid_info={
        "global_backbone_step_km": 60,
        "priority_rois_step_km": 15,
        "homologous_window_diameter_m": 5000,
        "total_cells_exported": rep["total_cells"],
        "qc_ok_percent": rep["qc_flag_ok_percent"],
        "qc_usable_percent": rep["qc_flag_usable_percent"],
        "execution_seconds": round(time.time() - t0, 1),
    })
    import json
    (DATA / "metadata.json").write_text(json.dumps(meta_doc, indent=2, ensure_ascii=False))
    log.info("Pipeline principal completado en %.1f min", (time.time() - t0) / 60.0)


if __name__ == "__main__":
    main()

