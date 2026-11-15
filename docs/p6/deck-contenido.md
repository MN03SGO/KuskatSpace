# T6 · Deck de 7 diapositivas — contenido

**Estado:** propuesta P6 para revisión del PM · **Fecha:** 2026-11-14
Por diapositiva: título (ES/EN), **máximo 3 viñetas**, visual sugerido y notas del orador. Cada afirmación técnica lleva su **fuente en el repo** (archivo y sección) entre corchetes `[ ]`. No se inventan datos: lo que falta va como `PENDIENTE: <qué y quién>`.

> ### ⚠ Hallazgo que condiciona el deck (leer antes de presentar)
> Los 4 GeoTIFF que usa el procesamiento (`backend/sample_data/*.tif`) **son sintéticos**: los genera `backend/prepare_samples.py` con NumPy (ruido *speckle*, senos y gaussianas), no son productos reales de CSA, ESA, JAXA ni NASA. Eso incluye el perfil "tipo Diviner" de 45–355 K (la interfaz ya lo rotula como simulado). Por eso el deck **no puede decir** que las imágenes procesadas son datos de las agencias ni que el panel "Ejemplo simulado: polo lunar frente a la Tierra" muestra temperaturas medidas. Lo que **sí es real** y consultado hoy: las teselas del globo (GIBS, Trek) y la búsqueda en vivo de catálogos (ver diapositiva 3). Se reporta además al PM como riesgo (sección 9).

**Regla 5 (plan P6):** el deck no dice que el procesamiento use datos reales del BBox ni que el módulo A (buscador de análogos) funcione.

---

## Diapositiva 1 · Problema y tesis
**ES:** *Ningún lugar de la Tierra es un espejo de la Luna o de Marte* · **EN:** *No place on Earth mirrors the Moon or Mars*

**Viñetas**
1. La Luna tiene 0,165 g y Marte 0,38 g; además, vacío o atmósfera tenue y radiación cósmica. Ningún sitio terrestre reproduce las tres cosas a la vez. `[plan_maestro §"Tesis Central"]`
2. Los análogos conocidos (Antártida, Atacama, Islandia, Hawái) están muy estudiados; faltan sitios poco explorados. `[plan_maestro §"Tesis Central" y §01, diferenciador 1]`
3. **Tesis:** no buscamos *un* sitio perfecto, sino una **cartera de análogos parciales**, y decimos qué probar en campo y qué dejar a laboratorios. `[plan_maestro §"Tesis Central"]`

**Visual sugerido:** el globo 3D de la Tierra partiéndose en tres "capas" (gravedad · atmósfera · radiación) con una marca ✗ en cada una. Fondo `canvas`, texto `ink`.

**Notas del orador (≈ 40 s):** Abrir con la pregunta del reto: *¿dónde en la Tierra puedo ensayar la vida en una base lunar o en Marte?* La respuesta honesta es "en ninguna a la vez". Por eso la idea no es un único sitio, sino un portafolio: cada lugar cubre una parte de las condiciones y declaramos qué falta. Esta frase se repite al cierre.

---

## Diapositiva 2 · Solución
**ES:** *Un producto, dos módulos* · **EN:** *One product, two modules*

**Viñetas**
1. **Módulo B · Explorador de datos (disponible hoy):** globo 3D de la Tierra, la Luna y Marte, búsqueda en vivo en catálogos de agencias, procesamiento con datos simulados y descarga GeoTIFF. `[frontend/README.md §"El explorador tiene dos vistas"; frontend/src/modules/explorer/]`
2. **Módulo A · Buscador de análogos (en construcción):** IFA, escenarios por zona, fichas y radar. Todavía **no funciona**. `[frontend/src/modules/analogs/AnalogsView.tsx; plan_P5 §3, D1]`
3. Funciona en español e inglés. `[frontend/src/i18n/es.json y en.json]`

**Visual sugerido:** dos tarjetas lado a lado: B con captura real del globo (etiqueta "Disponible"); A con la maqueta de `wireframes.md` §2 (etiqueta "En construcción"). No mostrar la maqueta como si fuera la app.

**Notas del orador (≈ 30 s):** Decir con claridad qué existe y qué no. B demuestra el uso de datos abiertos y la infraestructura; A es el núcleo científico y es lo siguiente. No describir A en presente.

---

## Diapositiva 3 · Datos de agencias
**ES:** *Cuatro agencias, tres capas de uso* · **EN:** *Four agencies, three levels of use*

**Viñetas**
1. **Consultado en vivo hoy:** **ESA** (Copernicus STAC: Sentinel-2 L2A y Sentinel-1 GRD) devuelve resultados; **NASA** (Earthdata CMR y PDS) se consulta, pero hoy **sin resultados** (B10). `[backend/connectors.py: colecciones "sentinel-2-l2a" y "sentinel-1-grd", consulta a PDS ODE]`
2. **Teselas del globo (reales):** NASA GIBS *Blue Marble* para la Tierra; NASA Trek *LRO WAC* para la Luna y *Viking MDIM 2.1* para Marte. `[frontend/src/config/globeTextures.ts; config/bodies.ts; frontend/README.md]`
3. **Catálogo de referencia (se muestra, no se consulta en vivo):** **JAXA** G-Portal (GPM/GSMaP, GCOM-C, AMSR2) y **CSA** (RADARSAT Constellation y RADARSAT-1 Open Archive). `[backend/connectors.py: lista fija de recursos asociados]`

**Tabla de respaldo (para diapositiva o anexo)**

| Agencia | Recurso | Cómo se usa hoy | Fuente en el repo |
| :--- | :--- | :--- | :--- |
| NASA | GIBS Blue Marble | Textura del globo de la Tierra | `config/globeTextures.ts` |
| NASA | Trek · LRO WAC y Viking MDIM 2.1 | Texturas del globo de la Luna y Marte | `config/bodies.ts` |
| NASA | Earthdata CMR | Búsqueda en vivo (hoy devuelve lista vacía, B10) | `backend/connectors.py`; plan_P5 §6, B10 |
| NASA | PDS ODE | Búsqueda en vivo para Luna y Marte (productos con ubicación aproximada, B19) | `backend/connectors.py`; plan_P5 §6, B19 |
| ESA | Copernicus STAC (Sentinel-2 L2A, Sentinel-1 GRD) | Búsqueda en vivo | `backend/connectors.py` |
| JAXA | G-Portal (GPM/GSMaP, GCOM-C, AMSR2) | Catálogo de referencia | `backend/connectors.py` |
| CSA | RADARSAT Constellation y RADARSAT-1 | Catálogo de referencia | `backend/connectors.py` |
| NASA/ESA/JAXA/CSA | Datasets del plan (LOLA, Diviner, MODIS, Copernicus DEM, EMIT, G-Portal, RADARSAT-1…) | **Planificados** para el pipeline de P1/P2; no integrados todavía | plan_maestro §03 |
| — (infraestructura del equipo) | **MongoDB Atlas** con índice `2dsphere` (colecciones `candidates` y `targets`) y API `/`, `/candidates`, `/candidates/near`, `/targets`, `/export` | **Ya existe** (integrada en `c3e2be9`). **Sus datos de ejemplo aún no cumplen el contrato §05** (sin `scores` ni ficha; los 3 "candidatos" son de Marte y la Luna) y no se pudo probar contra Atlas desde la máquina del frontend | plan_P5 §2.5, B34 y B35; `main.py` de la raíz |

**Visual sugerido:** cuatro logos de agencia (con permiso de uso y atribución) y debajo la tabla anterior con tres colores (en vivo · textura · catálogo). `PENDIENTE: verificar licencias de logos y atribuciones — P6 con el equipo`.

**Notas del orador (≈ 40 s):** No decir "usamos datos de las cuatro agencias" sin matices. Decir: "consultamos ESA (Copernicus) en vivo y obtenemos resultados; consultamos NASA CMR, que hoy no devuelve resultados; mostramos JAXA y CSA como recursos de referencia, y el pipeline de datos del plan maestro es lo que viene". (Redacción coherente con el video, plano 3.) Sobre la infraestructura: decir que **la base de datos MongoDB Atlas con índice 2dsphere y su API ya existen**, pero que **todavía no contienen los candidatos reales** del buscador (los datos de ejemplo son de Marte y la Luna y no traen puntuaciones). No decir que el buscador funciona ni que hay candidatos reales.

---

## Diapositiva 4 · Método: IFA y propiedad vs. proceso
**ES:** *Parecerse en un número no es parecerse en el fenómeno* · **EN:** *Matching a number is not matching the phenomenon*

**Viñetas**
1. **IFA** = Σ(wᵈ·sᵈ) / Σ wᵈ, con sᵈ = exp(−|xᵈ − tᵈ| / σᵈ) en 5 dimensiones (relieve, iluminación, frío, hielo, polvo); los pesos los elige la persona. `[plan_maestro §4.2]`
2. Cada ficha separa **propiedad** (mismo valor) de **proceso** (mismo fenómeno), y siempre muestra **diferencias y límites**. `[plan_maestro §01, diferenciador 2; §05, campos similar_properties, similar_processes, differences_and_limits]`
3. Antes de comparar, los datos se llevan a una **resolución homóloga** (~240 m, celdas de ~5 km). `[plan_maestro §4.1]`

**Visual sugerido:** la fórmula (una sola línea) y debajo un ejemplo de ficha con las cuatro secciones en orden (propiedad → proceso → límites → usos) tomado de `wireframes.md` §2.3, **con valores en blanco o marcados "ejemplo"**. No mostrar números de IFA reales: `PENDIENTE: candidates.json y valores reales — P3/P4`.

**Notas del orador (≈ 45 s):** Esto es **diseño del plan maestro**; el cálculo del IFA en el producto aún no está implementado (`lib/ifa.ts` no existe, plan_P5 §7, Fase 2). Explicar con un ejemplo cualitativo (frío extremo frente a "estabilidad del hielo bajo capa seca"). `PENDIENTE: prueba de cordura con McMurdo y Devon en el Top 20 — P3 (checkpoint H12)`.

---

## Diapositiva 5 · Demo
**ES:** *Del globo a la escena, en 30 segundos* · **EN:** *From globe to scene, in 30 seconds*

**Viñetas**
1. Tres mundos en un globo 3D (Tierra, Luna y Marte) con selector y mapa 2D. `[frontend/src/modules/explorer/GlobeView.tsx, PlanetMap.tsx]`
2. Una búsqueda en vivo en ESA (Copernicus); NASA CMR consultado, hoy sin resultados; recursos de JAXA y CSA. `[backend/connectors.py; ResultsList.tsx]`
3. Procesamiento con **datos simulados** (botón "Mostrar temperatura (tipo Diviner)", panel "Ejemplo simulado: polo lunar frente a la Tierra") y descarga GeoTIFF. `[ProcessingPanel.tsx; plan_P5 §6, B12]`

**Visual sugerido:** el video de ≤ 30 s ([guion-video.md](guion-video.md)) a pantalla completa. Plan B: capturas de los planos 3 y 4.

**Notas del orador (≈ 30 s + video):** Narrar lo que se ve, no lo que se espera. El aviso ámbar "Datos simulados de demostración" debe quedar legible, igual que el título "Ejemplo simulado: polo lunar frente a la Tierra". Si la búsqueda en vivo tarda, pasar al video grabado. La demo **no cambia** con la integración de Mongo: el módulo A sigue sin funcionar y no se muestran candidatos.

---

## Diapositiva 6 · Límites y honestidad científica
**ES:** *Lo que no hacemos todavía* · **EN:** *What we do not do yet*

**Viñetas**
1. **El procesamiento usa datos simulados de demostración generados por nosotros** (no son mediciones de ninguna misión ni datos del BBox); la imagen solo se coloca sobre el BBox. `[backend/prepare_samples.py; plan_P5 §2.2 y §6, B12]`
2. **El buscador de análogos no está terminado** y los resultados de IFA aún no están calibrados (prueba de cordura pendiente). `[AnalogsView.tsx; plan_maestro §07, falla de cordura en H10]`
3. **Ningún sitio terrestre reproduce a la vez** gravedad, vacío y radiación: cada ficha lo declara. `[plan_maestro §"Tesis Central"; §05, differences_and_limits]`

**Visual sugerido:** tres tarjetas con un ícono de advertencia en `warn`, texto sobre `surface`. Sin humor ni tono defensivo.

**Notas del orador (≈ 40 s):** Esta diapositiva es una fortaleza, no una disculpa: la rúbrica premia la validez científica y decir dónde falla la analogía. Explicar que el panel "Ejemplo simulado: polo lunar frente a la Tierra" muestra un perfil simulado (tipo Diviner) frente a una media antártica de referencia: ilustra el flujo y no son mediciones. Usar el aviso "Datos simulados de demostración". No omitir el hallazgo del recuadro inicial.

---

## Diapositiva 7 · Equipo y próximos pasos
**ES:** *Lo que sigue* · **EN:** *What comes next*

**Viñetas**
1. **Equipo (alias del README):** P1 Jorge (datos terrestres) · P2 Ansorje (datos planetarios) · P3 Abel (algoritmo y fichas) · P4 Anthony (backend y base de datos) · P5 Amiguito (frontend) · P6 Paola (UX y pitch). `[README.md §"Distribución de los roles"]`
2. **Próximos pasos:** cargar en Mongo los datos reales de P3 con el contrato del plan maestro; unir las dos APIs en una sola; generar el Plan B (`candidates.json`) con `/export`; módulo A con IFA, presets y fichas; y sustituir los datos simulados por datos reales de las agencias. `[plan_P5 §2.5, D7, D8, B34, B38 y §7; plan_maestro §05 y §06]`
3. Cierre: *una cartera de análogos parciales que dice qué probar y qué no.* `[plan_maestro §"Tesis Central"]`

**Visual sugerido:** línea de tiempo corta con las fases del plan y la zona "hecho" (módulo B) en `ok` y "por hacer" (módulo A) en `ink-muted`. `PENDIENTE: fechas — hora real de H0, ver cronograma-checkins.md`.

**Notas del orador (≈ 25 s):** Cerrar con la tesis de la diapositiva 1. Invitar a las preguntas. Decir que lo siguiente es el dato: la API ya está, falta cargar los candidatos reales con el contrato. No presentar los 3 "candidatos" de ejemplo (Jezero, Valle Marineris, Shackleton) como resultados.

---

## 8. Verificación de fuentes (T6: "cada afirmación técnica tiene su fuente")

| Afirmación | Fuente comprobada | Verificado |
| :--- | :--- | :--- |
| 0,165 g y 0,38 g; tesis de cartera de análogos parciales | `plan_maestro_terraan_loga_v2_0_hackathon_24h.md`, nota "Tesis Central" | Sí |
| IFA = Σ w·s / Σ w; s = exp(−\|x−t\|/σ); 5 dimensiones | plan maestro §4.2 | Sí |
| Resolución homóloga ~240 m, celdas ~5 km | plan maestro §4.1 | Sí |
| Propiedad vs. proceso; límites siempre visibles | plan maestro §01 y §05; plan P5 §8 | Sí |
| Búsqueda en vivo: NASA CMR, Copernicus STAC (`sentinel-2-l2a`, `sentinel-1-grd`) y PDS ODE | `backend/connectors.py` (líneas 115, 140) | Sí |
| JAXA y CSA son entradas de un catálogo fijo | `backend/connectors.py` (líneas 6–70) | Sí |
| Las muestras GeoTIFF son sintéticas | `backend/prepare_samples.py` (líneas 29–48) | Sí |
| El módulo A es un marcador de posición | `frontend/src/modules/analogs/AnalogsView.tsx` | Sí |
| El globo usa GIBS y Trek | `frontend/README.md`; `frontend/src/config/bodies.ts` | Sí |
| 4 agencias con datasets: NASA, ESA, JAXA, CSA | Tabla de la diapositiva 3 | Sí |

---

## 9. Autoevaluación y dudas abiertas

| Criterio (plan P6, T6) | Cumple | Dónde |
| :--- | :--- | :--- |
| Por diapositiva: título, ≤ 3 viñetas, visual sugerido y notas del orador | Sí (7 diapositivas) | §1–§7 |
| Estructura: problema/tesis → solución → datos → método → demo → límites → equipo y próximos pasos | Sí | Diapositivas 1–7 |
| Cada afirmación técnica con su fuente en el repo (archivo y sección) | Sí | Viñetas y §8 |
| Menciona las 4 agencias con los datasets reales que se usan | Sí, **distinguiendo en vivo, textura, catálogo y planificado** | Diapositiva 3 |
| Incluye la tesis central del plan maestro | Sí | Diapositivas 1 y 7 |
| Cumple la regla 5 | Sí; además advierte de que las muestras son sintéticas | Recuadro inicial, diapositivas 2, 5 y 6 |

**Dudas abiertas / riesgos para el PM**
1. **RESUELTA (S1).** El PM corrigió la interfaz el 2026-11-14 (`es.json` / `en.json`): `processing.title` = "Procesamiento con datos simulados"; botones sin atribución a agencias (p. ej. "Mostrar temperatura (tipo Diviner)"); `demoSample` = "Datos simulados de demostración … no son mediciones de ninguna misión ni de esta zona"; panel = "Ejemplo simulado: polo lunar frente a la Tierra". Texto original de la duda: **Riesgo de honestidad (importante):** el panel "Polo lunar vs. Tierra" y los estadísticos (mín/media/máx) salen de GeoTIFF **sintéticos**; la interfaz ya avisa "muestra de demostración", pero el texto actual dice solo que **"no son datos reales de esta zona"**, no que son **simulados**. Sugerencia para P5/PM: decir "datos simulados" y valorar rotular el panel Diviner como ejemplo, no como medición. No lo toqué (fuera de mi alcance).
2. `PENDIENTE: permiso y atribución de logos de agencias — P6/equipo`.
3. `PENDIENTE: valores de IFA, candidatos y prueba de cordura — P3/P4`.
4. ¿Quién presenta y cuánto dura la exposición? `PENDIENTE: formato del evento — equipo`. Las notas suman ≈ 3,5 min.
