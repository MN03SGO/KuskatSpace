# Stage 8: Intermediate Zoom Out Review — `plan_maestro_terraan_loga_v2_0_hackathon_24h.md`

* **Target Document:** `plan_maestro_terraan_loga_v2_0_hackathon_24h.md` (full file: lines 1–183)
* **Reviewer:** `egm-zoom-out` (High-Altitude Simplicity, Scope Unity & Codebase Alignment)
* **Baseline Context:** `concepts_brief.md`, `api/main.py`, `pipeline/fetch_planetary_computer.py`, `pipeline/compute_scores.py`, `data/targets.json`, `frontend/src/modules/analogs/AnalogsView.tsx`, `docker-compose.yml`

---

### 1. Scope Unity Assessment
**No — the document is not unified around the actual v3 system.** `plan_maestro_terraan_loga_v2_0_hackathon_24h.md` describes a v2.0 architecture, data pipeline, scoring model, JSON contract, and deployment stack that conflict directly with the implemented v3 codebase (`concepts_brief.md` + `api/main.py` + `pipeline/` + `frontend/` + `docker-compose.yml`).

---

### 2. Single Highest-Leverage Simplification
**Retire the v2.0 GEE / 10-dataset / Render-Vercel / 5D spec and rebase `plan_maestro` onto `concepts_brief.md` (v3)** as the single source of truth:
* Lock the pipeline to the **4 Planetary Computer STAC collections** and **20 curated sites** (optional +40 grid post-12:00).
* Lock the scoring/API/UI contract to **4 dimensions** (`relieve`, `iluminacion`, `frio`, `hielo`), **`targets.json` IDs** (`moon_south_pole`, `moon_lava_tube`, `mars`), and **client-side slider re-ranking** on `localhost` / Docker.
* Cut unimplemented v2.0 features from the critical execution plan (`polvo`, GEE, Render/Vercel, Recharts, GIBS, Z1–Z4 presets, SAR/LROC comparator).

---

### 3. Concise Numbered Findings

1. **[BLOCKER] Two-System Stack Conflict (GEE + Render/Vercel vs. Planetary Computer + Docker/Localhost)**
   * **Lines:** `33–48`, `153`, `156–157`, `165–166`, `179–180`, `182`
   * **Action:** Replace Section 02 and H1–H12 pipeline/deploy tasks with the v3 flow (`fetch_planetary_computer.py` -> `cache_points.jsonl` -> `compute_scores.py` -> `data/candidates.json` + `docker-compose.yml`).

2. **[BLOCKER] Incompatible JSON Contract & Target IDs**
   * **Lines:** `59`, `104–146`
   * **Action:** Replace lines `107–146` with the actual `CandidateResponse` schema and valid target IDs (`moon_south_pole`, `moon_lava_tube`, `mars`).

3. **[BLOCKER] Outdated Scientific Scoring Model (5D Pure Exponential vs. 4D Hybrid)**
   * **Lines:** `23`, `72–90`, `181`
   * **Action:** Rewrite Section 04 to document 90 m DEM `cos(lat)` + SVF, 4 dimensions (`0.6*SVF + 0.4*|lat|` for illumination), hybrid scoring (`relative_minmax` for polar/Mars `frio`/`hielo`, `direct` for `moon_lava_tube`), and client-side TypeScript weighting.

4. **[MAJOR] Over-Scoped 10-Dataset Agency Matrix**
   * **Lines:** `51–67`, `169`
   * **Action:** Prune Section 03 to the 4 Planetary Computer STAC collections actually queried for analog scoring plus static `targets.json` planetary profiles.

5. **[MAJOR] Speculative UI/API Features Missing from `AnalogsView.tsx`**
   * **Lines:** `45`, `47`, `92–98`, `156–157`, `166–169`
   * **Action:** Remove `Z1–Z4` presets, Recharts radar, SAR/LROC comparator, and GIBS/polar-view claims from `AnalogsView` execution scope (keeping `ExplorerView` clearly separate).

6. **[MINOR] Stale Timeline Milestones & Role Assignments**
   * **Lines:** `150–172`
   * **Action:** Align Section 06 with the 12:00 integrated demo (20 curated sites) and 20:00 code freeze milestones from `concepts_brief.md`.
