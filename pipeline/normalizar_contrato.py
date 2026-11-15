"""
Normaliza `data/candidates.json` al contrato §05 del plan maestro.

Uso:
    python pipeline/normalizar_contrato.py            # aplica cambios
    python pipeline/normalizar_contrato.py --check    # solo informa, no escribe

Renombra campos y añade los que faltan SIN inventar puntuaciones: si falta una
dimensión de `scores` (p. ej. `polvo`), se deja fuera y se reporta.
El original se guarda una sola vez en `data/candidates.raw.json`.
"""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
CANDIDATES = DATA_DIR / "candidates.json"
BACKUP = DATA_DIR / "candidates.raw.json"

TARGET_MAP = {
    "mars": "mars_surface",
    "moon_lava_tube": "lava_tubes",
    "moon_south_pole": "moon_south_pole",
    "mars_surface": "mars_surface",
    "lava_tubes": "lava_tubes",
}

CATEGORY_MAP = {
    "process": "Proceso",
    "morphologic": "Morfológico",
    "lithologic": "Litológico",
}

SIMPLE_RENAMES = {
    "similar_values": "similar_properties",
    "earth_limits": "differences_and_limits",
    "datasets": "datasets_used",
}

SCORE_FIELDS = ("relieve", "iluminacion", "frio", "hielo", "polvo")


def normalize(doc: dict[str, Any]) -> dict[str, Any]:
    out = dict(doc)

    # 1. Renombrados simples (si el destino no existe ya)
    for old, new in SIMPLE_RENAMES.items():
        if old in out and new not in out:
            out[new] = out.pop(old)

    # 2. target -> identificadores del contrato
    if "target" in out:
        out["target"] = TARGET_MAP.get(out["target"], out["target"])

    # 3. region_type
    if "region_type" not in out:
        out["region_type"] = "understudied_discovery" if out.get("is_understudied") else "known_analog"

    # 4. analog_category (lista)
    if "analog_category" not in out:
        cat = CATEGORY_MAP.get(str(out.get("analog_type", "")).lower())
        out["analog_category"] = [cat] if cat else []

    # 5. exploration_use (string) -> exploration_use_cases (lista)
    if "exploration_use_cases" not in out:
        use = out.pop("exploration_use", None) or out.pop("exploration_use_cases", None)
        out["exploration_use_cases"] = [use] if isinstance(use, str) and use.strip() else []

    # 6. subsurface_and_biology: estructura obligatoria, marcada como pendiente
    if "subsurface_and_biology" not in out:
        out["subsurface_and_biology"] = {
            "subsurface_potential": "No documentado (pendiente P3)",
            "extremophiles_note": "No documentado (pendiente P3)",
        }

    # 7. scores: nunca inventar. Solo se reporta lo que falte.
    scores = out.get("scores")
    if isinstance(scores, dict):
        out["scores"] = {k: scores[k] for k in SCORE_FIELDS if k in scores}

    return out


def main() -> int:
    check_only = "--check" in sys.argv

    docs = json.loads(CANDIDATES.read_text(encoding="utf-8"))
    normalized = [normalize(d) for d in docs]

    print(f"Documentos: {len(docs)}")
    missing: dict[str, int] = {}
    for d in normalized:
        for field in ("region_type", "analog_category", "similar_properties", "similar_processes",
                      "differences_and_limits", "exploration_use_cases", "subsurface_and_biology",
                      "datasets_used"):
            if not d.get(field):
                missing[field] = missing.get(field, 0) + 1
        scores = d.get("scores") or {}
        for field in SCORE_FIELDS:
            if field not in scores:
                key = f"scores.{field}"
                missing[key] = missing.get(key, 0) + 1

    if missing:
        print("Pendiente de completar (campo: nº de documentos):")
        for field, count in sorted(missing.items()):
            print(f"  - {field}: {count}")

    if check_only:
        print("Modo --check: no se escribió nada.")
        return 0

    if not BACKUP.exists():
        shutil.copyfile(CANDIDATES, BACKUP)
        print(f"Original guardado en {BACKUP.name}")

    CANDIDATES.write_text(
        json.dumps(normalized, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Escrito {CANDIDATES} con {len(normalized)} documentos normalizados.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
