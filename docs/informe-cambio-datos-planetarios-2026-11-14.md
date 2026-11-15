# Informe de cambio — `datos-planetarios` (2026-11-14 19:37)

**Repo:** `MN03SGO/NASA_SPACE` · **Rama local:** `Frontend/WebGIS`
**Evento detectado por el vigía:** `datos-planetarios` `394b79d` → `bac02e1`
**Estado:** descargado (`git fetch`) y analizado. **NO fusionado** en tu rama.

---

## 1. Qué subieron

Commit único: `bac02e1` — *"feat(backend): agregar API FastAPI, pipelines geoespaciales, datos y Docker"*

| Archivo | Δ | Qué es |
|---|---|---|
| `data/candidates.json` | +212 | **6 análogos terrestres reales** (McMurdo, Haughton, …) |
| `data/targets.json` | +131 | 3 perfiles: `moon_south_pole`, `moon_lava_tube`, `mars` |
| `data/datasets.json` | +92 | catálogo de datasets |
| `pipeline/cargar_mongo.py` | +129 | cargador a Mongo (upsert + índice 2dsphere) |
| `pipeline/fetch_meteomatics.py` | +192 | ingesta Meteomatics |
| `pipeline/fetch_planetary_computer.py` | +186 | ingesta Planetary Computer |
| `api/main.py` | +371 | **tercera API FastAPI** |
| `Dockerfile`, `docker-compose.yml` | +67 | despliegue |
| `.env.example` | +12 | `MONGO_URI`, `METEOMATICS_USER/PASSWORD`, `PORT`, `HOST` |
| `.gitignore` | +43 | |

---

## 2. Lo bueno: ya hay datos reales

`data/candidates.json` son **6 sitios terrestres reales** con coordenadas válidas y `scores`.
Ejemplo (`site_01`): Valles Secos de McMurdo, `[162.50, -77.50]`, target `moon_south_pole`,
`scores {relieve 0.82, iluminacion 0.75, frio 0.88, hielo 0.84}`.

Coordenadas fuera de rango: **0**. Es la base que le faltaba al módulo A.

---

## 3. Lo malo: no cumple el contrato §05 al 100 %

| Campo §05 | En su JSON | Problema |
|---|---|---|
| `region_type` | ❌ | no existe (tienen `analog_type` + `is_understudied`) |
| `analog_category[]` | ❌ | no existe |
| `scores.polvo` | ❌ | **falta `polvo` en los 6 documentos** |
| `similar_properties[]` | `similar_values[]` | nombre distinto |
| `differences_and_limits[]` | `earth_limits[]` | nombre distinto |
| `exploration_use_cases[]` | `exploration_use` (string) | tipo y nombre distintos |
| `datasets_used[]` | `datasets[]` | nombre distinto |
| `subsurface_and_biology{}` | ❌ | no existe |
| `target` | `mars`, `moon_lava_tube` | el contrato pide `mars_surface`, `lava_tubes` |

Consecuencia: `candidateAdapter.ts` **descartaría los 6** (faltan `scores.polvo` y 4 campos
obligatorios). Se arregla con un mapeo/renombrado, no reescribiendo los datos.

---

## 4. ⚠️ Choque de base de datos

| | Nombre de BD |
|---|---|
| Tu backend (`backend/mongo_api.py`, de MN03SGO) | `nasa_space` |
| Su API y su loader (`api/main.py`, `pipeline/cargar_mongo.py`) | **`analogos`** |

Si corres `cargar_mongo.py`, llena `analogos` y **tu `/candidates` sigue devolviendo vacío**.
Hay que elegir una (recomendado: `nasa_space`, ya está en tu backend unificado y en el plan).

---

## 5. Qué conflictúa si lo fusionas

`merge-tree` contra `Frontend/WebGIS`:

- `.env.example` → **add/add** (tú ya creaste uno con solo `MONGO_URI`)
- `.gitignore` → auto-merge, pero revisar
- `docker-compose.yml` → **modify/modify** (él ya tenía el de PostGIS)

Sin conflictos: `data/`, `pipeline/`, `api/`, `Dockerfile`.

---

## 6. Duplicación nueva

Ya no son dos backends, ahora serían **tres**:

1. `backend/main.py` — el unificado (búsqueda + Mongo vía `mongo_api.py`) ← **tu rama**
2. `api/main.py` — el de `datos-planetarios` (371 líneas, BD `analogos`, `/health`, `/targets`, `/datasets`, `/candidates`, `/candidates/near`)
3. `api/` + `Dockerfile` + compose propio

`api/main.py` además trae algo que no tienes: **`/datasets`**, `haversine_km` y
`compute_weighted_score` (IFA en servidor).

---

## 7. Recomendación

1. **Fusionar sólo los datos**, no la tercera API: `data/*.json` + `pipeline/cargar_mongo.py`.
2. **Normalizar** con un mapeo (`analog_type→analog_category`, `similar_values→similar_properties`,
   `earth_limits→differences_and_limits`, `datasets→datasets_used`, `exploration_use→exploration_use_cases[]`,
   y añadir `polvo` + `subsurface_and_biology`).
3. **BD `nasa_space`** para todo.
4. Reusar de `api/main.py` sólo `compute_weighted_score` y `/datasets` dentro de `backend/`.
5. Regenerar `public/data/candidates.json` (Plan B) desde `/export` cuando esté cargado.

---

## 8. Añadido al contexto del agente

```markdown
### Cambio en datos-planetarios (bac02e1)
- Trae `data/candidates.json` (6 análogos reales), `targets.json` (3) y `datasets.json`.
- Su loader y su API usan la BD `analogos`; nuestro backend usa `nasa_space` → unificar en `nasa_space`.
- Campos fuera del contrato §05: falta scores.polvo, region_type, analog_category,
  subsurface_and_biology; y usan similar_values / earth_limits / datasets / exploration_use (string).
- target usa `mars` y `moon_lava_tube`; el contrato pide `mars_surface` y `lava_tubes`.
- Trae una tercera API (`api/main.py`) con `/datasets`, haversine y compute_weighted_score.
- NO fusionado todavía.
```
