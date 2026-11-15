# TerraAnáloga Unification and Real-Data Analog Scoring (v3)

* **Author:** Carlos Ansorge
* **Date:** 2026-11-14

## Overview

TerraAnáloga is a web application for the NASA Space Apps Challenge 2026 (*Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars*). It ranks Earth locations by how closely they resemble one of three fixed planetary targets—Lunar South Pole (`moon_south_pole`), Mare Tranquillitatis Lava Tube (`moon_lava_tube`), and Mars (`mars`)—across four physical dimensions (`relieve`, `iluminacion`, `frio`, `hielo`).

The target users are hackathon judges, planetary exploration planners, and researchers. The core value proposition is helping users find terrestrial field-test beds for rovers, drills, and sensors while explicitly showing where Earth differs from space (gravity, vacuum, cosmic radiation). The product never claims or implies construction suitability on the Moon, Mars, or Earth.

This brief defines the unified single-app architecture (`api/main.py` + `pipeline/` + `frontend/`), the corrected offline Microsoft Planetary Computer pipeline, and the two-phase candidate rollout for the 12:00 integrated demo and 20:00 code freeze.

## Analysis

### 1. Client-Side Slider Re-Ranking and Singleton Database Client
* **Problem Resolved:** Calling `GET /candidates` on every slider drag with a per-request `MongoClient(..., serverSelectionTimeoutMS=2000)` + `ping` and `limit=50` risked 2-second UI stalls and truncated candidate lists.
* **Mechanism:**
  * `api/main.py` initializes a single `MongoClient` at startup using FastAPI `lifespan`, raises `GET /candidates` default `limit` to `200`, and falls back to `data/candidates.json` when MongoDB is unavailable.
  * `AnalogsView.tsx` fetches `GET /candidates?target=<target>&limit=200` once per planetary target switch (with direct static fallback to `candidates.json`), and computes weighted scores and sorting in TypeScript at 60 FPS with zero network calls during slider movement.
* **Trade-offs:** Slightly larger initial JSON payload (~20–60 sites, <100 KB) in exchange for zero-latency slider interaction and immunity to event Wi-Fi hiccups.

### 2. Geospatial Fixes and Resumable Offline Pipeline
* **Slope Projection Fix:** `pipeline/fetch_planetary_computer.py` computes `dx = 90.0 * cos(radians(lat))` and `dy = 90.0` in `compute_terrain_metrics` so `EPSG:4326` DEM gradients are not underestimated by 2x–5x at polar latitudes.
* **MODIS CRS and Tile Boundaries:** `cop-dem-glo-90` queries use `limit=4` and mosaic across 1-degree tile borders; `modis-11A2-061` and `modis-10A2-061` clips pass `crs="EPSG:4326"` to match their Sinusoidal projection.
* **No Fake Fallbacks:** Hardcoded fallback terrain numbers (`elevation_mean_m: 1200.0`, `slope_mean_deg: 10.5`) are removed. Points whose satellite reads fail record `null` and are excluded.
* **Curated Exemption and Ice-Sheet Mask:**
  * Curated sites (`is_curated: true`) are exempt from the `>15%` `esa-worldcover` vegetation filter so volcanic subsurface analogs (e.g., El Boquerón, Lava Beds) are preserved.
  * Grid points (`is_curated: false`) with `esa-worldcover` class `70` (permanent snow/ice) `> 80%` are discarded so interior Greenland/Antarctic ice sheets do not outrank cold-dry permafrost analogs (McMurdo Dry Valleys, Devon Island).
* **Incremental Disk Cache:** Each processed point is appended to `pipeline/cache_points.jsonl` immediately so interrupted runs resume without re-fetching completed coordinates.

### 3. Two-Phase Candidate Scope and Schema Symmetry
* **Phase 1 (12:00 Demo Milestone):** Process **20 strategic curated sites** (`is_curated: true`, covering `moon_south_pole`, `moon_lava_tube`, and `mars`, including classic validation sites and understudied sites like Qaidam, Pingualuit, and Puna de Atacama) using real Planetary Computer metrics (<1 minute runtime).
* **Phase 2 (Optional Post-12:00 before 20:00 Freeze):** If the end-to-end demo is verified and time remains, run **40 additional grid points** using the same resumable `cache_points.jsonl` pipeline; otherwise ship the 20 real curated sites.
* **Schema Symmetry:** `CandidateResponse` in `api/main.py` adds `is_curated: bool = False`, `rule_label: Optional[str] = None`, and `measured_metrics`, keeping `is_understudied: bool = False` for scientific novelty and defaulting `exploration_use: Optional[str] = None` so auto-generated grid cards never fail Pydantic validation. `pipeline/cargar_mongo.py` prunes stale candidate IDs during sync.
* **Transparency & Lava-Tube 90 m Limit:** Relative dimensions (`frio`, `hielo` for South Pole and Mars) display raw physical units alongside the 0–1 score with a `Relative Earth Scale` badge and frozen min-max bounds from `data/targets.json`. For `moon_lava_tube`, `iluminacion` reflects macro-regional latitude/setting and `earth_limits` states explicitly that meter-scale skylights are unresolved in a 90 m orbital DEM.

## Goals vs. Non-Goals

* **In-Scope Goals:**
  * Single unified app: `api/main.py` (retaining `backend/connectors.py`, `backend/processor.py`, and `backend/sample_data/` for `ExplorerView`), `pipeline/`, and `frontend/` (`AnalogsView.tsx` as default tab).
  * Remove dead duplicate files and unused services: root `main.py`, `seed_mongo.py`, `test_db.py`, `backend/main.py`, and PostGIS/MinIO/Adminer from `docker-compose.yml`.
  * Fix `api/main.py` `__main__` entrypoint to `"api.main:app"`.
  * Resumable offline Planetary Computer pipeline (`fetch_planetary_computer.py` + `compute_scores.py` + `cargar_mongo.py`) producing 20 real curated candidates for 12:00 (optional +40 grid points post-12:00).
  * Interactive `AnalogsView.tsx` with target selector, 4 client-side weight sliders, Leaflet map markers, two-level cards with Earth limits, and "Earth Field-Test Analog Finder — Not construction suitability" disclaimer.
* **Out-of-Scope Non-Goals:**
  * Evaluating landing safety or construction suitability on the Moon, Mars, or Earth.
  * Live Planetary Computer or Meteomatics API calls during the 60-second demo.
  * Running `fetch_meteomatics.py` in the critical demo path.
  * Requiring the 120-point grid before the 12:00 end-to-end demo milestone.

## Alternatives Weighed

* **Server-side slider re-ranking on every drag:** Rejected by author; creates unnecessary HTTP load and 2-second Atlas handshake risk during live demo.
* **120-point grid before 12:00:** Rejected by author in favor of a two-phase rollout (20 real curated sites first, optional +40 grid points after end-to-end demo verification) to guarantee the 12:00 milestone.
* **Live STAC queries during demo:** Rejected by author for latency and Wi-Fi risk.
* **Absolute `exp(-|x-t|/σ)` for lunar/Martian `frio` and `hielo`:** Rejected by author because ~100 K temperature gaps collapse all Earth sites near `0`.

## Key Decisions & Staging for Next Steps

1. **Client-Side Slider Math + Singleton `MongoClient`:** Cache one `MongoClient` via FastAPI `lifespan`, set `limit=200`, and re-weight/sort in TypeScript inside `AnalogsView.tsx`.
2. **Geospatial Pipeline Fixes + `cache_points.jsonl`:** Apply `cos(lat)` DEM scaling, `limit=4` DEM mosaic, `crs="EPSG:4326"` MODIS clipping, no fake fallbacks, `is_curated` vegetation exemption, and class-70 `>80%` ice-sheet exclusion.
3. **20 Curated Sites First (+40 Optional Grid):** Deliver the full 20-site real-data catalog for 12:00; expand with 40 grid points only after end-to-end demo passes.
4. **Unified Symmetric Contracts & Cleanup:** Update `data/targets.json` (new `iluminacion` SVF/`|lat|` targets and `scoring_mode`), `CandidateResponse` (`is_curated`, `is_understudied`, `measured_metrics`, `rule_label`), and remove `main.py`, `seed_mongo.py`, `test_db.py`, `backend/main.py`, PostGIS, and MinIO.
