# T1 · Wireframes de los módulos A y B — TerraAnáloga

> **Nota:** los textos de interfaz vigentes están en `frontend/src/i18n/es.json` y `en.json`; los rótulos de este documento son orientativos.

**Tarea:** T1 de [plan_P6_ux_pitch.md](../../plan_P6_ux_pitch.md) · **Estado:** propuesta para revisión del PM · **Fecha:** 2026-11-14

> **Cómo leer este documento**
> - **Módulo B** = lo que **ya existe** en `frontend/src/modules/explorer/` (se documenta tal cual; cada zona cita el archivo).
> - **Módulo A** = **diseño propuesto, todavía no implementado** (`AnalogsView.tsx` es hoy un marcador de posición "en construcción"). Los datos salen del contrato JSON del plan maestro (sección 05) y de `plan_P5_frontend_webgis.md` (secciones 4.3 y 5.1).
> - Marcadores `[n]` = zonas anotadas. `PENDIENTE: <qué y quién>` = dato que no existe en el repo y no se inventa.
> - Puntos de corte: **375 px** (móvil) y **1280 px** (escritorio). En código, el cambio de disposición ocurre en `md` = **768 px** (`ExplorerView.tsx`, clases `md:`).

---

## 0. Estructura común (App.tsx)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ [1] TerraAnáloga                  [2] Buscador de análogos │ Explorador   [3] ES│EN │
│     Análogos terrestres de la Luna y Marte                                    │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│                    [4] Contenido del módulo activo (A o B)                    │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

| # | Zona | Qué hace | Dato / fuente |
| :-- | :--- | :--- | :--- |
| 1 | Título y lema | Identifica el producto | `app.title`, `app.tagline` (`App.tsx`) |
| 2 | Pestañas de módulo | Cambian entre A y B; la activa lleva `aria-current="page"` | `app.tabs.analogs`, `app.tabs.explorer`. Hoy se abre **B** por defecto porque A está en construcción |
| 3 | Selector de idioma | Alterna ES/EN y actualiza `<html lang>` | `LangToggle.tsx`, `useT.ts` |
| 4 | Contenido | Ocupa el alto restante (`h-dvh`) | — |

**375 px:** la cabecera se parte en dos filas (título arriba; pestañas e idioma debajo) gracias a `flex-wrap`. **1280 px:** una sola fila.

---

## 1. Módulo B · Explorador de datos (YA IMPLEMENTADO)

Fuente: `ExplorerView.tsx`, `BodySelector.tsx`, `SearchPanel.tsx`, `ResultsList.tsx`, `ProcessingPanel.tsx`, `GlobeView.tsx`, `PlanetMap.tsx`.

### 1.1 Escritorio (≥ 768 px; ejemplo a 1280 px)

```
┌──────────────────────────────┬────────────────────────────────────────────────┐
│ PANEL LATERAL (400 px fijo)  │ [11] MAPA / GLOBO (resto del ancho)            │
│ con scroll vertical          │                         ┌─[12]─────────────┐   │
│                              │                         │ Globo 3D │Mapa 2D│   │
│ [5] ┌──────┬──────┬──────┐   │ [13] Arrastra para girar · rueda para acercar  │
│     │Tierra│ Luna │Marte │   │      · clic para mover el BBox                 │
│     └──────┴──────┴──────┘   │                                                │
│ [6] ┌─ Búsqueda ─────────┐   │              ,-'''''-.                         │
│     │ Clic en el mapa... │   │            ,'    ┌──┐ `.   ← [14] BBox actual  │
│     │ Fecha GIBS (Tierra)│   │           /      └──┘    \                      │
│     │ BBox [____________]│   │          |   (esfera)     |                     │
│     │ Desde [__] Hasta[_]│   │           \              /                      │
│     │ Filtro [▼        ]│   │            `.          ,'                       │
│     │ [Buscar escenas…]  │   │              `-.....-'                         │
│     │ (banner de error)  │   │                                                │
│     └────────────────────┘   │ [15] Cargando mosaico 12/51      NASA GIBS ©   │
│ [7] ┌─ Procesamiento ────┐   │      (estado)                    (atribución)  │
│     │ [SAR][NDVI][NDWI]  │   │                                                │
│     │ [Precip][Diviner]  │   │                                                │
│     │ (banner de error)  │   │                                                │
│ [8] │ Resultado:         │   │                                                │
│     │  etiqueta · unidad │   │                                                │
│     │  ▓▓▓▓▓▓▓ leyenda   │   │                                                │
│     │  mín │ media │ máx │   │                                                │
│     │  ⚠ Muestra demo    │   │                                                │
│     │  Opacidad ───●──   │   │                                                │
│     │  [Descargar .tif]  │   │                                                │
│ [9] │  Polo lunar vs.    │   │                                                │
│     │  Tierra (Diviner)  │   │                                                │
│     └────────────────────┘   │                                                │
│ [10]┌─ Resultados ───────┐   │                                                │
│     │ ESA Copernicus (n) │   │                                                │
│     │ NASA CMR (n)       │   │                                                │
│     │ Agencias asoc. (n) │   │                                                │
│     └────────────────────┘   │                                                │
└──────────────────────────────┴────────────────────────────────────────────────┘
```

| # | Zona | Qué hace | Dato que muestra / de dónde sale |
| :-- | :--- | :--- | :--- |
| 5 | Selector de cuerpo | Tierra · Luna · Marte (`aria-pressed`). Al cambiar, el bbox salta al valor por defecto del cuerpo | `BODY_ORDER`, `BODIES[...].defaultBBox` (`config/bodies.ts`). Textos: `bodies.*.label` |
| 6 | Panel de búsqueda | Pista de clic; fecha GIBS (**solo Tierra**); BBox editable con validación (`format`/`range`/`order`); fechas desde/hasta; filtro de agencia (opciones según cuerpo); botón de búsqueda | Estado en `useExplorerStore`. Validación en `lib/bbox.ts`. Parámetros de `GET /api/search`: `bbox`, `start_date`, `end_date`, `body`, `variable` |
| 7 | Modos de procesamiento | 5 botones: `sar_db`, `ndvi`, `ndwi`, `jaxa_precip`, `diviner_thermal`. Se deshabilitan si hay bbox inválido o mientras procesa | `config/processModes.ts`; `POST /api/process` |
| 8 | Resultado | Etiqueta de la escena; **unidad**; leyenda de color (bajo → alto); estadísticas mín/media/máx; **aviso de muestra de demostración** (siempre visible, B12); opacidad 20–100 %; descarga GeoTIFF con el bbox **procesado** (B3) | `response.unit`, `response.stats{min,mean,max}`, `response.source_file`, `response.overlay_png_base64`, `response.bounds`; `GET /api/export/geotiff` |
| 9 | Comparativa polo lunar vs. Tierra | Solo en modo Diviner: mínimo lunar, media antártica y una frase calculada con el delta (más fría / más cálida) | `response.cryosphere_comparison.{lunar_psr_min_k, earth_antarctica_avg_k, delta_vs_earth_ice_k}` (B16) |
| 10 | Lista de resultados | Tras buscar: grupos por fuente. Tierra → Copernicus y CMR; Luna/Marte → PDS; siempre → agencias asociadas. Clic en un ítem = coloca el bbox y procesa con su `recommended_mode`. Lista vacía → "Sin resultados o fuente no disponible" | `live_copernicus[]`, `live_earthdata[]`, `live_pds_planetary[]`, `partner_resources[]`. PDS muestra "Ubicación aproximada" (B19) |
| 11 | Visor | Globo 3D (por defecto) o mapa 2D (Leaflet) | `GlobeView.tsx` / `PlanetMap.tsx`, cargados con `lazy` |
| 12 | Conmutador de vista | Globo 3D ↔ Mapa 2D (`aria-pressed`), arriba a la derecha del visor | `explorer.view.*` |
| 13 | Pista del globo | Instrucciones de gestos; **oculta bajo 640 px** (`hidden sm:block`) | `explorer.globe.hint` |
| 14 | BBox | Caja sobre el globo; un clic la mueve | `bboxAroundPoint` (±1,5° lon × ±1° lat) |
| 15 | Estado y atribución | "Cargando mosaico n/total" mientras llegan las teselas en vivo (total = 1 textura local + teselas: Tierra 51, Luna y Marte 129); atribución del cuerpo abajo a la derecha | `GLOBE_TEXTURES[body].attribution` |

**Sin WebGL:** el globo se sustituye por un mensaje (`explorer.globe.noWebgl`) y un botón "Mapa 2D" (ver estados, sección 4).

### 1.2 Móvil (375 px)

El visor sube y el panel baja (`order-1` / `order-2`): el mapa ocupa **45 % del alto** (`h-[45dvh]`) y el panel el resto, con scroll propio. Sin borde lateral.

```
┌─────────────────────────┐ 375 px
│ TerraAnáloga       ES│EN │  ← cabecera en 2 filas
│ Buscador │ Explorador    │
├─────────────────────────┤
│  ┌───────────┐          │
│  │Globo│Mapa │ ← [12]   │  45 % del alto
│        ,-'''-.          │
│       (  [▭]  )  ← [14] │  [13] oculta
│        `-...-'          │
│ Cargando 3/6   NASA ©   │
├─────────────────────────┤
│ [Tierra][ Luna ][Marte] │  ← [5]  a ancho completo
│ ┌─ Búsqueda ─────────┐  │
│ │ BBox [___________] │  │  ← [6]  una columna;
│ │ Desde [_] Hasta [_]│  │         fechas en 2 columnas
│ │ [Buscar escenas]   │  │
│ └────────────────────┘  │
│ ┌─ Procesamiento ────┐  │  ← [7] botones en 2 columnas
│ │ [SAR dB ][ NDVI   ]│  │
│ │ ...                │  │  ↕ scroll del panel
│ └────────────────────┘  │
└─────────────────────────┘
```

**Reglas 375 px:** sin desplazamiento horizontal; objetivos táctiles ≥ 40 px de alto (los botones actuales miden ≈ 32–36 px: ver observaciones U1 en la sección 6); el bbox largo usa `font-mono` y debe poder desplazarse dentro de su campo sin ensanchar la página.

---

## 2. Módulo A · Buscador de análogos (DISEÑO PROPUESTO — no implementado)

Basado en: plan maestro §4.3 (presets) y §5 (contrato); P5 §5.1 y §9.3 (guion de demo). **El cálculo del IFA ocurre en el navegador** (decisión D3, recomendada y todavía sin cerrar por el equipo).

### 2.1 Pantalla de inicio — escritorio (1280 px)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ TerraAnáloga       [Buscador de análogos]│Explorador de datos          ES│EN   (cab.) │
├───────────────────────┬─────────────────────────────────────────┬───────────────────┤
│ COLUMNA 1 · 340 px    │ COLUMNA 2 · flexible                    │ COLUMNA 3 · 380 px│
│ "Define tu escenario" │                                         │ (solo con ficha)  │
│                       │ [A5] Mapa / globo con candidatos        │                   │
│ [A1] Objetivo         │      (puntos coloreados por IFA)        │ [A9] FICHA        │
│  ◉ Luna  ○ Marte      │            ·  ·                         │  (ver §2.3)       │
│  ○ Subsuelo           │        ·  ●(sel.)  ·                    │                   │
│                       │     ·        ·                          │                   │
│ [A2] Presets          │                                         │                   │
│  [Z1 Crestas]         │ [A6] Conmutador:  Todos │ Solo desc.    │                   │
│  [Z2 Mesetas]         │      (filtro "descubrimientos")         │                   │
│  [Z4 PSR/Frío]        │                                         │                   │
│  [Marte]  [Subsuelo]  │ ─────────────────────────────────────── │                   │
│                       │ [A7] TOP N  (N=10)                      │                   │
│ [A3] Pesos (sliders)  │ ┌────┬──────────────────────┬─────┬────┐ │                   │
│  Relieve      ──●──   │ │ #  │ Nombre / país        │ IFA │ ⚑  │ │                   │
│  Iluminación  ─●───   │ │ 1  │ Depresión E. Qaidam  │ 0.xx│desc│ │                   │
│  Frío         ───●─   │ │ 2  │ ...                  │ 0.xx│cal.│ │                   │
│  Hielo        ──●──   │ │ …  │ ...                  │     │    │ │                   │
│  Polvo        ●────   │ └────┴──────────────────────┴─────┴────┘ │                   │
│  (peso relativo en %) │ [A8] Clic en una fila = abre la ficha   │                   │
│  [Restablecer pesos]  │                                         │                   │
│                       │                                         │                   │
│ [A4] Origen de datos  │                                         │                   │
│  ● API  ○ Respaldo    │                                         │                   │
└───────────────────────┴─────────────────────────────────────────┴───────────────────┘
```

> Los números de ejemplo (`0.xx`, nombres) son **marcadores**, no datos. `PENDIENTE: candidates.json real cargado en Mongo con el contrato §05 — P3/P4` (B34); `candidates.mock.json` queda **solo para desarrollo y pruebas, nunca en la demo** (P5 D8).

| # | Zona | Qué hace | Campo del contrato / fuente |
| :-- | :--- | :--- | :--- |
| A1 | Selector de objetivo | Elige `moon_south_pole`, `mars_surface` o `lava_tubes` | `candidate.target` (valores citados en el plan maestro §3 y §5). Etiquetas de interfaz: Luna / Marte / Subsuelo |
| A2 | Presets por zona | **Solo se muestran los presets del objetivo elegido en A1** (Luna → Z1, Z2, Z4; Marte → Marte; Subsuelo → Subsuelo), para no mezclar escenarios incompatibles. Cargan pesos prefijados. **Luna Z1**: Iluminación 0,45 y Relieve 0,25. **Luna Z2**: Relieve 0,50 y Polvo 0,20. **Luna Z4**: Hielo 0,40, Frío 0,30 y "sombra persistente" 0,20. **Marte**: Polvo 0,30, Hielo 0,30, Frío 0,20, Relieve 0,20. **Subsuelo**: filtra por terrenos volcánicos/cársticos | Plan maestro §4.3. `PENDIENTE: pesos restantes de cada preset, preset "Subsuelo" y si "sombra persistente" es dimensión propia o sale de iluminación — P3` (P5 §11, pregunta 4) |
| A3 | Sliders de pesos | Cinco sliders (uno por dimensión). Al moverlos se recalcula el IFA y se reordena el Top N **sin llamar a la API**. Junto a cada slider se muestra su **peso relativo en %** (wᵈ / Σw). No se muestra "suma = 1", porque el IFA ya normaliza por Σw y esa cifra confundiría. Los números se formatean según el idioma (0,45 en ES y 0.45 en EN) | `scores.{relieve, iluminacion, frio, hielo, polvo}`; IFA = Σ(wᵈ·sᵈ)/Σ wᵈ (plan maestro §4.2) |
| A4 | Origen de datos | Conmutador API ↔ respaldo estático. **La API es la app única del backend** (una sola URL, `VITE_API_BASE`, `GET /candidates`; ya no hay `VITE_DATA_API_BASE`, `7f0968a`) y **el respaldo es `/data/candidates.json`, generado con `GET /export`**. Aviso "Modo respaldo" cuando falla la API. Cuando exista el adaptador (B37, **todavía no existe**) y descarte documentos, aparece debajo el aviso informativo "N candidatos descartados por no cumplir el contrato" (no es un error) | P5 §5.3, §9.1 (resiliencia A), D8, B37 y B38 |
| A5 | Visor con candidatos | Puntos en el globo/mapa coloreados por IFA; el seleccionado se resalta. Cámaras rápidas: Polo Sur, Polo Norte, Centroamérica | `candidate.location.coordinates` `[lon, lat]`; cámaras: P5 §7, fase 3 |
| A6 | Filtro de descubrimientos | "Todos" / "Solo descubrimientos". Los sitios clásicos se marcan como **calibración** | `candidate.region_type` (p. ej. `understudied_discovery`). `PENDIENTE: valor exacto de region_type para sitios de calibración — P3` |
| A7 | Lista Top N | Tabla con posición, nombre, país, IFA y etiqueta (descubrimiento / calibración). N = 10 por defecto | `name`, `country`, IFA calculado, `region_type` |
| A8 | Selección | Clic o Enter en una fila abre la ficha (A9) y resalta el punto en A5 | — |
| A9 | Ficha | Ver §2.3 | Ver §2.3 |

### 2.2 Pantalla de inicio — móvil (375 px)

Una columna. El visor arriba (45 % del alto, igual que el módulo B); debajo, **pestañas internas** en lugar de tres columnas: `Escenario` · `Top N` · `Ficha`. La ficha se abre como **hoja a pantalla completa** con botón "Volver al listado".

```
┌─────────────────────────┐ 375 px
│ TerraAnáloga       ES│EN │
│ [Buscador]│Explorador    │
├─────────────────────────┤
│   mapa con candidatos    │  45 % del alto
│      ·  ●  ·  [A6]      │
├─────────────────────────┤
│ Escenario │ Top N │ Ficha│  ← pestañas internas (role="tablist")
├─────────────────────────┤
│ [A1] ◉ Luna ○ Marte ○ Sub│
│ [A2] presets: carrusel   │  ← desplazable en horizontal DENTRO
│      [Z1][Z2][Z4][Marte] │     del contenedor (no de la página)
│ [A3] Relieve  ────●──    │
│      Iluminación ─●────  │  sliders a ancho completo,
│      ...                 │  zona táctil ≥ 40 px
│ [Restablecer pesos]      │
└─────────────────────────┘
```

Pestaña `Top N`: lista de tarjetas apiladas (nombre, país, IFA, etiqueta); sin tabla. Pestaña `Ficha`: vacía hasta elegir un candidato (estado vacío, §4).

### 2.3 Ficha de candidato (A9)

Orden de lectura obligatorio, de arriba abajo: **propiedad → proceso → límites → usos** (P5 §7, fase 2). Primero qué se parece, después por qué, después **en qué falla**, y al final **qué probar**.

```
┌───────────────────────────────────────────────┐
│ [F1] ← Volver                      ✕ Cerrar   │
│ Nombre del candidato                           │
│ País · [descubrimiento | calibración]  IFA 0.xx│
├───────────────────────────────────────────────┤
│ [F2] RADAR de 5 dimensiones                    │
│        Relieve                                 │
│    Polvo   ╱╲   Iluminación     ── candidato   │
│        ╲  ╱  ╲ ╱                -- objetivo    │
│     Hielo ──── Frío                            │
├───────────────────────────────────────────────┤
│ [F3] 1 · Propiedades similares                 │
│      • …  (lista)                              │
│ [F4] 2 · Procesos similares                    │
│      • …                                       │
│ [F5] 3 · Diferencias y límites   ← SIEMPRE     │
│      • …                           visible,    │
│                                    nunca       │
│                                    plegado     │
│ [F6] 4 · Usos en exploración                   │
│      • …                                       │
├───────────────────────────────────────────────┤
│ [F7] Subsuelo y biología                       │
│      Potencial de subsuelo: …                  │
│      Extremófilos: …                           │
├───────────────────────────────────────────────┤
│ [F8] Datasets usados                           │
│      [copernicus_dem][modis_lst][emit]…        │
├───────────────────────────────────────────────┤
│ [F9] Comparador Tierra vs. Luna/Marte          │
│      ┌──────────┬──────────┐                   │
│      │  Tierra  ┇  Luna    │  ← slider         │
│      └──────────┴──────────┘     (se oculta si │
│                                   falta el par)│
├───────────────────────────────────────────────┤
│ [F10] [Explorar datos de este sitio]  → módulo B│
└───────────────────────────────────────────────┘
```

| # | Zona | Qué muestra | Campo del contrato JSON |
| :-- | :--- | :--- | :--- |
| F1 | Cabecera | Nombre, país, categoría, IFA | `name`, `country`, `region_type`; IFA calculado en el navegador |
| F2 | Radar | Candidato frente al perfil del objetivo en 5 ejes | `scores.relieve`, `.iluminacion`, `.frio`, `.hielo`, `.polvo`; perfil del objetivo: `PENDIENTE: forma de targets.json y valores del perfil — P2` |
| F3 | Propiedades similares | Lista de viñetas | **`similar_properties`** |
| F4 | Procesos similares | Lista de viñetas. Etiqueta junto a F3/F4 que indica si la analogía es de propiedad o de proceso | **`similar_processes`**, `analog_category` |
| F5 | Diferencias y límites | Lista de viñetas, **siempre visible**; si falta, muestra "Pendiente" (P5 §8) | **`differences_and_limits`** |
| F6 | Usos en exploración | Qué tecnología/protocolo se puede ensayar | **`exploration_use_cases`** |
| F7 | Subsuelo y biología | Dos textos cortos | **`subsurface_and_biology.subsurface_potential`**, **`subsurface_and_biology.extremophiles_note`** |
| F8 | Datasets usados | Chips con el identificador de cada dataset; opcional: enlace al glosario de fuentes | **`datasets_used`** (p. ej. `copernicus_dem`, `modis_lst`, `modis_aod`, `emit`, `jaxa_gportal`) |
| F9 | Comparador | Imagen de la Tierra vs. imagen planetaria, con deslizador | Archivos `public/data/compare/<candidate_id>/{earth.jpg, planet.jpg}` (P5 §5.2). `PENDIENTE: pares de imágenes del Top 5 — P1/P2` |
| F10 | Puente A → B | Abre el módulo B con el bbox del candidato ya cargado | `location.coordinates` → `bboxAroundPoint(lon, lat)` (±1,5° × ±1°) |

**Cobertura del contrato exigida por T1:** `similar_properties` (F3) · `similar_processes` (F4) · `differences_and_limits` (F5) · `exploration_use_cases` (F6) · `subsurface_and_biology` (F7) · `datasets_used` (F8). ✔

**Ficha en 375 px:** hoja a pantalla completa con una sola columna; el radar ocupa el ancho completo (alto ≈ 260 px); F3–F6 como secciones apiladas con encabezado visible (no acordeones, para no ocultar F5); el botón F10 queda fijo abajo (`sticky`). **Ficha en 1280 px:** columna 3 (380 px) junto al visor; scroll interno.

**Texto largo:** los bullets del contrato pueden ser largos (p. ej. "Presión atmosférica ~600 hPa (vs ~6 hPa en Marte y vacío en Luna)"): se permite salto de línea, sin truncar.

---

## 3. Puente A → B

```
 MÓDULO A · Ficha (F10)                         MÓDULO B · Explorador
┌────────────────────────┐   clic en            ┌────────────────────────────┐
│ …                      │  [Explorar datos     │ Cuerpo: Tierra (ya elegido)│
│ [Explorar datos de este│   de este sitio]     │ BBox: lon±1,5 / lat±1      │
│  sitio]                │ ───────────────────▶ │       alrededor del punto  │
└────────────────────────┘                      │ Globo centrado en el bbox  │
                                                │ Aviso: "Mostrando datos de │
                                                │ <nombre del candidato>"    │
                                                └────────────────────────────┘
```

Reglas del puente:
1. Cambia la pestaña a **Explorador de datos**, cuerpo = **Tierra** (el candidato es un sitio terrestre) y bbox = caja alrededor de `location.coordinates` (misma función que usa el clic del mapa: `bboxAroundPoint`).
2. **No lanza la búsqueda sola:** el usuario pulsa "Buscar escenas en vivo". Así se evita una consulta inesperada.
3. En B aparece un **aviso informativo** con el nombre del candidato de origen y un enlace "Volver a la ficha" (conserva el candidato seleccionado en A).
4. El aviso de **muestra de demostración** (B12) sigue visible al procesar: el puente **no** hace que el procesamiento use datos reales del bbox.

> **Nota de implementación para P5 (no es un cambio mío):** hoy `AnalogsView` recibe solo `onOpenExplorer: () => void`. El puente necesitará pasar el bbox y el nombre; `useExplorerStore` ya expone `setBbox`. `PENDIENTE: decisión de P5 sobre cómo se pasa el candidato (store o parámetro)`.

---

## 4. Estados vacío, de carga y de error

Cada estado indica **qué ve la persona, qué puede hacer y dónde vive el texto** (las claves nuevas se proponen en `textos-modulo-a.md`, tarea T3; las que ya existen se citan).

### 4.1 Módulo B (existentes)

| Situación | Qué se ve | Salida para la persona | Fuente |
| :--- | :--- | :--- | :--- |
| Antes de buscar | Solo el panel de búsqueda y el visor; `ResultsList` no se pinta (`search.state !== 'success'`) | Pulsar "Buscar escenas en vivo" | `ResultsList.tsx` |
| Buscando | Botón deshabilitado con "Consultando catálogos..." | Esperar | `explorer.searching` |
| Procesando | Botón del modo con "Procesando..."; el resto, deshabilitado; los resultados de la lista se deshabilitan | Esperar | `explorer.processing.running` |
| Búsqueda sin resultados / fuente caída | Texto gris por grupo: "Sin resultados o fuente no disponible." | Cambiar fechas, bbox o filtro | `explorer.results.empty`. El backend aún no distingue "vacío" de "caída" (B10; `PENDIENTE: campo errors por fuente — P4`) |
| Error de red / timeout / HTTP / lectura | Banner rojo (`role="alert"`) dentro del panel; la UI no se rompe | Reintentar; comprobar backend | `errors.network`, `errors.timeout`, `errors.http`, `errors.parse` |
| BBox inválido | Mensaje rojo bajo el campo; búsqueda y procesamiento deshabilitados | Corregir el campo | `explorer.bboxErrors.*` |
| Fechas en orden incorrecto | Mensaje rojo bajo las fechas; búsqueda deshabilitada | Corregir fechas | `explorer.dateOrder` |
| Globo cargando teselas | "Cargando mosaico n/total" abajo a la izquierda (`role="status"`) | Seguir usando el globo (hay textura 2K local) | `explorer.globe.loading` |
| Sin WebGL | Mensaje + botón "Mapa 2D" | Pasar al mapa 2D | `explorer.globe.noWebgl` |
| Resultado de demostración | Banner **ámbar** permanente con el archivo de origen | Informativo | `explorer.result.demoSample` |

### 4.2 Módulo A (propuestos)

| Situación | Qué se ve | Salida para la persona |
| :--- | :--- | :--- |
| Sin escenario elegido (primera visita) | Visor con todos los candidatos en un solo color; Top N muestra "Elige un preset para ver los mejores análogos" | Pulsar un preset |
| Cargando candidatos | Esqueletos (placeholders) en lista y ficha; el visor sigue interactivo | Esperar (límite sugerido 6 s, P5 §9.1) |
| API caída → respaldo estático | Banner informativo "Modo respaldo: datos guardados en la aplicación" y conmutador A4 en "Respaldo" | Seguir usando la app; reintentar la API |
| Candidatos descartados por no cumplir el contrato §05 | Aviso **informativo** (no error), junto a A4: "N de M sitios no tienen datos completos y no se muestran". Los sitios válidos siguen visibles; los inválidos **no se inventan ni se rellenan** (D8) | Seguir usando la app. Mientras los datos reales no estén en Mongo (B34), puede que **todos** se descarten: entonces la lista muestra el estado vacío y el aviso, sin pintar nada en el globo. **Decidido (PM): la interfaz muestra solo el conteo; el detalle (`_id` y motivo) va a `console.warn` solo en desarrollo (B37).** |
| Sin candidatos para el filtro | Lista vacía con texto "Ningún candidato cumple este filtro" y botón "Mostrar todos" | Quitar el filtro |
| Pesos que suman 0 | Mensaje bajo los sliders; IFA no se calcula | Subir un peso o "Restablecer pesos" |
| Ficha sin ficha completa (campo ausente) | La sección muestra **"Pendiente"** (no se oculta) | — (honestidad científica, P5 §8) |
| Falta el par de imágenes del comparador | El comparador F9 **no se pinta** (sin hueco vacío) | — |
| Marcadores de candidato | Los datos son del mock (solo en desarrollo; D8) | Etiqueta visible "Datos de ejemplo" mientras `candidates.mock.json` esté en uso. `PENDIENTE: confirmar con P5/P4 cuándo se pasa a candidates.json real` |
| Módulo en construcción (hoy) | Título + texto + botón al Explorador | Ir al Explorador (`analogs.placeholderTitle/Body`) |

---

## 5. Comportamiento responsivo — resumen

| Aspecto | 375 px (móvil) | 1280 px (escritorio) |
| :--- | :--- | :--- |
| Cabecera | 2 filas | 1 fila |
| Módulo B | Visor arriba (45 % alto) + panel debajo con scroll | Panel 400 px a la izquierda + visor a la derecha |
| Módulo A | Visor 45 % + pestañas internas (Escenario / Top N / Ficha) | 3 columnas: controles 340 · visor+Top N · ficha 380 |
| Ficha | Hoja a pantalla completa, 1 columna, botón F10 fijo | Columna lateral con scroll |
| Presets | Carrusel horizontal dentro de su contenedor | Rejilla de botones |
| Lista Top N | Tarjetas apiladas | Tabla |
| Pista del globo | Oculta | Visible |
| Desplazamiento horizontal de la página | **Ninguno** | **Ninguno** |
| Objetivos táctiles | ≥ 40 px | ≥ 32 px |
| Teclado | — | Tab y flechas; foco visible en todos los controles |

Punto de corte técnico: `md` = 768 px. Entre 640 y 767 px aplican las reglas de móvil, salvo la pista del globo (`sm` = 640 px).

---

## 6. Observaciones sobre lo implementado (para P5; no se modificó código)

| # | Observación | Dónde | Sugerencia |
| :-- | :--- | :--- | :--- |
| U1 | Varios botones miden < 40 px de alto (`py-1.5`/`py-2` con `text-xs`) → difíciles de tocar en 375 px | `SearchPanel`, `ProcessingPanel`, `BodySelector`, `ViewToggle` | Subir a `min-h-10` en móvil |
| U2 | La pista del globo (`explorer.globe.hint`) se oculta en móvil, así que no hay instrucción de gestos | `GlobeView.tsx` | Mostrar una versión corta o un botón de ayuda (el texto lo propone T3) |
| U3 | El hint "Haz clic en cualquier punto del mapa…" dice "clic" también en móvil | `explorer.mapHint` | Texto neutro: "Toca o haz clic…" |
| U4 | El aviso de muestra de demostración está dentro de `SceneResult`; la etiqueta de la región aparece como título pero la leyenda de color no lleva texto accesible (`aria-hidden`) | `ProcessingPanel.tsx` | Añadir `aria-label` a la leyenda o repetir bajo/alto con valores |
| U5 | Las pestañas muestran **A primero**, pero la app abre en **B** (A en construcción). Al terminar A, conviene que A sea la pantalla inicial | `App.tsx` | Cambiar el estado inicial cuando A exista |
| U6 | La capa de ayuda "Cargando mosaico" no tiene estado de **fallo** (si una tesela en vivo falla, no se avisa) | `GlobeView.tsx` | `PENDIENTE: decisión de P5` |

---

## 7. Autoevaluación contra los criterios de aceptación de T1

| Criterio (plan P6, T1) | Cumple | Dónde |
| :--- | :--- | :--- |
| Pantallas: módulo A (selector de objetivo, presets, sliders, Top N, ficha con radar y comparador) | Sí | §2.1 (A1–A9), §2.3 (F1–F10) |
| Módulo B "como está hoy" (panel + globo 3D / mapa 2D) | Sí | §1 (zonas 5–15), contrastado con el código |
| Puente A → B | Sí | §3 |
| Estados vacío, de carga y de error | Sí | §4.1 (B, existentes) y §4.2 (A, propuestos) |
| Versión móvil (375 px) | Sí | §1.2, §2.2, §2.3, §5 |
| Formato: ASCII con anotaciones numeradas (zona, dato, campo del contrato) | Sí | Tablas con columna de campo/fuente en cada sección |
| Cubre `similar_properties`, `similar_processes`, `differences_and_limits`, `exploration_use_cases`, `subsurface_and_biology`, `datasets_used` | Sí | F3, F4, F5, F6, F7, F8 |
| Respeta el orden propiedad → proceso → límites → usos | Sí | Numeración 1–4 en §2.3 |
| Módulo B coincide con lo implementado | Sí | Revisados `ExplorerView`, `SearchPanel`, `ProcessingPanel`, `ResultsList`, `BodySelector`, `GlobeView`, `StatusBanner`, `App` |
| Indica el comportamiento en 375 px y 1280 px | Sí | §5 |
| Sin datos inventados (regla 4) | Sí | Valores de ejemplo marcados como marcadores; faltantes como `PENDIENTE` |
| Sin tocar archivos fuera de `docs/p6/` (regla 1–2), sin commit (regla 3) | Sí | Solo se creó este archivo |

### Dudas abiertas
1. **D1 / D3 sin cerrar:** el diseño de A supone producto de dos módulos y IFA en el navegador; si el equipo decide otra cosa, §2 cambia.
2. **Pesos y preset "Subsuelo"** (P3): faltan los pesos restantes de cada preset y la definición de "sombra persistente".
3. **Valor de `region_type` para "calibración"** y forma de `targets.json` (perfil objetivo del radar): PENDIENTE de P3/P2.
4. **Pares de imágenes del comparador** (P1/P2) y formato definitivo de `candidates.json` (P4).
5. **Puente A → B:** cómo se pasa el candidato a B (store o parámetro) lo decide P5.
6. **Objetivos táctiles de 40 px** (U1): si el PM prefiere otro mínimo, ajusto §5.
