import os
from typing import Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from connectors import run_federated_search
from mongo_api import close_db, router as data_router
from processor import execute_pipeline, export_geotiff_bytes

app = FastAPI(title="Cloud GIS & Remote Sensing Platform", version="0.4.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Módulo A (datos en MongoDB): /candidates, /candidates/near, /targets, /export
app.include_router(data_router)


@app.on_event("shutdown")
def shutdown() -> None:
    close_db()


@app.get("/api/search")
async def search_catalogs(
    bbox: str = Query("-92.5,11.5,-83.0,17.5"),
    start_date: str = Query("2026-10-01"),
    end_date: str = Query("2026-11-10"),
    body: str = Query("earth", enum=["earth", "moon", "mars"]),
    variable: str = Query("all"),
    limit: int = Query(5, ge=1, le=20),
):
    return await run_federated_search(bbox, start_date, end_date, body, variable, limit)


@app.post("/api/process")
def process_scene(
    mode: str = Query("sar_db", enum=["sar_db", "ndvi", "ndwi", "diviner_thermal", "jaxa_precip"]),
    bbox: str = Query("-92.5,11.5,-83.0,17.5"),
    sample_name: Optional[str] = Query(None),
):
    try:
        coords = [float(x) for x in bbox.split(",")]
        file_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sample_data", sample_name) if sample_name else None
        return execute_pipeline(mode=mode, bbox=coords, sample_path=file_path)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/export/geotiff")
def download_processed_geotiff(
    mode: str = Query("sar_db", enum=["sar_db", "ndvi", "ndwi", "diviner_thermal", "jaxa_precip"]),
    bbox: str = Query("-92.5,11.5,-83.0,17.5"),
):
    coords = [float(x) for x in bbox.split(",")]
    tif_bytes = export_geotiff_bytes(mode=mode, bbox=coords)
    return Response(
        content=tif_bytes,
        media_type="image/tiff",
        headers={"Content-Disposition": f"attachment; filename=resultado_{mode}.tif"},
    )