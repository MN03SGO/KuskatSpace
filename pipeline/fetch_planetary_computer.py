"""
Pipeline de Extracción Geoespacial: Microsoft Planetary Computer STAC
=====================================================================
Proyecto: TerraAnáloga - NASA Space Apps Challenge 2026
Reto: Identify Earth Locations that Analog Permanent Moon Base & Mars

Consulta colecciones STAC en Planetary Computer:
1. 'cop-dem-glo-90': Modelo Digital de Elevación Copernicus (90 m) con
   corrección de pendiente por cos(latitud) y Sky View Factor (SVF).
2. 'modis-11A2-061': Temperatura superficial MODIS LST 8-Day (4 fechas 2025)
   en proyección Sinusoidal recortada explícitamente a EPSG:4326.
3. 'modis-10A2-061': Cobertura nival/hielo MODIS 8-Day (4 fechas 2025)
   en proyección Sinusoidal recortada explícitamente a EPSG:4326.
4. 'esa-worldcover': Máscara de vegetación (clases 10, 20, 30) y hielo
   permanente (clase 70) con exención para sitios curados.
"""

from __future__ import annotations

import json
import math
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import planetary_computer
import pystac_client
import rioxarray

STAC_API_URL = "https://planetarycomputer.microsoft.com/api/stac/v1"
SEASONAL_DATES_2025 = ("2025-01-15", "2025-04-15", "2025-07-15", "2025-10-15")

PIPELINE_DIR = Path(__file__).resolve().parent
ROOT_DIR = PIPELINE_DIR.parent
DATA_DIR = ROOT_DIR / "data"
CACHE_PATH = PIPELINE_DIR / "cache_points.jsonl"

# 20 sitios curados estratégicos (validación clásica + subestudiados + Centroamérica)
CURATED_SITES: List[Dict[str, Any]] = [
    # --- MOON SOUTH POLE (7 sitios) ---
    {
        "_id": "site_01",
        "name": "Valles Secos de McMurdo (Taylor & Wright)",
        "country": "Antártida",
        "target": "moon_south_pole",
        "analog_type": "process",
        "is_understudied": False,
        "is_curated": True,
        "lat": -77.50,
        "lon": 162.50,
        "similar_values": [
            "temperaturas superficiales invernales extremas y sublimación hiperárida",
            "pendientes de morrenas y valles glaciares comparables a crestas lunares",
            "alta latitud polar con régimen solar rasante",
        ],
        "similar_processes": [
            "sublimación directa de hielo bajo regolito hiperárido sin fase líquida",
            "atrapamiento térmico topográfico en depresiones frías",
            "meteorización física crioclástica en ausencia de lluvia",
        ],
        "earth_limits": [
            "gravedad terrestre 1.0g frente a 0.165g lunar",
            "presencia de atmósfera polar densa frente a vacío ultra-alto",
            "ausencia de bombardeo de micrometeoritos y radiación GCR directa",
        ],
        "exploration_use": "Validación de perforadoras criogénicas ISRU, rovers de prospección autónoma y muestreo de hielo prístino.",
        "datasets": ["cop-dem-glo-90", "modis-11A2-061", "modis-10A2-061", "esa-worldcover"],
    },
    {
        "_id": "site_02",
        "name": "Cráter Haughton (Devon Island)",
        "country": "Nunavut, Canadá",
        "target": "moon_south_pole",
        "analog_type": "morphologic",
        "is_understudied": False,
        "is_curated": True,
        "lat": 75.38,
        "lon": -89.68,
        "similar_values": [
            "estructura de impacto de ~23 km con brechas fragmentadas",
            "régimen de sol rasante ártico y noche polar prolongada",
            "permafrost continuo en roca silícea fracturada",
        ],
        "similar_processes": [
            "morfometría de cráteres de impacto complejos",
            "patrones de sombras rasantes análogos a crestas polares lunares",
            "fragmentación de regolito por ciclos criogénicos",
        ],
        "earth_limits": [
            "erosión hídrica y glaciar post-impacto ausente en la Luna",
            "gravedad 1.0g frente a 0.165g y presencia de atmósfera",
            "presencia de biosfera ártica y campo geomagnético",
        ],
        "exploration_use": "Entrenamiento de astronautas en geología de impacto, pruebas EVA y conducción de rovers en terreno quebrado.",
        "datasets": ["cop-dem-glo-90", "modis-11A2-061", "modis-10A2-061", "esa-worldcover"],
    },
    {
        "_id": "site_03",
        "name": "Cráter Pingualuit (Nunavik)",
        "country": "Quebec, Canadá",
        "target": "moon_south_pole",
        "analog_type": "morphologic",
        "is_understudied": True,
        "is_curated": True,
        "lat": 61.28,
        "lon": -73.66,
        "similar_values": [
            "cráter simple circular de ~3.4 km con borde elevado prístino",
            "pendientes internas de pared de cráter y persistencia nival invernal",
            "basamento cristalino de escasa cobertura vegetal en latitud subártica",
        ],
        "similar_processes": [
            "geometría de cráter simple sin pico central análoga a cráteres polares menores",
            "acumulación fría protegida por geometría de borde",
        ],
        "earth_limits": [
            "presencia de lago líquido estacional en el interior (inexistente en la Luna)",
            "gravedad 1.0g y atmósfera terrestre",
            "precipitación nival atmosférica frente a implantación/migración de volátiles",
        ],
        "exploration_use": "Pruebas de navegación autónoma en bordes de cráteres simples y descenso con inclinómetro.",
        "datasets": ["cop-dem-glo-90", "modis-11A2-061", "modis-10A2-061", "esa-worldcover"],
    },
    {
        "_id": "site_04",
        "name": "Volcán Licancabur / Meseta de Chajnantor",
        "country": "Antofagasta, Chile / Bolivia",
        "target": "moon_south_pole",
        "analog_type": "process",
        "is_understudied": True,
        "is_curated": True,
        "lat": -22.83,
        "lon": -67.88,
        "similar_values": [
            "altitud > 5,000 m con baja presión atmosférica relativa y radiación UV extrema",
            "pendientes volcánicas despejadas y baja humedad superficial",
            "oscilación térmica diurna pronunciada",
        ],
        "similar_processes": [
            "desecación extrema y estabilidad de volátiles en altura",
            "operación óptica y solar con cielo despejado (alto SVF)",
        ],
        "earth_limits": [
            "latitud tropical (sin noche polar ni sol rasante continuo)",
            "gravedad 1.0g y ~50% de presión atmosférica terrestre",
        ],
        "exploration_use": "Pruebas de sistemas fotovoltaicos, óptica de navegación y trajes presurizados en alta montaña.",
        "datasets": ["cop-dem-glo-90", "modis-11A2-061", "modis-10A2-061", "esa-worldcover"],
    },
    {
        "_id": "site_05",
        "name": "Monte Erebus (Isla de Ross)",
        "country": "Antártida",
        "target": "moon_south_pole",
        "analog_type": "process",
        "is_understudied": True,
        "is_curated": True,
        "lat": -77.53,
        "lon": 167.15,
        "similar_values": [
            "latitud polar extrema (~77.5°S) con sol rasante",
            "terreno volcánico basáltico/fonolítico cubierto de hielo",
            "temperaturas superficiales sub-cero permanentes",
        ],
        "similar_processes": [
            "interacción hielo-roca volcánica en régimen criogénico polar",
            "sombras topográficas prolongadas en crestas de alta pendiente",
        ],
        "earth_limits": [
            "actividad fumarólica e hidrotermal activa inexistente en la Luna actual",
            "gravedad 1.0g y atmósfera terrestre",
        ],
        "exploration_use": "Validación de rovers en laderas heladas de alta pendiente y sensores térmicos en entornos polares.",
        "datasets": ["cop-dem-glo-90", "modis-11A2-061", "modis-10A2-061", "esa-worldcover"],
    },
    {
        "_id": "site_06",
        "name": "Adventdalen / Meseta de Platåberget (Svalbard)",
        "country": "Svalbard, Noruega",
        "target": "moon_south_pole",
        "analog_type": "process",
        "is_understudied": False,
        "is_curated": True,
        "lat": 78.22,
        "lon": 15.40,
        "similar_values": [
            "latitud 78.2°N con cuatro meses de noche polar continua",
            "mesetas despejadas de alto SVF sobre permafrost ártico",
            "cobertura nival persistente gran parte del año",
        ],
        "similar_processes": [
            "ciclos de iluminación polar rasante y gestión energética en baja elevación solar",
            "dinámica de permafrost y suelo poligonal",
        ],
        "earth_limits": [
            "influencia oceánica del Ártico que modera temperaturas frente a PSR lunares",
            "gravedad 1.0g y atmósfera terrestre",
        ],
        "exploration_use": "Ensayos de teleoperación con baja elevación solar, comunicaciones polares y microrredes.",
        "datasets": ["cop-dem-glo-90", "modis-11A2-061", "modis-10A2-061", "esa-worldcover"],
    },
    {
        "_id": "site_07",
        "name": "Meseta de Thule / Pituffik (Borde Libre de Hielo)",
        "country": "Groenlandia",
        "target": "moon_south_pole",
        "analog_type": "process",
        "is_understudied": True,
        "is_curated": True,
        "lat": 76.53,
        "lon": -68.70,
        "similar_values": [
            "latitud 76.5°N con régimen polar extremo",
            "contacto directo entre regolito rocoso expuesto y hielo glaciar",
            "temperaturas invernales severas y alta reflectancia superficial",
        ],
        "similar_processes": [
            "transición regolito seco a hielo masivo análoga a márgenes de PSR",
            "iluminación rasante sobre crestas costeras",
        ],
        "earth_limits": [
            "presencia de atmósfera, viento catabático y precipitaciones",
            "gravedad 1.0g frente a 0.165g lunar",
        ],
        "exploration_use": "Pruebas de radares de penetración terrestre (GPR) para mapeo de hielo subsuperficial.",
        "datasets": ["cop-dem-glo-90", "modis-11A2-061", "modis-10A2-061", "esa-worldcover"],
    },
    # --- MOON LAVA TUBE (7 sitios, incluyendo Centroamérica / El Salvador) ---
    {
        "_id": "site_08",
        "name": "Cráter El Boquerón (Volcán de San Salvador)",
        "country": "El Salvador",
        "target": "moon_lava_tube",
        "analog_type": "morphologic",
        "is_understudied": True,
        "is_curated": True,
        "lat": 13.73,
        "lon": -89.29,
        "similar_values": [
            "cráter de colapso profundo con paredes basáltico-andesíticas escarpadas",
            "latitud tropical baja comparable al cinturón ecuatorial lunar",
            "oclusión topográfica marcada en el fondo del cráter",
        ],
        "similar_processes": [
            "colapso gravitacional de paredes volcánicas y taludes de bloques",
            "restricción de línea de vista y visibilidad del cielo (SVF reducido) para comunicaciones",
        ],
        "earth_limits": [
            "cobertura vegetal tropical en laderas (exenta por ser análogo geomorfológico de subsuelo)",
            "resolución DEM 90 m no resuelve claraboyas métricas individuales (< 90 m)",
            "gravedad 1.0g y atmósfera húmeda frente a vacío lunar",
        ],
        "exploration_use": "Pruebas de descenso por cable/rapel de rovers en escarpes volcánicos y relés de comunicación en cráteres.",
        "datasets": ["cop-dem-glo-90", "modis-11A2-061", "modis-10A2-061", "esa-worldcover"],
    },
    {
        "_id": "site_09",
        "name": "Volcán Chaparrastique (San Miguel)",
        "country": "El Salvador",
        "target": "moon_lava_tube",
        "analog_type": "morphologic",
        "is_understudied": True,
        "is_curated": True,
        "lat": 13.43,
        "lon": -88.27,
        "similar_values": [
            "coladas basálticas jóvenes de escoria y bloques con alta rugosidad",
            "pendientes pronunciadas en cono y flancos volcánicos",
            "ausencia de cobertura nival/hielo",
        ],
        "similar_processes": [
            "emplazamiento de flujos basálticos 'aa' y 'pahoehoe' y conductos lávicos",
            "tránsito sobre regolito volcánico suelto y clastos angulosos",
        ],
        "earth_limits": [
            "vegetación tropical en sectores bajos (exenta en curados)",
            "resolución DEM 90 m limita detección de oquedades sub-pixel",
            "gravedad 1.0g, atmósfera y meteorización húmeda",
        ],
        "exploration_use": "Evaluación de tracción de ruedas/patas sobre coladas basálticas jóvenes y mapeo LiDAR de conductos.",
        "datasets": ["cop-dem-glo-90", "modis-11A2-061", "modis-10A2-061", "esa-worldcover"],
    },
    {
        "_id": "site_10",
        "name": "Parque Nacional Volcán Masaya (Cráter Santiago)",
        "country": "Nicaragua",
        "target": "moon_lava_tube",
        "analog_type": "morphologic",
        "is_understudied": True,
        "is_curated": True,
        "lat": 11.98,
        "lon": -86.16,
        "similar_values": [
            "cráteres de pozo (pit craters) basálticos con paredes subverticales",
            "tubos de lava conocidos en el complejo volcánico (Cueva Tzinaconostoc)",
            "latitud ecuatorial/tropical baja (~12°N)",
        ],
        "similar_processes": [
            "formación de pit craters por drenaje de cámara magmática y colapso de techo",
            "aislamiento térmico y geométrico en cavernas basálticas",
        ],
        "earth_limits": [
            "desgasificación volcánica activa e hidrotermalismo ausentes en Mare Tranquillitatis",
            "resolución DEM 90 m no resuelve entradas de cuevas individuales",
            "gravedad 1.0g y atmósfera terrestre",
        ],
        "exploration_use": "Validación de drones/rovers exploradores de cavernas con SLAM sin GPS y mapeo 3D subterráneo.",
        "datasets": ["cop-dem-glo-90", "modis-11A2-061", "modis-10A2-061", "esa-worldcover"],
    },
    {
        "_id": "site_11",
        "name": "Lava Beds National Monument",
        "country": "California, EE. UU.",
        "target": "moon_lava_tube",
        "analog_type": "morphologic",
        "is_understudied": False,
        "is_curated": True,
        "lat": 41.71,
        "lon": -121.51,
        "similar_values": [
            "mayor concentración de tubos de lava basálticos y claraboyas en Norteamérica",
            "bloques de colapso (breakdown) y pisos internos planos",
            "ausencia de hielo superficial persistente en verano",
        ],
        "similar_processes": [
            "propagación térmica en conductos basálticos y colapso de claraboyas",
            "atenuación de señales de radio en túneles volcánicos",
        ],
        "earth_limits": [
            "vegetación semiárida superficial (exenta por ser sitio curado de subsuelo)",
            "resolución DEM 90 m promedia claraboyas de < 50 m",
            "gravedad 1.0g y atmósfera terrestre",
        ],
        "exploration_use": "Banco estándar NASA/PSTAR para robótica subterránea, hábitats inflables en túneles y detección gravimétrica.",
        "datasets": ["cop-dem-glo-90", "modis-11A2-061", "modis-10A2-061", "esa-worldcover"],
    },
    {
        "_id": "site_12",
        "name": "Craters of the Moon National Monument",
        "country": "Idaho, EE. UU.",
        "target": "moon_lava_tube",
        "analog_type": "morphologic",
        "is_understudied": False,
        "is_curated": True,
        "lat": 43.46,
        "lon": -113.56,
        "similar_values": [
            "campos extensos de basaltos de inundación con tubos y grietas",
            "pendientes moderadas a escarpadas en conos y coladas",
            "baja cobertura arbórea",
        ],
        "similar_processes": [
            "morfología de basaltos de inundación análoga a maria lunares",
            "colapso de techos de tubos de lava y formación de trincheras",
        ],
        "earth_limits": [
            "latitud media (43°N) con estacionalidad nival invernal",
            "gravedad 1.0g y atmósfera terrestre",
        ],
        "exploration_use": "Entrenamiento geológico de astronautas, caracterización espectral de basaltos y prospección de cavidades.",
        "datasets": ["cop-dem-glo-90", "modis-11A2-061", "modis-10A2-061", "esa-worldcover"],
    },
    {
        "_id": "site_13",
        "name": "Cueva de los Verdes / Corona (Lanzarote)",
        "country": "Islas Canarias, España",
        "target": "moon_lava_tube",
        "analog_type": "morphologic",
        "is_understudied": False,
        "is_curated": True,
        "lat": 29.16,
        "lon": -13.44,
        "similar_values": [
            "megatubo volcánico de ~7 km con múltiples jameos (claraboyas)",
            "terreno basáltico árido prácticamente libre de vegetación",
            "ausencia total de hielo superficial",
        ],
        "similar_processes": [
            "arquitectura de tubos volcánicos de gran diámetro comparables a tubos lunares",
            "estabilidad térmica interior frente a variación superficial",
        ],
        "earth_limits": [
            "escala terrestre (~20 m ancho) menor que tubos lunares teóricos (> 100 m por baja gravedad)",
            "gravedad 1.0g, humedad marina y atmósfera",
        ],
        "exploration_use": "Programa ESA PANGAEA: entrenamiento de astronautas y despliegue de robots multi-agente en cuevas.",
        "datasets": ["cop-dem-glo-90", "modis-11A2-061", "modis-10A2-061", "esa-worldcover"],
    },
    {
        "_id": "site_14",
        "name": "Campo Volcánico de Krafla / Grjótagjá",
        "country": "Islandia",
        "target": "moon_lava_tube",
        "analog_type": "morphologic",
        "is_understudied": False,
        "is_curated": True,
        "lat": 65.71,
        "lon": -16.78,
        "similar_values": [
            "fisuras basálticas recientes, cavidades lávicas y regolito vítreo",
            "bajas temperaturas superficiales y escasa vegetación",
        ],
        "similar_processes": [
            "tectónica extensional en basaltos y formación de oquedades subsuperficiales",
            "abrasión por ceniza y escoria basáltica",
        ],
        "earth_limits": [
            "latitud subártica (65.7°N) con nieve invernal y actividad geotérmica",
            "gravedad 1.0g y atmósfera terrestre",
        ],
        "exploration_use": "Validación de sensores GPR, trajes EVA y movilidad sobre basalto fracturado frío.",
        "datasets": ["cop-dem-glo-90", "modis-11A2-061", "modis-10A2-061", "esa-worldcover"],
    },
    # --- MARS (6 sitios) ---
    {
        "_id": "site_15",
        "name": "Cuenca Hiperárida de Qaidam",
        "country": "Meseta Tibetana, China",
        "target": "mars",
        "analog_type": "process",
        "is_understudied": True,
        "is_curated": True,
        "lat": 37.85,
        "lon": 93.45,
        "similar_values": [
            "planicie hiperárida de alta altitud (~3,000 m) con yardangs y playas salinas",
            "pendientes suaves (< 5°) y alta apertura topográfica (SVF > 0.85)",
            "latitud media (~37.8°N) y fuertes amplitudes térmicas",
        ],
        "similar_processes": [
            "deflación eólica intensa, formación de yardangs y dunas",
            "precipitación de evaporitas (sulfatos y cloruros) análoga a cuencas lacustres marcianas",
        ],
        "earth_limits": [
            "presión atmosférica terrestre (~700 hPa) frente a 6.1 hPa de CO2 en Marte",
            "gravedad 1.0g frente a 0.38g marciana",
        ],
        "exploration_use": "Pruebas de rovers de largo alcance en planicies evaporíticas y espectrómetros Raman/LIBS.",
        "datasets": ["cop-dem-glo-90", "modis-11A2-061", "modis-10A2-061", "esa-worldcover"],
    },
    {
        "_id": "site_16",
        "name": "Puna de Atacama (Salar de Arizaro)",
        "country": "Salta, Argentina",
        "target": "mars",
        "analog_type": "process",
        "is_understudied": True,
        "is_curated": True,
        "lat": -24.60,
        "lon": -67.75,
        "similar_values": [
            "cuenca endorreica hiperárida a ~3,500 m con costras salinas y dunas",
            "pendientes bajas, horizonte despejado y radiación UV elevada",
            "baja humedad y latitud subtropical (~24.6°S)",
        ],
        "similar_processes": [
            "formación de costras de halita/yeso y polígonos de desecación",
            "transporte eólico de polvo fino y arena basáltica",
        ],
        "earth_limits": [
            "atmósfera de N2/O2 mucho más densa que Marte",
            "gravedad 1.0g frente a 0.38g",
        ],
        "exploration_use": "Validación de detección de biofirmas en sales evaporíticas y pruebas de polvo en paneles solares.",
        "datasets": ["cop-dem-glo-90", "modis-11A2-061", "modis-10A2-061", "esa-worldcover"],
    },
    {
        "_id": "site_17",
        "name": "Valle de la Luna / Yungay (Desierto de Atacama)",
        "country": "Antofagasta, Chile",
        "target": "mars",
        "analog_type": "process",
        "is_understudied": False,
        "is_curated": True,
        "lat": -24.08,
        "lon": -69.92,
        "similar_values": [
            "suelos hiperáridos con nitratos, percloratos y sulfatos",
            "vegetación prácticamente nula y pendientes suaves a moderadas",
            "latitud ~24°S con alta insolación",
        ],
        "similar_processes": [
            "acumulación atmosférica de sales oxidantes en ausencia de lavado hídrico",
            "preservación extrema de materia orgánica en regolito seco",
        ],
        "earth_limits": [
            "presencia de niebla costera ocasional (camanchaca) en sectores occidentales",
            "gravedad 1.0g y atmósfera terrestre",
        ],
        "exploration_use": "Calibración de instrumentos de astrobiología (perforación y detección orgánica) para misiones tipo Rosalind Franklin/MSR.",
        "datasets": ["cop-dem-glo-90", "modis-11A2-061", "modis-10A2-061", "esa-worldcover"],
    },
    {
        "_id": "site_18",
        "name": "Wadi Rum (Desierto Basáltico-Arenisco)",
        "country": "Jordania",
        "target": "mars",
        "analog_type": "morphologic",
        "is_understudied": False,
        "is_curated": True,
        "lat": 29.57,
        "lon": 35.42,
        "similar_values": [
            "latitud 29.6°N coincidente con banda subtropical marciana",
            "arenas ricas en óxidos de hierro sobre planicies y mesas",
            "horizonte despejado y cielo árido",
        ],
        "similar_processes": [
            "saltación eólica sobre sustratos duros y abanicos aluviales secos",
            "oxidación superficial de hierro en areniscas",
        ],
        "earth_limits": [
            "litología dominada por areniscas cuarcíticas frente a basaltos marcianos",
            "gravedad 1.0g y atmósfera terrestre",
        ],
        "exploration_use": "Pruebas de hábitats análogos (AMADEE), logística EVA y navegación autónoma de rovers.",
        "datasets": ["cop-dem-glo-90", "modis-11A2-061", "modis-10A2-061", "esa-worldcover"],
    },
    {
        "_id": "site_19",
        "name": "Río Tinto (Faja Pirítica Ibérica)",
        "country": "Huelva, España",
        "target": "mars",
        "analog_type": "process",
        "is_understudied": False,
        "is_curated": True,
        "lat": 37.70,
        "lon": -6.55,
        "similar_values": [
            "depósitos masivos de jarosita, hematita y sulfatos de hierro",
            "latitud ~37.7°N y pendientes moderadas de cuenca minera/fluvial",
        ],
        "similar_processes": [
            "alteración ácida sulfatada análoga a Meridiani Planum y Gale",
            "precipitación de óxidos de hierro en ambientes ácidos",
        ],
        "earth_limits": [
            "presencia de agua líquida superficial permanente y vegetación mediterránea circundante (exenta en curados)",
            "gravedad 1.0g y atmósfera terrestre",
        ],
        "exploration_use": "Pruebas de perforación (proyecto MARTE) y espectrometría Mössbauer/Raman para minerales hidratados.",
        "datasets": ["cop-dem-glo-90", "modis-11A2-061", "modis-10A2-061", "esa-worldcover"],
    },
    {
        "_id": "site_20",
        "name": "Meseta de Hanksville / MDRS (Utah)",
        "country": "Utah, EE. UU.",
        "target": "mars",
        "analog_type": "morphologic",
        "is_understudied": False,
        "is_curated": True,
        "lat": 38.41,
        "lon": -110.78,
        "similar_values": [
            "latitud 38.4°N, planicies arcillosas (bentonita/esmectita) y canales invertidos",
            "pendientes bajas en llanuras y escarpes estratificados",
            "escasa vegetación desértica",
        ],
        "similar_processes": [
            "preservación de paleocanales fluviales invertidos análogos a Jezero/Eberswalde",
            "exposición de filosilicatos y sulfatos sedimentarios",
        ],
        "earth_limits": [
            "lluvias torrenciales estacionales e intemperismo húmedo ausentes en Marte actual",
            "gravedad 1.0g y atmósfera terrestre",
        ],
        "exploration_use": "Simulaciones de misión tripulada (MDRS), geología de campo con rovers y muestreo de arcillas.",
        "datasets": ["cop-dem-glo-90", "modis-11A2-061", "modis-10A2-061", "esa-worldcover"],
    },
]


def get_bounding_box(lat: float, lon: float, buffer_km: float = 5.0) -> Tuple[float, float, float, float]:
    """Calcula [min_lon, min_lat, max_lon, max_lat] en WGS84 alrededor de (lat, lon)."""
    delta_lat = buffer_km / 111.0
    cos_lat = max(math.cos(math.radians(abs(lat))), 0.05)
    delta_lon = buffer_km / (111.0 * cos_lat)
    return (
        max(-180.0, lon - delta_lon),
        max(-90.0, lat - delta_lat),
        min(180.0, lon + delta_lon),
        min(90.0, lat + delta_lat),
    )


def compute_svf(dem_array: np.ndarray, dx_m: float, dy_m: float, max_radius_px: int = 12) -> Optional[float]:
    """
    Calcula el Sky View Factor (SVF, 0.0 a 1.0) promedio sobre una sub-ventana central
    trazando 8 direcciones acimutales sobre el DEM con espaciado (dx_m, dy_m).
    """
    rows, cols = dem_array.shape
    if rows < 5 or cols < 5:
        return None

    directions = [
        (0, 1), (1, 1), (1, 0), (1, -1),
        (0, -1), (-1, -1), (-1, 0), (-1, 1),
    ]

    r_start = max(1, rows // 3)
    r_end = min(rows - 1, (2 * rows) // 3 + 1)
    c_start = max(1, cols // 3)
    c_end = min(cols - 1, (2 * cols) // 3 + 1)

    step_r = max(1, (r_end - r_start) // 4)
    step_c = max(1, (c_end - c_start) // 4)

    svf_samples: List[float] = []
    for r0 in range(r_start, r_end, step_r):
        for c0 in range(c_start, c_end, step_c):
            z0 = dem_array[r0, c0]
            if not np.isfinite(z0) or z0 <= -500 or z0 >= 9000:
                continue

            sin_horizons: List[float] = []
            for dr, dc in directions:
                max_angle = 0.0
                for step in range(1, max_radius_px + 1):
                    rr = r0 + dr * step
                    cc = c0 + dc * step
                    if rr < 0 or rr >= rows or cc < 0 or cc >= cols:
                        break
                    z = dem_array[rr, cc]
                    if not np.isfinite(z) or z <= -500 or z >= 9000:
                        continue
                    dist_m = math.hypot(dc * step * dx_m, dr * step * dy_m)
                    if dist_m <= 0:
                        continue
                    angle = math.atan2(z - z0, dist_m)
                    if angle > max_angle:
                        max_angle = angle
                sin_horizons.append(math.sin(max(0.0, max_angle)))

            if sin_horizons:
                svf_samples.append(max(0.0, min(1.0, 1.0 - float(np.mean(sin_horizons)))))

    if not svf_samples:
        return None
    return round(float(np.mean(svf_samples)), 4)


def compute_terrain_metrics(dem_array: np.ndarray, lat: float) -> Optional[Dict[str, float]]:
    """
    Calcula métricas topográficas del DEM Copernicus 90 m con corrección de
    espaciado horizontal por latitud: dx = 90.0 * cos(lat), dy = 90.0.
    """
    valid_mask = np.isfinite(dem_array) & (dem_array > -500) & (dem_array < 9000)
    if not np.any(valid_mask):
        return None

    dx_m = 90.0 * max(math.cos(math.radians(abs(lat))), 0.05)
    dy_m = 90.0

    valid_elev = dem_array[valid_mask]
    gy, gx = np.gradient(dem_array, dy_m, dx_m)
    slope_deg = np.degrees(np.arctan(np.sqrt(gx**2 + gy**2)))
    valid_slope = slope_deg[valid_mask]
    valid_slope = valid_slope[np.isfinite(valid_slope)]
    if len(valid_slope) == 0:
        return None

    svf = compute_svf(dem_array, dx_m=dx_m, dy_m=dy_m)
    if svf is None:
        return None

    return {
        "elevation_mean_m": round(float(np.nanmean(valid_elev)), 2),
        "elevation_min_m": round(float(np.nanmin(valid_elev)), 2),
        "elevation_max_m": round(float(np.nanmax(valid_elev)), 2),
        "slope_mean_deg": round(float(np.nanmean(valid_slope)), 2),
        "slope_p90_deg": round(float(np.nanpercentile(valid_slope, 90)), 2),
        "roughness_m": round(float(np.nanstd(valid_elev)), 2),
        "svf": svf,
    }


def _date_window(date_str: str, half_days: int = 10) -> str:
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    start = (dt - timedelta(days=half_days)).strftime("%Y-%m-%d")
    end = (dt + timedelta(days=half_days)).strftime("%Y-%m-%d")
    return f"{start}/{end}"


def fetch_dem_metrics(
    catalog: pystac_client.Client,
    bbox: Tuple[float, float, float, float],
    lat: float,
) -> Optional[Dict[str, float]]:
    """Consulta cop-dem-glo-90 con limit=4 y recorte en EPSG:4326."""
    search = catalog.search(collections=["cop-dem-glo-90"], bbox=bbox, limit=4)
    for item in search.items():
        if "data" not in item.assets:
            continue
        try:
            with rioxarray.open_rasterio(item.assets["data"].href) as rds:
                clipped = rds.rio.clip_box(
                    minx=bbox[0], miny=bbox[1], maxx=bbox[2], maxy=bbox[3], crs="EPSG:4326"
                )
                arr = clipped.values[0].astype(float)
                metrics = compute_terrain_metrics(arr, lat=lat)
                if metrics is not None:
                    return metrics
        except Exception:
            continue
    return None


def fetch_modis_lst(
    catalog: pystac_client.Client,
    bbox: Tuple[float, float, float, float],
) -> Optional[Dict[str, float]]:
    """
    Consulta modis-11A2-061 en 4 fechas estacionales de 2025, con limit=4 y
    recorte explícito crs='EPSG:4326'. Retorna temperaturas en Kelvin o None.
    """
    day_means_k: List[float] = []
    night_means_k: List[float] = []

    for date_str in SEASONAL_DATES_2025:
        search = catalog.search(
            collections=["modis-11A2-061"],
            bbox=bbox,
            datetime=_date_window(date_str, half_days=10),
            limit=4,
        )
        for item in search.items():
            if "LST_Day_1km" in item.assets:
                try:
                    with rioxarray.open_rasterio(item.assets["LST_Day_1km"].href) as rds_day:
                        clipped = rds_day.rio.clip_box(
                            minx=bbox[0], miny=bbox[1], maxx=bbox[2], maxy=bbox[3], crs="EPSG:4326"
                        )
                        vals = clipped.values[0].astype(float)
                        valid = vals[(vals > 0) & (vals < 65535)]
                        if len(valid) > 0:
                            day_means_k.append(float(np.nanmean(valid)) * 0.02)
                except Exception:
                    pass

            if "LST_Night_1km" in item.assets:
                try:
                    with rioxarray.open_rasterio(item.assets["LST_Night_1km"].href) as rds_night:
                        clipped = rds_night.rio.clip_box(
                            minx=bbox[0], miny=bbox[1], maxx=bbox[2], maxy=bbox[3], crs="EPSG:4326"
                        )
                        vals = clipped.values[0].astype(float)
                        valid = vals[(vals > 0) & (vals < 65535)]
                        if len(valid) > 0:
                            night_means_k.append(float(np.nanmean(valid)) * 0.02)
                except Exception:
                    pass

    all_k = day_means_k + night_means_k
    if not all_k:
        return None

    lst_day_k = round(float(np.mean(day_means_k)), 2) if day_means_k else None
    lst_night_k = round(float(np.mean(night_means_k)), 2) if night_means_k else None
    lst_mean_k = round(float(np.mean(all_k)), 2)
    lst_min_k = round(float(np.min(all_k)), 2)

    result: Dict[str, float] = {
        "lst_mean_k": lst_mean_k,
        "lst_min_k": lst_min_k,
    }
    if lst_day_k is not None:
        result["lst_day_mean_k"] = lst_day_k
    if lst_night_k is not None:
        result["lst_night_mean_k"] = lst_night_k
    return result


def fetch_modis_snow(
    catalog: pystac_client.Client,
    bbox: Tuple[float, float, float, float],
) -> Optional[float]:
    """
    Consulta modis-10A2-061 en 4 fechas estacionales de 2025, con limit=4 y
    recorte crs='EPSG:4326'. Calcula persistencia de nieve/hielo [0.0, 1.0].
    En MOD10A2: 200 = nieve/hielo, 25 = suelo sin nieve.
    """
    fractions: List[float] = []

    for date_str in SEASONAL_DATES_2025:
        search = catalog.search(
            collections=["modis-10A2-061"],
            bbox=bbox,
            datetime=_date_window(date_str, half_days=10),
            limit=4,
        )
        for item in search.items():
            asset_key = "Maximum_Snow_Extent" if "Maximum_Snow_Extent" in item.assets else "Eight_Day_Snow_Cover"
            if asset_key not in item.assets:
                continue
            try:
                with rioxarray.open_rasterio(item.assets[asset_key].href) as rds:
                    clipped = rds.rio.clip_box(
                        minx=bbox[0], miny=bbox[1], maxx=bbox[2], maxy=bbox[3], crs="EPSG:4326"
                    )
                    vals = clipped.values[0]
                    snow_px = int(np.sum(vals == 200))
                    land_px = int(np.sum((vals == 200) | (vals == 25)))
                    if land_px > 0:
                        fractions.append(snow_px / land_px)
            except Exception:
                continue

    if not fractions:
        return None
    return round(float(np.mean(fractions)), 4)


def fetch_worldcover(
    catalog: pystac_client.Client,
    bbox: Tuple[float, float, float, float],
) -> Dict[str, Any]:
    """
    Consulta esa-worldcover (10 m). Si no hay cobertura (Antártida > 60°S o > 84°N,
    o nodata), asume vegetation_fraction = 0.0 y permanent_ice_fraction = 0.0.
    """
    try:
        search = catalog.search(collections=["esa-worldcover"], bbox=bbox, limit=4)
        for item in search.items():
            if "map" not in item.assets:
                continue
            try:
                with rioxarray.open_rasterio(item.assets["map"].href) as rds:
                    clipped = rds.rio.clip_box(
                        minx=bbox[0], miny=bbox[1], maxx=bbox[2], maxy=bbox[3], crs="EPSG:4326"
                    )
                    vals = clipped.values[0]
                    valid = vals[vals > 0]
                    if len(valid) == 0:
                        continue
                    veg_px = int(np.sum((valid == 10) | (valid == 20) | (valid == 30)))
                    ice_px = int(np.sum(valid == 70))
                    total = len(valid)
                    return {
                        "worldcover_coverage": True,
                        "vegetation_fraction": round(veg_px / total, 4),
                        "permanent_ice_fraction": round(ice_px / total, 4),
                    }
            except Exception:
                continue
    except Exception:
        pass

    return {
        "worldcover_coverage": False,
        "vegetation_fraction": 0.0,
        "permanent_ice_fraction": 0.0,
    }


def load_cache(cache_path: Path = CACHE_PATH) -> Dict[str, Dict[str, Any]]:
    """Carga puntos ya procesados desde cache_points.jsonl para reanudar sin repetir descargas."""
    cached: Dict[str, Dict[str, Any]] = {}
    if not cache_path.exists():
        return cached
    with open(cache_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
                if "_id" in rec:
                    cached[rec["_id"]] = rec
            except json.JSONDecodeError:
                continue
    return cached


def append_cache(record: Dict[str, Any], cache_path: Path = CACHE_PATH) -> None:
    """Guarda inmediatamente un punto procesado en cache_points.jsonl."""
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    with open(cache_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


def fetch_site_metrics(
    site: Dict[str, Any],
    catalog: pystac_client.Client,
    buffer_km: float = 5.0,
) -> Dict[str, Any]:
    """Extrae todas las métricas reales de Planetary Computer para un sitio."""
    lat = float(site["lat"])
    lon = float(site["lon"])
    is_curated = bool(site.get("is_curated", False))
    bbox = get_bounding_box(lat, lon, buffer_km=buffer_km)

    wc = fetch_worldcover(catalog, bbox)
    veg_frac = float(wc["vegetation_fraction"])
    ice_perm_frac = float(wc["permanent_ice_fraction"])

    # Regla 4: Curados nunca se descartan por vegetación; malla sí (>15% veg o >80% hielo permanente)
    discard_reason: Optional[str] = None
    if not is_curated:
        if veg_frac > 0.15:
            discard_reason = f"vegetation_fraction={veg_frac:.2f} > 0.15"
        elif ice_perm_frac > 0.80:
            discard_reason = f"permanent_ice_fraction={ice_perm_frac:.2f} > 0.80"

    if discard_reason:
        return {
            **site,
            "location": {"type": "Point", "coordinates": [lon, lat]},
            "metrics": {
                **wc,
                "slope_mean_deg": None,
                "svf": None,
                "lst_mean_k": None,
                "lst_min_k": None,
                "ice_persistence": None,
            },
            "status": "discarded",
            "discard_reason": discard_reason,
        }

    dem_metrics = fetch_dem_metrics(catalog, bbox, lat=lat)
    lst_metrics = fetch_modis_lst(catalog, bbox)
    ice_persistence = fetch_modis_snow(catalog, bbox)

    metrics: Dict[str, Any] = {
        **wc,
        "elevation_mean_m": dem_metrics["elevation_mean_m"] if dem_metrics else None,
        "elevation_min_m": dem_metrics["elevation_min_m"] if dem_metrics else None,
        "elevation_max_m": dem_metrics["elevation_max_m"] if dem_metrics else None,
        "slope_mean_deg": dem_metrics["slope_mean_deg"] if dem_metrics else None,
        "slope_p90_deg": dem_metrics["slope_p90_deg"] if dem_metrics else None,
        "roughness_m": dem_metrics["roughness_m"] if dem_metrics else None,
        "svf": dem_metrics["svf"] if dem_metrics else None,
        "lst_mean_k": lst_metrics["lst_mean_k"] if lst_metrics else None,
        "lst_min_k": lst_metrics["lst_min_k"] if lst_metrics else None,
        "lst_day_mean_k": lst_metrics.get("lst_day_mean_k") if lst_metrics else None,
        "lst_night_mean_k": lst_metrics.get("lst_night_mean_k") if lst_metrics else None,
        "ice_persistence": ice_persistence,
    }

    required_ok = (
        metrics["slope_mean_deg"] is not None
        and metrics["svf"] is not None
        and metrics["lst_mean_k"] is not None
        and metrics["ice_persistence"] is not None
    )

    return {
        **site,
        "location": {"type": "Point", "coordinates": [lon, lat]},
        "metrics": metrics,
        "status": "ok" if required_ok else "incomplete",
    }


def run_pipeline(sites: Optional[List[Dict[str, Any]]] = None, buffer_km: float = 5.0) -> List[Dict[str, Any]]:
    """Ejecuta el pipeline incremental con caché en disco y exporta data/candidates.json."""
    from compute_scores import compute_and_export_candidates

    target_sites = sites if sites is not None else CURATED_SITES
    cached = load_cache(CACHE_PATH)
    catalog = pystac_client.Client.open(STAC_API_URL, modifier=planetary_computer.sign_inplace)

    records: List[Dict[str, Any]] = []
    for idx, site in enumerate(target_sites, start=1):
        site_id = site["_id"]
        if site_id in cached and cached[site_id].get("status") in ("ok", "discarded"):
            print(f"[{idx}/{len(target_sites)}] Cache hit: {site_id} ({site['name']})")
            records.append(cached[site_id])
            continue

        print(f"[{idx}/{len(target_sites)}] Extrayendo Planetary Computer: {site_id} ({site['name']})...")
        rec = fetch_site_metrics(site, catalog=catalog, buffer_km=buffer_km)
        append_cache(rec, CACHE_PATH)
        cached[site_id] = rec
        records.append(rec)
        print(f"    -> status={rec['status']} slope={rec['metrics'].get('slope_mean_deg')} svf={rec['metrics'].get('svf')} lst_k={rec['metrics'].get('lst_mean_k')} ice={rec['metrics'].get('ice_persistence')}")

    valid_records = [r for r in records if r.get("status") == "ok"]
    print(f"[*] Puntos válidos extraídos: {len(valid_records)} / {len(records)}")
    candidates = compute_and_export_candidates(valid_records)
    print(f"[*] Exportados {len(candidates)} candidatos con puntajes reales a {DATA_DIR / 'candidates.json'}")
    return candidates


if __name__ == "__main__":
    run_pipeline()
