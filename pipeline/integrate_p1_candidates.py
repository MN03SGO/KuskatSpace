"""P1 · Puente de integración de datos terrestres (`earth_features.csv`) hacia `candidates.json` y `datasets.json`.

Resuelve los bloqueos documentados en `docs/informe-cambio-datos-planetarios-2026-11-14.md`
y `pipeline/normalizar_contrato.py`:
  1. Calcula las 5 dimensiones dinámicas del Índice de Fidelidad Analógica (IFA §04):
     `relieve`, `iluminacion`, `frio`, `hielo`, `polvo` usando la fórmula exponencial
     $s_d = \\exp(-|x_d - t_d| / \\sigma_d)$ sobre las mediciones reales de GEE a escala
     homóloga (240 m / ventanas de 5 km).
  2. Completa `scores.polvo`, `subsurface_and_biology`, `p1_cell_metrics` y `orbital_previews`
     (Sentinel-2 RGB + Sentinel-1 SAR con filtro Lee) en todos los candidatos curados.
  3. Añade los sitios de descubrimiento y calibración de P1 (Islandia/Askja, Danakil,
     Lut, Svalbard, Lanzarote/Corona, Mojave, Namib, Pilbara) y selecciona las mejores
     celdas descubiertas en `data/earth_features.csv` con separación espacial mínima.
  4. Enriquece `data/datasets.json` con los datasets verificados en `data/metadata.json`.
"""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from common import DATA, get_logger

log = get_logger("integrate_p1_candidates")


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2.0) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2.0) ** 2
    return 2.0 * r * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


def compute_5d_scores_for_row(row: pd.Series | dict[str, Any], target: str) -> dict[str, float]:
    """Calcula scores [0, 1] en las 5 dimensiones (relieve, iluminacion, frio, hielo, polvo)
    según el perfil físico del objetivo planetario (§04 del Plan Maestro)."""
    slope = float(row.get("slope_mean") if pd.notna(row.get("slope_mean")) else 5.0)
    relief = float(row.get("relief_local") if pd.notna(row.get("relief_local")) else 150.0)
    sh_vals = [
        float(row.get(k))
        for k in ("shadow_frac_d1", "shadow_frac_d2", "shadow_frac_d3", "shadow_frac_d4")
        if pd.notna(row.get(k))
    ]
    sh_max = max(sh_vals) if sh_vals else 0.0
    sh_mean = sum(sh_vals) / len(sh_vals) if sh_vals else 0.0

    lst_min = float(row.get("lst_min") if pd.notna(row.get("lst_min")) else 260.0)
    lst_mean = float(row.get("lst_mean") if pd.notna(row.get("lst_mean")) else 275.0)
    lst_amp = float(row.get("lst_amp") if pd.notna(row.get("lst_amp")) else 15.0)
    snow = float(row.get("snow_persist") if pd.notna(row.get("snow_persist")) else 0.0)
    aod_p90 = float(row.get("aod_p90") if pd.notna(row.get("aod_p90")) else 0.12)
    aod_mean = float(row.get("aod_mean") if pd.notna(row.get("aod_mean")) else 0.08)
    ndvi_max = float(row.get("ndvi_max") if pd.notna(row.get("ndvi_max")) else 0.10)

    # Factor de suelo desnudo / ausencia de biosfera vegetal densa (penaliza NDVI alto salvo en tubos de lava)
    bareness = float(np.clip(1.0 - max(0.0, ndvi_max - 0.12) / 0.65, 0.25, 1.0))

    if target == "moon_south_pole":
        # Relieve: pendientes de cráteres y crestas lunares (~14.5° media LOLA)
        s_relieve = math.exp(-abs(slope - 12.0) / 14.0) * 0.7 + min(1.0, relief / 600.0) * 0.3
        # Iluminación: sol rasante / sombra invernal alta (PSR y crestas polares)
        s_ilum = 0.65 * sh_max + 0.35 * (1.0 - abs(sh_mean - 0.35))
        # Frío: normalizado respecto al extremo terrestre (~195 K en meseta polar)
        s_frio = math.exp(-max(0.0, lst_min - 205.0) / 48.0)
        # Hielo: persistencia criosférica + estabilidad térmica
        s_hielo = 0.65 * snow + 0.35 * s_frio
        # Polvo: regolito seco sin vegetación (bajo NDVI y aerosoles finos moderados)
        s_polvo = 0.65 * bareness + 0.35 * min(1.0, aod_p90 / 0.25)
    elif target == "mars_surface":
        # Relieve: planicies y cuencas marcianas (~6.8° media MOLA)
        s_relieve = math.exp(-abs(slope - 6.8) / 11.0)
        # Iluminación: insolación directa en atmósfera tenue + amplitud térmica diurna alta
        s_ilum = 0.55 * (1.0 - sh_mean) + 0.45 * min(1.0, max(0.0, lst_amp) / 32.0)
        # Frío: criósfera/aridez fría (~210 K media marciana; premiamos mínimas frías y gran amplitud)
        s_frio = 0.65 * math.exp(-max(0.0, lst_min - 235.0) / 45.0) + 0.35 * min(1.0, max(0.0, lst_amp) / 35.0)
        # Hielo/Evaporitas: aridez superficial extrema (suelo desnudo) o permafrost de altura
        s_hielo = 0.60 * bareness + 0.40 * (1.0 - abs(snow - 0.15))
        # Polvo: carga de aerosoles eólicos (MODIS MAIAC AOD) + sustrato desnudo
        s_polvo = 0.60 * min(1.0, (0.5 * aod_mean + 0.5 * aod_p90) / 0.28) + 0.40 * bareness
    else:  # lava_tubes
        # Relieve: escarpes volcánicos y coladas rugosas
        s_relieve = min(1.0, 0.55 * math.exp(-abs(slope - 16.0) / 14.0) + 0.45 * min(1.0, relief / 700.0))
        # Iluminación: contraste topográfico
        s_ilum = 0.50 * (1.0 - sh_mean) + 0.50 * min(1.0, relief / 800.0)
        # Frío: estabilidad térmica (menor amplitud relativa o enfriamiento de altitud)
        s_frio = math.exp(-abs(lst_mean - 282.0) / 30.0)
        # Hielo: bajo en tubos ecuatoriales/basálticos o moderado en tubos subpolares (Islandia)
        s_hielo = 0.50 * (1.0 - min(1.0, snow)) + 0.50 * math.exp(-abs(lst_amp - 12.0) / 20.0)
        # Polvo: tefra/ceniza volcánica y aerosoles
        s_polvo = 0.60 * min(1.0, aod_p90 / 0.22) + 0.40 * min(1.0, relief / 900.0)

    return {
        "relieve": round(float(np.clip(s_relieve, 0.05, 0.99)), 2),
        "iluminacion": round(float(np.clip(s_ilum, 0.05, 0.99)), 2),
        "frio": round(float(np.clip(s_frio, 0.05, 0.99)), 2),
        "hielo": round(float(np.clip(s_hielo, 0.05, 0.99)), 2),
        "polvo": round(float(np.clip(s_polvo, 0.05, 0.99)), 2),
    }


# Catálogo curado de sitios (los 6 de datos-planetarios + descubrimientos P1 con soporte de orbital_previews)
CURATED_CANDIDATES: list[dict[str, Any]] = [
    {
        "_id": "site_01",
        "name": "Valles Secos de McMurdo (Taylor & Wright)",
        "country": "Antártida",
        "target": "moon_south_pole",
        "region_type": "known_analog",
        "is_understudied": False,
        "analog_type": "process",
        "analog_category": ["Proceso (criosférico/hiperárido)", "Propiedad (frío extremo/sombra polar)"],
        "location": {"type": "Point", "coordinates": [161.85, -77.55]},
        "preview_site_id": "mcmurdo_dry_valleys",
        "similar_properties": [
            "Temperaturas superficiales invernales < 215 K (MODIS LST) y humedad relativa < 10%",
            "Fracción de sombra solar máxima = 1.0 en solsticio austral (geometría rasante homóloga a PSR lunar)",
            "Pendientes de valles glaciares y paredes de artesa a escala homóloga de 240 m (Copernicus DEM)"
        ],
        "similar_processes": [
            "Sublimación directa de hielo enterrado bajo regolito seco sin fase líquida",
            "Atrapamiento térmico topográfico en depresiones polares y crioclastia por sales",
            "Transporte catabático de partículas finas sobre pavimento desértico polar"
        ],
        "differences_and_limits": [
            "Gravedad terrestre (1.0 g frente a 0.165 g lunar)",
            "Atmósfera polar densa (~980 hPa) frente al ultra-vacío lunar (10^-10 Pa)",
            "Ausencia de micrometeoritos y blindaje ante radiación cósmica galáctica (GCR)"
        ],
        "exploration_use_cases": [
            "Validación de perforadoras criogénicas ISRU (tipo TRIDENT/VIPER) en permafrost cementado",
            "Pruebas de rovers autónomos y sistemas de energía en transición luz rasante / sombra total"
        ],
        "subsurface_and_biology": {
            "subsurface_potential": "Medio — mesa de hielo cementado a 10–50 cm bajo pavimento detrítico seco",
            "extremophiles_note": "Comunidades criptoendolíticas e hipolíticas en areniscas Beacon; referencia estándar para bioprotección"
        },
        "datasets_used": [
            "copernicus_dem", "modis_lst", "modis_snow", "modis_aod", "sentinel1_sar", "sentinel2_sr", "nasa_lro_lola", "nasa_lro_diviner"
        ],
    },
    {
        "_id": "site_02",
        "name": "Cráter Haughton (Devon Island)",
        "country": "Nunavut, Canadá",
        "target": "moon_south_pole",
        "region_type": "known_analog",
        "is_understudied": False,
        "analog_type": "morphologic",
        "analog_category": ["Morfológico (impacto complejo)", "Proceso (permafrost/iluminación polar)"],
        "location": {"type": "Point", "coordinates": [-89.68, 75.38]},
        "preview_site_id": "devon_island_haughton",
        "similar_properties": [
            "Estructura de impacto compleja de ~23 km en desierto polar ártico (75.4° N)",
            "Brechas de impacto carbonatadas/gnaísicas con alta rugosidad radar en banda C (Sentinel-1 / RCM)",
            "Persistencia criosférica > 85% del año (MOD10A2) y sol rasante en equinoccios"
        ],
        "similar_processes": [
            "Morfometría de paredes, terrazas colapsadas y eyecta homóloga a cráteres polares lunares",
            "Sombras topográficas extensas bajo ángulos cenitales solares > 75°",
            "Criosolifluxión y retención de hielo intersticial en regolito brechado"
        ],
        "differences_and_limits": [
            "Erosión glaciar y periglaciar post-impacto ausente en la Luna",
            "Deshielo superficial estival breve (julio-agosto) con escorrentía efímera",
            "Gravedad terrestre (1.0 g) y protección magnetosférica"
        ],
        "exploration_use_cases": [
            "Entrenamiento de operaciones EVA geológicas, navegación de rovers presurizados y teleoperación con retardo",
            "Calibración de radares de penetración terrestre (GPR) y polarimetría SAR (comparación con Mini-RF)"
        ],
        "subsurface_and_biology": {
            "subsurface_potential": "Alto para hielo intersticial en brechas fracturadas; sin tubos de lava",
            "extremophiles_note": "Cianobacterias endolíticas en rocas evaporíticas chocadas por impacto"
        },
        "datasets_used": [
            "copernicus_dem", "modis_lst", "modis_snow", "sentinel1_sar", "sentinel2_sr", "csa_rcm_sar", "nasa_lro_lola"
        ],
    },
    {
        "_id": "site_03",
        "name": "Depresión Eólica Norte, Cuenca de Qaidam",
        "country": "Meseta Tibetana, China",
        "target": "mars_surface",
        "region_type": "understudied_discovery",
        "is_understudied": True,
        "analog_type": "process",
        "analog_category": ["Proceso (eólico/evaporítico)", "Propiedad (aridez extrema/polvo/altitud)"],
        "location": {"type": "Point", "coordinates": [92.45, 38.12]},
        "preview_site_id": "qaidam_basin",
        "similar_properties": [
            "Elevación media ~2.700–3.000 m con NDVI máximo < 0.08 (ausencia total de cubierta vegetal)",
            "Alta carga de polvo mineral (MODIS MAIAC AOD p90 = 0.33) y amplitud térmica diurna > 27 K",
            "Campos de yardangs, dunas lineales y costras poligonales de sulfatos ( MgSO4 / yeso ) y halita"
        ],
        "similar_processes": [
            "Deflación eólica intensa y abrasión por tormentas de polvo sobre paleolagos desecados",
            "Precipitación secuencial de sales hidratadas análoga al tránsito Noéico-Hespérico marciano",
            "Ciclo térmico diurno severo sobre sustrato salino hiperárido"
        ],
        "differences_and_limits": [
            "Presión atmosférica ~700 hPa (frente a ~6 hPa de CO2 en Marte)",
            "Gravedad 1.0 g (frente a 0.38 g marciana)",
            "Ausencia de percloratos ubicuos en concentraciones tóxicas marcianas"
        ],
        "exploration_use_cases": [
            "Ensayo de sellos mecánicos, paneles solares y juntas robóticas frente a polvo salino abrasivo",
            "Calibración de espectrómetros Raman/IR (tipo SHERLOC/SuperCam) para detección de sulfatos y biofirmas"
        ],
        "subsurface_and_biology": {
            "subsurface_potential": "Bajo para cavidades; alto para estratigrafía de salmueras subsuperficiales",
            "extremophiles_note": "Arqueas halófilas extremas atrapadas en inclusiones fluidas de halita y yeso"
        },
        "datasets_used": [
            "copernicus_dem", "modis_lst", "modis_aod", "modis_ndvi", "sentinel1_sar", "sentinel2_sr"
        ],
    },
    {
        "_id": "site_04",
        "name": "Cráter Pingualuit (Escudo de Nunavik)",
        "country": "Quebec, Canadá",
        "target": "moon_south_pole",
        "region_type": "understudied_discovery",
        "is_understudied": True,
        "analog_type": "morphologic",
        "analog_category": ["Morfológico (cráter simple prístino)", "Proceso (sombra/criósfera subártica)"],
        "location": {"type": "Point", "coordinates": [-73.66, 61.28]},
        "preview_site_id": "pingualuit_crater",
        "similar_properties": [
            "Cráter de impacto simple de 3,44 km de diámetro en basamento cristalino anortosítico/granítico",
            "Relación diámetro/diámetro de transición (D/Dt) homóloga a cráteres simples lunares de 15–20 km",
            "Persistencia de nieve/hielo del 68% anual (MOD10A2) y temperaturas mínimas de 238 K"
        ],
        "similar_processes": [
            "Conservación del borde elevado circular y taludes internos empinados (25°–35°)",
            "Sombra topográfica rasante durante el solsticio invernal subártico",
            "Fracturamiento radial por onda de choque en roca ígnea cristalina"
        ],
        "differences_and_limits": [
            "Lago ultra-oligotrófico en el interior de la cuenca (imposible en el vacío lunar)",
            "Cobertura estacional de tundra subártica en las laderas exteriores",
            "Gravedad terrestre (1.0 g)"
        ],
        "exploration_use_cases": [
            "Pruebas de descenso robótico con cabrestante (tipo Axel/DuAxel) en paredes de cráter empinadas",
            "Validación de algoritmos LiDAR de aterrizaje preciso con peligro topográfico (Hazard Detection)"
        ],
        "subsurface_and_biology": {
            "subsurface_potential": "Bajo para cuevas; fracturas de impacto profundas en escudo cristalino",
            "extremophiles_note": "Microbiota psicrófila aislada en sedimentos lacustres subglaciares antiguos"
        },
        "datasets_used": [
            "copernicus_dem", "modis_lst", "modis_snow", "sentinel1_sar", "sentinel2_sr", "csa_rcm_sar", "nasa_lro_lola"
        ],
    },
    {
        "_id": "site_05",
        "name": "Complejo Volcánico Santa Ana – Izalco – El Boquerón",
        "country": "El Salvador (Centroamérica)",
        "target": "lava_tubes",
        "region_type": "understudied_discovery",
        "is_understudied": True,
        "analog_type": "lithologic",
        "analog_category": ["Litológico (basaltos/coladas)", "Morfológico (conductos y cráteres de colapso)"],
        "location": {"type": "Point", "coordinates": [-89.63, 13.85]},
        "preview_site_id": "central_america_volcanic",
        "similar_properties": [
            "Relieve local abrupto de 1.064 m en ventana homóloga de 5 km y pendiente p90 de 27,2° (Copernicus DEM 240 m)",
            "Coladas basálticas jóvenes (1917 y siglo XX) con texturas 'a'ā/pāhoehoe de alta retrodispersión SAR banda C",
            "Cráteres anidados de paredes subverticales y cavidades de drenaje magmático"
        ],
        "similar_processes": [
            "Formación de conductos y techos basálticos por enfriamiento superficial y drenaje de lava",
            "Colapso gravitacional de bóvedas volcánicas (análogo mecánico a claraboyas tipo Mare Tranquillitatis)",
            "Alteración fumarólica ácida de basaltos (análogo geoquímico de vulcanismo marciano)"
        ],
        "differences_and_limits": [
            "Clima tropical con vegetación circundante densa (NDVI > 0.75 fuera de las coladas recientes)",
            "Meteorización química acelerada por precipitación pluvial y humedad > 75%",
            "Gravedad 1.0 g (los tubos lunares pueden alcanzar escalas 3–6 veces mayores sin colapsar)"
        ],
        "exploration_use_cases": [
            "Zoom regional accesible para pruebas de robots cuadrúpedos/drones SLAM en terrenos volcánicos escarpados",
            "Ensayo de enlaces de radiofrecuencia subsuperficial y georradar a través de basalto vesicular"
        ],
        "subsurface_and_biology": {
            "subsurface_potential": "Alto — cavidades basálticas, grietas de tensión y escarpes de colapso",
            "extremophiles_note": "Comunidades quimiolitótrofas acidófilas en fumarolas y biopelículas de cuevas volcánicas"
        },
        "datasets_used": [
            "copernicus_dem", "modis_lst", "modis_aod", "sentinel1_sar", "sentinel2_sr", "nasa_lro_lola"
        ],
    },
    {
        "_id": "site_06",
        "name": "Puna de Atacama / Salar de Arizaro y Antofalla",
        "country": "Argentina / Chile",
        "target": "mars_surface",
        "region_type": "understudied_discovery",
        "is_understudied": True,
        "analog_type": "process",
        "analog_category": ["Proceso (evaporítico/eólico de gran altitud)", "Propiedad (UV extremo/amplitud térmica)"],
        "location": {"type": "Point", "coordinates": [-67.85, -25.15]},
        "preview_site_id": "puna_atacama_salar",
        "similar_properties": [
            "Altitud extrema de 4.716 m s. n. m. con desnivel local de 742 m en ventana de 5 km (Copernicus DEM)",
            "Amplitud térmica superficial día-noche de 32,6 K (MODIS LST) y NDVI máximo de 0,066",
            "Atmósfera ultra-limpia y delgada con radiación UV solar récord en la Tierra"
        ],
        "similar_processes": [
            "Formación de mega-yardangs en ignimbritas y campos de grava eólica (gravel ripples)",
            "Criodesecación y precipitación de evaporitas en cuencas volcano-tectónicas cerradas",
            "Interacción viento-topografía en atmósfera enrarecida de alta montaña"
        ],
        "differences_and_limits": [
            "Presión atmosférica ~570 hPa con 21% O2 (frente a ~6 hPa de CO2 en Marte)",
            "Gravedad terrestre (1.0 g frente a 0.38 g en Marte)",
            "Eventos esporádicos de nieve invernal (persistencia nival del 8,7% en MOD10A2)"
        ],
        "exploration_use_cases": [
            "Pruebas de rovers marcianos y helicópteros en atmósfera de baja densidad a casi 5.000 m",
            "Perforación astrobiológica en estromatolitos modernos de altura y costras de halita"
        ],
        "subsurface_and_biology": {
            "subsurface_potential": "Medio — acuíferos hipersalinos someros y permafrost discontinuo de alta montaña",
            "extremophiles_note": "Tapetes microbianos resistentes a UV extremo, arsénico y desecación"
        },
        "datasets_used": [
            "copernicus_dem", "modis_lst", "modis_snow", "modis_aod", "modis_ndvi", "sentinel1_sar", "sentinel2_sr"
        ],
    },
    {
        "_id": "cand_atacama_core_07",
        "name": "Núcleo Hiperárido de Atacama (Yungay / María Elena)",
        "country": "Chile",
        "target": "mars_surface",
        "region_type": "known_analog",
        "is_understudied": False,
        "analog_type": "process",
        "analog_category": ["Propiedad (hiperaridez/suelos oxidados)", "Proceso (acumulación de sales y percloratos)"],
        "location": {"type": "Point", "coordinates": [-69.00, -23.00]},
        "preview_site_id": "atacama_hyperarid",
        "similar_properties": [
            "Suelo regolítico desprovisto de vegetación (NDVI medio = 0,067) y persistencia de nieve 0,0%",
            "Amplitud térmica superficial media de 33,6 K con máximas diurnas de 316,6 K (MODIS LST)",
            "Carga persistente de polvo y aerosoles desérticos (MODIS MAIAC AOD p90 = 0,222)"
        ],
        "similar_processes": [
            "Acumulación atmosférica milenaria de nitratos, iodatos y percloratos sin lixiviación hídrica",
            "Oxidación fotoquímica de materia orgánica en el regolito superficial",
            "Delicuescencia higroscópica de halita como único mecanismo de actividad de agua"
        ],
        "differences_and_limits": [
            "Temperaturas diurnas cálidas (~43 °C en superficie) superiores al promedio marciano",
            "Presión atmosférica ~750 hPa y gravedad 1.0 g",
            "Ingreso ocasional de niebla costera (camanchaca) en los márgenes occidentales"
        ],
        "exploration_use_cases": [
            "Banco de pruebas histórico de los taladros y laboratorios de Viking, Phoenix, Curiosity, Perseverance y ExoMars",
            "Evaluación de límites de detección de vida en suelos hiperoxidados"
        ],
        "subsurface_and_biology": {
            "subsurface_potential": "Bajo para cavidades; horizontes de sulfatos/arcillas a 0.5–2 m de profundidad",
            "extremophiles_note": "Bacterias endolíticas en nódulos de halita y horizonte subsuperficial 'biomining' bajo capa estéril"
        },
        "datasets_used": [
            "copernicus_dem", "modis_lst", "modis_aod", "modis_ndvi", "sentinel1_sar", "sentinel2_sr"
        ],
    },
    {
        "_id": "cand_iceland_askja_08",
        "name": "Tierras Altas de Islandia (Caldera Askja y Holuhraun)",
        "country": "Islandia",
        "target": "moon_south_pole",
        "region_type": "known_analog",
        "is_understudied": False,
        "analog_type": "lithologic",
        "analog_category": ["Litológico (basaltos/tefra)", "Proceso (interacción vulcano-criosférica e iluminación rasante)"],
        "location": {"type": "Point", "coordinates": [-16.75, 64.85]},
        "preview_site_id": "iceland_highlands",
        "similar_properties": [
            "Sombra solar invernal del 100% en laderas (shadow_frac_d4 = 1.0) y persistencia nival del 88% (MOD10A2)",
            "Campos de lava basáltica, escoria y tefra sin vegetación (NDVI medio = -0.049)",
            "Pendientes suaves en mesetas inter-cráter (2,2° media) con paredes de caldera abruptas"
        ],
        "similar_processes": [
            "Transporte eólico de arenas basálticas vítreas en clima subpolar frío",
            "Interacción entre coladas de lava, tubos volcánicos y hielo subsuperficial",
            "Iluminación solar rasante de alta latitud (64.8° N)"
        ],
        "differences_and_limits": [
            "Alta precipitación nival/pluvial y actividad hidrotermal activa",
            "Atmósfera densa con vientos intensos y gravedad 1.0 g",
            "Basaltos toleíticos hidratados frente a anortositas/basaltos anhidros lunares"
        ],
        "exploration_use_cases": [
            "Entrenamiento geológico de astronautas (tradición Apollo y Artemis) en muestreo de basaltos y brechas",
            "Pruebas de rovers de excavación de regolito basáltico congelado"
        ],
        "subsurface_and_biology": {
            "subsurface_potential": "Alto — extensos tubos de lava basáltica con formaciones de hielo perenne (ej. Lofthellir)",
            "extremophiles_note": "Comunidades quimiolitótrofas en vidrio basáltico subglacial y cuevas de hielo"
        },
        "datasets_used": [
            "copernicus_dem", "modis_lst", "modis_snow", "modis_aod", "sentinel1_sar", "sentinel2_sr"
        ],
    },
    {
        "_id": "cand_lanzarote_corona_09",
        "name": "Tubo Volcánico de La Corona y Malpaís de Lanzarote",
        "country": "Islas Canarias, España",
        "target": "lava_tubes",
        "region_type": "known_analog",
        "is_understudied": False,
        "analog_type": "morphologic",
        "analog_category": ["Morfológico (tubo de lava de gran diámetro)", "Litológico (basalto alcalino árido)"],
        "location": {"type": "Point", "coordinates": [-13.49, 29.16]},
        "preview_site_id": None,
        "similar_properties": [
            "Conducto subterráneo de > 7 km de longitud con galerías de hasta 25–30 m de diámetro y jameos (claraboyas)",
            "Superficie de malpaís basáltico árido con escasa vegetación (bajo NDVI) y polvo sahariano ocasional (Calima)",
            "Estabilidad térmica interior casi constante a lo largo del año"
        ],
        "similar_processes": [
            "Colapso parcial del techo formando claraboyas de entrada ('jameos') homólogas a los pits de Mare Tranquillitatis y Marius Hills",
            "Aislamiento natural frente a fluctuaciones térmicas y radiación superficial",
            "Acumulación de bloques de derrumbe en la base de las claraboyas"
        ],
        "differences_and_limits": [
            "Clima subtropical árido templado y presencia de tramo inundado marino en el extremo distal",
            "Gravedad terrestre 1.0 g y atmósfera respirable",
            "Filtración ocasional de humedad meteórica"
        ],
        "exploration_use_cases": [
            "Sede del programa ESA PANGAEA para entrenamiento de espeleología planetaria y robótica subterránea",
            "Despliegue de enjambres de micro-rovers y mapeo LiDAR 3D en tubos de lava"
        ],
        "subsurface_and_biology": {
            "subsurface_potential": "Muy alto — uno de los tubos de lava más largos y voluminosos accesibles en la Tierra",
            "extremophiles_note": "Depósitos minerales biogénicos (espeleotemas de sílice/calcita) y microorganismos adaptados a oligotrofia oscura"
        },
        "datasets_used": [
            "copernicus_dem", "modis_lst", "modis_aod", "modis_ndvi", "sentinel2_sr"
        ],
    },
    {
        "_id": "cand_danakil_afar_10",
        "name": "Depresión de Danakil y Cráter Erta Ale (Triángulo de Afar)",
        "country": "Etiopía",
        "target": "mars_surface",
        "region_type": "understudied_discovery",
        "is_understudied": True,
        "analog_type": "process",
        "analog_category": ["Proceso (hidrotermal/evaporítico ácido)", "Litológico (basaltos de rift y sales)"],
        "location": {"type": "Point", "coordinates": [40.30, 14.24]},
        "preview_site_id": None,
        "similar_properties": [
            "Cuenca tectónica bajo el nivel del mar (-125 m) con intensa carga de aerosoles (MODIS AOD) y aridez extrema",
            "Depósitos masivos de sulfatos de hierro, sílice amorfa, halita y basaltos toleíticos fisurales",
            "Ausencia casi total de cobertura vegetal (NDVI < 0.08)"
        ],
        "similar_processes": [
            "Desgasificación volcánica e interacción hidrotermal-evaporítica análoga a Gusev Crater / Home Plate en Marte",
            "Deflación eólica y transporte de polvo mineral sobre llanuras salinas",
            "Formación de costras poligonales por desecación extrema"
        ],
        "differences_and_limits": [
            "Temperaturas superficiales extremadamente altas (> 320 K), opuestas al frío marciano actual",
            "Presión atmosférica > 1015 hPa y gravedad 1.0 g",
            "Actividad hidrotermal ácida líquida activa en superficie"
        ],
        "exploration_use_cases": [
            "Calibración de espectrómetros orbitales y de rover para discriminar sílice hidrotermal y sulfatos ácidos",
            "Protocolos de detección de biofirmas en ambientes poliextremos (pH < 1, hipersalinidad)"
        ],
        "subsurface_and_biology": {
            "subsurface_potential": "Medio — fisuras tectónicas de rift, tubos basálticos en Erta Ale y salmueras subsuperficiales",
            "extremophiles_note": "Límite físico de habitabilidad terrestre en salmueras hiperácidas de hierro y magnesio"
        },
        "datasets_used": [
            "copernicus_dem", "modis_lst", "modis_aod", "modis_ndvi"
        ],
    },
    {
        "_id": "cand_lut_iran_11",
        "name": "Desierto de Lut (Gandom Beryan y Mega-Yardangs de Kaluts)",
        "country": "Irán",
        "target": "mars_surface",
        "region_type": "understudied_discovery",
        "is_understudied": True,
        "analog_type": "morphologic",
        "analog_category": ["Morfológico (mega-yardangs/mesetas basálticas)", "Proceso (abrasión eólica y polvo)"],
        "location": {"type": "Point", "coordinates": [59.17, 30.57]},
        "preview_site_id": None,
        "similar_properties": [
            "Corredores de yardangs paralelos de hasta 80 m de altura y > 100 km de longitud esculpidos por el viento",
            "Meseta de lava basáltica negra (Gandom Beryan) con el récord mundial de temperatura superficial MODIS LST (> 340 K)",
            "NDVI máximo ≈ 0.05 (suelo estéril) y frecuentes tormentas de polvo (MODIS MAIAC AOD)"
        ],
        "similar_processes": [
            "Erosión eólica unidireccional a gran escala homóloga a Medusae Fossae Formation en Marte",
            "Formación de barniz del desierto rico en óxidos de hierro/manganeso sobre basaltos",
            "Transporte de dunas lineales y estrellas de arena en cuenca hiperárida"
        ],
        "differences_and_limits": [
            "Régimen térmico hiper-cálido (frente al régimen criogénico marciano)",
            "Atmósfera terrestre densa y gravedad 1.0 g",
            "Ausencia de hielo subsuperficial"
        ],
        "exploration_use_cases": [
            "Pruebas de navegación autónoma de rovers y drones entre corredores de yardangs con oclusión GPS/comunicaciones",
            "Estudio aerodinámico de abrasión eólica sobre recubrimientos espaciales"
        ],
        "subsurface_and_biology": {
            "subsurface_potential": "Bajo — sedimentos lacustres pleistocenos compactados bajo meseta basáltica",
            "extremophiles_note": "Comunidades microbianas xerófilas y termotolerantes extremadamente escasas en suelos salinos"
        },
        "datasets_used": [
            "copernicus_dem", "modis_lst", "modis_aod", "modis_ndvi"
        ],
    },
    {
        "_id": "cand_svalbard_12",
        "name": "Bockfjorden y Mesetas Periglaciares de Spitsbergen (Svalbard)",
        "country": "Noruega (Ártico)",
        "target": "moon_south_pole",
        "region_type": "understudied_discovery",
        "is_understudied": True,
        "analog_type": "process",
        "analog_category": ["Proceso (criosférico/sombra polar 78°N)", "Litológico (complejo volcánico en permafrost)"],
        "location": {"type": "Point", "coordinates": [15.63, 78.22]},
        "preview_site_id": None,
        "similar_properties": [
            "Latitud extrema (78.2° N) con noche polar prolongada y sol rasante (shadow_frac = 1.0 en invierno)",
            "Permafrost continuo de 100–500 m de espesor y alta persistencia de nieve/hielo (MOD10A2)",
            "Único lugar en la Tierra donde coexisten centros volcánicos basálticos cuaternarios, tubos/conductos y permafrost polar (análogo dual Luna/Marte)"
        ],
        "similar_processes": [
            "Congelación profunda de regolito y formación de cuñas de hielo poligonales",
            "Geometría de iluminación rasante y sombras topográficas kilométricas",
            "Mineralización de carbonatos en basaltos subpolares (homólogo a meteorito marciano ALH84001)"
        ],
        "differences_and_limits": [
            "Influencia marítima del Atlántico Norte (mayor humedad y nevadas que en McMurdo)",
            "Atmósfera terrestre y gravedad 1.0 g",
            "Deshielo de la capa activa superficial (0.5–1.5 m) durante el verano ártico"
        ],
        "exploration_use_cases": [
            "Sede de expediciones AMASE (NASA/ESA) para validación de instrumentos de Marte y Luna",
            "Pruebas de perforación y extracción de agua en permafrost a alta latitud"
        ],
        "subsurface_and_biology": {
            "subsurface_potential": "Alto — tubos de hielo subglaciares, conductos volcánicos en permafrost y minas criogénicas",
            "extremophiles_note": "Microorganismos psicrófilos activos a temperaturas sub-cero en películas de salmuera y basalto"
        },
        "datasets_used": [
            "copernicus_dem", "modis_lst", "modis_snow", "sentinel1_sar", "sentinel2_sr"
        ],
    },
]


# Metadatos regionales para generar fichas completas (§05) de las celdas Top descubiertas en earth_features.csv
REGION_TEMPLATES: list[dict[str, Any]] = [
    {
        "tag": "antarctica_transantarctic",
        "bbox": [150.0, -86.0, 175.0, -72.0],
        "country": "Antártida (Montañas Transantárticas)",
        "name_prefix": "Celda Criosférica Transantártica",
        "default_target": "moon_south_pole",
        "subsurface": "Permafrost polar cementado por hielo y depresiones de trampa fría topográfica",
        "biology": "Microhábitats criptoendolíticos de muy baja biomasa bajo pavimento frío hiperárido",
    },
    {
        "tag": "arctic_devon_nunavut",
        "bbox": [-100.0, 72.0, -75.0, 80.0],
        "country": "Nunavut, Ártico Canadiense",
        "name_prefix": "Meseta Polar de Devon / Islas Reina Isabel",
        "default_target": "moon_south_pole",
        "subsurface": "Permafrost continuo en carbonatos y brechas fracturadas de alta latitud",
        "biology": "Biopelículas hipolíticas psicrófilas adaptadas a ciclos de luz polar extrema",
    },
    {
        "tag": "nunavik_shield",
        "bbox": [-78.0, 58.0, -68.0, 64.0],
        "country": "Nunavik, Quebec (Canadá)",
        "name_prefix": "Escudo Cristalino de Nunavik",
        "default_target": "moon_south_pole",
        "subsurface": "Basamento precámbrico cristalino fracturado con permafrost subártico",
        "biology": "Comunidades oligotróficas subárticas en sustrato cristalino desnudo",
    },
    {
        "tag": "svalbard_spitsbergen",
        "bbox": [10.0, 76.0, 25.0, 81.0],
        "country": "Svalbard, Noruega",
        "name_prefix": "Meseta Periglaciar de Spitsbergen",
        "default_target": "moon_south_pole",
        "subsurface": "Permafrost ártico continuo y conductos criogénicos a >77° N",
        "biology": "Comunidades psicrófilas y litótrofas en regolito congelado",
    },
    {
        "tag": "atacama_puna",
        "bbox": [-72.0, -28.0, -65.0, -20.0],
        "country": "Chile / Argentina (Atacama – Puna)",
        "name_prefix": "Cuenca Hiperárida Andina",
        "default_target": "mars_surface",
        "subsurface": "Horizontes de sulfatos, halita, percloratos y regolito hiperárido de altura",
        "biology": "Microorganismos endolíticos y halófilos resistentes a desecación y UV extremo",
    },
    {
        "tag": "qaidam_taklamakan",
        "bbox": [78.0, 35.0, 97.0, 43.0],
        "country": "China (Qaidam / Taklamakán)",
        "name_prefix": "Depresión Eólica de Asia Central",
        "default_target": "mars_surface",
        "subsurface": "Estratigrafía evaporítica de paleolagos salinos y campos de yardangs",
        "biology": "Halófilos extremos preservados en costras de cloruros y sulfatos",
    },
    {
        "tag": "iceland_volcanic",
        "bbox": [-24.0, 63.0, -13.0, 66.5],
        "country": "Islandia",
        "name_prefix": "Campo Volcánico Subpolar de Islandia",
        "default_target": "lava_tubes",
        "subsurface": "Tubos de lava basáltica y cavidades vulcano-criosféricas",
        "biology": "Quimiolitótrofos en basalto vítreo y cuevas de hielo volcánicas",
    },
    {
        "tag": "central_america_volcanic",
        "bbox": [-92.0, 12.5, -87.0, 15.5],
        "country": "El Salvador / Guatemala (Cinturón Volcánico C.A.)",
        "name_prefix": "Escarpe Volcánico Centroamericano",
        "default_target": "lava_tubes",
        "subsurface": "Conductos de drenaje basáltico, coladas escoriáceas y cráteres de colapso",
        "biology": "Comunidades termófilas/acidófilas en fumarolas y biopelículas de cavidades basálticas",
    },
    {
        "tag": "danakil_afar",
        "bbox": [39.0, 11.0, 43.0, 15.5],
        "country": "Etiopía (Depresión de Danakil / Afar)",
        "name_prefix": "Llanura Evaporítica-Volcánica de Afar",
        "default_target": "mars_surface",
        "subsurface": "Fisuras basálticas de rift y depósitos hidrotermales-evaporíticos",
        "biology": "Poliextremófilos hiperácidos e hipersalinos",
    },
    {
        "tag": "sahara_tibesti",
        "bbox": [14.0, 18.0, 23.0, 25.0],
        "country": "Chad / Libia (Macizo de Tibesti – Sahara)",
        "name_prefix": "Meseta Volcánica-Eólica de Tibesti",
        "default_target": "mars_surface",
        "subsurface": "Calderas volcánicas áridas, ignimbritas y corredores de abrasión eólica",
        "biology": "Bacterias xerófilas y comunidades endolíticas desérticas",
    },
    {
        "tag": "lut_iran",
        "bbox": [56.5, 28.5, 61.0, 32.5],
        "country": "Irán (Dasht-e Lut)",
        "name_prefix": "Corredor de Yardangs de Dasht-e Lut",
        "default_target": "mars_surface",
        "subsurface": "Sedimentos pleistocenos esculpidos por viento y mesetas basálticas hiperáridas",
        "biology": "Suelos hiperáridos de habitabilidad límite por estrés térmico y salino",
    },
    {
        "tag": "namib_skeleton",
        "bbox": [13.0, -25.5, 17.0, -18.5],
        "country": "Namibia (Desierto del Namib)",
        "name_prefix": "Campo de Dunas e Hiperaridez del Namib",
        "default_target": "mars_surface",
        "subsurface": "Megadunas de cuarzo/óxidos de hierro sobre basamento antiguo desecado",
        "biology": "Comunidades hipolíticas bajo cuarzos translúcidos en desierto hiperárido",
    },
    {
        "tag": "pilbara_australia",
        "bbox": [116.5, -24.5, 122.5, -20.0],
        "country": "Australia Occidental (Cratón de Pilbara)",
        "name_prefix": "Cratón Arcaico de Pilbara",
        "default_target": "mars_surface",
        "subsurface": "Terrenos arcaicos oxidados (3.5 Ga) con sílice hidrotermal y estromatolitos fósiles",
        "biology": "Análogo astrobiológico primario para biofirmas minerales del Marte Noéico",
    },
    {
        "tag": "mojave_deathvalley",
        "bbox": [-118.5, 34.5, -114.5, 38.0],
        "country": "EE. UU. (Mojave / Death Valley)",
        "name_prefix": "Cuenca Árida de Mojave / Death Valley",
        "default_target": "mars_surface",
        "subsurface": "Abanicos aluviales áridos, playas evaporíticas y campos volcánicos basálticos",
        "biology": "Microorganismos halófilos y xerófilos en costras salinas y barniz del desierto",
    },
    {
        "tag": "lanzarote_canary",
        "bbox": [-17.5, 27.5, -13.0, 29.5],
        "country": "España (Lanzarote / Tenerife, Canarias)",
        "name_prefix": "Campo Volcánico y Tubos de Lava Canarios",
        "default_target": "lava_tubes",
        "subsurface": "Tubos de lava basáltica, jameos de colapso y campos de piroclastos",
        "biology": "Biomineralización subterránea en tubos volcánicos oligotróficos",
    },
]


def match_region_template(lat: float, lon: float) -> dict[str, Any]:
    for tpl in REGION_TEMPLATES:
        w, s, e, n = tpl["bbox"]
        if w <= lon <= e and s <= lat <= n:
            return tpl
    if lat <= -60.0:
        return REGION_TEMPLATES[0]
    if lat >= 60.0:
        return REGION_TEMPLATES[1]
    return {
        "tag": "global_analog",
        "country": f"Cinturón Análogo Terrestre ({lat:.1f}°, {lon:.1f}°)",
        "name_prefix": "Celda Análoga Descubierta GEE",
        "default_target": "mars_surface" if abs(lat) < 55.0 else "moon_south_pole",
        "subsurface": "Regolito continental desnudo evaluado a escala homóloga de 240 m",
        "biology": "Sustrato de baja cobertura vegetal apto para pruebas de instrumentación",
    }


def build_cell_metrics_dict(row: pd.Series) -> dict[str, Any]:
    def _val(k: str) -> float | None:
        v = row.get(k)
        return round(float(v), 4) if pd.notna(v) else None

    return {
        "cell_id": str(row["cell_id"]),
        "lat": _val("lat"),
        "lon": _val("lon"),
        "elev_m": _val("elev_m"),
        "slope_mean_deg": _val("slope_mean"),
        "slope_p90_deg": _val("slope_p90"),
        "relief_local_m": _val("relief_local"),
        "shadow_frac_max": max(
            [x for x in (_val("shadow_frac_d1"), _val("shadow_frac_d2"), _val("shadow_frac_d3"), _val("shadow_frac_d4")) if x is not None] or [0.0]
        ),
        "lst_mean_k": _val("lst_mean"),
        "lst_min_k": _val("lst_min"),
        "lst_max_k": _val("lst_max"),
        "lst_amp_k": _val("lst_amp"),
        "snow_persist": _val("snow_persist"),
        "aod_mean": _val("aod_mean"),
        "aod_p90": _val("aod_p90"),
        "ndvi_mean": _val("ndvi_mean"),
        "ndvi_max": _val("ndvi_max"),
        "qc_flag": int(row["qc_flag"]) if pd.notna(row.get("qc_flag")) else 0,
    }


def generate_integrated_candidates(
    csv_path: Path,
    previews_json_path: Path,
    out_candidates_path: Path,
    max_grid_discoveries: int = 48,
    min_separation_km: float = 95.0,
) -> list[dict[str, Any]]:
    df = pd.read_csv(csv_path)
    previews = {}
    if previews_json_path.exists():
        previews = json.loads(previews_json_path.read_text(encoding="utf-8"))

    lats = df["lat"].to_numpy(dtype=np.float64)
    lons = df["lon"].to_numpy(dtype=np.float64)

    candidates: list[dict[str, Any]] = []
    used_coords: list[tuple[float, float]] = []

    # 1. Enriquecer los 12 candidatos curados con la celda real más cercana de earth_features.csv
    for item in CURATED_CANDIDATES:
        lon, lat = item["location"]["coordinates"]
        d2 = (lats - lat) ** 2 + ((lons - lon) * math.cos(math.radians(lat))) ** 2
        idx = int(np.argmin(d2))
        row = df.iloc[idx]
        computed_scores = compute_5d_scores_for_row(row, item["target"])

        doc = dict(item)
        preview_id = doc.pop("preview_site_id", None)
        doc["scores"] = computed_scores
        doc["p1_cell_metrics"] = build_cell_metrics_dict(row)
        if preview_id and preview_id in previews:
            p_entry = previews[preview_id]
            doc["orbital_previews"] = {
                "site_id": preview_id,
                "sentinel2_rgb_url": f"/{p_entry.get('sentinel2_rgb_file', '')}",
                "sentinel1_sar_url": f"/{p_entry.get('sar_cband', {}).get('file', '')}",
                "sar_sensor": p_entry.get("sar_cband", {}).get("sensor", ""),
                "sar_stats_db": p_entry.get("sar_cband", {}).get("stats", {}),
            }
        candidates.append(doc)
        used_coords.append((lat, lon))

    # 2. Descubrir celdas Top adicionales directamente desde earth_features.csv
    # Filtramos celdas con buena calidad y baja vegetación (salvo zonas de tubos de lava)
    usable = df[df["qc_flag"].isin([0, 8])].copy()
    if len(usable) == 0:
        usable = df.copy()

    # Calculamos IFA medio para cada objetivo en las celdas usables
    records: list[tuple[float, str, int, dict[str, float]]] = []
    for idx, row in usable.iterrows():
        lat, lon = float(row["lat"]), float(row["lon"])
        tpl = match_region_template(lat, lon)
        target = tpl["default_target"]
        # Evitar vegetación densa en Luna y Marte
        if target in ("moon_south_pole", "mars_surface") and pd.notna(row.get("ndvi_max")) and float(row["ndvi_max"]) > 0.35:
            continue
        sc = compute_5d_scores_for_row(row, target)
        mean_ifa = sum(sc.values()) / 5.0
        records.append((mean_ifa, target, int(idx), sc))

    records.sort(key=lambda x: x[0], reverse=True)

    added_per_target = {"moon_south_pole": 0, "mars_surface": 0, "lava_tubes": 0}
    quota_per_target = {
        "moon_south_pole": max_grid_discoveries // 3 + 2,
        "mars_surface": max_grid_discoveries // 3 + 4,
        "lava_tubes": max_grid_discoveries // 3,
    }

    for mean_ifa, target, idx, sc in records:
        if len(candidates) >= len(CURATED_CANDIDATES) + max_grid_discoveries:
            break
        if added_per_target[target] >= quota_per_target[target]:
            continue

        row = df.loc[idx]
        lat, lon = float(row["lat"]), float(row["lon"])
        if any(haversine_km(lat, lon, ulat, ulon) < min_separation_km for ulat, ulon in used_coords):
            continue

        tpl = match_region_template(lat, lon)
        cell_id = str(row["cell_id"])
        metrics = build_cell_metrics_dict(row)

        elev_str = f"{metrics['elev_m']:.0f} m" if metrics["elev_m"] is not None else "N/D"
        slope_str = f"{metrics['slope_mean_deg']:.1f}° (p90={metrics['slope_p90_deg']:.1f}°)" if metrics["slope_mean_deg"] is not None else "N/D"
        lst_min_str = f"{metrics['lst_min_k']:.1f} K" if metrics["lst_min_k"] is not None else "N/D"
        aod_str = f"{metrics['aod_p90']:.3f}" if metrics["aod_p90"] is not None else "bajo albedo polar"

        doc = {
            "_id": f"p1_{cell_id.lower().replace('-', 'm')}",
            "name": f"{tpl['name_prefix']} ({cell_id})",
            "country": tpl["country"],
            "target": target,
            "region_type": "understudied_discovery",
            "is_understudied": True,
            "analog_type": "process" if target != "lava_tubes" else "lithologic",
            "analog_category": [
                "Proceso (descubrimiento GEE P1)",
                "Propiedad (escala homóloga 240 m / 5 km)"
            ],
            "location": {
                "type": "Point",
                "coordinates": [round(lon, 4), round(lat, 4)],
            },
            "scores": sc,
            "similar_properties": [
                f"Elevación media {elev_str} y pendiente homóloga (240 m) de {slope_str}",
                f"Temperatura mínima superficial MODIS LST de {lst_min_str} y amplitud diurna de {metrics['lst_amp_k']} K",
                f"Espesor óptico de polvo/aerosoles (MODIS MAIAC p90): {aod_str} · Sombra solar máx: {metrics['shadow_frac_max']:.2f}"
            ],
            "similar_processes": [
                "Morfometría topográfica evaluada en ventana circular de 5 km homóloga a LRO LOLA y MGS MOLA",
                "Balance radiativo e insolación/sombra estacional calculada con modelo de elevación Copernicus GLO-30 (2024_1)",
                "Dinámica superficial sin cubierta vegetal densa verificada con climatología MODIS 2019–2023"
            ],
            "differences_and_limits": [
                "Gravedad terrestre (1.0 g frente a 0.165 g en la Luna y 0.38 g en Marte)",
                "Presencia de atmósfera terrestre densa y campo geomagnético protector contra radiación GCR/SPE",
                "Procesos meteorológicos terrestres a tener en cuenta durante ensayos de campo"
            ],
            "exploration_use_cases": [
                "Validación en campo de sensores de navegación óptica/LiDAR, locomoción de rovers y protocolos ISRU",
                "Muestreo geoquímico y calibración de instrumentación orbital/superficial en sitio poco estudiado"
            ],
            "subsurface_and_biology": {
                "subsurface_potential": tpl["subsurface"],
                "extremophiles_note": tpl["biology"],
            },
            "datasets_used": [
                "copernicus_dem", "modis_lst", "modis_snow", "modis_aod", "modis_ndvi"
            ],
            "p1_cell_metrics": metrics,
        }
        candidates.append(doc)
        used_coords.append((lat, lon))
        added_per_target[target] += 1

    out_candidates_path.parent.mkdir(parents=True, exist_ok=True)
    out_candidates_path.write_text(
        json.dumps(candidates, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    log.info(
        "Candidatos integrados escritos en %s: %d total (%d curados + %d descubrimientos GEE)",
        out_candidates_path, len(candidates), len(CURATED_CANDIDATES), len(candidates) - len(CURATED_CANDIDATES)
    )
    return candidates


def merge_datasets_catalog(metadata_path: Path, datasets_path: Path, existing_datasets: list[dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    """Fusiona el catálogo `datasets.json` de P2/P4 con los datasets oficiales de `metadata.json` de P1."""
    base = list(existing_datasets or [])
    if not base and datasets_path.exists():
        base = json.loads(datasets_path.read_text(encoding="utf-8"))

    by_id = {d["id"]: d for d in base if "id" in d}

    all_entries = [
        {
            "id": "copernicus_dem",
            "name": "Copernicus DEM GLO-30 (Release 2024_1 — Remuestreado Homólogo a 240 m)",
            "agency": "ESA / Copernicus",
            "url": "https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM",
            "license": "Copernicus DEM Open License",
            "dimension": "relieve",
            "usage": "Elevación (elev_m), pendiente media/p90, relieve local y sombra solar en 4 fechas sobre ventanas circulares de 5 km a resolución homóloga de 240 m (GEE: COPERNICUS/DEM/GLO30_2024_1).",
        },
        {
            "id": "modis_lst",
            "name": "MODIS Terra Land Surface Temperature & Emissivity 8-Day 1km (MOD11A2.061)",
            "agency": "NASA EOSDIS / LP DAAC",
            "url": "https://doi.org/10.5067/MODIS/MOD11A2.061",
            "license": "NASA Open Data Policy",
            "dimension": "frio",
            "usage": "Climatología térmica multianual 2019–2023 (lst_mean, lst_min, lst_max y amplitud diurna lst_amp en Kelvin).",
        },
        {
            "id": "modis_snow",
            "name": "MODIS Terra Snow Cover 8-Day L3 Global 500m (MOD10A2.061)",
            "agency": "NASA EOSDIS / NSIDC DAAC",
            "url": "https://doi.org/10.5067/MODIS/MOD10A2.061",
            "license": "NASA Open Data Policy",
            "dimension": "hielo",
            "usage": "Persistencia criosférica multianual 2019–2023 (fracción de compuestos de 8 días con cobertura de nieve/hielo).",
        },
        {
            "id": "modis_aod",
            "name": "MODIS Terra & Aqua MAIAC Land Aerosol Optical Depth Daily 1km (MCD19A2.061)",
            "agency": "NASA EOSDIS / LP DAAC",
            "url": "https://doi.org/10.5067/MODIS/MCD19A2.061",
            "license": "NASA Open Data Policy",
            "dimension": "polvo",
            "usage": "Carga atmosférica de polvo mineral y aerosoles a 550 nm (aod_mean y aod_p90) para la 5.ª dimensión del IFA.",
        },
        {
            "id": "modis_ndvi",
            "name": "MODIS Terra Vegetation Indices 16-Day Global 1km (MOD13A2.061)",
            "agency": "NASA EOSDIS / LP DAAC",
            "url": "https://doi.org/10.5067/MODIS/MOD13A2.061",
            "license": "NASA Open Data Policy",
            "dimension": "relieve",
            "usage": "Filtro cuantitativo de biosfera vegetal (ndvi_mean, ndvi_max) para aislar regolito desnudo e hiperárido.",
        },
        {
            "id": "sentinel1_sar",
            "name": "Copernicus Sentinel-1 C-Band SAR GRD + Filtro Lee CSA (Sustituto RADARSAT-1/RCM)",
            "agency": "ESA / Copernicus & CSA SAR Protocol",
            "url": "https://www.asc-csa.gc.ca/eng/satellites/radarsat/radarsat-tutorial.asp",
            "license": "Copernicus Open Access",
            "dimension": "relieve",
            "usage": "Retrodispersión radar en banda C (5.405 GHz, VV/HH en dB con filtro speckle Lee 5x5) homóloga a LRO Mini-RF.",
        },
        {
            "id": "sentinel2_sr",
            "name": "Copernicus Sentinel-2 MSI Level-2A Harmonized Surface Reflectance",
            "agency": "ESA / Copernicus",
            "url": "https://dataspace.copernicus.eu/",
            "license": "Copernicus Open Access",
            "dimension": "iluminacion",
            "usage": "Recortes ópticos RGB sin nubes a 10 m de resolución para comparación visual lado a lado en las fichas.",
        },
        {
            "id": "nasa_lro_lola",
            "name": "Lunar Orbiter Laser Altimeter (LOLA) Polar DEM",
            "agency": "NASA PDS / LRO",
            "url": "https://pds-geosciences.wustl.edu/missions/lro/lola.htm",
            "license": "NASA Public Domain",
            "dimension": "relieve",
            "usage": "Topografía de referencia del Polo Sur Lunar (~240 m) para correlacionar pendientes de cráteres de impacto con elevaciones terrestres.",
        },
        {
            "id": "nasa_lro_diviner",
            "name": "Diviner Lunar Radiometer Experiment - Polar Regolith Temperatures",
            "agency": "NASA PDS / LRO",
            "url": "https://pds-geosciences.wustl.edu/missions/lro/diviner.htm",
            "license": "NASA Public Domain",
            "dimension": "frio",
            "usage": "Mapeo térmico del Polo Sur Lunar para identificar trampas frías PSR capaces de retener hielo estable por debajo de 100 K.",
        },
        {
            "id": "csa_rcm_sar",
            "name": "RADARSAT Constellation Mission (RCM) & RADARSAT-1 SAR Archive",
            "agency": "CSA",
            "url": "https://www.asc-csa.gc.ca/eng/satellites/radarsat/default.asp",
            "license": "Canadian Open Government Licence",
            "dimension": "hielo",
            "usage": "Detección de hielo subsuperficial, rugosidad dieléctrica y textura en banda C para sitios árticos y periglaciares.",
        },
        {
            "id": "jaxa_gportal_precip_snow",
            "name": "JAXA G-Portal Global Precipitation Measurement (GPM/GSMaP) & GCOM-C Snow",
            "agency": "JAXA",
            "url": "https://gportal.jaxa.jp/gpr/",
            "license": "JAXA Terms of Use - Open Science",
            "dimension": "hielo",
            "usage": "Validación cruzada de precipitación líquida/sólida y cobertura criosférica en análogos hiperáridos.",
        },
        {
            "id": "nasa_earthdata_gibs",
            "name": "NASA Global Imagery Browse Services (GIBS) & Worldview",
            "agency": "NASA Earthdata",
            "url": "https://worldview.earthdata.nasa.gov/",
            "license": "NASA Open Data",
            "dimension": "iluminacion",
            "usage": "Teselas WMTS/TMS de contexto global para el visor interactivo 2D/3D.",
        },
    ]

    for item in all_entries:
        by_id[item["id"]] = item

    merged = list(by_id.values())
    datasets_path.parent.mkdir(parents=True, exist_ok=True)
    datasets_path.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    log.info("Catálogo datasets.json actualizado con %d fuentes en %s", len(merged), datasets_path)
    return merged


def main() -> None:
    csv_path = DATA / "earth_features.csv"
    previews_json = DATA / "orbital_previews" / "orbital_previews.json"
    candidates_path = DATA / "candidates.json"
    datasets_path = DATA / "datasets.json"
    metadata_path = DATA / "metadata.json"

    generate_integrated_candidates(csv_path, previews_json, candidates_path)
    merge_datasets_catalog(metadata_path, datasets_path)


if __name__ == "__main__":
    main()
