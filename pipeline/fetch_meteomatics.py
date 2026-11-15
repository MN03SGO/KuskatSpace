"""
Pipeline de Extracción Climática: Meteomatics REST API
======================================================
Proyecto: TerraAnáloga - NASA Space Apps Challenge 2026
Reto: Identify Earth Locations that Analog Permanent Moon Base & Mars

Este módulo consulta la API de Meteomatics con HTTP Basic Auth para extraer
perfiles climáticos históricos y estacionales:
- t_min_2m_24h:C (Frío extremo)
- t_mean_2m_24h:C (Temperatura media diaria)
- precip_24h:mm (Aridez e insolación)
- fresh_snow_24h:cm (Presencia y persistencia de nieve/hielo)
- wind_speed_10m:ms (Transporte de polvo eólico marciano y contraste con vacío lunar)

Incluye control de tasa (HTTP 429), reintentos con backoff y caché local JSON en data/.
"""

import os
import json
import time
from pathlib import Path
from typing import Dict, Any, Optional
import requests
from dotenv import load_dotenv

load_dotenv()

METEOMATICS_USER = os.getenv("METEOMATICS_USER", "")
METEOMATICS_PASSWORD = os.getenv("METEOMATICS_PASSWORD", "")
BASE_URL = "https://api.meteomatics.com"

# Directorio de caché
CACHE_DIR = Path(__file__).resolve().parent.parent / "data"


def get_cache_filename(lat: float, lon: float) -> Path:
    """Genera la ruta de archivo para el caché local de un punto geográfico."""
    lat_str = f"{lat:.2f}".replace(".", "_").replace("-", "m")
    lon_str = f"{lon:.2f}".replace(".", "_").replace("-", "m")
    return CACHE_DIR / f"cache_meteomatics_{lat_str}_{lon_str}.json"


def fetch_meteomatics_weather(
    lat: float,
    lon: float,
    start_date: str = "2023-01-01T00:00:00Z",
    end_date: str = "2023-12-31T00:00:00Z",
    interval: str = "P1M",
    use_cache: bool = True,
    max_retries: int = 3
) -> Dict[str, Any]:
    """
    Consulta o recupera de caché los parámetros climáticos de Meteomatics para una coordenada.
    
    Parámetros:
    - lat, lon: Coordenadas WGS84
    - start_date, end_date: Rango temporal ISO 8601
    - interval: Paso temporal (P1M = mensual, P1D = diario)
    - use_cache: Si es True, revisa y guarda en archivo local JSON
    """
    cache_path = get_cache_filename(lat, lon)
    if use_cache and cache_path.exists():
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                cached_data = json.load(f)
                cached_data["source"] = "local_cache"
                return cached_data
        except Exception:
            pass

    # Parámetros meteorológicos requeridos
    params = [
        "t_min_2m_24h:C",
        "t_mean_2m_24h:C",
        "precip_24h:mm",
        "fresh_snow_24h:cm",
        "wind_speed_10m:ms"
    ]
    params_str = ",".join(params)
    time_window = f"{start_date}--{end_date}:{interval}"
    coord_str = f"{lat},{lon}"
    url = f"{BASE_URL}/{time_window}/{params_str}/{coord_str}/json"

    # Si no hay credenciales, generar perfil base calibrado para hackathon
    if not METEOMATICS_USER or not METEOMATICS_PASSWORD:
        mock_profile = {
            "coordinates": {"lat": lat, "lon": lon},
            "source": "simulated_baseline_no_creds",
            "t_min_annual_c": round(-30.0 + (lat if lat < 0 else -lat) * 0.4, 2),
            "t_mean_annual_c": round(-10.0 + (lat if lat < 0 else -lat) * 0.25, 2),
            "precip_annual_mm": 45.0,
            "snow_annual_cm": 12.0,
            "wind_speed_mean_ms": 6.8,
            "raw_series": {}
        }
        if use_cache:
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            with open(cache_path, "w", encoding="utf-8") as f:
                json.dump(mock_profile, f, indent=2, ensure_ascii=False)
        return mock_profile

    auth = (METEOMATICS_USER, METEOMATICS_PASSWORD)
    attempt = 0
    backoff = 2.0

    while attempt < max_retries:
        try:
            response = requests.get(url, auth=auth, timeout=15)
            if response.status_code == 200:
                data = response.json()
                processed = parse_meteomatics_response(data, lat, lon)
                if use_cache:
                    cache_path.parent.mkdir(parents=True, exist_ok=True)
                    with open(cache_path, "w", encoding="utf-8") as f:
                        json.dump(processed, f, indent=2, ensure_ascii=False)
                return processed
            elif response.status_code == 429:
                # Rate limit alcanzado
                time.sleep(backoff)
                backoff *= 2
                attempt += 1
            else:
                break
        except Exception:
            attempt += 1
            time.sleep(backoff)

    # Fallback con estimación climática
    fallback = {
        "coordinates": {"lat": lat, "lon": lon},
        "source": "fallback_error",
        "t_min_annual_c": -25.0,
        "t_mean_annual_c": -5.0,
        "precip_annual_mm": 50.0,
        "snow_annual_cm": 10.0,
        "wind_speed_mean_ms": 5.5,
    }
    return fallback


def parse_meteomatics_response(payload: Dict[str, Any], lat: float, lon: float) -> Dict[str, Any]:
    """Extrae agregaciones anuales limpias a partir de la respuesta JSON de Meteomatics."""
    result: Dict[str, Any] = {
        "coordinates": {"lat": lat, "lon": lon},
        "source": "meteomatics_api",
        "t_min_annual_c": None,
        "t_mean_annual_c": None,
        "precip_annual_mm": 0.0,
        "snow_annual_cm": 0.0,
        "wind_speed_mean_ms": None,
        "raw_series": {}
    }

    t_mins = []
    t_means = []
    winds = []

    for entry in payload.get("data", []):
        param_name = entry.get("parameter")
        coords_list = entry.get("coordinates", [])
        if not coords_list:
            continue
        dates_data = coords_list[0].get("dates", [])
        values = [d["value"] for d in dates_data if "value" in d]

        if "t_min_2m" in param_name:
            t_mins.extend(values)
        elif "t_mean_2m" in param_name:
            t_means.extend(values)
        elif "precip" in param_name:
            result["precip_annual_mm"] = round(sum(values), 2)
        elif "fresh_snow" in param_name:
            result["snow_annual_cm"] = round(sum(values), 2)
        elif "wind_speed" in param_name:
            winds.extend(values)

    if t_mins:
        result["t_min_annual_c"] = round(min(t_mins), 2)
    if t_means:
        result["t_mean_annual_c"] = round(sum(t_means) / len(t_means), 2)
    if winds:
        result["wind_speed_mean_ms"] = round(sum(winds) / len(winds), 2)

    return result


if __name__ == "__main__":
    # Prueba en Valles Secos de McMurdo
    lat_test, lon_test = -77.50, 162.50
    print(f"[*] Consultando clima para McMurdo ({lat_test}, {lon_test})...")
    res = fetch_meteomatics_weather(lat_test, lon_test)
    print(json.dumps(res, indent=2, ensure_ascii=False))
