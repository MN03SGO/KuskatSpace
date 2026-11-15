"""P1 · Extracción de features terrestres por celda con GEE (reduceRegions).

Grilla: EASE-Grid 2.0 (EPSG:6933) con paso --step-km; en cada celda se agregan
estadísticas en una ventana circular central de --window-m de diámetro (5 km por defecto,
cumpliendo la regla de escala homóloga de plan_maestro §4.1).

Dos pasadas por tesela:
  * DEM (240 m, homólogo a LOLA/MOLA): elev, pendiente, relieve, sombra 4 fechas.
  * MODIS (escala homóloga de ventana): climatología multianual de LST, nieve, AOD y NDVI.

Salida: un CSV por tesela en data/tiles/ (caché reanudable) y, con --assemble,
data/earth_features_raw.csv (que luego pasa por `qc.py` → `data/earth_features.csv`).

Ejemplos:
  python features.py --bbox -72 -26 -66 -20 --workers 2 --tag test
  python features.py --step-km 30 --lat-step 20 --lon-step 30 --workers 6 --assemble
"""
from __future__ import annotations

import argparse
import math
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import pandas as pd

from common import (AOD_ID, CLIM_END, DATA, DEM_ID, LST_ID, NDVI_ID,
                    get_logger, init_ee)

log = get_logger("features")

SNOW8_ID = "MODIS/061/MOD10A2"
# EPSG:6933 (WGS 84 / NSIDC EASE-Grid 2.0 Global) como WKT: GEE no resuelve ese código EPSG
EASE_WKT = ('PROJCS["WGS 84 / NSIDC EASE-Grid 2.0 Global",GEOGCS["WGS 84",DATUM["WGS_1984",'
            'SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],'
            'UNIT["degree",0.0174532925199433]],PROJECTION["Cylindrical_Equal_Area"],'
            'PARAMETER["standard_parallel_1",30],PARAMETER["central_meridian",0],'
            'PARAMETER["false_easting",0],PARAMETER["false_northing",0],UNIT["metre",1]]')

DEM_SCALE = 240
MODIS_SCALE = 2500  # Escala homóloga para agregación en ventana de 5 km
# Fechas (declinación solar, grados): equinoccios y solsticios 2024
SUN_DATES = {
    "d1": ("2024-03-20", 0.0),
    "d2": ("2024-06-20", 23.44),
    "d3": ("2024-09-22", 0.0),
    "d4": ("2024-12-21", -23.44),
}
SHADOW_NEIGH_PX = 100  # 100 px * 240 m = 24 km de alcance de sombra proyectada

COLUMNS = ["cell_id", "lat", "lon", "elev_m", "slope_mean", "slope_p90", "relief_local",
           "shadow_frac_d1", "shadow_frac_d2", "shadow_frac_d3", "shadow_frac_d4",
           "lst_mean", "lst_min", "lst_max", "lst_amp", "snow_persist",
           "aod_mean", "aod_p90", "ndvi_mean", "ndvi_max", "qc_flag"]


def noon_sun(lat: float, decl: float) -> tuple[float, float]:
    """Elevación (°) y azimut (°) del sol al mediodía solar local."""
    elev = 90.0 - abs(lat - decl)
    az = 180.0 if lat > decl else 0.0
    return elev, az


class Builder:
    def __init__(self, ee, step_km: float, window_m: float,
                 modis_start: str = "2022-01-01", aod_start: str = "2023-01-01"):
        self.ee = ee
        self.step_m = step_km * 1000
        self.window_m = window_m
        ease = ee.Projection(EASE_WKT)
        self.grid = ease.atScale(self.step_m)
        self.p240 = ease.atScale(DEM_SCALE)

        dem = (ee.ImageCollection(DEM_ID).select("DEM").mosaic()
               .setDefaultProjection("EPSG:4326", None, 30))
        self.land = dem.mask().gt(0)
        self.dem240 = dem.reproject(self.p240).rename("elev")
        self.slope = ee.Terrain.slope(self.dem240).rename("slope")

        # ---- MODIS climatología vectorizada (sin loops de 12 meses ni map por imagen) ----
        lst = ee.ImageCollection(LST_ID).filterDate(modis_start, CLIM_END)
        day = lst.select("LST_Day_1km")
        night = lst.select("LST_Night_1km")
        day_mean = day.mean()
        night_mean = night.mean()
        lst_mean = day_mean.add(night_mean).divide(2).multiply(0.02).rename("lst_mean")
        lst_amp = day_mean.subtract(night_mean).multiply(0.02).rename("lst_amp")

        # Meses solsticiales extremos (enero y julio cubren verano/invierno en ambos hemisferios)
        jan_d = day.filter(ee.Filter.calendarRange(1, 1, "month")).mean()
        jul_d = day.filter(ee.Filter.calendarRange(7, 7, "month")).mean()
        jan_n = night.filter(ee.Filter.calendarRange(1, 1, "month")).mean()
        jul_n = night.filter(ee.Filter.calendarRange(7, 7, "month")).mean()
        lst_max = jan_d.max(jul_d).multiply(0.02).rename("lst_max")
        lst_min = jan_n.min(jul_n).multiply(0.02).rename("lst_min")

        snow = ee.ImageCollection(SNOW8_ID).filterDate(modis_start, CLIM_END).select("Maximum_Snow_Extent")
        is_snow = snow.map(lambda i: i.eq(200))
        valid = snow.map(lambda i: i.eq(200).Or(i.eq(25)))
        snow_persist = is_snow.sum().divide(valid.sum()).rename("snow_persist")

        # MCD19A2 es por gránulos orbitales (hasta 1350 gránulos por tesela polar):
        # colapsamos primero 8 ventanas estacionales (3 días c/u en 2022-2023) con .mean()
        # antes de calcular media y p90, evitando User memory limit exceeded en latitudes altas.
        aod_windows = [
            ("2022-01-15", "2022-01-18"), ("2022-04-15", "2022-04-18"),
            ("2022-07-15", "2022-07-18"), ("2022-10-15", "2022-10-18"),
            ("2023-01-15", "2023-01-18"), ("2023-04-15", "2023-04-18"),
            ("2023-07-15", "2023-07-18"), ("2023-10-15", "2023-10-18"),
        ]
        aod_comp = ee.ImageCollection([
            ee.ImageCollection(AOD_ID).filterDate(ws, we).select("Optical_Depth_055").mean()
            for ws, we in aod_windows
        ])
        aod_mean = aod_comp.mean().multiply(0.001).rename("aod_mean")
        aod_p90 = aod_comp.reduce(ee.Reducer.percentile([90])).multiply(0.001).rename("aod_p90")

        ndvi = ee.ImageCollection(NDVI_ID).filterDate(modis_start, CLIM_END).select("NDVI")
        ndvi_mean = ndvi.mean().multiply(0.0001).rename("ndvi_mean")
        ndvi_max = ndvi.max().multiply(0.0001).rename("ndvi_max")

        self.modis = ee.Image.cat([lst_mean, lst_min, lst_max, lst_amp, snow_persist,
                                   aod_mean, aod_p90, ndvi_mean, ndvi_max]).toFloat()

    def shadow_stack(self, lat_c: float):
        ee = self.ee
        bands = []
        for k, (_, decl) in SUN_DATES.items():
            h, az = noon_sun(lat_c, decl)
            if h <= 0:
                img = ee.Image.constant(1).reproject(self.p240)
            else:
                cast = ee.Terrain.hillShadow(self.dem240, az, 90 - h, SHADOW_NEIGH_PX, False)
                self_sh = ee.Terrain.hillshade(self.dem240, az, h).lte(0)
                img = cast.Not().Or(self_sh)
            bands.append(img.updateMask(self.dem240.mask()).toFloat().rename(f"shadow_frac_{k}"))
        return ee.Image.cat(bands)

    def cells(self, rect):
        ee = self.ee
        img = (ee.Image.pixelCoordinates(self.grid)
               .addBands(ee.Image.pixelLonLat())
               .updateMask(self.land))
        pts = img.sample(region=rect, projection=self.grid, geometries=True, dropNulls=True)
        r = self.window_m / 2
        step_km = int(round(self.step_m / 1000))

        def mk(f):
            col = ee.Number(f.get("x")).floor().int()
            row = ee.Number(f.get("y")).floor().int()
            cid = (ee.String(f"E{step_km}_r")
                   .cat(row.format()).cat("_c").cat(col.format()))
            return ee.Feature(f.geometry().buffer(r, 25), {
                "cell_id": cid, "lat": f.get("latitude"), "lon": f.get("longitude")})
        return pts.map(mk)

    def tile_frames(self, west, south, east, north):
        ee = self.ee
        rect = ee.Geometry.Rectangle([west, south, east, north], "EPSG:4326", False)
        cells = self.cells(rect)
        lat_c = (south + north) / 2
        dem_stack = self.dem240.addBands(self.slope).addBands(self.shadow_stack(lat_c))
        red = (ee.Reducer.mean()
               .combine(ee.Reducer.percentile([90]), sharedInputs=True)
               .combine(ee.Reducer.minMax(), sharedInputs=True)
               .combine(ee.Reducer.count(), sharedInputs=True))
        dem_fc = dem_stack.reduceRegions(cells, red, scale=DEM_SCALE, crs=self.p240, tileScale=8)
        dem_cols = ["cell_id", "lat", "lon", "elev_mean", "elev_min", "elev_max", "elev_count",
                    "slope_mean", "slope_p90"] + [f"shadow_frac_{k}_mean" for k in SUN_DATES]
        dem_fc = dem_fc.select(dem_cols, retainGeometry=False)
        a = ee.data.computeFeatures({"expression": dem_fc, "fileFormat": "PANDAS_DATAFRAME"})
        if a.empty:
            return a
        mod_fc = self.modis.reduceRegions(cells, ee.Reducer.mean(), scale=MODIS_SCALE,
                                          crs="EPSG:4326", tileScale=8)
        mod_cols = ["cell_id", "lst_mean", "lst_min", "lst_max", "lst_amp", "snow_persist",
                    "aod_mean", "aod_p90", "ndvi_mean", "ndvi_max"]
        mod_fc = mod_fc.select(mod_cols, retainGeometry=False)
        b = ee.data.computeFeatures({"expression": mod_fc, "fileFormat": "PANDAS_DATAFRAME"})
        df = a.merge(b, on="cell_id", how="left") if not b.empty else a
        return df


def to_contract(df: pd.DataFrame, window_m: float) -> pd.DataFrame:
    out = pd.DataFrame()
    out["cell_id"] = df["cell_id"]
    out["lat"] = df["lat"].round(5)
    out["lon"] = df["lon"].round(5)
    out["elev_m"] = df.get("elev_mean")
    out["slope_mean"] = df.get("slope_mean")
    out["slope_p90"] = df.get("slope_p90")
    out["relief_local"] = df.get("elev_max") - df.get("elev_min")
    for k in SUN_DATES:
        out[f"shadow_frac_{k}"] = df.get(f"shadow_frac_{k}_mean")
    for c in ["lst_mean", "lst_min", "lst_max", "lst_amp", "snow_persist",
              "aod_mean", "aod_p90", "ndvi_mean", "ndvi_max"]:
        out[c] = df[c] if c in df else float("nan")
    expected = math.pi * (window_m / 2) ** 2 / DEM_SCALE ** 2
    out["_dem_cov"] = df.get("elev_count") / expected
    return out


def make_tiles(bbox, lat_step, lon_step):
    w, s, e, n = bbox
    tiles = []
    lat = s
    while lat < n - 1e-6:
        lon = w
        lat_next = min(lat + lat_step, n)
        while lon < e - 1e-6:
            lon_next = min(lon + lon_step, e)
            tiles.append((round(lon, 2), round(lat, 2), round(lon_next, 2), round(lat_next, 2)))
            lon = lon_next
        lat = lat_next
    return tiles


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--bbox", nargs=4, type=float, default=[-180, -85, 180, 85],
                    metavar=("W", "S", "E", "N"))
    ap.add_argument("--step-km", type=float, default=30,
                    help="paso de grilla EASE en km (30 km global ≈ 165k celdas; 15 km para densificación regional)")
    ap.add_argument("--window-m", type=float, default=5000,
                    help="diámetro de ventana homóloga de evaluación (5000 m)")
    ap.add_argument("--lat-step", type=float, default=20)
    ap.add_argument("--lon-step", type=float, default=30)
    ap.add_argument("--modis-start", default="2022-01-01")
    ap.add_argument("--aod-start", default="2023-01-01")
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--retries", type=int, default=3)
    ap.add_argument("--tag", default="")
    ap.add_argument("--assemble", action="store_true")
    a = ap.parse_args()

    ee = init_ee()
    b = Builder(ee, a.step_km, a.window_m, a.modis_start, a.aod_start)
    tdir = DATA / "tiles" / (a.tag or f"s{int(a.step_km)}_w{int(a.window_m)}")
    tdir.mkdir(parents=True, exist_ok=True)
    tiles = make_tiles(a.bbox, a.lat_step, a.lon_step)
    todo = [t for t in tiles if not (tdir / ("t_%.1f_%.1f_%.1f_%.1f.csv" % t)).exists()]
    log.info("Teselas: %d total, %d pendientes, cache=%s", len(tiles), len(todo), tdir)

    def run(t):
        path = tdir / ("t_%.1f_%.1f_%.1f_%.1f.csv" % t)
        msg = ""
        for attempt in range(1, a.retries + 1):
            try:
                t0 = time.time()
                df = b.tile_frames(*t)
                df = to_contract(df, a.window_m) if not df.empty else pd.DataFrame(columns=COLUMNS)
                df.to_csv(path, index=False)
                return t, len(df), time.time() - t0, None
            except Exception as exc:  # noqa: BLE001
                msg = str(exc)[:300]
                log.warning("Tesela %s intento %d falló: %s", t, attempt, msg)
                time.sleep(4 * attempt)
        return t, 0, 0, msg

    t_start = time.time()
    done = 0
    with ThreadPoolExecutor(max_workers=a.workers) as pool:
        futs = [pool.submit(run, t) for t in todo]
        for f in as_completed(futs):
            t, n, dt, err = f.result()
            done += 1
            if err:
                log.error("Tesela %s FALLÓ: %s", t, err)
            else:
                log.info("[%d/%d] tesela %s: %d celdas en %.1fs (total %.0fs)",
                         done, len(todo), t, n, dt, time.time() - t_start)

    if a.assemble:
        parts = [pd.read_csv(p) for p in sorted(tdir.glob("t_*.csv")) if p.stat().st_size > 80]
        full = pd.concat([p for p in parts if not p.empty], ignore_index=True) if parts else pd.DataFrame(columns=COLUMNS)
        full = full.drop_duplicates("cell_id")
        out = DATA / "earth_features_raw.csv"
        full.to_csv(out, index=False)
        log.info("Ensamblado %d celdas → %s (pasar por qc.py)", len(full), out)


if __name__ == "__main__":
    main()
