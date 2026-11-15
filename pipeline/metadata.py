"""P1 · Generador de metadata.json (catálogo oficial de fuentes, versiones, fechas y licencias).

Consumido por P6 (documentación técnica, tabla de fuentes/licencias y slides)
y por P2/P3/P4 para trazabilidad de `datasets_used` en `candidates.json`.
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from common import (AOD_ID, CLIM_END, CLIM_START, DATA, DEM_ID, LST_ID, NDVI_ID,
                    S1_ID, S2_ID, get_logger)

log = get_logger("metadata")


def build_metadata(grid_info: dict | None = None) -> dict:
    return {
        "project": "TerraAnáloga v2.0 — NASA Space Apps Challenge 2026",
        "role": "P1 — Ingeniero de Datos Terrestres (Jorge)",
        "generated_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "homologous_scale_protocol": {
            "base_dem_resolution_m": 30,
            "homologous_resampled_resolution_m": 240,
            "cell_evaluation_window_diameter_m": 5000,
            "projection_grid": "WGS 84 / NSIDC EASE-Grid 2.0 Global (EPSG:6933 equal-area)",
            "output_crs": "EPSG:4326 (WGS84)",
            "rationale": (
                "El DEM terrestre (Copernicus 30 m) se remuestrea a 240 m en proyección "
                "de igual área antes de calcular pendiente, relieve local y sombra solar, "
                "igualando la escala espacial de LRO LOLA (~240 m) y MGS MOLA (~240-463 m) "
                "evaluados sobre ventanas circulares homólogas de 5 km de diámetro."
            ),
            "grid_execution": grid_info or {},
        },
        "solar_shadow_protocol": {
            "dates": {
                "d1": {"date": "2024-03-20", "solar_declination_deg": 0.0, "event": "Equinoccio de marzo"},
                "d2": {"date": "2024-06-20", "solar_declination_deg": 23.44, "event": "Solsticio de junio"},
                "d3": {"date": "2024-09-22", "solar_declination_deg": 0.0, "event": "Equinoccio de septiembre"},
                "d4": {"date": "2024-12-21", "solar_declination_deg": -23.44, "event": "Solsticio de diciembre"},
            },
            "method": (
                "ee.Terrain.hillShadow(dem240, azimut_mediodia, cenit=90-h, neighborhoodSize=100 px = 24 km) "
                "combinado con auto-sombra topográfica (hillshade <= 0) al mediodía solar local "
                "(h = 90° - |lat - declinación|). Si h <= 0° (noche polar), shadow_frac = 1.0."
            ),
            "lunar_psr_justification": (
                "En el Polo Sur Lunar el Sol mantiene una elevación rasante (~1.5°). En la Tierra, "
                "a latitudes >65° durante el solsticio invernal, la elevación al mediodía es 0°-1.5°, "
                "reproduciendo la misma geometría de sombra proyectada a larga distancia en depresiones y cráteres."
            ),
        },
        "datasets": [
            {
                "key": "copernicus_dem",
                "agency": "ESA / Copernicus",
                "title": "Copernicus DEM GLO-30: Global 30m Digital Elevation Model (Release 2024_1)",
                "gee_id": DEM_ID,
                "deprecated_predecessor": "COPERNICUS/DEM/GLO30",
                "version": "2024_1 (DGED, datum vertical EGM2008 / EPSG:3855)",
                "temporal_coverage": ["2010-12-01", "2020-11-13"],
                "native_resolution_m": 30,
                "processing_resolution_m": 240,
                "variables_extracted": ["elev_m", "slope_mean", "slope_p90", "relief_local",
                                        "shadow_frac_d1", "shadow_frac_d2", "shadow_frac_d3", "shadow_frac_d4"],
                "license": "Copernicus DEM License (acceso libre y abierto mundial salvo Armenia y Azerbaiyán)",
                "citation_url": "https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM",
            },
            {
                "key": "modis_lst",
                "agency": "NASA EOSDIS / LP DAAC",
                "title": "MOD11A2.061 Terra Land Surface Temperature and Emissivity 8-Day Global 1km",
                "gee_id": LST_ID,
                "doi": "10.5067/MODIS/MOD11A2.061",
                "version": "Collection 6.1 (061)",
                "climatology_window": [CLIM_START, "2023-12-31"],
                "native_resolution_m": 1000,
                "scale_factor": 0.02,
                "unit": "Kelvin (K)",
                "variables_extracted": ["lst_mean", "lst_min", "lst_max", "lst_amp"],
                "license": "NASA Open Data Policy (dominio público / sin restricciones de reutilización)",
                "citation_url": "https://doi.org/10.5067/MODIS/MOD11A2.061",
            },
            {
                "key": "modis_snow",
                "agency": "NASA EOSDIS / NSIDC DAAC",
                "title": "MOD10A2.061 Terra Snow Cover 8-Day L3 Global 500m",
                "gee_id": "MODIS/061/MOD10A2",
                "doi": "10.5067/MODIS/MOD10A2.061",
                "version": "Collection 6.1 (061)",
                "climatology_window": [CLIM_START, "2023-12-31"],
                "native_resolution_m": 500,
                "processing_resolution_m": 1000,
                "unit": "Fracción adimensional [0, 1] de compuestos de 8 días con nieve (clase 200)",
                "variables_extracted": ["snow_persist"],
                "license": "NASA Open Data Policy (dominio público)",
                "citation_url": "https://doi.org/10.5067/MODIS/MOD10A2.061",
            },
            {
                "key": "modis_aod",
                "agency": "NASA EOSDIS / LP DAAC",
                "title": "MCD19A2.061 Terra & Aqua MAIAC Land Aerosol Optical Depth Daily 1km",
                "gee_id": AOD_ID,
                "doi": "10.5067/MODIS/MCD19A2.061",
                "version": "Collection 6.1 (061)",
                "climatology_window": ["2023-01-01", "2023-12-31 (muestreo quincenal días 1-2 y 15-16 / MERRA-2 respaldo)"],
                "native_resolution_m": 1000,
                "scale_factor": 0.001,
                "unit": "Espesor óptico de aerosoles a 550 nm (adimensional)",
                "variables_extracted": ["aod_mean", "aod_p90"],
                "license": "NASA Open Data Policy (dominio público)",
                "citation_url": "https://doi.org/10.5067/MODIS/MCD19A2.061",
            },
            {
                "key": "modis_ndvi",
                "agency": "NASA EOSDIS / LP DAAC",
                "title": "MOD13A2.061 Terra Vegetation Indices 16-Day Global 1km",
                "gee_id": NDVI_ID,
                "doi": "10.5067/MODIS/MOD13A2.061",
                "version": "Collection 6.1 (061)",
                "climatology_window": [CLIM_START, "2023-12-31"],
                "native_resolution_m": 1000,
                "scale_factor": 0.0001,
                "unit": "NDVI [-1, 1]",
                "variables_extracted": ["ndvi_mean", "ndvi_max"],
                "license": "NASA Open Data Policy (dominio público)",
                "citation_url": "https://doi.org/10.5067/MODIS/MOD13A2.061",
            },
            {
                "key": "sentinel2_sr",
                "agency": "ESA / Copernicus",
                "title": "Harmonized Sentinel-2 MSI: MultiSpectral Instrument, Level-2A (Surface Reflectance)",
                "gee_id": S2_ID,
                "version": "Level-2A Harmonized",
                "temporal_coverage": ["2019-01-01", "2024-12-31"],
                "native_resolution_m": 10,
                "variables_extracted": ["Recortes ópticos RGB en color verdadero para fichas de candidatos Top"],
                "license": "Copernicus Sentinel Data Terms and Conditions (libre y abierto)",
                "citation_url": "https://dataspace.copernicus.eu/",
            },
            {
                "key": "sentinel1_sar_substitute",
                "agency": "ESA / Copernicus (sustituto operativo de CSA RADARSAT-1 / RCM)",
                "title": "Sentinel-1 SAR GRD: C-band Synthetic Aperture Radar Ground Range Detected (log scaling)",
                "gee_id": S1_ID,
                "version": "GRD IW/EW C-Band (5.405 GHz — misma banda C que RADARSAT-1 y RCM)",
                "temporal_coverage": ["2019-01-01", "2024-12-31"],
                "native_resolution_m": 10,
                "variables_extracted": [
                    "Retrodispersión radar en banda C (dB, filtro Lee speckle) para comparación de rugosidad con LRO Mini-RF"
                ],
                "deviation_note": (
                    "Desviación D2 documentada en PLAN_P1.md: ante la falta de descarga directa de escenas "
                    "RADARSAT-1/RCM en el tiempo del reto, se emplea Sentinel-1 C-band GRD junto con el "
                    "flujo de calibración sigma0 + filtro Lee del tutorial SAR de la CSA."
                ),
                "license": "Copernicus Sentinel Data Terms and Conditions (libre y abierto)",
                "citation_url": "https://www.asc-csa.gc.ca/eng/satellites/radarsat/radarsat-tutorial.asp",
            },
        ],
        "deviations_logged": [
            {
                "id": "D1",
                "summary": "COPERNICUS/DEM/GLO30 deprecado en GEE → migrado a COPERNICUS/DEM/GLO30_2024_1.",
            },
            {
                "id": "D2",
                "summary": "RADARSAT-1/RCM sustituido operativamente por Sentinel-1 GRD (banda C) + filtro Lee CSA.",
            },
            {
                "id": "D3",
                "summary": "JAXA G-Portal con aprobación pendiente → persistencia criosférica medida con MODIS MOD10A2.",
            },
            {
                "id": "D4",
                "summary": "Grilla optimizada con prefiltrado de ambientes análogos sin vegetación densa + ventanas homólogas de 5 km para cumplir presupuesto de 5 h y cuota EECU.",
            },
        ],
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", type=Path, default=DATA / "metadata.json")
    a = ap.parse_args()
    a.out.parent.mkdir(parents=True, exist_ok=True)
    doc = build_metadata()
    a.out.write_text(json.dumps(doc, indent=2, ensure_ascii=False))
    log.info("Metadata escrita en %s", a.out)


if __name__ == "__main__":
    main()

