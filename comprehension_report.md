# Stage 6: Comprehension Review — `plan_maestro_terraan_loga_v2_0_hackathon_24h.md`

* **Target Document:** `plan_maestro_terraan_loga_v2_0_hackathon_24h.md` (FeatureRange: lines 1–149, DetailedRange: lines 150–183)
* **Reviewer:** `egm-comprehension` (Naive Reader Audit — document read alone, without external codebase context)

---

### What this proposes
This document proposes a 24-hour hackathon execution plan to build **TerraAnáloga v2.0**, an interactive WebGIS application for the NASA Space Apps Challenge 2026 that discovers and ranks Earth analog sites for three planetary targets: the Lunar South Pole (subdivided into four functional zones Z1–Z4), Mars (subsurface ice plains and hyperarid environments), and Lunar/Martian lava tubes. Official Earth and planetary datasets (from NASA, CSA, ESA, and JAXA) are resampled offline to a homogenized ~240 m resolution, aggregated into ~5 km grid cells, scored across five dynamic physical dimensions into an Analog Fidelity Index (IFA), and stored in MongoDB Atlas (with a static JSON fallback). A FastAPI backend and React/MapLibre frontend allow users to adjust dimension weights via sliders or presets to recalculate rankings in real time, while a six-person team (P1–P6) executes the pipeline, web app, scientific validation, and pitch deliverables across hours H0–H24.

### How the existing system works, per this document
Per this document, no existing codebase, deployed infrastructure, or pre-processed dataset is described as already running; this is a greenfield 24-hour build starting from repository creation and access verification at H0. External agency portals and platforms (Google Earth Engine, NASA Earthdata/PDS/Worldview, ESA Copernicus/Open Science Catalog, JAXA G-Portal, and CSA RADARSAT) are referenced strictly as upstream data sources and tooling to be accessed and integrated during the hackathon.

---

### Findings

1. **[BLOCKER] Undefined variables, units, and target aggregation in the IFA similarity formula**
   - **Affected Scope:** Section 4.2, lines 76–81 (`s_d = exp(-|x_d - t_d| / sigma_d)`) and Section 06, line 165.
   - **Discrepancy Description & Rationale:** The formula uses $x_d$, $t_d$, and $\sigma_d$ without specifying their units, data types, or how multi-metric dimensions (e.g., *Relieve* = slope + ruggedness; *Iluminación* = shadow fraction across 4 dates; *Polvo* = AOD + storm frequency) are reduced to a single scalar $x_d$. Furthermore, line 165 states that P2 computes a statistical profile (`media, p10, p90`) for `targets.json`, leaving it ambiguous whether $t_d$ is the mean, median, or a range, and no initial values or derivation method are provided for $\sigma_d$.
   - **Clarification Fix:** Add a variable specification table in Section 4.2 defining the exact physical metric, unit, and scalar extraction rule for $x_d$, $t_d$ (e.g., `mean` vs. `[p10, p90]`), and initial $\sigma_d$ for each dimension.

2. **[BLOCKER] Missing transformation formula for "Relative / Process Comparison" (*Frío* and *Hielo*)**
   - **Affected Scope:** Section 4.2, line 84.
   - **Discrepancy Description & Rationale:** Line 84 states that because Earth never reaches the $25\text{–}40\text{ K}$ of lunar PSRs, *Frío* and *Hielo* are normalized relative to Earth's natural extreme ($\approx 175\text{ K}$) while evaluating thermal gradient and ice stability under a dry layer. No mathematical formula is given for this normalization or for combining temperature, thermal gradient, and ice stability into the $s_d$ equation on line 80.
   - **Clarification Fix:** Provide the explicit normalization equation mapping raw Earth/planetary temperatures and ice-stability metrics onto $[0, 1]$ or into compatible $(x_d, t_d)$ inputs before applying $s_d$.

3. **[BLOCKER] Unexplained pipeline link from ~5 km global grid to ~2,000 MongoDB `candidates` with rich text fields**
   - **Affected Scope:** Section 01 (line 21), Section 04 (line 73), Section 05 (lines 107–146), and Section 06 (lines 166–168).
   - **Discrepancy Description & Rationale:** A global ~5 km grid produces millions of cells, yet line 166 states P3 outputs `candidates.json (Top ~2.000 celdas)` without defining the land/water mask, `NDVI` vegetation threshold, or whether the 2,000 limit is global or per target (`moon_south_pole`, `mars_surface`, `lava_tubes`). Additionally, the MongoDB schema (lines 109–144) requires human-authored fields (`name`, `country`, `similar_properties`, `similar_processes`, `differences_and_limits`, `exploration_use_cases`, `subsurface_and_biology`), while line 168 only assigns P3 to write detailed sheets for 4 understudied discoveries—leaving the population strategy for the remaining ~1,996 records undefined.
   - **Clarification Fix:** Specify the pre-filtering thresholds (land mask, vegetation cutoff, per-target top-$N$ split) and clarify how metadata/narrative fields are populated for bulk grid cells versus curated top discoveries.

4. **[BLOCKER] Missing data sources and ranking role for the "3 structural dimensions"**
   - **Affected Scope:** Section 01 (line 23), Section 03 (lines 55–67), Section 04 (lines 76–98), and Section 05 (lines 140–143).
   - **Discrepancy Description & Rationale:** Line 23 promises 5 dynamic dimensions plus 3 structural dimensions (*Geología/Mineralogía, Subsuelo/Cuevas, Biología/Extremófilos*). While EMIT covers mineralogy (line 60), no dataset in Section 03 provides *Subsuelo/Cuevas* or *Biología/Extremófilos* data, nor does Section 04 explain whether structural dimensions affect filtering/ranking or are strictly manual annotations on curated cards.
   - **Clarification Fix:** Either add the authoritative data sources/catalogs for caves/lava tubes and extremophiles to Section 03, or explicitly state in Section 04 that the 3 structural dimensions are qualitative card-level metadata excluded from the automated IFA calculation.

5. **[MAJOR] Incomplete preset weights, missing Zone Z3 preset, and division-by-zero edge case in IFA**
   - **Affected Scope:** Section 4.2 (lines 89–90) and Section 4.3 (lines 92–98).
   - **Discrepancy Description & Rationale:**
     - If a user moves all sliders to $0$, $\sum_{d=1}^{5} w_d = 0$ causes division by zero in line 89.
     - Preset weights do not sum to $1.0$: **Luna Z1** lists $0.45 + 0.25 = 0.70$; **Luna Z2** lists $0.50 + 0.20 = 0.70$ plus a hard filter (`pendiente < 8°`) not modeled in the IFA formula; **Luna Z4** lists $0.40 + 0.30 + 0.20 = 0.90$ and uses *Sombra persistente* (inverted polarity relative to *Iluminación*).
     - **Luna Z3 (Laderas de transición)** is defined in line 16 and referenced as a UI button in line 166, but has no preset in Section 4.3.
     - **Subsuelo (Tubos de Lava)** (line 98) specifies a categorical filter instead of weights, leaving its IFA score calculation undefined.
   - **Clarification Fix:** Define all weights (summing to $1.0$) for each preset, specify how hard filters and inverted-polarity dimensions are handled, and add a $\sum w_d = 0$ guard.

6. **[MAJOR] Unclear `D / D_t` crater scaling usage and missing Mars `D_t` value**
   - **Affected Scope:** Section 4.1, line 74.
   - **Discrepancy Description & Rationale:** Line 74 defines $D$ and $D_t$ for Moon ($15\text{–}20\text{ km}$) and Earth ($2\text{–}6\text{ km}$), but omits Mars's $D_t$ value and never states where the $D / D_t$ ratio is applied.
   - **Clarification Fix:** State Mars's $D_t$ value and specify whether $D / D_t$ is used in the automated pipeline or only in scientific card interpretation.

7. **[MAJOR] Unspecified API contract, `zone` field omission, and `Heatmap PNG` integration**
   - **Affected Scope:** Section 02 (lines 37, 45–46), Section 05 (lines 107–146), and Section 06 (lines 156, 166).
   - **Discrepancy Description & Rationale:** The `candidates` schema has a single `"target": "mars_surface"` field and no `zone` field (`Z1–Z4`), yet `/candidates` and `/targets` endpoints are expected to serve zone-specific presets and recalculate IFA from user slider weights. Additionally, `Heatmap PNG` is listed as a static deliverable (lines 37, 166) with no explanation of which target/preset it depicts or how MapLibre georeferences it.
   - **Clarification Fix:** Document the request/response schemas for `/candidates`, `/candidates/near`, and `/targets`, and clarify the target/bounds/usage of `Heatmap PNG`.

8. **[MAJOR] Undefined acronyms and domain/product jargon in the Official Data Matrix and text**
   - **Affected Scope:** Section 01 (line 24) and Section 03 (lines 57–66).
   - **Discrepancy Description & Rationale:** A naive reader is given no inline expansion or documentation links for `ISRU`, `EVA`, `LRO`, `LOLA`, `LEND`, `Mini-RF`, `LROC`, `PRP`, `MODIS LST`, `MOD10A2`, `MODIS AOD`, `MERRA-2`, `EMIT`, `NDVI`, `GIBS`, `WMTS/TMS`, `DEM GLO-30`, `GCOM-C / AMSR2`, and `SAR` / `filtro speckle`.
   - **Clarification Fix:** Expand each acronym on first use (or add a compact glossary/links column in Section 03) and briefly clarify domain terms.

9. **[MAJOR] Role mismatches, missing intermediate contracts, and contradictory H12 checkpoint in DetailedRange (lines 150–183)**
   - **Affected Scope:** Section 06, lines 153–171.
   - **Discrepancy Description & Rationale:**
     - **Role mismatch:** Line 158 assigns P6 (Paola) to UI/UX, coordination, bilingual text, video, and pitch deck—not software engineering—yet line 166 assigns `P5/P6` to connect frontend sliders, zone buttons, and Recharts.
     - **Missing intermediate contracts:** Line 164 freezes the MongoDB `candidates` JSON contract, but does not freeze the `earth_features.csv` (P1 → P3) or `targets.json` (P2 → P3) schemas needed for parallel H1–H8 work.
     - **Contradictory H12 checkpoint:** Line 167 declares H12 a critical checkpoint where the app must work "100% end-to-end," yet `/candidates/near`, lava tube profiling, the side-by-side comparator, and the static fallback switch are not built until H16–H20 (line 169).
     - **Unclear rest shift & `H0–H24` reference:** Line 168 specifies two rest shifts (`mínimo 3 personas activas`) without defining who covers which shift, and `H0–H24` is never explicitly defined as elapsed hackathon hours vs. wall-clock time.
   - **Clarification Fix:** Clarify P6's role in H4–H8, define `earth_features.csv` and `targets.json` handoff contracts, scope the H12 MVP criteria, and specify the H12–H16 shift roster.

10. **[MAJOR] Ambiguous contingency triggers and broken Plan B interactions in Section 07**
    - **Affected Scope:** Section 07, lines 177–183.
    - **Discrepancy Description & Rationale:** Line 179 references `PDS QuickMap` (not introduced in Section 03) without clarifying if web previews replace actual processing; line 181 triggers $\sigma_d$ calibration or a 3-dimension fallback without stating how UI sliders behave; line 182 switches to static `candidates.json` without explaining how dynamic slider recalculation or `/candidates/near` work offline; line 183 lists "freeze repository strictly at H20" as a contingency for post-H16 bugs even though H20 freeze is already the baseline schedule.
    - **Clarification Fix:** Specify client-side behavior during static Plan B, define UI behavior for fallback modes, and replace line 183's action with a concrete mitigation.

11. **[MINOR] Minor formatting/inconsistencies in team roster**
    - **Affected Scope:** Section 06 (lines 154, 156, 157).
    - **Discrepancy Description & Rationale:** `P2 ANSORJE =` uses `=` instead of `—`, `P4 ANTHONY  —` has a double space, and `P5 AMIGUITO—` is missing a space before `—`.
    - **Clarification Fix:** Standardize formatting to `**P# NAME — Role:**`.
