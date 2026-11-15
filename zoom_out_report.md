# Stage 5: Initial Zoom Out Review — `plan_maestro_terraan_loga_v2_0_hackathon_24h.md`

* **Target Document:** `plan_maestro_terraan_loga_v2_0_hackathon_24h.md` (lines 1–183)
* **Reviewers:** `egm-zoom-out` (Simplicity & Codebase Alignment) + `egm-inventive-catalyst` (TRIZ Contradictions)
* **Baseline Context:** `concepts_brief.md`, `api/main.py`, `pipeline/fetch_planetary_computer.py`, `pipeline/compute_scores.py`, `data/targets.json`, `frontend/src/modules/analogs/AnalogsView.tsx`, `docker-compose.yml`

---

## Executive Summary

`plan_maestro_terraan_loga_v2_0_hackathon_24h.md` (v2.0) has drifted substantially from the unified v3 codebase. Following v2.0 as written would reintroduce rejected complexity (5D `polvo` scoring, Google Earth Engine 2,000-cell grid at 240 m, server-side slider re-ranking, Render/Vercel split, polar MapLibre projection, Recharts, GIBS) and break active API/frontend contracts.

---

## Consolidated Findings

### 1. [BLOCKER] 5-Dimension Model (`polvo`) Contradicts the 4-Dimension Codebase
* **Plan Lines:** L23, L77–90, L95–97, L116–122.
* **Finding:** The plan defines 5 dynamic scoring dimensions (`relieve`, `iluminacion`, `frio`, `hielo`, `polvo`) and a 5-term exponential formula. In the actual codebase:
  * `pipeline/compute_scores.py`, `data/targets.json`, `api/main.py` (`compute_weighted_score`, `GET /candidates`), and `AnalogsView.tsx` (`CandidateScores`, `SLIDER_META`) only compute and expose **4 dimensions** (`relieve`, `iluminacion`, `frio`, `hielo`). `Scores.polvo` in `api/main.py` is `Optional[float] = None` and unused in ranking.
* **Recommendation & TRIZ Resolution:** Segment `polvo` out of the mandatory 4D real-time ranking vector (treat it as qualitative metadata or post-demo Phase 2 enrichment) and align the plan strictly to the 4 implemented dimensions.

### 2. [BLOCKER] Incompatible Target IDs and Candidate JSON Contract
* **Plan Lines:** L59, L104–146.
* **Finding:** Plan uses `mars_surface` and `lava_tubes`, whereas the codebase uses `moon_south_pole`, `moon_lava_tube`, and `mars`. Plan schema specifies `region_type`, `analog_category`, `similar_properties`, `differences_and_limits`, `exploration_use_cases` (list), `subsurface_and_biology`, and `datasets_used`, whereas `CandidateResponse` (`api/main.py`), `compute_scores.py`, and `AnalogsView.tsx` use `analog_type`, `is_understudied`, `is_curated`, `metrics`, `similar_values`, `similar_processes`, `earth_limits`, `exploration_use` (string), and `datasets`.
* **Recommendation:** Replace Section 05's JSON contract and target IDs with the actual `CandidateResponse` and `data/targets.json` schema.

### 3. [BLOCKER] Pipeline Stack & Scale Contradiction (GEE 2,000-Cell Grid @ 240 m vs. Planetary Computer 20 Curated Sites @ 90 m)
* **Plan Lines:** L35, L44, L73, L153, L165–166, L179–180.
* **Finding:** The plan specifies Google Earth Engine (`earth_features.csv`), a ~5 km global grid (~2,000 cells), and resampling DEM to 240 m. The implemented pipeline (`pipeline/fetch_planetary_computer.py`) uses **Microsoft Planetary Computer STAC** (`cop-dem-glo-90` at 90 m with `cos(lat)` scaling, `modis-11A2-061`, `modis-10A2-061`, `esa-worldcover`) with `cache_points.jsonl` over **20 strategic curated sites** (with optional +40 grid points post-demo).
* **Recommendation:** Rewrite Section 02 and Section 04.1 around Planetary Computer STAC, 90 m DEM, and the 20-curated-site rollout.

### 4. [MAJOR] Server-Side Slider Re-Ranking Contradicts Client-Side Architecture
* **Plan Lines:** L38–39, L46, L86.
* **Finding:** The plan states FastAPI recalculates IFA on every slider move. `concepts_brief.md` and `AnalogsView.tsx` explicitly inverted this: `AnalogsView.tsx` fetches `GET /candidates?target=<target>&limit=200` once per target switch and re-weights/sorts 100% in TypeScript at 60 FPS (avoiding hackathon Wi-Fi stalls and Render cold-start latency).
* **Recommendation:** Update Section 02 architecture diagram and stack description to single-fetch + client-side TypeScript re-ranking (and add a client-side static `candidates.json` fallback if `${API_BASE}` fails).

### 5. [MAJOR] Scientific Scoring Model Drift & Cross-Scale Skylight Contradiction
* **Plan Lines:** L18, L73–98, L165, L169.
* **Finding:**
  * Plan references unimplemented crater scaling ($D/D_t$), 4-date solar shadow modeling for illumination, and uniform exponential distance for `frio`/`hielo`. Actual `compute_scores.py` uses `0.6 * s_svf + 0.4 * s_lat` for `iluminacion`, and a hybrid model: `relative_minmax` for `frio`/`hielo` on `moon_south_pole` and `mars`, and `direct` exponential (`253.15 K`, `0.0` ice) on `moon_lava_tube`.
  * Plan also treats 90 m / 240 m orbital DEMs as resolving meter-scale lunar skylights (`moon_lava_tube`). Codebase resolves this via macro-regional 90 m proxy scoring (`svf_target: 0.05`, `slope_deg: 15.0`) + `is_curated` exemption + explicit 90 m DEM resolution disclaimer in `earth_limits`.
  * Plan defines 5 zone presets (Z1–Z4); `AnalogsView.tsx` implements 4 raw sliders + Reset.
* **Recommendation:** Align Section 04 with `compute_scores.py` and `data/targets.json`, document the 90 m skylight resolution boundary explicitly, and remove unimplemented $D/D_t$ and Z1–Z4 claims.

### 6. [MAJOR] Unimplemented / Speculative Frontend & Dataset Scope (YAGNI)
* **Plan Lines:** L39, L47, L55–66, L156–169.
* **Finding:** `AnalogsView.tsx` uses standard dark CARTO Mercator MapLibre tiles (no polar projection), horizontal score bars (no Recharts radar), no Worldview GIBS layer, and no SAR/LROC comparator. Analog scoring uses only 4 Planetary Computer collections (`cop-dem-glo-90`, `modis-11A2-061`, `modis-10A2-061`, `esa-worldcover`), while NASA/CSA/ESA/JAXA federated search lives in the separate `ExplorerView`.
* **Recommendation:** Scope Section 03 and `AnalogsView` specs strictly to implemented features and distinguish `ExplorerView` from `AnalogsView`.

### 7. [MINOR] Obsolete Repo Paths, Deployment Topology, and 24h Schedule
* **Plan Lines:** L36, L38, L45–47, L164–171, L179–183.
* **Finding:** Plan references `/web` instead of `frontend/`, Render/Vercel/Atlas M0 instead of `docker-compose.yml` (`api` + `mongo:7.0`, `DB_NAME="analogos"` + local JSON fallback), and an obsolete H0–H24 GEE timeline/contingency table superseded by `concepts_brief.md` (12:00 demo / 20:00 freeze).
* **Recommendation:** Update paths, deployment notes, and milestones to match the current repo.
