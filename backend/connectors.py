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
    fallback = [float(x) for x in bbox.split(",")]
    url = "https://cmr.earthdata.nasa.gov/search/granules.json"
    params = {
        "bounding_box": bbox,
        "temporal": f"{start_date}T00:00:00Z,{end_date}T23:59:59Z",
        "page_size": limit,
    }
    res = await client.get(url, params=params)
    res.raise_for_status()
    entries = res.json().get("feed", {}).get("entry", [])
    return [
        {
            "id": e.get("id"),
            "title": e.get("title"),
            "date": e.get("time_start", "")[:10],
            "source": "NASA Earthdata (CMR)",
            "bbox": _parse_cmr_box(e.get("boxes"), fallback),
            "recommended_mode": "ndvi",
        }
        for e in entries
    ]


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

    async with httpx.AsyncClient(timeout=6.0) as client:
        if body == "earth":
            results = await asyncio.gather(
                query_nasa_cmr(client, bbox, start_date, end_date, limit),
                query_copernicus_stac(client, bbox, start_date, end_date, limit),
                return_exceptions=True,
            )
            if not isinstance(results[0], Exception):
                response["live_earthdata"] = results[0]
            if not isinstance(results[1], Exception):
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