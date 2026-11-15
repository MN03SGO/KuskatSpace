"""
Cálculo Matemático de Similitud Planetaria (Escala Híbrida Directa + Relativa)
=============================================================================
Proyecto: TerraAnáloga - NASA Space Apps Challenge 2026

Lee las métricas reales extraídas por fetch_planetary_computer.py y los perfiles
de data/targets.json para generar data/candidates.json:
- Relieve e Iluminación (0.6 * svf_score + 0.4 * lat_score): s = exp(-|x - t| / sigma)
- Frío e Hielo:
  * moon_south_pole y mars: normalización Min-Max relativa al rango terrestre
    (menor LST = 1.0, mayor persistencia de hielo = 1.0).
  * moon_lava_tube: comparación directa s = exp(-|x - t| / sigma) contra
    (253.15 K, sigma=25.0) y (0.0, sigma=0.10).
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any, Dict, List, Optional

PIPELINE_DIR = Path(__file__).resolve().parent
ROOT_DIR = PIPELINE_DIR.parent
DATA_DIR = ROOT_DIR / "data"
TARGETS_PATH = DATA_DIR / "targets.json"
CANDIDATES_PATH = DATA_DIR / "candidates.json"
CACHE_PATH = PIPELINE_DIR / "cache_points.jsonl"


def exp_similarity(value: float, target: float, sigma: float) -> float:
    """Fórmula exponencial s_d = exp(-|x_d - t_d| / sigma_d) acotada en [0.0, 1.0]."""
    if sigma <= 0:
        return 0.0
    score = math.exp(-abs(value - target) / sigma)
    return round(max(0.0, min(1.0, score)), 4)


def load_targets(targets_path: Path = TARGETS_PATH) -> Dict[str, Dict[str, Any]]:
    with open(targets_path, "r", encoding="utf-8") as f:
        targets = json.load(f)
    return {t["_id"]: t for t in targets}


def _minmax_norm(values: List[float], val: float, lower_is_better: bool) -> float:
    v_min = min(values)
    v_max = max(values)
    if math.isclose(v_max, v_min, rel_tol=1e-9, abs_tol=1e-9):
        return 1.0 if (lower_is_better or val > 0.0) else 0.0
    if lower_is_better:
        norm = (v_max - val) / (v_max - v_min)
    else:
        norm = (val - v_min) / (v_max - v_min)
    return round(max(0.0, min(1.0, norm)), 4)


def compute_scores_for_records(
    records: List[Dict[str, Any]],
    targets_by_id: Optional[Dict[str, Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    """Calcula scores híbridos para cada registro válido y omite registros incompletos."""
    targets = targets_by_id if targets_by_id is not None else load_targets()

    valid: List[Dict[str, Any]] = []
    for r in records:
        m = r.get("metrics") or {}
        if (
            m.get("slope_mean_deg") is None
            or m.get("svf") is None
            or m.get("lst_mean_k") is None
            or m.get("ice_persistence") is None
        ):
            continue
        if r.get("target") not in targets:
            continue
        valid.append(r)

    # Agrupar valores por objetivo para normalización relativa terrestre (moon_south_pole, mars)
    by_target: Dict[str, List[Dict[str, Any]]] = {}
    for r in valid:
        by_target.setdefault(r["target"], []).append(r)

    scored_candidates: List[Dict[str, Any]] = []

    for target_id, group in by_target.items():
        params = targets[target_id]["scoring_params"]
        lst_values = [float(r["metrics"]["lst_mean_k"]) for r in group]
        ice_values = [float(r["metrics"]["ice_persistence"]) for r in group]

        for r in group:
            m = r["metrics"]
            coords = r.get("location", {}).get("coordinates", [r.get("lon", 0.0), r.get("lat", 0.0)])
            lat = float(r.get("lat", coords[1]))

            slope = float(m["slope_mean_deg"])
            svf = float(m["svf"])
            lst_k = float(m["lst_mean_k"])
            ice = float(m["ice_persistence"])

            # 1. Relieve (directo)
            rel_p = params["relieve"]
            s_relieve = exp_similarity(slope, float(rel_p["slope_deg"]), float(rel_p["sigma"]))

            # 2. Iluminación (0.6 * svf_score + 0.4 * lat_score)
            ilu_p = params["iluminacion"]
            s_svf = exp_similarity(svf, float(ilu_p["svf_target"]), float(ilu_p["svf_sigma"]))
            s_lat = exp_similarity(abs(lat), float(ilu_p["lat_target"]), float(ilu_p["lat_sigma"]))
            w_svf = float(ilu_p.get("weights", {}).get("svf", 0.6))
            w_lat = float(ilu_p.get("weights", {}).get("lat", 0.4))
            s_iluminacion = round(max(0.0, min(1.0, w_svf * s_svf + w_lat * s_lat)), 4)

            # 3. Frío (relativo Min-Max o directo)
            frio_p = params["frio"]
            if frio_p["mode"] == "direct":
                s_frio = exp_similarity(lst_k, float(frio_p["temp_target_k"]), float(frio_p["sigma"]))
            else:
                s_frio = _minmax_norm(lst_values, lst_k, lower_is_better=True)

            # 4. Hielo (relativo Min-Max o directo)
            hielo_p = params["hielo"]
            if hielo_p["mode"] == "direct":
                s_hielo = exp_similarity(ice, float(hielo_p["ice_target"]), float(hielo_p["sigma"]))
            else:
                s_hielo = _minmax_norm(ice_values, ice, lower_is_better=False)

            scores = {
                "relieve": s_relieve,
                "iluminacion": s_iluminacion,
                "frio": s_frio,
                "hielo": s_hielo,
            }

            candidate = {
                "_id": r["_id"],
                "name": r["name"],
                "country": r.get("country"),
                "target": target_id,
                "analog_type": r.get("analog_type", "morphologic"),
                "is_understudied": bool(r.get("is_understudied", False)),
                "is_curated": bool(r.get("is_curated", False)),
                "location": {
                    "type": "Point",
                    "coordinates": [float(coords[0]), float(coords[1])],
                },
                "metrics": m,
                "scores": scores,
                "similar_values": r.get("similar_values", []),
                "similar_processes": r.get("similar_processes", []),
                "earth_limits": r.get("earth_limits", []),
                "exploration_use": r.get("exploration_use", "Validación de campo para operaciones planetarias análogas."),
                "datasets": r.get("datasets", ["cop-dem-glo-90", "modis-11A2-061", "modis-10A2-061", "esa-worldcover"]),
            }
            scored_candidates.append(candidate)

    return scored_candidates


def compute_and_export_candidates(
    records: Optional[List[Dict[str, Any]]] = None,
    output_path: Path = CANDIDATES_PATH,
    cache_path: Path = CACHE_PATH,
) -> List[Dict[str, Any]]:
    """Calcula puntajes y guarda data/candidates.json."""
    if records is None:
        records = []
        if cache_path.exists():
            with open(cache_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        rec = json.loads(line)
                        if rec.get("status") == "ok":
                            records.append(rec)
                    except json.JSONDecodeError:
                        continue

    candidates = compute_scores_for_records(records)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(candidates, f, indent=2, ensure_ascii=False)
    return candidates


if __name__ == "__main__":
    exported = compute_and_export_candidates()
    print(f"[*] Calculados y exportados {len(exported)} candidatos a {CANDIDATES_PATH}")
