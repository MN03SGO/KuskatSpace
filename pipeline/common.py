"""Utilidades comunes P1: logging, init de GEE y constantes de datasets.

Las credenciales se leen SOLO de variables de entorno (cargadas desde `.env`
de la raíz si existe). Nunca se imprimen ni se escriben a disco.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
LOGS = ROOT / "pipeline" / "logs"

# --- IDs verificados en el catálogo STAC de GEE (2026-11-14) ---------------
DEM_ID = "COPERNICUS/DEM/GLO30_2024_1"   # sucesor de COPERNICUS/DEM/GLO30 (deprecado)
LST_ID = "MODIS/061/MOD11A2"             # LST 8 días 1 km, escala 0.02 K
SNOW_ID = "MODIS/061/MOD10A1"            # nieve diaria 500 m, NDSI_Snow_Cover 0-100
AOD_ID = "MODIS/061/MCD19A2_GRANULES"    # MAIAC AOD 1 km, escala 0.001
NDVI_ID = "MODIS/061/MOD13A2"            # NDVI 16 días 1 km, escala 0.0001
S1_ID = "COPERNICUS/S1_GRD"              # sustituto SAR de RADARSAT-1/RCM
S2_ID = "COPERNICUS/S2_SR_HARMONIZED"

# Climatología MODIS fija (reproducibilidad): 5 años completos
CLIM_START = "2019-01-01"
CLIM_END = "2024-01-01"  # exclusivo


def get_logger(name: str) -> logging.Logger:
    LOGS.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger(name)
    if not logger.handlers:
        fmt = logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s")
        sh = logging.StreamHandler()
        sh.setFormatter(fmt)
        fh = logging.FileHandler(LOGS / f"{name}.log")
        fh.setFormatter(fmt)
        logger.addHandler(sh)
        logger.addHandler(fh)
        logger.setLevel(logging.INFO)
    return logger


def load_env() -> None:
    """Carga `.env` en os.environ sin sobrescribir ni imprimir valores."""
    env = ROOT / ".env"
    if not env.exists():
        return
    for line in env.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def init_ee():
    import ee

    load_env()
    project = os.environ.get("GEE_PROJECT_ID")
    if not project:
        raise RuntimeError("Falta GEE_PROJECT_ID en el entorno/.env")
    ee.Initialize(project=project, opt_url="https://earthengine-highvolume.googleapis.com")
    return ee

