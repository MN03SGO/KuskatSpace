# Stage 7: Critic Review — `plan_maestro_terraan_loga_v2_0_hackathon_24h.md`

* **Target Scope:** `FeatureRange` (lines 1–149)
* **Reviewers:** `egm-design` (Design & Codebase Critic), `egm-structural` (Structural Validator), `egm-style` (Style Copy Editor)
* **Baseline Context:** `concepts_brief.md`, `api/main.py`, `pipeline/fetch_planetary_computer.py`, `pipeline/compute_scores.py`, `data/targets.json`, `frontend/src/modules/analogs/AnalogsView.tsx`, `docker-compose.yml`

---

## Consolidated Findings

### 1. [BLOCKER] Data Model & API Contract Drift (5 vs. 4 Dimensions, Target IDs, and JSON Schema)
* **Source:** `egm-design` #1, `egm-style` #2, #4, #5
* **Affected Lines:** L23, L59, L77, L89, L107–146
* **Issue:**
  1. Plan specifies 5 dynamic dimensions (`relieve`, `iluminacion`, `frio`, `hielo`, `polvo`), whereas the unified codebase (`compute_scores.py`, `data/targets.json`, `api/main.py`, `AnalogsView.tsx`) only computes and weights 4 (`relieve`, `iluminacion`, `frio`, `hielo`).
  2. Plan uses `mars_surface` and `lava_tubes` instead of `mars` and `moon_lava_tube`.
  3. Plan JSON example uses `region_type`, `analog_category`, `similar_properties`, `differences_and_limits`, `exploration_use_cases` (list), `subsurface_and_biology`, and `datasets_used`, whereas `CandidateResponse` and `AnalogsView.tsx` use `analog_type`, `is_understudied`, `is_curated`, `metrics`, `similar_values`, `earth_limits`, `exploration_use` (string), and `datasets`.
  4. `cand_qaidam_014` sets `"target": "mars_surface"` (L114) while listing lunar limits (`0.165g en Luna`, `vacío en Luna`, L132–133).
* **Fix:** Align Sections 01, 04, and 05 to the 4-dimension `CandidateResponse` contract (`moon_south_pole`, `moon_lava_tube`, `mars`), fix the Qaidam example to Mars-only limits, and mark `polvo` / `EMIT` / `subsurface_and_biology` as deferred post-hackathon extensions.

### 2. [BLOCKER] Missing Frontend Static Plan B Fallback & Server-Side vs. Client-Side Slider Contradiction
* **Source:** `egm-design` #2
* **Affected Lines:** L33–41, L46, L86
* **Issue:**
  1. Plan promises an automatic static fallback (`candidates.json` -> WebApp) if FastAPI fails/sleeps, yet `AnalogsView.tsx` (`L166–178`) sets `rawCandidates([])` and shows an error banner on `/candidates` failure without falling back to a bundled static `candidates.json`.
  2. Plan states FastAPI recalculates IFA on every slider move, whereas `AnalogsView.tsx` (`L188–196`) computes weighted scores client-side in TypeScript on a single `GET /candidates?limit=200` fetch per target switch.
* **Fix:** Add a static `candidates.json` fallback in `AnalogsView.tsx` on API failure, and update the plan architecture (L38–40, L46) to document client-side TypeScript re-ranking.

### 3. [BLOCKER] Missing Required Design Doc Governance Sections
* **Source:** `egm-structural` #1
* **Affected Lines:** L1–149
* **Issue:** The document lacks `Non-Goals`, `Critical User Journeys (CUJs)`, `Non-Functional Requirements (NFRs)`, `Alternatives Considered`, and `Open Questions` sections, leaving latency targets, memory/connection limits, and rejected design trade-offs undocumented.
* **Fix:** Add dedicated governance sections with measurable NFRs (e.g., API p95 `< 200 ms`, static fallback timeout `< 3 s`) and documented trade-offs.

### 4. [MAJOR] Scientific Model, Spatial Resolution, and Batch-Dependent Min-Max Instability
* **Source:** `egm-design` #3
* **Affected Lines:** L25, L73, L79–84
* **Issue:**
  1. Line 73 claims resampling Copernicus DEM (30 m) to ~240 m in 5 km cells; `fetch_planetary_computer.py` actually uses `cop-dem-glo-90` (90 m) + MODIS 500 m/1 km windows.
  2. `compute_scores.py` (`L45–54`, `L112–124`) uses `_minmax_norm` over the current `by_target` batch for `frio`/`hielo` on `moon_south_pole` and `mars`. Adding Phase 2 grid points shifts existing scores, and a 1-item batch collapses `_minmax_norm` to `1.0`.
* **Fix:** Document 90 m DEM + MODIS resolution accurately, and freeze reference `min`/`max` bounds in `data/targets.json` for `_minmax_norm`.

### 5. [MAJOR] Unbacked 10-Agency Data Matrix vs. 4-Collection STAC Pipeline
* **Source:** `egm-design` #4, `egm-style` #3
* **Affected Lines:** L35, L53–66
* **Issue:** Section 03 claims active ingestion/cross-validation across 10 agency resources (GEE, LRO, Diviner, PDS, MERRA-2, EMIT, ESA Open Science, JAXA G-Portal, CSA RADARSAT). Actual candidate scoring queries only 4 Planetary Computer STAC collections (`cop-dem-glo-90`, `modis-11A2-061`, `modis-10A2-061`, `esa-worldcover`). Line 53's claim of "Todos los conjuntos de datos de la pestaña Resources" is uncalibrated.
* **Fix:** Separate "Active Scoring Pipeline (4 STAC collections)" from "Reference Target Profiles / ExplorerView Federated Search" in Section 03.

### 6. [MAJOR] Incomplete Section 05 Collection/API Contracts & Zone Z1–Z4 Preset Asymmetry
* **Source:** `egm-structural` #2, #3; `egm-style` #1
* **Affected Lines:** L16, L36, L38–39, L45, L92–98, L102–146
* **Issue:** Section 05 omits schemas for `targets`, `datasets`, `/candidates/near`, and `/candidates`. Line 16 defines 4 lunar zones (`Z1`–`Z4`), but Section 4.3 omits `Z3`, renames `Z4`, and provides weights summing to `0.70` (`Z1`, `Z2`) and `0.90` (`Z4`). `AnalogsView.tsx` has 4 raw sliders + Reset without zone presets.
* **Fix:** Document all 3 collections + API endpoints in Section 05, reconcile `Z1–Z4` presets (or remove unbuilt preset claims), and make preset weights sum to `1.00`.

### 7. [MAJOR] Missing Globe/Polar MapLibre Projection in `AnalogsView.tsx`
* **Source:** `egm-design` #5
* **Affected Lines:** L47, L92–98
* **Issue:** Line 47 specifies MapLibre GL JS with globe/polar projection to avoid high-latitude distortion (`McMurdo -77.5°`, `Svalbard 78.2°`), while `AnalogsView.tsx` (`L209–231`) uses default Web Mercator.
* **Fix:** Enable `projection: { type: 'globe' }` in `AnalogsView.tsx` (or update L47 to reflect Web Mercator + coordinate readouts).

### 8. [MAJOR] Security & Ops Risks in `api/main.py` and `docker-compose.yml`
* **Source:** `egm-design` #6
* **Affected Lines:** L36, L45–47 (vs. `api/main.py` L74–80, L388–413, L514–521; `docker-compose.yml` L14–32)
* **Issue:**
  1. `allow_origins=["*"]` with `allow_credentials=True` in `api/main.py` violates the CORS spec.
  2. `sample_name` in `/api/process` is joined without path-traversal sanitization (`..` / absolute paths).
  3. `/candidates/near` silently swallows `PyMongoError` if the `2dsphere` index is missing without logging.
  4. `docker-compose.yml` fails if `.env` is absent and runs `mongo:7.0` without auth on `27017`.
* **Fix:** Set `allow_credentials=False` (or explicit origins), sanitize `sample_name` via `Path(sample_name).name` + `.is_relative_to`, log `PyMongoError` in `/candidates/near`, and guard `.env` / local Mongo exposure.

### 9. [MINOR] Structural, Style, and Minor Code Hygiene Items
* **Source:** `egm-design` #7, `egm-structural` #4–6, `egm-style` #3, #6, #7
* **Affected Lines:** L8, L17, L21, L24–25, L31, L35–39, L46, L74, L92–95, L132; `compute_scores.py` L164–178; `api/main.py` L306–325.
* **Issues:**
  * `compute_and_export_candidates` reads `cache_points.jsonl` without deduplicating by `_id`; `/export` has no pagination/limit.
  * Uncalibrated claims ("a prueba de fallos" L31, "en milisegundos" L46) and promotional phrasing ("cartera optimizada" L8, "Sliders Inteligentes" L92).
  * Undefined `H1 - H9` in Mermaid node B (L35), raw `<br>` in unquoted Mermaid labels (L35–39), inconsistent H3 numbering, mixed decimal commas/points, and `ej.` instead of `p. ej.,`.
