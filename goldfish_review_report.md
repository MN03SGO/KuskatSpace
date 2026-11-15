# Goldfish Annotated Review Report

**Status:** resolved  
**Target:** `plan_maestro_terraan_loga_v2_0_hackathon_24h.md` (`1–183`)

## Prioritized Findings & AI Suggestions

### [Issue 1] [`egm-design` / `egm-style` / `egm-implementation-readiness`] - Severity: Blocker
*   **Affected Scope:** [Lines 23, 59, 77–90, 107–146, 164](plan_maestro_terraan_loga_v2_0_hackathon_24h.md#L23-L164) (Sections 01, 04.2, 05, 06)
*   **Discrepancy Description:** The plan specifies 5 dynamic dimensions (`relieve`, `iluminacion`, `frio`, `hielo`, `polvo`), target IDs `mars_surface` / `lava_tubes`, and v2.0 JSON keys (`region_type`, `similar_properties`, `differences_and_limits`, `exploration_use_cases`, `subsurface_and_biology`, `datasets_used`), plus lunar limits inside the Mars Qaidam example (L132–133).
*   **Rationale:** The unified v3 codebase (`api/main.py`, `pipeline/compute_scores.py`, `data/targets.json`, `frontend/src/modules/analogs/AnalogsView.tsx`) uses 4 active dimensions (`relieve`, `iluminacion`, `frio`, `hielo`), target IDs `moon_south_pole`, `moon_lava_tube`, `mars`, and `CandidateResponse` fields (`analog_type`, `is_understudied`, `is_curated`, `metrics`, `similar_values`, `similar_processes`, `earth_limits`, `exploration_use`, `datasets`).
*   ***AI Suggestion:*** `PROPOSE FIX`
*   ***Justification:*** Aligning the design doc to the actual 4D v3 schema eliminates contract drift and fixes the Mars/Moon mix-up in `cand_qaidam_014`.
*   ***Proposed Edit:***
    *   Location: Lines 23, 59, 77–90, 107–146
    *   Change: Replace 5D `polvo` scoring with the 4 active dimensions + hybrid `relative_minmax`/`direct` model, update target IDs to `moon_south_pole`, `moon_lava_tube`, `mars`, and replace the Section 05 JSON example with the actual `CandidateResponse` schema (without lunar limits on Mars).

### [Issue 2] [`egm-design` / `egm-implementation-readiness` / `egm-codebase-details`] - Severity: Blocker
*   **Affected Scope:** [Lines 31–48, 73, 153, 165–166](plan_maestro_terraan_loga_v2_0_hackathon_24h.md#L31-L166) (Sections 02, 04.1, 06)
*   **Discrepancy Description:** The plan describes a Google Earth Engine + `earth_features.csv` + 2,000-cell @ 240 m grid + Render/Vercel stack.
*   **Rationale:** The actual v3 system uses Microsoft Planetary Computer STAC (`cop-dem-glo-90` at 90 m with `cos(lat)` scaling + SVF, `modis-11A2-061`, `modis-10A2-061`, `esa-worldcover`), incremental `pipeline/cache_points.jsonl`, 20 strategic curated sites (optional +40 grid), `pipeline/compute_scores.py`, `pipeline/cargar_mongo.py`, and `docker-compose.yml` (`api` + `mongo:7.0` + `DB_NAME="analogos"`).
*   ***AI Suggestion:*** `PROPOSE FIX`
*   ***Justification:*** Updating Section 02, 04.1, and 06 ensures the execution plan documents the real Planetary Computer + Docker/localhost pipeline rather than an obsolete GEE workflow.
*   ***Proposed Edit:***
    *   Location: Lines 31–48, 73, 153, 165–166
    *   Change: Update the Mermaid diagram, stack list, spatial resolution rule (90 m DEM with `cos(lat)` + MODIS CRS `EPSG:4326`), and P1/P3 tasks to reflect Planetary Computer STAC, `cache_points.jsonl`, 20 curated sites, and `docker-compose.yml`.

### [Issue 3] [`egm-implementation-readiness` / `egm-codebase-details`] - Severity: Blocker
*   **Affected Scope:** [Lines 162–171](plan_maestro_terraan_loga_v2_0_hackathon_24h.md#L162-L171) (Section 06 Schedule)
*   **Discrepancy Description:** Line 164 references non-existent `/web` directory, omits `backend/` and `docker-compose.yml`, and milestones lack executable startup and verification commands.
*   **Rationale:** The actual repo uses `frontend/` (`AnalogsView.tsx`), `api/main.py`, `backend/` (multi-agency Explorer helpers), `pipeline/`, and `data/`.
*   ***AI Suggestion:*** `PROPOSE FIX`
*   ***Justification:*** Concrete paths and verification commands make Section 06 directly executable.
*   ***Proposed Edit:***
    *   Location: Lines 162–171
    *   Change: Replace `/web` with `frontend/`, list `api/`, `backend/`, `pipeline/`, `data/`, `docker-compose.yml`, align milestones with the 12:00 integrated demo / 20:00 freeze, and add exact startup/curl/build verification commands.

### [Issue 4] [`egm-structural`] - Severity: Blocker
*   **Affected Scope:** [Lines 1–149](plan_maestro_terraan_loga_v2_0_hackathon_24h.md#L1-L149) (Document governance sections)
*   **Discrepancy Description:** The document lacks explicit `Non-Goals`, `Critical User Journeys`, `Non-Functional Requirements`, `Alternatives Considered`, and `Open Questions` sections.
*   **Rationale:** Without explicit scope boundaries, latency/fallback SLAs, and rejected alternatives, reviewers and implementers lack clear architectural guardrails.
*   ***AI Suggestion:*** `PROPOSE FIX`
*   ***Justification:*** Adding concise governance sections grounded in `concepts_brief.md` closes the structural gap without bloat.
*   ***Proposed Edit:***
    *   Location: After Section 05 (before Section 06)
    *   Change: Add a concise `## 05b. Gobernanza, No-Objetivos, CUJs, NFRs y Alternativas` section covering Non-Goals, 2 CUJs, NFRs (60 FPS client sliders, `< 3 s` API fallback), and rejected alternatives from `concepts_brief.md`.

### [Issue 5] [`egm-design` / `egm-structural` / `egm-style`] - Severity: Major
*   **Affected Scope:** [Lines 38–40, 46–47, 86, 92–98, 157, 165–169](plan_maestro_terraan_loga_v2_0_hackathon_24h.md#L38-L169) (Client-side sliders & UI scope)
*   **Discrepancy Description:** Plan describes server-side slider recalculation, Z1–Z4 preset buttons (omitting Z3 and with weights not summing to 1.0), Recharts radar, Worldview GIBS, and polar/3D projection in `AnalogsView.tsx`.
*   **Rationale:** `AnalogsView.tsx` fetches `GET /candidates?target=...&limit=200` once per target switch, re-ranks 100% client-side in TypeScript, renders 4 raw sliders + Reset, horizontal score bars, and a 2D Mercator MapLibre map.
*   ***AI Suggestion:*** `PROPOSE FIX`
*   ***Justification:*** Aligning the UI spec to what `AnalogsView.tsx` actually implements removes false promises and reconciles the Z1–Z4 preset inconsistency.
*   ***Proposed Edit:***
    *   Location: Lines 38–40, 46–47, 86, 92–98, 157, 165–169
    *   Change: Document client-side TypeScript re-ranking on `limit=200`, 4 raw sliders + Reset, 2D MapLibre dark basemap, and mark Z1–Z4 presets, Recharts radar, polar globe in `AnalogsView`, and frontend static `candidates.json` fallback as deferred/post-MVP items (while noting `ExplorerView` handles multi-agency raster layers).

### [Issue 6] [`egm-design` / `egm-style`] - Severity: Major
*   **Affected Scope:** [Lines 51–67](plan_maestro_terraan_loga_v2_0_hackathon_24h.md#L51-L67) (Section 03 Data Matrix)
*   **Discrepancy Description:** Section 03 presents 10 agency portals as active inputs to the scoring pipeline and uses the uncalibrated phrase "Todos los conjuntos de datos".
*   **Rationale:** Analog scoring uses 4 Planetary Computer STAC collections (`cop-dem-glo-90`, `modis-11A2-061`, `modis-10A2-061`, `esa-worldcover`), while NASA/CSA/ESA/JAXA federated search is scoped to `ExplorerView` (`backend/connectors.py`).
*   ***AI Suggestion:*** `PROPOSE FIX`
*   ***Justification:*** Distinguishing active STAC scoring collections from reference profiles and `ExplorerView` connectors makes the matrix accurate.
*   ***Proposed Edit:***
    *   Location: Lines 51–67
    *   Change: Calibrate line 53 ("Los conjuntos de datos seleccionados...") and add a clear role distinction between active STAC scoring (Planetary Computer), planetary reference profiles (`data/targets.json`), and multi-agency `ExplorerView` search.

### [Issue 7] [`egm-implementation-readiness` / `egm-codebase-details`] - Severity: Major
*   **Affected Scope:** [Lines 175–183](plan_maestro_terraan_loga_v2_0_hackathon_24h.md#L175-L183) (Section 07 Contingency Table)
*   **Discrepancy Description:** Contingency triggers reference obsolete GEE exports (`earth_features.csv`), unimplemented 3-dimension mode, and Render cold-start workarounds.
*   **Rationale:** Real v3 failure modes are Planetary Computer STAC interruptions (resolved via `cache_points.jsonl`), MongoDB unavailability (resolved via `api/main.py` `local_fallback`), and API downtime.
*   ***AI Suggestion:*** `PROPOSE FIX`
*   ***Justification:*** Replacing obsolete triggers with v3 contingencies makes Section 07 actionable.
*   ***Proposed Edit:***
    *   Location: Lines 175–183
    *   Change: Rewrite the contingency table around `cache_points.jsonl` resume, 20-curated-site baseline vs. optional +40 grid, `api/main.py` `local_fallback`, and H20 freeze/smoke checks.

### [Issue 8] [`egm-codebase-details`] - Severity: Major
*   **Affected Scope:** [Line 169](plan_maestro_terraan_loga_v2_0_hackathon_24h.md#L169) (`/candidates/near`)
*   **Discrepancy Description:** Line 169 assigns P4 to implement `/candidates/near`, while `AnalogsView.tsx` does not wire map clicks to it.
*   **Rationale:** `get_candidates_near` is already implemented in `api/main.py` (`L371–430`) with MongoDB `$near` + Haversine fallback; only the `AnalogsView.tsx` map-click UI hook is unbuilt.
*   ***AI Suggestion:*** `PROPOSE FIX`
*   ***Justification:*** Clarify in line 169 that `/candidates/near` is implemented in `api/main.py` and its `AnalogsView.tsx` map-click UI integration is optional/post-12:00.
*   ***Proposed Edit:***
    *   Location: Line 169
    *   Change: Mark `/candidates/near` as implemented in `api/main.py` and move map-click UI wiring to optional post-12:00 enhancements.

### [Issue 9] [`egm-structural` / `egm-style`] - Severity: Minor
*   **Affected Scope:** [Lines 8, 17, 21, 24–25, 31, 46, 74, 153–158](plan_maestro_terraan_loga_v2_0_hackathon_24h.md#L8-L158) (Formatting & prose precision)
*   **Discrepancy Description:** Roster punctuation mismatches (`P2 ANSORJE =`, double space in `P4`, missing space in `P5`), uncalibrated claims ("a prueba de fallos", "en milisegundos", "cartera optimizada"), and `ej.` instead of `p. ej.,`.
*   **Rationale:** Minor cleanup improves clarity and objective tone.
*   ***AI Suggestion:*** `PROPOSE FIX`
*   ***Justification:*** Worth fixing alongside the structural alignment pass.
*   ***Proposed Edit:***
    *   Location: Lines 8, 17, 21, 24–25, 31, 46, 74, 153–158
    *   Change: Standardize roster formatting (`**P# NOMBRE — Rol:**`), replace `ej.` with `p. ej.,`, and calibrate promotional phrases.
