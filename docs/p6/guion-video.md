# T5 · Guion del video (≤ 30 s)

**Estado:** versión 2, con los cambios pedidos por el PM tras la evaluación (T5: aceptada con cambios) · **Fecha:** 2026-11-14
Base: guion de demo de `plan_P5_frontend_webgis.md` §9.3, **limitado a lo que existe hoy** en `frontend/src/modules/explorer/` (módulo B). Lo que no existe se marca `PENDIENTE (Fase 2)` y **no entra** en el corte de 30 s.

**Reglas de honestidad (plan P6, regla 5):** el video **no dice** que el procesamiento usa datos reales del BBox (son datos simulados de demostración, B12) ni que el módulo A (buscador de análogos) ya funciona. Cada plano que muestra un resultado procesado lleva en pantalla el aviso de la interfaz: "Datos simulados de demostración" / "Simulated demo data". **Nota:** esos datos son **simulados** (`backend/prepare_samples.py` los genera con NumPy), así que la voz del plano 4 lo dice. Los textos de la interfaz vigentes están en `frontend/src/i18n/es.json` y `en.json`.

---

## 1. Corte de 30 s con lo que existe hoy

Formato: 1280 × 720 (grabación de pantalla); voz en off en ES y en EN (dos versiones del mismo video). Cada plano ≥ 2 s.

| # | Seg. | Dur. | Qué se ve en pantalla | Voz en off ES | Voz en off EN | Texto en pantalla (ES / EN) |
| :-: | :-: | :-: | :--- | :--- | :--- | :--- |
| 1 | 0–6 | 6 s | Pestaña **Explorador de datos**. Globo 3D de la **Tierra** girando despacio (Blue Marble, GIBS). Título arriba | ¿Qué lugares de la Tierra se parecen a la Luna y a Marte? | Which places on Earth resemble the Moon and Mars? | **TerraAnáloga** / TerraAnáloga |
| 2 | 6–10 | 4 s | Clic en **Luna** y luego en **Marte** en el selector de cuerpo; el globo cambia a LRO WAC y Viking MDIM | Explora los tres mundos en un globo 3D. | Explore all three worlds on a 3D globe. | Tierra · Luna · Marte / Earth · Moon · Mars |
| 3 | 10–17 | 7 s | Vuelve a **Tierra**. Clic en el globo para colocar el BBox. Clic en **Buscar escenas en vivo**; aparecen los grupos de resultados (ESA Copernicus; Agencias asociadas con NASA, JAXA y CSA) | Busca en vivo en ESA y reúne recursos de NASA, JAXA y CSA. | One search queries ESA live and gathers NASA, JAXA and CSA resources. | Búsqueda federada / Federated search |
| 4 | 17–24 | 7 s | Clic en **Luna** → **Mostrar temperatura (tipo Diviner)** (EN: *Show temperature (Diviner-like)*). Aparece la imagen en el polo sur, el panel **"Ejemplo simulado: polo lunar frente a la Tierra"** (EN: *Simulated example: lunar pole vs. Earth*) y el aviso ámbar **"Datos simulados de demostración"** (EN: *Simulated demo data*), visible ≥ 2 s | Compara el polo lunar con la Antártida, con una muestra de demostración simulada. | Compare the lunar pole with Antarctica, using a simulated demo sample. | **Datos simulados de demostración** / **Simulated demo data** |
| 5 | 24–27 | 3 s | Clic en **Descargar resultado GeoTIFF (.tif)**; se ve la descarga iniciada | Descarga el resultado como GeoTIFF. | Download the result as GeoTIFF. | GeoTIFF |
| 6 | 27–30 | 3 s | Plano fijo con la pestaña **Buscador de análogos** y su texto "Estamos construyendo el buscador de análogos". Logos de las agencias (NASA · ESA · JAXA · CSA) abajo | Próximamente: el buscador de análogos. | Coming soon: the analog finder. | En construcción · NASA · ESA · JAXA · CSA / Under construction · NASA · ESA · JAXA · CSA |

> **Cambios de la versión 2:** (1) el plano 4 pasa de NDVI a **Diviner** (decisión del PM: lo más ligado al reto); (2) el plano 3 usa la redacción segura "**ESA en vivo** y recursos asociados" porque NASA CMR devuelve hoy 0 resultados (verificado por el PM contra el backend real; B10); (3) el plano 1 se corrige a "¿Qué lugares de la Tierra se parecen a la Luna y a Marte?". Para que quepa la voz, el plano 1 pasa a 6 s y el 2 a 4 s. **Actualización S1:** rótulos y acciones del plano 4 puestos al día con los textos nuevos de la interfaz (botón "tipo Diviner", panel "Ejemplo simulado…", aviso "Datos simulados de demostración"); la voz del plano 4 no cambia.

### Comprobación de duración y de voz

Las palabras se contaron con un script (separando por espacios).

| Plano | Dur. (s) | Palabras ES | Palabras/s ES | Palabras EN | Palabras/s EN |
| :-: | :-: | :-: | :-: | :-: | :-: |
| 1 | 6 | 13 | 2,2 | 9 | 1,5 |
| 2 | 4 | 8 | 2,0 | 8 | 2,0 |
| 3 | 7 | 13 | 1,9 | 12 | 1,7 |
| 4 | 7 | 13 | 1,9 | 11 | 1,6 |
| 5 | 3 | 5 | 1,7 | 5 | 1,7 |
| 6 | 3 | 5 | 1,7 | 5 | 1,7 |
| **Total** | **30** | **57** | **1,9** | **50** | **1,7** |

- Duración total = 6 + 4 + 7 + 7 + 3 + 3 = **30 s** (≤ 30 ✔). Plano más corto: 3 s (≥ 2 ✔).
- Límite de voz: ≈ 2,5 palabras/s → máximo 75 palabras en 30 s. El guion tiene **57 (ES) y 50 (EN)** ✔, y el plano más denso llega a **2,2 palabras/s** (plano 1 en ES).

### Revisión de la regla 5

| Afirmación del video | Respaldo | ¿Respeta la regla 5? |
| :--- | :--- | :--- |
| "¿Qué lugares de la Tierra se parecen a la Luna y a Marte?" | Pregunta del reto (plan maestro, cabecera) | Sí: es la pregunta, no una afirmación sobre el producto |
| "tres mundos en un globo 3D" | `GlobeView.tsx`, `config/globeTextures.ts` | Sí |
| "Busca en vivo en ESA y reúne recursos de NASA, JAXA y CSA" | Copernicus STAC en vivo (`connectors.py`); NASA, JAXA y CSA salen de `partner_resources` (catálogo fijo) | Sí. Dice "en vivo" solo de ESA. Alternativa "NASA y ESA en vivo" **solo** si P4 arregla B10 antes de grabar |
| "Compara el polo lunar con la Antártida, con una muestra de demostración simulada" | `ProcessingPanel.tsx` (panel y banner `demoSample`); `backend/prepare_samples.py` genera la muestra con NumPy | Sí: dice que es **simulada**; **no** afirma temperaturas medidas ni datos reales del BBox |
| "Descarga el resultado como GeoTIFF" | `GET /api/export/geotiff` con el bbox procesado (B3) | Sí |
| "Próximamente: el buscador de análogos" | `AnalogsView.tsx` es un marcador de posición | Sí: no dice que funcione |

---

## 2. Notas de grabación (para P5, que graba la pantalla)

1. **Antes de grabar:** backend encendido desde `backend/` (`uvicorn main:app`), pestaña **Explorador**, idioma ES o EN según la versión, ventana a 1280 × 720, sin barra de marcadores ni extensiones visibles.
2. **Plano 3:** debe verse al menos un grupo con resultados (**ESA Copernicus**) y el grupo **Agencias asociadas**. El grupo de NASA Earthdata saldrá con "Sin resultados o fuente no disponible. …" (B10): es normal y **no hay que ocultarlo**. `PENDIENTE: confirmar el día de la grabación qué fuentes responden — P5`. Si P4 arregla B10 antes, se puede usar la voz "NASA y ESA en vivo".
3. **Plano 4:** secuencia exacta: clic en **Luna** → clic en **Mostrar temperatura (tipo Diviner)** → esperar a que aparezcan la imagen y el panel "Ejemplo simulado: polo lunar frente a la Tierra" → dejar el aviso ámbar **"Datos simulados de demostración"** visible ≥ 2 s completos.
4. **Fecha GIBS fija** (no la de hoy) para que la imagen no cambie entre tomas.
5. **Consola sin errores** (checklist P5 §9.5) y cursor grande y lento: cada clic debe verse.
6. **Versión EN:** grabar de nuevo con `EN` activado (selector en la cabecera); los rótulos en pantalla cambian solos.

---

## 3. Lo que todavía no existe: `PENDIENTE (Fase 2)`

Estos pasos del guion de demo (P5 §9.3) **no se pueden filmar hoy** y no están en el corte de 30 s:

| Paso P5 §9.3 | Qué mostraría | Estado |
| :--- | :--- | :--- |
| 1 · Globo con base GIBS y **candidatos** | Puntos de sitios análogos sobre el globo | `PENDIENTE (Fase 2)` — módulo A sin empezar |
| 2 · **Luna → Z4 (PSR)**: el Top 10 cambia | Preset y reordenamiento del Top N | `PENDIENTE (Fase 2)` |
| 3 · Mover el slider de **Hielo**: el orden cambia en vivo | Sliders de pesos | `PENDIENTE (Fase 2)` |
| 4 · "Solo descubrimientos" → ficha, radar, propiedad vs. proceso, límites | Ficha del candidato | `PENDIENTE (Fase 2)` |
| 5 · Comparador Tierra vs. Luna | `ImageCompare` | `PENDIENTE (Fase 2)` |
| 6 · "Explorar datos de este sitio" → módulo B | Puente A → B | `PENDIENTE (Fase 2)` |
| 7 · Cambiar a Luna en B → temperatura "tipo Diviner" → panel "Ejemplo simulado: polo lunar frente a la Tierra" | **Ahora es el plano 4 del corte** | Disponible hoy |
| 8 · Cambiar a **EN** | Es la versión EN del mismo video | Disponible hoy |
| 9 · **Modo estático** (Plan B) | Interruptor de respaldo | `PENDIENTE (Fase 2)` (`DataSourceToggle` sin hacer) |

**Propuesta de corte alternativo cuando el módulo A esté listo (≤ 30 s, a validar entonces):**
0–4 globo · 4–10 preset Luna Z4 y Top 10 · 10–15 slider de Hielo · 15–21 ficha con límites visibles · 21–26 puente a B y procesamiento (con "Datos simulados de demostración") · 26–30 cierre con las 4 agencias. Las voces se redactan cuando exista; **no se escriben ahora** para no prometer lo que no funciona.

---

## 4. Autoevaluación contra los criterios de aceptación de T5

| Criterio | Cumple | Dónde |
| :--- | :--- | :--- |
| Tabla de planos: segundo inicial y final, qué se ve, voz en off ES y EN, texto en pantalla | Sí | §1 |
| Basado en el guion de demo (P5 §9.3), solo funciones que existen (globo de 3 cuerpos, búsqueda federada, procesamiento, descarga) | Sí: planos 1–5 | §1, §3 |
| Lo que no existe, marcado `PENDIENTE (Fase 2)` | Sí | §3 |
| Dura ≤ 30 s en total | Sí: 30 s | §1 |
| Cada plano ≥ 2 s | Sí: el mínimo es 3 s | §1 |
| Voz en off cabe en el tiempo (≈ 2,5 palabras/s) | Sí: 1,9 (ES) y 1,7 (EN) de media; máximo 2,2 | §1 |
| Respeta la regla 5 | Sí | §1 (tabla de revisión) |
| Sin datos inventados | Sí; qué fuentes responden el día de la grabación queda como `PENDIENTE` | §2 |
| Cambios pedidos por el PM aplicados (Diviner, redacción segura del plano 3, plano 1 corregido, tablas recontadas) | Sí | §1 |

### Dudas abiertas
1. ~~**Voz del plano 4:** dice "simulada"…~~ **RESUELTA:** la interfaz ya dice "Datos simulados de demostración" (`explorer.result.demoSample`), así que la voz y el rótulo en pantalla coinciden. El PM pidió mantener "simulada" en la voz.
2. **`PENDIENTE (P4)`:** arreglo de B10; si llega antes de grabar, el plano 3 puede decir "NASA y ESA en vivo".
3. **`PENDIENTE (equipo)`:** quién pone la voz y en qué idioma se entrega primero; hora real de H0 y fecha de `candidates.json`.
