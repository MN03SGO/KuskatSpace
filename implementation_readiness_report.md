# Stage 9: Implementation Readiness Test — `plan_maestro_terraan_loga_v2_0_hackathon_24h.md`

* **Target Scope:** `DetailedRange` (lines 150–183)
* **Reviewers:** `egm-implementation-readiness` (Pragmatic Tech Lead), `egm-codebase-details` (Codebase Accuracy Auditor)
* **Overall Verdict:** **NOT IMPLEMENTATION-READY** against the unified v3 codebase (`3 BLOCKERs`, `4 MAJORs`, `3 MINORs`)

---

## Consolidated Findings

### 1. [BLOCKER] Obsolete GEE / `earth_features.csv` Pipeline & 5D Scoring Contradict v3 Pipeline
* **Source:** `egm-implementation-readiness` #1, `egm-codebase-details` #3, #6
* **Affected Lines:** L153, L165–166, L179–181
* **Finding:** Lines 153 and 165–166 instruct P1/P3 to run Google Earth Engine + MODIS AOD/NDVI + JAXA G-Portal + RADARSAT-1/RCM, export `earth_features.csv` and a PNG heatmap, and generate `~2,000` cells across 5 dimensions (including `polvo`). In the actual v3 codebase:
  * `pipeline/fetch_planetary_computer.py` queries Microsoft Planetary Computer STAC (`cop-dem-glo-90`, `modis-11A2-061`, `modis-10A2-061`, `esa-worldcover`), caches to `pipeline/cache_points.jsonl`, and processes **20 `CURATED_SITES`** (`19/20` valid exported to `data/candidates.json`). `earth_features.csv` does not exist.
  * `pipeline/compute_scores.py` scores **4 dimensions** (`relieve`, `iluminacion`, `frio`, `hielo`) using `exp_similarity` + `_minmax_norm` (`relative_minmax` for `moon_south_pole` and `mars` `frio`/`hielo`). No 3-dimension robust fallback mode exists.
* **Remediation:** Replace P1/P3 steps with v3 commands: `python pipeline/fetch_planetary_computer.py` (which invokes `compute_scores.py` -> `data/candidates.json`) and `python pipeline/cargar_mongo.py` (`DB_NAME = "analogos"`).

### 2. [BLOCKER] Wrong Directory Layout (`/web`) and Missing Startup/Verification Commands
* **Source:** `egm-implementation-readiness` #2, #5; `egm-codebase-details` #1
* **Affected Lines:** L162–171
* **Finding:** Line 164 specifies `/pipeline, /api, /web, /data`. `/web` does not exist; the actual repository uses `frontend/`, `api/`, `backend/` (imported by `api/main.py`), `pipeline/`, `data/`, and `docker-compose.yml` (`api` + `mongo:7.0`). Milestones also lack executable verification commands.
* **Remediation:** Update line 164 to the actual repo layout and add concrete startup/verification commands (`docker compose up -d`, `curl http://localhost:8000/health`, `curl "http://localhost:8000/candidates?target=moon_south_pole&limit=200"`, `npm run build` / `vitest run`).

### 3. [BLOCKER] Frozen JSON Contract & Target ID Mismatch (L164)
* **Source:** `egm-implementation-readiness` #3
* **Affected Lines:** L164 (referencing L108–145)
* **Finding:** Line 164 freezes the Section 05 v2.0 JSON contract (`mars_surface`, `scores.polvo`, `similar_properties`, `differences_and_limits`, `exploration_use_cases`, `subsurface_and_biology`, `datasets_used`). The v3 codebase (`api/main.py` `CandidateResponse`, `AnalogsView.tsx` `AnalogCandidate`, `data/targets.json`) uses `moon_south_pole`, `moon_lava_tube`, `mars`, `is_curated`, `is_understudied`, `analog_type`, `metrics`, `similar_values`, `similar_processes`, `earth_limits`, `exploration_use`, and `datasets`.
* **Remediation:** Freeze the v3 `CandidateResponse` / `data/targets.json` contract in H0–H1.

### 4. [MAJOR] Unimplemented Frontend Static Plan B Fallback & Missing Z1–Z4 / Radar / GIBS UI Features
* **Source:** `egm-implementation-readiness` #4, `egm-codebase-details` #2, #4
* **Affected Lines:** L157, L165–167, L182
* **Finding:**
  1. Line 182 relies on a frontend static `candidates.json` fallback switch when the backend fails. `AnalogsView.tsx` (`L166–178`) currently sets `error` and empties `rawCandidates` on API failure instead of loading static `candidates.json` (static fallback only exists server-side in `api/main.py` when MongoDB is down).
  2. Lines 157 and 165–167 require Z1–Z4 zone buttons, Recharts radar charts, NASA Worldview GIBS, and polar/3D projection in `AnalogsView.tsx`, none of which exist in `AnalogsView.tsx` (which uses 3 target buttons, 4 client-side sliders, horizontal score bars, and 2D Mercator MapLibre).
* **Remediation:** Either add the `.catch()` static `candidates.json` fallback in `AnalogsView.tsx` and update the plan to match the 4-slider + 2D MapLibre UI, or explicitly defer Z1–Z4/Recharts/GIBS/globe projection out of `AnalogsView`.

### 5. [MAJOR] Unused `/candidates/near` Map-Click Exploration in `AnalogsView.tsx`
* **Source:** `egm-codebase-details` #5
* **Affected Lines:** L169
* **Finding:** `get_candidates_near` is already implemented in `api/main.py` (`L371–430`), but `AnalogsView.tsx` does not wire map clicks to `/candidates/near`.
* **Remediation:** Mark `/candidates/near` as already implemented in `api/main.py` and clarify whether map-click proximity search in `AnalogsView.tsx` is deferred or required.

### 6. [MAJOR] Contradictory Contingency Triggers in Section 07
* **Source:** `egm-implementation-readiness` #6
* **Affected Lines:** L175–183
* **Finding:** Section 07 triggers reference obsolete GEE fallbacks (L179–180), unimplemented $\sigma_d$ / 3-dimension fallback (L181), and unimplemented frontend static switch (L182).
* **Remediation:** Rewrite Section 07 around v3 failure modes: Planetary Computer STAC timeout -> resume from `cache_points.jsonl` and ship curated sites; MongoDB down -> `api/main.py` `local_fallback`; API down -> frontend static `candidates.json`.

### 7. [MINOR] Scope, i18n, and Endpoint Inventory Hygiene
* **Source:** `egm-implementation-readiness` #7, `egm-codebase-details` #7–9
* **Affected Lines:** L156, L166–169
* **Issues:**
  * Candidate count target (`~2,000` cells) vs. v3 scope (`20` curated sites / `+40` optional grid).
  * `AnalogsView.tsx` uses hardcoded Spanish labels without `useT()` i18n hooks despite `<LangToggle />` in `App.tsx`.
  * Section 06 omits `api/main.py`'s actual database name (`analogos`), `cargar_mongo.py`, and active `/api/p1/*` and `/api/search` / `/api/process` endpoints.
