# AI_USAGE_P1 — Registro de uso de IA (P1 Jorge)

| Fecha/hora | Tarea | Qué hizo la IA | Revisión humana |
|---|---|---|---|
| 2026-11-14 18:13 | Auditoría repo y plan_maestro | Lectura de estructura, extracción de tareas P1, redacción de `PLAN_P1.md` | Pendiente de revisión por Jorge |
| 2026-11-14 18:15 | Verificación de datasets | Consulta del catálogo STAC de GEE; detectó que `COPERNICUS/DEM/GLO30` está deprecado | IDs verificables en el catálogo |
| 2026-11-14 18:16 | Scripts pipeline | Generación de `pipeline/common.py`, `smoke_test.py` | Revisado y probado con GEE en McMurdo |
| 2026-11-14 18:55 | Auditoría de ramas y módulos P1 | Inspección de `origin/feature/database`, `origin/back-AR` y `origin/Frontend/WebGIS`; creación de `features.py`, `qc.py`, `heatmap.py`, `metadata.py`, `orbital_previews.py` y `run_pipeline.py` | Validado contra esquemas de P4 y P5 |
| 2026-11-14 19:40 | Generación de entregables v1 | Exportación de `data/earth_features.csv`, `qc_report.json`, 3 heatmaps PNG + `heatmap_bounds.json`, `metadata.json` y 16 recortes Sentinel-2 / Sentinel-1 SAR (filtro Lee) | Verificado con `qc.py` |
| 2026-11-14 20:40 | Expansión global (16 ROIs + dorsal 60 km) e integración §05 | Descarga de ROIs restantes (Sahara/Tibesti, Taklamakán, Lut, Namib, Pilbara, Svalbard, Mojave, Lanzarote) → 13.688 celdas en `earth_features.csv`; creación de `pipeline/integrate_p1_candidates.py` para generar `candidates.json` (5D con `scores.polvo`) y `datasets.json` | Validado con esquema §05 y `normalizar_contrato.py` |

