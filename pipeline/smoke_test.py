"""Prueba de humo GEE: DEM GLO-30 + MODIS LST en un punto (Valles Secos McMurdo)."""
import argparse
import time

from common import DEM_ID, LST_ID, get_logger, init_ee

log = get_logger("smoke_test")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lon", type=float, default=161.85)
    ap.add_argument("--lat", type=float, default=-77.55)
    a = ap.parse_args()
    t0 = time.time()
    ee = init_ee()
    pt = ee.Geometry.Point([a.lon, a.lat])
    dem = ee.ImageCollection(DEM_ID).select("DEM").mosaic()
    elev = dem.reduceRegion(ee.Reducer.first(), pt, 30).get("DEM")
    lst = (ee.ImageCollection(LST_ID).filterDate("2023-01-01", "2023-02-01")
           .select("LST_Day_1km").mean().multiply(0.02))
    lstv = lst.reduceRegion(ee.Reducer.mean(), pt.buffer(5000), 1000).get("LST_Day_1km")
    res = ee.Dictionary({"elev_m": elev, "lst_jan2023_K": lstv}).getInfo()
    log.info("OK %s en %.1fs", res, time.time() - t0)


if __name__ == "__main__":
    main()
