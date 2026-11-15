# Informe de integración — backend `feature/database` → `Frontend/WebGIS`

**Fecha:** 2026-11-14
**Repo:** `MN03SGO/NASA_SPACE`
**Ruta local:** `C:\Users\ricar\Downloads\NASA_SPACE`
**Merge commit:** `c3e2be9` (merge --no-ff)
**Backup previo:** rama `backup/pre-merge-20261114-1908` (apunta a `093a1a8`)

---

## 1. Qué se integró

| Commit | Autor | Mensaje |
|---|---|---|
| `8b18173` | MN03SGO | chore: agregue requirements.txt para el seed |
| `c8e5dbc` | MN03SGO | Termine la api para consumir y la bd conexion en bd mongo atlas |

### Archivos que entraron

| Archivo | Δ | Estado |
|---|---|---|
| `main.py` | +177 | **nuevo** — API FastAPI sobre MongoDB Atlas |
| `requirements.txt` | +4 | **nuevo** — fastapi, uvicorn, pymongo, python-dotenv |
| `seed_mongo.py` | +43 | **nuevo** — carga inicial de datos |
| `test_db.py` | +21 | **nuevo** — smoke test de conexión |
| `docker-compose.yml` | +56 | **nuevo** — PostGIS + MinIO + Adminer |
| `db/init.sql` | +26 | **nuevo** — esquema PostGIS |
| `README.md` | +18 | actualizado |
| `index.html` (raíz) | −2 | **eliminado** (el entry real es `frontend/index.html`) |
| `.gitignore` | +43 | **conflicto resuelto por unión** |

---

## 2. Contrato de API (lo que el frontend debe consumir)

**Base:** `VITE_API_BASE` → por defecto `http://localhost:8000`
**CORS:** habilitado (`CORSMiddleware`)
**DB:** MongoDB Atlas, base `nasa_space`, índice `2dsphere` sobre la ubicación de candidatos

| Método | Ruta | Parámetros | Devuelve |
|---|---|---|---|
| GET | `/` | — | health / info |
| GET | `/candidates` | — | lista de candidatos espaciales |
| GET | `/candidates/near` | `lat` (−90..90, req), `lon` (−180..180, req), `radius_km` (default 100, >0) | candidatos dentro del radio |
| GET | `/targets` | — | targets planetarios |
| GET | `/export` | — | JSON completo con metadatos de la base |

**Variable de entorno obligatoria:** `MONGO_URI` (en `.env`). Si falta, `main.py` aborta con `RuntimeError`.
**Arranque:** `uvicorn main:app --reload` (desde la raíz del repo).

---

## 3. Conflictos y resolución

- **`.gitignore`** — add/add. Resuelto por **unión**: se mantuvo tu versión (Python + Node/Vite/TS + IDEs + `.env`) y se añadió al final un bloque *"Backend (FastAPI / Mongo / Docker)"* con 43 reglas del backend (`pgdata/`, `miniodata/`, `*.sql.gz`, `.coverage`, `.tox/`, `docker-compose.override.yml`, etc.). Total: 133 líneas.
- Resto de archivos: **sin conflicto**.

---

## 4. Verificación

- `tsc --noEmit` en `frontend/` → **exit 0** (compila con tus cambios en curso incluidos).
- Tu trabajo sin commitear **no se tocó**:
  - `frontend/src/i18n/en.json`, `es.json`
  - `frontend/src/index.css`
  - `frontend/src/modules/analogs/AnalogsView.tsx`
  - `plan_P5_frontend_webgis.md`
  - `docs/` y `plan_P6_ux_pitch.md` (sin trackear)

---

## 5. Deuda técnica / riesgos detectados

1. **Estructura duplicada del backend.** Tu rama tiene `backend/main.py` y `backend/requirements.txt`; el backend subió `main.py` y `requirements.txt` **en la raíz**. Ahora conviven dos versiones. Hay que decidir cuál es la canónica y reubicar.
2. **`docker-compose.yml` no coincide con el código.** Levanta PostGIS/Postgres + MinIO + Adminer, pero `main.py` usa **MongoDB Atlas**. O sobra el compose o falta el servicio de Mongo.
3. **No hay `.env.example`** para `MONGO_URI` en la raíz ni en `backend/`. El `frontend/.env.example` sí existe con `VITE_API_BASE`.
4. **`frontend/src/App.jsx`** aparece en el diff del backend (vacío) — ruido: el frontend ya migró a TypeScript (`.tsx`).
5. **`seed_mongo.py` y `test_db.py` en la raíz**, no en `backend/`.

---

## 6. Bloque de contexto para el agente

> Pega esto en el contexto / `CLAUDE.md` / instrucciones del agente.

```markdown
## Proyecto NASA_SPACE (MN03SGO/NASA_SPACE)

Monorepo: `frontend/` (React + TypeScript + Vite + pnpm) y `backend/` (FastAPI, Python).
Rama de trabajo del frontend: `Frontend/WebGIS`.

### Stack
- Frontend: React, TypeScript, Vite, i18n (`src/i18n/{es,en}.json`), módulos en `src/modules/` (p. ej. `analogs/AnalogsView.tsx`), globos 3D.
- Backend: FastAPI + PyMongo + python-dotenv. DB: **MongoDB Atlas**, base `nasa_space`, índice `2dsphere`.
- Scripts frontend: `dev`, `build` (tsc && vite build), `typecheck` (tsc), `lint` (eslint), `test` (vitest), `e2e` (playwright).

### API (contrato vigente)
- Base: `VITE_API_BASE` (default `http://localhost:8000`). CORS abierto.
- `GET /` health · `GET /candidates` · `GET /candidates/near?lat&lon&radius_km` · `GET /targets` · `GET /export`
- `MONGO_URI` es obligatoria (.env); sin ella el backend no arranca.

### Estado de integración (2026-11-14)
- Merge `c3e2be9` integró `feature/database` en `Frontend/WebGIS`.
- Pendiente: unificar `main.py`/`requirements.txt` duplicados (raíz vs `backend/`).
- Pendiente: decidir si se usa Mongo Atlas o el Postgres/PostGIS de `docker-compose.yml`.
- Pendiente: añadir `.env.example` con `MONGO_URI`.
- `.gitignore` ya es la unión de frontend + backend.

### Convenciones
- No commitear `.env`; usar `.env.local` en frontend.
- El frontend es TypeScript: no añadir `.jsx` nuevos.
```

---

## 7. Cómo revertir

```powershell
git reset --hard backup/pre-merge-20261114-1908   # vuelve a 093a1a8
```
