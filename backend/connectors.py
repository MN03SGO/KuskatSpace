import asyncio
import httpx

PARTNER_DATASETS = [
    {
        "id": "CSA-RCM-MARITIME",
        "agency": "CSA",
        "mission": "RADARSAT Constellation Mission (RCM)",
        "body": "earth",
        "variable": "maritime_disaster_ecosystem",
        "instruments": "SAR Banda-C (3 satélites)",
        "description": "Vigilancia marítima (hielo, vientos, derrames, buques), desastres y ecosistemas.",
        "recommended_mode": "sar_db",
        "bbox": [-92.5, 11.5, -83.0, 17.5],
    },
    {
        "id": "CSA-RADARSAT1-OPEN",
        "agency": "CSA",
        "mission": "RADARSAT-1 Open Archive",
        "body": "earth",
        "variable": "sar_historical",
        "instruments": "SAR Banda-C",
        "description": "Archivo histórico abierto de radar con penetración de nubes y humo.",
        "recommended_mode": "sar_db",
        "bbox": [-92.5, 11.5, -83.0, 17.5],
    },
    {
        "id": "NASA-LRO-DIVINER-POLAR",
        "agency": "NASA PDS / LRO",
        "mission": "LRO (Diviner, LROC, LOLA, LEND, Mini-RF)",
        "body": "moon",
        "variable": "lunar_surface_thermal",
        "instruments": "Diviner Radiometer / LOLA",
        "description": "Temperaturas extremas en polos lunares comparables con criósfera terrestre.",
        "recommended_mode": "diviner_thermal",
        "bbox": [-60.0, -88.0, 60.0, -60.0],
    },
    {
        "id": "NASA-PDS-MARS",
        "agency": "NASA PDS",
        "mission": "Planetary Data System (Mars Orbital & Rover)",
        "body": "mars",
        "variable": "planetary_geoscience",
        "instruments": "HiRISE, CTX, MOLA, CRISM",
        "description": "Cartografía y geociencia marciana de misiones orbitales y rovers.",
        "recommended_mode": "diviner_thermal",
        "bbox": [-95.0, -20.0, -45.0, 5.0],
    },
    {
        "id": "JAXA-GPORTAL-THEMATIC",
        "agency": "JAXA G-Portal",
        "mission": "GPM/GSMaP, GCOM-C & AMSR2",
        "body": "earth",
        "variable": "precipitation_snow_vegetation",
        "instruments": "DPR, SGLI, AMSR2",
        "description": "Variables geofísicas buscables por precipitación, nieve y vegetación.",
        "recommended_mode": "jaxa_precip",
        "bbox": [-92.5, 11.5, -83.0, 17.5],
    },
    {
        "id": "ESA-OPEN-SCIENCE",
        "agency": "ESA",
        "mission": "Copernicus Data Space & Open Science Catalog",
        "body": "earth",
        "variable": "land_ocean_atmosphere",
        "instruments": "Sentinel-1 SAR, Sentinel-2 MSI",
        "description": "Flujos científicos abiertos para tierra, océanos y atmósfera.",
        "recommended_mode": "ndvi",
        "bbox": [-92.5, 11.5, -83.0, 17.5],
    },
]


def _parse_cmr_box(boxes: list[str] | None, fallback: list[float]) -> list[float]:
    """Convierte el formato 'south west north east' de NASA CMR a [minLon, minLat, maxLon, maxLat]."""
    if not boxes:
        return fallback
    try:
        s, w, n, e = map(float, boxes[0].split())
        return [w, s, e, n]
    except Exception:
        return fallback


async def query_nasa_cmr(client: httpx.AsyncClient, bbox: str, start_date: str, end_date: str, limit: int):
    """
    CMR exige un identificador de colección en búsquedas de granules
    (short_name / concept_id / …). Sin eso responde 400 y la lista queda vacía.
    Docs: https://wiki.earthdata.nasa.gov/display/CMR/Granule+Queries+Now+Require+Collection+Identifiers
    Colecciones HLS: HLSS30 (Sentinel-2) y HLSL30 (Landsat) en LPCLOUD.
    """
    fallback = [float(x) for x in bbox.split(",")]
    url = "https://cmr.earthdata.nasa.gov/search/granules.json"
    # Repartir el límite entre HLS-S30 y HLS-L30
    per = max(1, (limit + 1) // 2)
    results = []
    for short_name in ("HLSS30", "HLSL30"):
        params = {
            "short_name": short_name,
            "bounding_box": bbox,
            "temporal": f"{start_date}T00:00:00Z,{end_date}T23:59:59Z",
            "page_size": per,
        }
        res = await client.get(url, params=params)
        if res.status_code >= 400:
            # No silenciar: propaga para que gather lo registre
            res.raise_for_status()
        payload = res.json()
        if "errors" in payload:
            raise httpx.HTTPStatusError(
                f"CMR errors: {payload['errors']}",
                request=res.request,
                response=res,
            )
        entries = payload.get("feed", {}).get("entry", [])
        for e in entries:
            links = e.get("links") or []
            asset_links = [
                {"href": ln.get("href"), "title": ln.get("title")}
                for ln in links
                if isinstance(ln, dict)
                and ln.get("href")
                and "data#" in str(ln.get("rel", ""))
                and str(ln.get("href", "")).startswith("https://")
            ][:12]
            cloud = e.get("cloud_cover")
            try:
                cloud_f = float(cloud) if cloud is not None else None
            except (TypeError, ValueError):
                cloud_f = None
            results.append(
                {
                    "id": e.get("id"),
                    "title": e.get("title"),
                    "date": e.get("time_start", "")[:10],
                    "source": f"NASA Earthdata CMR ({short_name})",
                    "collection": short_name,
                    "cloud_cover": cloud_f,
                    "bbox": _parse_cmr_box(e.get("boxes"), fallback),
                    "recommended_mode": "ndvi",
                    # Metadatos de descarga (requieren token Earthdata para leer los TIF protegidos)
                    "asset_links": asset_links,
                }
            )
            if len(results) >= limit:
                return results[:limit]
    return results[:limit]


async def query_copernicus_stac(client: httpx.AsyncClient, bbox: str, start_date: str, end_date: str, limit: int):
    url = "https://stac.dataspace.copernicus.eu/v1/search"
    coords = [float(x) for x in bbox.split(",")]
    payload = {
        "bbox": coords,
        "datetime": f"{start_date}T00:00:00Z/{end_date}T23:59:59Z",
        "collections": ["sentinel-2-l2a", "sentinel-1-grd"],
        "limit": limit,
    }
    res = await client.post(url, json=payload)
    res.raise_for_status()
    features = res.json().get("features", [])
    results = []
    for f in features:
        col = f.get("collection", "")
        results.append(
            {
                "id": f.get("id"),
                "collection": col,
                "date": f.get("properties", {}).get("datetime", "")[:10],
                "cloud_cover": f.get("properties", {}).get("eo:cloud_cover"),
                "source": "ESA Copernicus STAC",
                "bbox": f.get("bbox", coords),
                "recommended_mode": "sar_db" if "sentinel-1" in col else "ndvi",
            }
        )
    return results


async def query_nasa_pds_lro(client: httpx.AsyncClient, body: str, limit: int):
    target = "moon" if body == "moon" else "mars"
    url = f"https://oderest.rsl.wustl.edu/live2/?target={target}&query=product&results=m&output=JSON&limit={limit}"
    res = await client.get(url)
    res.raise_for_status()
    products = res.json().get("ODEResults", {}).get("Products", {}).get("Product", [])
    if isinstance(products, dict):
        products = [products]
    default_bbox = [-30.0, -89.5, 30.0, -80.0] if target == "moon" else [135.0, -6.0, 140.0, -3.0]
    return [
        {
            "id": p.get("pdsid", "PDS-ITEM"),
            "instrument": p.get("ihid", "LRO/MRO"),
            "product_type": p.get("pt", "RDR"),
            "source": f"NASA PDS ({target.upper()})",
            "bbox": default_bbox,
            "recommended_mode": "diviner_thermal",
        }
        for p in products[:limit]
    ]


async def run_federated_search(bbox: str, start_date: str, end_date: str, body: str, variable: str, limit: int):
    response = {
        "live_earthdata": [],
        "live_copernicus": [],
        "live_pds_planetary": [],
        "partner_resources": [],
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        if body == "earth":
            results = await asyncio.gather(
                query_nasa_cmr(client, bbox, start_date, end_date, limit),
                query_copernicus_stac(client, bbox, start_date, end_date, limit),
                return_exceptions=True,
            )
            if isinstance(results[0], Exception):
                print(f"[teledetección] NASA CMR falló: {type(results[0]).__name__}: {results[0]}")
            else:
                response["live_earthdata"] = results[0]
            if isinstance(results[1], Exception):
                print(f"[teledetección] Copernicus STAC falló: {type(results[1]).__name__}: {results[1]}")
            else:
                response["live_copernicus"] = results[1]
        else:
            pds_res = await asyncio.gather(query_nasa_pds_lro(client, body, limit), return_exceptions=True)
            if not isinstance(pds_res[0], Exception):
                response["live_pds_planetary"] = pds_res[0]

    response["partner_resources"] = [
        item for item in PARTNER_DATASETS
        if item["body"] == body and (variable == "all" or variable in item["variable"])
    ]
    return response