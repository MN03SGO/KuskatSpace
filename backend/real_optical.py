"""
Productos reales desde COGs:
  - NDVI / NDWI  source=sentinel2 → Element84 (Sentinel-2 L2A públicos)
  - NDVI / NDWI  source=hls       → HLSS30 / HLSL30 en LP DAAC (Bearer NASA_TOKEN)
  - Térmico      source=hls (L30) → HLSL30 B10 (TIRS1), temperatura de brillo TOA

Máscaras por índice y fuente: ver QA_MASKS (más abajo), con sus referencias.
Auth LP DAAC (GDAL): cabecera "Authorization: Bearer" vía GDAL_HTTP_HEADER_FILE
  https://urs.earthdata.nasa.gov/documentation/for_users/user_token
"""

from __future__ import annotations

import base64
import io
import os
import re
import tempfile
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout
from contextlib import contextmanager
from typing import Any, Iterator
from urllib.parse import quote, urlparse

import httpx
import numpy as np
import rasterio
from PIL import Image
from rasterio.enums import Resampling
from rasterio.transform import Affine, array_bounds, from_bounds
from rasterio.warp import reproject, transform_bounds
from rasterio.windows import from_bounds as window_from_bounds

ELEMENT84_STAC = "https://earth-search.aws.element84.com/v1"
CMR_GRANULES = "https://cmr.earthdata.nasa.gov/search/granules.json"

# Lista cerrada (configurable vía ALLOWED_COG_HOSTS=host1,host2)
_DEFAULT_HOSTS = (
    "sentinel-cogs.s3.us-west-2.amazonaws.com",
    "sentinel-cogs.s3.amazonaws.com",
    "data.lpdaac.earthdatacloud.nasa.gov",
)


def allowed_asset_hosts() -> frozenset[str]:
    extra = os.getenv("ALLOWED_COG_HOSTS", "").strip()
    hosts = set(_DEFAULT_HOSTS)
    if extra:
        hosts.update(h.strip().lower() for h in extra.split(",") if h.strip())
    return frozenset(hosts)


# Element84 STAC: red/green/nir/scl (confirmados en assets del item)
S2_BAND_ALIASES = {
    "red": ("red", "B04"),
    "green": ("green", "B03"),
    "nir": ("nir", "B08"),
    "qa": ("scl", "SCL"),
}

# HLS: nombres de archivo en CMR (User Guide §6 + assets reales LP DAAC)
# S30 (Sentinel-2): B03 green, B04 red, B08 NIR
# L30 (Landsat): B03 green, B04 red, B05 NIR
HLS_BAND_FILES = {
    "S30": {"red": "B04", "green": "B03", "nir": "B08", "qa": "Fmask"},
    "L30": {"red": "B04", "green": "B03", "nir": "B05", "qa": "Fmask"},
}

# ─────────────────────────────────────────────────────────────────────────────
# Máscaras de calidad (QA) por índice y fuente
# ─────────────────────────────────────────────────────────────────────────────
# Sentinel-2 L2A — Scene Classification (SCL), valores enteros.
# Guía oficial: ESA SentiWiki › S2 Processing › L2A Algorithms › Scene
#   Classification › "Classification Mask Generation", Table 3
#   "Scene classification values" — https://sentiwiki.copernicus.eu/web/s2-processing
SCL_NO_DATA = 0
SCL_SATURATED_OR_DEFECTIVE = 1
SCL_CAST_SHADOWS = 2
SCL_CLOUD_SHADOWS = 3
SCL_VEGETATION = 4
SCL_NOT_VEGETATED = 5
SCL_WATER = 6
SCL_UNCLASSIFIED = 7
SCL_CLOUD_MEDIUM_PROBABILITY = 8
SCL_CLOUD_HIGH_PROBABILITY = 9
SCL_THIN_CIRRUS = 10
SCL_SNOW_OR_ICE = 11
SCL_NAMES = {
    0: "NO_DATA",
    1: "SATURATED_OR_DEFECTIVE",
    2: "CAST_SHADOWS",
    3: "CLOUD_SHADOWS",
    4: "VEGETATION",
    5: "NOT_VEGETATED",
    6: "WATER",
    7: "UNCLASSIFIED",
    8: "CLOUD_MEDIUM_PROBABILITY",
    9: "CLOUD_HIGH_PROBABILITY",
    10: "THIN_CIRRUS",
    11: "SNOW_OR_ICE",
}

# HLS v2.0 — Fmask (byte QA, bits de LSB a MSB).
# Guía oficial: HLS Product User Guide v2.0 (abril 2026), §6.4 "Quality
#   Assessment Layer", Table 9; §4.2 "Cloud Masking And The Quality Assessment
#   Band"; fill del Fmask = 255 (Tables 6 y 7).
#   https://lpdaac.usgs.gov/documents/1698/HLS_User_Guide_V2.pdf
# Nota de la guía: el bit 0 (Cirrus) está "Reserved, but not used in HLS V2.0";
#   §4.2: "a separate cirrus class is not created; cirrus is aggregated into
#   the generic 'cloud' class" → el cirro se enmascara con el bit 1. Se incluye
#   también el bit 0 por si una versión futura lo activa (hoy siempre vale 0).
FMASK_BIT_CIRRUS = 0
FMASK_BIT_CLOUD = 1
FMASK_BIT_ADJACENT = 2
FMASK_BIT_CLOUD_SHADOW = 3
FMASK_BIT_SNOW_ICE = 4
FMASK_BIT_WATER = 5
FMASK_FILL = 255
FMASK_BIT_NAMES = {
    0: "CIRRUS_RESERVED",
    1: "CLOUD",
    2: "ADJACENT_TO_CLOUD_SHADOW",
    3: "CLOUD_SHADOW",
    4: "SNOW_ICE",
    5: "WATER",
}

# Lista ÚNICA de máscaras por (índice, fuente). Política:
#   - Siempre: nube, cirro, sombra de nube y fill/no-data.
#     (S2: SATURATED_OR_DEFECTIVE se trata como dato inválido, igual que fill.)
#   - NDWI y térmico: NO se enmascara agua; el agua es justo la señal (NDWI > 0)
#     o una temperatura de superficie válida (lagos, embalses).
#   - NDVI: SÍ se enmascara agua. Justificación: el NDVI mide vegetación; sobre
#     agua abierta es negativo y no aporta señal de vegetación, así que sus
#     píxeles hunden el mínimo y la media según cuánta agua caiga en el bbox.
#     Enmascararla en LAS DOS fuentes deja estadísticas de tierra comparables
#     entre S2 y HLS (antes solo HLS la quitaba).
QA_MASKS: dict[tuple[str, str], dict[str, tuple[int, ...]]] = {
    ("ndvi", "sentinel2"): {
        "scl_classes": (
            SCL_NO_DATA,
            SCL_SATURATED_OR_DEFECTIVE,
            SCL_CLOUD_SHADOWS,
            SCL_WATER,
            SCL_CLOUD_MEDIUM_PROBABILITY,
            SCL_CLOUD_HIGH_PROBABILITY,
            SCL_THIN_CIRRUS,
        ),
    },
    ("ndwi", "sentinel2"): {
        "scl_classes": (
            SCL_NO_DATA,
            SCL_SATURATED_OR_DEFECTIVE,
            SCL_CLOUD_SHADOWS,
            SCL_CLOUD_MEDIUM_PROBABILITY,
            SCL_CLOUD_HIGH_PROBABILITY,
            SCL_THIN_CIRRUS,
        ),
    },
    ("ndvi", "hls"): {
        "fmask_bits": (FMASK_BIT_CIRRUS, FMASK_BIT_CLOUD, FMASK_BIT_CLOUD_SHADOW, FMASK_BIT_WATER),
    },
    ("ndwi", "hls"): {
        "fmask_bits": (FMASK_BIT_CIRRUS, FMASK_BIT_CLOUD, FMASK_BIT_CLOUD_SHADOW),
    },
    ("thermal", "hls"): {
        "fmask_bits": (FMASK_BIT_CIRRUS, FMASK_BIT_CLOUD, FMASK_BIT_CLOUD_SHADOW),
    },
}

# HLS reflectancia: int16, scale 0.0001, fill -9999 (User Guide v2.0, Tables 6/7)
HLS_REFL_SCALE = 0.0001
HLS_REFL_FILL = -9999

# HLS L30 térmico (User Guide v2.0, Table 1 y Table 6; verificado también en
# las etiquetas del COG: long_name=TIRS1, scale_factor=0.01, add_offset=0,
# _FillValue=-9999):
#   B10 = TIRS banda 10 (10.60–11.19 µm), "degree °C", int16, scale 0.01,
#   fill -9999, 30 m. §4.1: NO tiene corrección atmosférica; es temperatura
#   de brillo aparente en el techo de la atmósfera (TOA BT), no LST.
#   Se usa B10 y no B11: USGS desaconseja B11 en análisis de un solo canal
#   por la incertidumbre de luz parásita (stray light) de TIRS.
HLS_THERMAL_BAND = "B10"
HLS_THERMAL_SCALE = 0.01
HLS_THERMAL_FILL = -9999

MAX_BBOX_SIDE_DEG = 0.5
MAX_OUTPUT_PX = 2048
READ_TIMEOUT_S = 25
VALID_PIXEL_WARN_PCT = 30.0

# scene_id estrictos (fullmatch) — nunca concatenar sin pasar por estos
CDSE_ID_RE = re.compile(
    r"^S2[ABC]_MSIL2A_\d{8}T\d{6}_N\d{2,4}_R\d{3}_T[0-9]{2}[A-Z]{3}_\d{8}T\d{6}$",
    re.IGNORECASE,
)
E84_ID_RE = re.compile(r"^S2[ABC]_[0-9]{2}[A-Z]{3}_\d{8}_\d+_L2A$", re.IGNORECASE)
HLS_TITLE_RE = re.compile(
    r"^HLS\.(S30|L30)\.T([0-9]{2}[A-Z]{3})\.(\d{7}T\d{6})\.v2\.0$",
    re.IGNORECASE,
)
HLS_CMR_ID_RE = re.compile(r"^G\d+-LPCLOUD$", re.IGNORECASE)


class ProcessValidationError(ValueError):
    """Entrada inválida → HTTP 422."""

    def __init__(self, message: str, code: str = "validation_error"):
        super().__init__(message)
        self.code = code


class ProcessUpstreamError(RuntimeError):
    """Fallo al leer COG / STAC → HTTP 504/502."""

    def __init__(self, message: str, code: str = "upstream_error"):
        super().__init__(message)
        self.code = code


class SceneNotFoundError(LookupError):
    """Escena CDSE sin COG en Element84 → HTTP 404."""

    def __init__(self, message: str = "Escena no encontrada en el catálogo COG"):
        super().__init__(message)
        self.code = "scene_not_found_in_cog_catalog"


class EarthdataAuthError(PermissionError):
    """Token Earthdata ausente/inválido → HTTP 401."""

    def __init__(self, message: str = "Se requiere autenticación Earthdata"):
        super().__init__(message)
        self.code = "earthdata_auth_required"


class BandUnavailableError(LookupError):
    """La escena existe pero no trae la banda pedida (p. ej. térmico) → HTTP 404."""

    def __init__(self, message: str, code: str = "band_unavailable"):
        super().__init__(message)
        self.code = code


def qa_exclusion(kind: str, source: str, qa: np.ndarray) -> tuple[np.ndarray, dict[str, Any]]:
    """
    Construye la máscara de exclusión (1 = excluir) según QA_MASKS y devuelve
    el recuento de píxeles por clase/bit excluido, sobre la ventana nativa.
    En Fmask un píxel puede tener varios bits activos (Guía HLS §6.4), así
    que los recuentos por bit pueden solaparse; "excluded_total" no.
    """
    spec = QA_MASKS[(kind, source)]
    counts: dict[str, int] = {}
    if source == "sentinel2":
        q = np.nan_to_num(qa, nan=SCL_NO_DATA).astype(np.int16)
        classes = spec["scl_classes"]
        mask = np.isin(q, classes)
        for c in classes:
            counts[f"scl_{c}_{SCL_NAMES[c]}"] = int(np.count_nonzero(q == c))
    else:
        q = np.nan_to_num(qa, nan=FMASK_FILL).astype(np.uint16)
        fill = q == FMASK_FILL
        bits = spec["fmask_bits"]
        bitmask = 0
        for b in bits:
            bitmask |= 1 << b
        mask = fill | ((q & bitmask) != 0)
        counts["fill_255"] = int(np.count_nonzero(fill))
        for b in bits:
            counts[f"bit{b}_{FMASK_BIT_NAMES[b]}"] = int(np.count_nonzero(~fill & (((q >> b) & 1) == 1)))
    summary = {
        "grid_pixels": int(q.size),
        "excluded_total": int(np.count_nonzero(mask)),
        "by_class": counts,
    }
    return mask.astype(np.uint8), summary


def qa_mask_label(kind: str, source: str) -> str:
    spec = QA_MASKS[(kind, source)]
    if source == "sentinel2":
        return "SCL " + ", ".join(f"{c}={SCL_NAMES[c]}" for c in spec["scl_classes"])
    bits = ", ".join(f"bit{b}={FMASK_BIT_NAMES[b]}" for b in spec["fmask_bits"])
    return f"Fmask {bits}; fill=255"


def validate_bbox(bbox: list[float]) -> list[float]:
    if len(bbox) != 4:
        raise ProcessValidationError("bbox debe ser [min_lon, min_lat, max_lon, max_lat]")
    min_lon, min_lat, max_lon, max_lat = (float(x) for x in bbox)
    if not (-180 <= min_lon < max_lon <= 180 and -90 <= min_lat < max_lat <= 90):
        raise ProcessValidationError("bbox fuera de rango o invertido")
    if (max_lon - min_lon) > MAX_BBOX_SIDE_DEG or (max_lat - min_lat) > MAX_BBOX_SIDE_DEG:
        raise ProcessValidationError(
            f"bbox demasiado grande: máximo {MAX_BBOX_SIDE_DEG}° por lado "
            f"(recibido {max_lon - min_lon:.3f}° × {max_lat - min_lat:.3f}°)"
        )
    return [min_lon, min_lat, max_lon, max_lat]


def _assert_allowed_href(href: str) -> str:
    parsed = urlparse(href)
    if parsed.scheme not in ("https", "http"):
        raise ProcessValidationError("URL de asset no permitida (solo https)")
    host = (parsed.hostname or "").lower()
    if host not in allowed_asset_hosts():
        raise ProcessValidationError(f"Host de asset no permitido: {host or 'desconocido'}")
    return href


def _earthdata_token() -> str:
    tok = (os.getenv("NASA_TOKEN") or os.getenv("EARTHDATA_TOKEN") or "").strip().strip('"').strip("'")
    if not tok:
        raise EarthdataAuthError(
            "Falta NASA_TOKEN (o EARTHDATA_TOKEN). Crea un User Token en "
            "https://urs.earthdata.nasa.gov/documentation/for_users/user_token"
        )
    return tok


def resolve_element84_item_id(scene_id: str) -> str:
    sid = scene_id.strip()
    if E84_ID_RE.fullmatch(sid):
        return sid
    if CDSE_ID_RE.fullmatch(sid):
        m = re.match(
            r"(S2[ABC])_MSIL2A_(\d{8})T\d+_N\d+_R\d+_T([0-9]{2}[A-Z]{3})_",
            sid,
            re.IGNORECASE,
        )
        assert m
        return f"{m.group(1).upper()}_{m.group(3).upper()}_{m.group(2)}_0_L2A"
    raise ProcessValidationError(
        "scene_id Sentinel-2 inválido. Usa id Copernicus SAFE o Element84.",
        code="invalid_scene_id",
    )


def fetch_stac_item(scene_id: str) -> dict[str, Any]:
    item_id = resolve_element84_item_id(scene_id)
    # Sanear path: solo el id ya validado por regex
    safe_id = quote(item_id, safe="._-")
    url = f"{ELEMENT84_STAC}/collections/sentinel-2-l2a/items/{safe_id}"
    try:
        with httpx.Client(timeout=READ_TIMEOUT_S) as client:
            res = client.get(url)
    except httpx.HTTPError as exc:
        raise ProcessUpstreamError(f"No se pudo consultar el catálogo STAC: {exc}") from exc

    if res.status_code == 404:
        raise SceneNotFoundError(
            "Esta escena no tiene COG disponible en Element84. Elige otra."
        )
    if res.status_code >= 400:
        raise ProcessUpstreamError(f"STAC respondió HTTP {res.status_code}")
    return res.json()


def pick_s2_asset(assets: dict[str, Any], role: str) -> tuple[str, str]:
    for key in S2_BAND_ALIASES[role]:
        asset = assets.get(key)
        if asset and asset.get("href"):
            return key, _assert_allowed_href(asset["href"])
    raise ProcessValidationError(
        f"El item STAC no incluye asset '{role}'. "
        f"Disponibles: {', '.join(sorted(assets.keys())[:40])}"
    )


def _resolve_hls_granule(scene_id: str) -> dict[str, Any]:
    """Devuelve entry CMR + título HLS validado. No construye URLs a mano."""
    sid = scene_id.strip()
    params: dict[str, str]
    m_title = HLS_TITLE_RE.fullmatch(sid)
    if m_title:
        product = m_title.group(1).upper()
        short = "HLSS30" if product == "S30" else "HLSL30"
        # CMR exige short_name (u otro id de colección) en búsquedas de granules
        params = {"short_name": short, "readable_granule_name": sid, "page_size": "1"}
    elif HLS_CMR_ID_RE.fullmatch(sid):
        params = {"concept_id": sid, "page_size": "1"}
    else:
        raise ProcessValidationError(
            "scene_id HLS inválido. Usa título HLS.*.v2.0 o concept_id G…-LPCLOUD.",
            code="invalid_scene_id",
        )

    try:
        with httpx.Client(timeout=READ_TIMEOUT_S) as client:
            res = client.get(CMR_GRANULES, params=params)
    except httpx.HTTPError as exc:
        raise ProcessUpstreamError(f"No se pudo consultar CMR: {exc}") from exc

    if res.status_code in (401, 403):
        raise EarthdataAuthError("CMR rechazó la petición (credenciales Earthdata).")
    if res.status_code >= 400:
        raise ProcessUpstreamError(f"CMR respondió HTTP {res.status_code}")

    entries = res.json().get("feed", {}).get("entry", [])
    if not entries:
        raise SceneNotFoundError("Granule HLS no encontrado en CMR. Elige otra escena.")
    entry = entries[0]
    title = str(entry.get("title") or "")
    if not HLS_TITLE_RE.fullmatch(title):
        raise ProcessValidationError(f"Título HLS inesperado: {title[:80]}")
    return entry


def _hls_band_hrefs(entry: dict[str, Any]) -> tuple[str, dict[str, str], dict[str, str]]:
    title = str(entry["title"])
    m = HLS_TITLE_RE.fullmatch(title)
    assert m
    product = m.group(1).upper()  # S30 | L30
    wanted = HLS_BAND_FILES[product]
    links = entry.get("links") or []
    found: dict[str, str] = {}
    used: dict[str, str] = {}
    for role, band in wanted.items():
        suffix = f".{band}.tif"
        for ln in links:
            if not isinstance(ln, dict):
                continue
            href = str(ln.get("href") or "")
            if not href.startswith("https://"):
                continue
            if "data#" not in str(ln.get("rel", "")):
                continue
            if href.lower().endswith(suffix.lower()) or href.endswith(suffix):
                found[role] = _assert_allowed_href(href)
                used[role] = band
                break
        if role not in found:
            raise ProcessValidationError(
                f"El granule HLS no incluye la banda {band} (rol {role})."
            )
    return product, found, used


@contextmanager
def _gdal_env(*, earthdata: bool = False) -> Iterator[None]:
    """
    Configura GDAL/rasterio. Para LP DAAC escribe la cabecera Bearer en un
    archivo para GDAL_HTTP_HEADER_FILE:
      - directorio temporal único (mkdtemp → 0700, solo el usuario del proceso),
      - archivo creado con O_CREAT|O_EXCL y modo 0600 desde el open (sin
        ventana en la que exista con otros permisos),
      - borrado del archivo y del directorio en un finally.
    Nunca se registra ni la ruta ni el contenido. Se fuerza CPL_CURL_VERBOSE=NO
    y CPL_DEBUG=OFF para que GDAL no vuelque cabeceras HTTP en stderr.
    TLS se verifica siempre (no GDAL_HTTP_UNSAFESSL): el token viaja en la cabecera.
    """
    header_dir: str | None = None
    header_path: str | None = None
    opts: dict[str, str] = {
        "GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR",
        "CPL_CURL_VERBOSE": "NO",
        "CPL_DEBUG": "OFF",
    }
    try:
        if earthdata:
            token = _earthdata_token()
            header_dir = tempfile.mkdtemp(prefix="edl_")
            header_path = os.path.join(header_dir, "hdr.txt")
            fd = os.open(header_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, "w") as fh:
                fh.write(f"Authorization: Bearer {token}\n")
            opts["GDAL_HTTP_HEADER_FILE"] = header_path
        else:
            opts["AWS_NO_SIGN_REQUEST"] = "YES"
            opts["CPL_VSIL_CURL_ALLOWED_EXTENSIONS"] = ".tif,.TIF,.tiff"

        with rasterio.Env(**opts):
            yield
    finally:
        if header_path is not None:
            try:
                os.unlink(header_path)
            except FileNotFoundError:
                pass
        if header_dir is not None:
            try:
                os.rmdir(header_dir)
            except OSError:
                pass


def _vsicurl(href: str) -> str:
    return href if href.startswith("/vsicurl/") else f"/vsicurl/{href}"


def _probe_earthdata_auth(href: str) -> None:
    """GET/HEAD corto para detectar 401/403 sin loguear el token."""
    token = _earthdata_token()
    try:
        with httpx.Client(timeout=20.0, follow_redirects=True) as client:
            res = client.get(
                href,
                headers={"Authorization": f"Bearer {token}", "Range": "bytes=0-1023"},
            )
            if res.status_code in (401, 403):
                raise EarthdataAuthError(
                    "Token Earthdata inválido o caducado (HTTP auth). "
                    "Renueva el User Token en urs.earthdata.nasa.gov."
                )
            # HTML de login / error page en vez de TIFF
            ct = (res.headers.get("content-type") or "").lower()
            if res.status_code == 200 and "html" in ct:
                raise EarthdataAuthError(
                    "Earthdata devolvió HTML de login: token inválido o sin permiso."
                )
    except EarthdataAuthError:
        raise
    except httpx.HTTPError:
        pass


def _read_window(
    href: str,
    bbox_wgs84: list[float],
    *,
    earthdata: bool = False,
    nodata: float | None = None,
    categorical: bool = False,
) -> tuple[np.ndarray, Any, Any]:
    path = _vsicurl(href)
    try:
        with _gdal_env(earthdata=earthdata):
            with rasterio.open(path) as src:
                left, bottom, right, top = transform_bounds(
                    "EPSG:4326", src.crs, *bbox_wgs84, densify_pts=21
                )
                left = max(left, src.bounds.left)
                bottom = max(bottom, src.bounds.bottom)
                right = min(right, src.bounds.right)
                top = min(top, src.bounds.top)
                if left >= right or bottom >= top:
                    raise ProcessValidationError("El bbox no intersecta el footprint de la escena")

                win = window_from_bounds(left, bottom, right, top, transform=src.transform)
                win = win.round_lengths().round_offsets()
                out_h = max(1, int(win.height))
                out_w = max(1, int(win.width))
                scale = max(out_h / MAX_OUTPUT_PX, out_w / MAX_OUTPUT_PX, 1.0)
                dst_h = max(1, int(out_h / scale))
                dst_w = max(1, int(out_w / scale))
                data = src.read(
                    1,
                    window=win,
                    out_shape=(dst_h, dst_w),
                    resampling=Resampling.nearest if categorical else Resampling.bilinear,
                    boundless=False,
                    fill_value=0 if nodata is None else nodata,
                ).astype(np.float32)
                transform = src.window_transform(win)
                if scale > 1:
                    transform = Affine(
                        transform.a * (out_w / dst_w),
                        transform.b,
                        transform.c,
                        transform.d,
                        transform.e * (out_h / dst_h),
                        transform.f,
                    )
                if nodata is not None:
                    data = np.where(data == nodata, np.nan, data)
                return data, src.crs, transform
    except EarthdataAuthError:
        raise
    except rasterio.errors.RasterioIOError as exc:
        if earthdata:
            # Tras fallo de vsicurl, re-probar auth explícitamente
            try:
                _probe_earthdata_auth(href)
            except EarthdataAuthError:
                raise
            raise ProcessUpstreamError(
                "No se pudo leer el COG HLS (formato/red). Comprueba conectividad LP DAAC."
            ) from exc
        raise ProcessUpstreamError("No se pudo leer el COG remoto") from exc


def _warp_to_wgs84(
    data: np.ndarray,
    src_crs: Any,
    src_transform: Any,
    bbox_wgs84: list[float],
    nodata_mask: np.ndarray | None = None,
    resolution_m: float = 10.0,
) -> tuple[np.ndarray, np.ndarray, list[float], float]:
    """
    Reproyecta a EPSG:4326 sobre el bbox pedido y recorta al footprint válido.
    Devuelve (data, mask, bbox_efectivo, valid_pixel_pct sobre la ventana pedida).
    """
    min_lon, min_lat, max_lon, max_lat = bbox_wgs84
    mid_lat = (min_lat + max_lat) / 2.0
    m_per_deg_lat = 111_320.0
    m_per_deg_lon = 111_320.0 * max(0.2, abs(np.cos(np.radians(mid_lat))))
    width = int(np.ceil((max_lon - min_lon) * m_per_deg_lon / resolution_m))
    height = int(np.ceil((max_lat - min_lat) * m_per_deg_lat / resolution_m))
    width = max(1, min(MAX_OUTPUT_PX, width))
    height = max(1, min(MAX_OUTPUT_PX, height))

    dst_transform = from_bounds(min_lon, min_lat, max_lon, max_lat, width, height)
    dest = np.full((height, width), np.nan, dtype=np.float32)
    dest_mask = np.ones((height, width), dtype=np.uint8)

    reproject(
        source=data,
        destination=dest,
        src_transform=src_transform,
        src_crs=src_crs,
        src_nodata=np.nan,
        dst_transform=dst_transform,
        dst_crs="EPSG:4326",
        dst_nodata=np.nan,
        resampling=Resampling.bilinear,
    )
    if nodata_mask is not None:
        mask_dest = np.zeros((height, width), dtype=np.uint8)
        reproject(
            source=nodata_mask.astype(np.uint8),
            destination=mask_dest,
            src_transform=src_transform,
            src_crs=src_crs,
            dst_transform=dst_transform,
            dst_crs="EPSG:4326",
            resampling=Resampling.nearest,
        )
        dest_mask = mask_dest
        dest = np.where(mask_dest > 0, np.nan, dest)

    # % válidos sobre la ventana pedida (antes del recorte)
    window_total = dest.size
    valid_full = np.isfinite(dest) & (dest_mask == 0)
    valid_pct = 100.0 * float(np.count_nonzero(valid_full)) / float(window_total)

    if not np.any(valid_full):
        raise ProcessValidationError(
            "Sin píxeles válidos en la ventana (nubes, máscara o sin solape).",
            code="no_valid_pixels",
        )

    rows = np.any(valid_full, axis=1)
    cols = np.any(valid_full, axis=0)
    r0, r1 = int(np.argmax(rows)), int(len(rows) - np.argmax(rows[::-1]))
    c0, c1 = int(np.argmax(cols)), int(len(cols) - np.argmax(cols[::-1]))
    cropped = dest[r0:r1, c0:c1]
    cropped_mask = dest_mask[r0:r1, c0:c1]
    crop_transform = dst_transform * Affine.translation(c0, r0)
    b = array_bounds(cropped.shape[0], cropped.shape[1], crop_transform)
    effective = [float(b[0]), float(b[1]), float(b[2]), float(b[3])]
    return cropped, cropped_mask, effective, valid_pct


def _apply_colormap(data: np.ndarray, mask: np.ndarray, vmin: float, vmax: float, stops: np.ndarray) -> np.ndarray:
    safe = np.nan_to_num(data, nan=vmin)
    norm = np.clip((safe - vmin) / (vmax - vmin + 1e-8), 0, 1)
    idx = norm * (len(stops) - 1)
    i0 = np.clip(np.floor(idx).astype(np.int32), 0, len(stops) - 1)
    i1 = np.clip(i0 + 1, 0, len(stops) - 1)
    t = (idx - i0.astype(np.float32))[..., None]
    rgb = ((1 - t) * stops[i0] + t * stops[i1]).astype(np.uint8)
    alpha = np.where((mask > 0) | ~np.isfinite(data), 0, 230).astype(np.uint8)
    return np.dstack((rgb, alpha))


def _rdylgn_rgba(data: np.ndarray, mask: np.ndarray, vmin: float, vmax: float) -> np.ndarray:
    stops = np.array(
        [
            [165, 0, 38],
            [215, 48, 39],
            [244, 109, 67],
            [253, 174, 97],
            [254, 224, 139],
            [255, 255, 191],
            [217, 239, 139],
            [166, 217, 106],
            [102, 189, 99],
            [26, 152, 80],
            [0, 104, 55],
        ],
        dtype=np.float32,
    )
    return _apply_colormap(data, mask, vmin, vmax, stops)


def _blues_rgba(data: np.ndarray, mask: np.ndarray, vmin: float, vmax: float) -> np.ndarray:
    stops = np.array(
        [
            [255, 255, 217],
            [237, 248, 177],
            [199, 233, 180],
            [127, 205, 187],
            [65, 182, 196],
            [29, 145, 192],
            [34, 94, 168],
            [12, 44, 132],
        ],
        dtype=np.float32,
    )
    return _apply_colormap(data, mask, vmin, vmax, stops)


# matplotlib "inferno" muestreado en 11 puntos equiespaciados (0, 0.1, …, 1)
INFERNO_STOPS = np.array(
    [
        [0, 0, 4],
        [22, 11, 57],
        [66, 10, 104],
        [106, 23, 110],
        [147, 38, 103],
        [188, 55, 84],
        [221, 81, 58],
        [243, 120, 25],
        [252, 165, 10],
        [246, 215, 70],
        [252, 255, 164],
    ],
    dtype=np.float32,
)


def _inferno_rgba(data: np.ndarray, mask: np.ndarray, vmin: float, vmax: float) -> np.ndarray:
    return _apply_colormap(data, mask, vmin, vmax, INFERNO_STOPS)


def _png_b64(rgba: np.ndarray) -> str:
    img = Image.fromarray(rgba, mode="RGBA")
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode('ascii')}"


def _finalize_index(
    *,
    kind: str,
    index: np.ndarray,
    cloud_mask: np.ndarray,
    crs: Any,
    transform: Any,
    bbox: list[float],
    resolution_m: float,
    meta: dict[str, Any],
) -> dict[str, Any]:
    """kind: ndvi | ndwi | thermal. Para thermal, `index` ya va en °C."""
    warped, warped_mask, effective, valid_pct = _warp_to_wgs84(
        index, crs, transform, bbox, cloud_mask, resolution_m=resolution_m
    )
    if valid_pct <= 0:
        raise ProcessValidationError(
            "Sin píxeles válidos (0%). Elige otra escena o un bbox con menos nubes.",
            code="no_valid_pixels",
        )

    valid = warped[np.isfinite(warped) & (warped_mask == 0)]
    vmin = float(np.nanpercentile(valid, 2))
    vmax = float(np.nanpercentile(valid, 98))
    if abs(vmax - vmin) < 1e-6:
        vmin, vmax = (vmin - 1.0, vmax + 1.0) if kind == "thermal" else (-1.0, 1.0)

    if kind == "ndvi":
        rgba = _rdylgn_rgba(warped, warped_mask, vmin, vmax)
        colormap = "RdYlGn"
    elif kind == "ndwi":
        rgba = _blues_rgba(warped, warped_mask, vmin, vmax)
        colormap = "YlGnBu"
    else:
        rgba = _inferno_rgba(warped, warped_mask, vmin, vmax)
        colormap = "inferno"
    leaflet_bounds = [[effective[1], effective[0]], [effective[3], effective[2]]]
    ndigits = 2 if kind == "thermal" else 4

    out = {
        **meta,
        "source_mode": "real",
        "demo": False,
        "bbox_requested": [float(x) for x in bbox],
        "bbox": effective,
        "bounds": leaflet_bounds,
        "valid_pixel_pct": round(valid_pct, 2),
        "cloud_cover_scene": meta.get("cloud_cover"),
        "stats": {
            "min": round(float(np.nanmin(valid)), ndigits),
            "max": round(float(np.nanmax(valid)), ndigits),
            "mean": round(float(np.nanmean(valid)), ndigits),
        },
        "colormap": colormap,
        "color_range": [round(vmin, ndigits), round(vmax, ndigits)],
        "overlay_png_base64": _png_b64(rgba),
    }
    if valid_pct < VALID_PIXEL_WARN_PCT:
        out["warning"] = (
            f"Pocos píxeles válidos ({valid_pct:.1f}%): las estadísticas no son representativas"
        )
    return out


def _align_to(src: np.ndarray, src_transform: Any, crs: Any, ref: np.ndarray, ref_transform: Any, fill: float) -> np.ndarray:
    """Alinea una banda categórica (QA) a la rejilla de `ref` con vecino más próximo."""
    if src.shape == ref.shape and src_transform == ref_transform:
        return src
    out = np.full(ref.shape, fill, dtype=np.float32)
    reproject(
        source=src,
        destination=out,
        src_transform=src_transform,
        src_crs=crs,
        dst_transform=ref_transform,
        dst_crs=crs,
        resampling=Resampling.nearest,
    )
    return out


def _s2_scale_offset(asset: dict[str, Any], props: dict[str, Any]) -> tuple[float, float, float]:
    """
    scale/offset/nodata para pasar DN → reflectancia en Element84.
    Desde la línea base 04.00 de ESA (ene-2022) el L2A lleva BOA_ADD_OFFSET
    (-1000 DN). Element84 publica `raster:bands.offset = -0.1`, pero cuando
    `earthsearch:boa_offset_applied` es True los DN del COG YA vienen sin ese
    +1000 (verificado: agua clara del Lago de Atitlán, NIR DN mediana 31), así
    que aplicar -0.1 otra vez daría reflectancias negativas. Solo se aplica el
    offset si la propiedad es explícitamente False. (Un offset aditivo no se
    cancela en (a-b)/(a+b), por eso importa.)
    """
    rb = (asset.get("raster:bands") or [{}])[0] or {}
    scale = float(rb.get("scale", 0.0001))
    nodata = float(rb.get("nodata", 0))
    offset = float(rb.get("offset", 0.0)) if props.get("earthsearch:boa_offset_applied") is False else 0.0
    return scale, offset, nodata


def _normalized_difference(a: np.ndarray, b: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """(a-b)/(a+b) sobre reflectancia física. Denominador <= 0 → no físico → NaN."""
    denom = a + b
    nonphysical = np.isfinite(denom) & (denom <= 0)
    with np.errstate(divide="ignore", invalid="ignore"):
        idx = np.where(denom > 0, (a - b) / denom, np.nan).astype(np.float32)
    idx = np.where(np.isfinite(idx), np.clip(idx, -1.0, 1.0), np.nan)
    return idx, nonphysical


def _process_sentinel2(kind: str, bbox: list[float], scene_id: str) -> dict[str, Any]:
    item = fetch_stac_item(scene_id)
    assets = item.get("assets") or {}
    used: dict[str, str] = {}
    hrefs: dict[str, str] = {}
    for role in ("red", "green", "nir", "qa"):
        key, href = pick_s2_asset(assets, role)
        used[role] = key
        hrefs[role] = href

    props = item.get("properties") or {}
    second = "red" if kind == "ndvi" else "green"
    sc_nir, off_nir, nd_nir = _s2_scale_offset(assets[used["nir"]], props)
    sc_2, off_2, nd_2 = _s2_scale_offset(assets[used[second]], props)

    nir_dn, crs, transform = _read_window(hrefs["nir"], bbox, nodata=nd_nir)
    b2_dn, _, _ = _read_window(hrefs[second], bbox, nodata=nd_2)
    scl, _, scl_transform = _read_window(hrefs["qa"], bbox, categorical=True)
    if b2_dn.shape != nir_dn.shape:
        raise ProcessUpstreamError("Las bandas COG no alinearon en tamaño tras el recorte")
    scl = _align_to(scl, scl_transform, crs, nir_dn, transform, fill=SCL_NO_DATA)

    nir = nir_dn * sc_nir + off_nir
    b2 = b2_dn * sc_2 + off_2
    if kind == "ndvi":
        index, nonphysical = _normalized_difference(nir, b2)
        unit = "NDVI (−1 a +1) — Sentinel-2 L2A"
    else:
        index, nonphysical = _normalized_difference(b2, nir)
        unit = "NDWI (−1 a +1) — Sentinel-2 L2A"

    cloud_mask, excluded = qa_exclusion(kind, "sentinel2", scl)
    excluded["nonphysical_reflectance"] = int(np.count_nonzero(nonphysical & (cloud_mask == 0)))
    index = np.where(cloud_mask > 0, np.nan, index)

    cloud = props.get("eo:cloud_cover")
    return _finalize_index(
        kind=kind,
        index=index,
        cloud_mask=cloud_mask,
        crs=crs,
        transform=transform,
        bbox=bbox,
        resolution_m=10.0,
        meta={
            "mode": kind,
            "source": "sentinel2",
            "source_file": used.get("nir", "cog"),
            "scene_id": item.get("id") or scene_id,
            "mission": "Sentinel-2 MSI L2A",
            "product": "Sentinel-2 L2A",
            "catalog": "Element84 earth-search (COG)",
            "provenance": "Sentinel-2 L2A · ESA · COG vía Element84",
            "scene_date": str(props.get("datetime", ""))[:10],
            "processing_baseline": props.get("s2:processing_baseline"),
            "cloud_cover": cloud,
            "unit": unit,
            "stats_unit": "",
            "band_assets_used": {k: v for k, v in used.items() if k in ("nir", second, "qa")},
            "reflectance_scaling": {
                "scale": sc_nir,
                "offset": off_nir,
                "boa_offset_already_applied": props.get("earthsearch:boa_offset_applied"),
            },
            "qa_mask": qa_mask_label(kind, "sentinel2"),
            "qa_excluded_pixels": excluded,
        },
    )


def _hls_read_qa(href: str, bbox: list[float], ref: np.ndarray, ref_transform: Any, crs: Any) -> np.ndarray:
    fmask, _, fm_transform = _read_window(href, bbox, earthdata=True, nodata=FMASK_FILL, categorical=True)
    fmask = np.nan_to_num(fmask, nan=FMASK_FILL)
    return _align_to(fmask, fm_transform, crs, ref, ref_transform, fill=FMASK_FILL)


def _hls_cloud_cover(entry: dict[str, Any]) -> float | None:
    cloud = entry.get("cloud_cover")
    try:
        return float(cloud) if cloud is not None else None
    except (TypeError, ValueError):
        return None


def _process_hls(kind: str, bbox: list[float], scene_id: str) -> dict[str, Any]:
    entry = _resolve_hls_granule(scene_id)
    product, hrefs, used = _hls_band_hrefs(entry)
    # Verificar auth antes de vsicurl (sin imprimir token)
    _probe_earthdata_auth(hrefs["nir"])

    second = "red" if kind == "ndvi" else "green"
    nir_dn, crs, transform = _read_window(hrefs["nir"], bbox, earthdata=True, nodata=HLS_REFL_FILL)
    b2_dn, _, _ = _read_window(hrefs[second], bbox, earthdata=True, nodata=HLS_REFL_FILL)
    if b2_dn.shape != nir_dn.shape:
        raise ProcessUpstreamError("Las bandas HLS no alinearon en tamaño tras el recorte")
    qa = _hls_read_qa(hrefs["qa"], bbox, nir_dn, transform, crs)

    nir = nir_dn * HLS_REFL_SCALE
    b2 = b2_dn * HLS_REFL_SCALE
    if kind == "ndvi":
        index, nonphysical = _normalized_difference(nir, b2)
        unit = f"NDVI (−1 a +1) — HLS {product}"
    else:
        index, nonphysical = _normalized_difference(b2, nir)
        unit = f"NDWI (−1 a +1) — HLS {product}"

    cloud_mask, excluded = qa_exclusion(kind, "hls", qa)
    excluded["nonphysical_reflectance"] = int(np.count_nonzero(nonphysical & (cloud_mask == 0)))
    index = np.where(cloud_mask > 0, np.nan, index)

    title = str(entry.get("title"))
    return _finalize_index(
        kind=kind,
        index=index,
        cloud_mask=cloud_mask,
        crs=crs,
        transform=transform,
        bbox=bbox,
        resolution_m=30.0,
        meta={
            "mode": kind,
            "source": "hls",
            "source_file": used.get("nir", "cog"),
            "scene_id": title,
            "mission": f"HLS {product} v2.0",
            "product": f"HLS {product} v2.0",
            "catalog": "NASA LP DAAC / CMR",
            "provenance": f"HLS {product} v2.0 · NASA LP DAAC",
            "scene_date": str(entry.get("time_start", ""))[:10],
            "cloud_cover": _hls_cloud_cover(entry),
            "unit": unit,
            "stats_unit": "",
            "band_assets_used": {k: v for k, v in used.items() if k in ("nir", second, "qa")},
            "reflectance_scaling": {"scale": HLS_REFL_SCALE, "offset": 0.0},
            "qa_mask": qa_mask_label(kind, "hls"),
            "qa_excluded_pixels": excluded,
        },
    )


def _hls_thermal_href(entry: dict[str, Any]) -> str:
    suffix = f".{HLS_THERMAL_BAND}.tif"
    for ln in entry.get("links") or []:
        if not isinstance(ln, dict):
            continue
        href = str(ln.get("href") or "")
        if href.startswith("https://") and "data#" in str(ln.get("rel", "")) and href.endswith(suffix):
            return _assert_allowed_href(href)
    raise BandUnavailableError(
        f"El granule HLS L30 no publica la banda térmica {HLS_THERMAL_BAND} (TIRS1). "
        "No se usa simulación: elige otra escena L30.",
        code="thermal_band_unavailable",
    )


def _process_hls_thermal(bbox: list[float], scene_id: str) -> dict[str, Any]:
    sid = scene_id.strip()
    m = HLS_TITLE_RE.fullmatch(sid)
    if m and m.group(1).upper() != "L30":
        raise ProcessValidationError(
            "El térmico solo existe en HLS L30 (Landsat 8/9 TIRS). HLS S30 (Sentinel-2) "
            "no tiene bandas térmicas: elige una escena HLS.L30.",
            code="thermal_requires_l30",
        )
    entry = _resolve_hls_granule(sid)
    title = str(entry.get("title"))
    product = HLS_TITLE_RE.fullmatch(title).group(1).upper()  # type: ignore[union-attr]
    if product != "L30":
        raise ProcessValidationError(
            "El térmico solo existe en HLS L30 (Landsat 8/9 TIRS). Esta escena es "
            f"HLS {product}: elige una escena HLS.L30.",
            code="thermal_requires_l30",
        )
    t_href = _hls_thermal_href(entry)
    qa_href = None
    for ln in entry.get("links") or []:
        href = str((ln or {}).get("href") or "") if isinstance(ln, dict) else ""
        if href.startswith("https://") and "data#" in str(ln.get("rel", "")) and href.endswith(".Fmask.tif"):
            qa_href = _assert_allowed_href(href)
            break
    if qa_href is None:
        raise BandUnavailableError("El granule HLS L30 no incluye Fmask.", code="qa_band_unavailable")

    _probe_earthdata_auth(t_href)
    bt_dn, crs, transform = _read_window(t_href, bbox, earthdata=True, nodata=HLS_THERMAL_FILL)
    if not np.any(np.isfinite(bt_dn)):
        raise BandUnavailableError(
            f"La banda térmica {HLS_THERMAL_BAND} está vacía (fill) en este bbox para la "
            "escena elegida. No se usa simulación.",
            code="thermal_no_data_in_bbox",
        )
    qa = _hls_read_qa(qa_href, bbox, bt_dn, transform, crs)
    bt_c = (bt_dn * HLS_THERMAL_SCALE).astype(np.float32)

    cloud_mask, excluded = qa_exclusion("thermal", "hls", qa)
    bt_c = np.where(cloud_mask > 0, np.nan, bt_c)

    return _finalize_index(
        kind="thermal",
        index=bt_c,
        cloud_mask=cloud_mask,
        crs=crs,
        transform=transform,
        bbox=bbox,
        resolution_m=30.0,
        meta={
            "mode": "hls_thermal",
            "source": "hls",
            "source_file": HLS_THERMAL_BAND,
            "scene_id": title,
            "mission": "HLS L30 v2.0 · Landsat 8/9 TIRS",
            "product": f"HLS L30 v2.0 {HLS_THERMAL_BAND} (TIRS1, 10.60–11.19 µm)",
            "catalog": "NASA LP DAAC / CMR",
            "provenance": (
                f"HLS L30 v2.0 · {HLS_THERMAL_BAND} TIRS1 · temperatura de brillo TOA "
                "(sin corrección atmosférica; no es LST) · NASA LP DAAC"
            ),
            "scene_date": str(entry.get("time_start", ""))[:10],
            "cloud_cover": _hls_cloud_cover(entry),
            "unit": "°C — temperatura de brillo TOA (HLS L30 B10)",
            "stats_unit": "°C",
            "band_assets_used": {"thermal": HLS_THERMAL_BAND, "qa": "Fmask"},
            "thermal_scaling": {"scale": HLS_THERMAL_SCALE, "offset": 0.0, "fill": HLS_THERMAL_FILL, "unit": "degC"},
            "qa_mask": qa_mask_label("thermal", "hls"),
            "qa_excluded_pixels": excluded,
        },
    )


_KNOWN_ERRORS = (
    ProcessValidationError,
    ProcessUpstreamError,
    SceneNotFoundError,
    EarthdataAuthError,
    BandUnavailableError,
)


def _run_with_timeout(fn: Any) -> dict[str, Any]:
    with ThreadPoolExecutor(max_workers=1) as pool:
        fut = pool.submit(fn)
        try:
            return fut.result(timeout=READ_TIMEOUT_S + 40)
        except FuturesTimeout as exc:
            raise ProcessUpstreamError(
                f"Timeout de lectura ({READ_TIMEOUT_S}s) al acceder al COG/STAC"
            ) from exc
        except _KNOWN_ERRORS:
            raise
        except Exception as exc:
            cause = exc.__cause__ or exc
            if isinstance(cause, _KNOWN_ERRORS):
                raise cause from exc
            raise


def process_real_optical(
    kind: str,
    bbox: list[float],
    scene_id: str,
    source: str = "sentinel2",
) -> dict[str, Any]:
    if kind not in ("ndvi", "ndwi"):
        raise ProcessValidationError(f"kind real no soportado: {kind}")
    if not scene_id or not str(scene_id).strip():
        raise ProcessValidationError(
            "Elige una escena (scene_id) para NDVI/NDWI reales; no se usan datos de demo."
        )
    bbox = validate_bbox(bbox)
    src = (source or "sentinel2").strip().lower()
    if src not in ("sentinel2", "hls"):
        raise ProcessValidationError("source debe ser 'sentinel2' o 'hls'")

    def _run() -> dict[str, Any]:
        if src == "hls":
            return _process_hls(kind, bbox, scene_id.strip())
        return _process_sentinel2(kind, bbox, scene_id.strip())

    return _run_with_timeout(_run)


def process_real_thermal(bbox: list[float], scene_id: str) -> dict[str, Any]:
    """Temperatura de brillo TOA real desde HLS L30 B10. Nunca cae a simulación."""
    if not scene_id or not str(scene_id).strip():
        raise ProcessValidationError(
            "Elige una escena HLS L30 (scene_id) para el térmico real; no se usan datos simulados.",
            code="scene_required",
        )
    bbox = validate_bbox(bbox)
    return _run_with_timeout(lambda: _process_hls_thermal(bbox, str(scene_id).strip()))
