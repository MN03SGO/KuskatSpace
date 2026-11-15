# T9 · Revisión de los textos de las capas del planeta (ES/EN)

**Estado:** propuesta P6 para revisión del PM · **Fecha:** 2026-11-14
**Alcance:** claves `explorer.layers.*`, `explorer.globe.hintShort`, `explorer.globe.tileErrors` y los nombres de procesamiento `explorer.processing.modes.jaxa_precip` y `diviner_thermal`, tal como están hoy en `frontend/src/i18n/es.json` y `en.json`. **No se editó ningún JSON**: abajo van las propuestas (clave → texto ES / EN). Términos según [glosario.md](glosario.md). Marcadores `{var}` idénticos en ES y EN.

**Regla de honestidad que se aplica:** la **Tierra** muestra **datos de satélite** (NASA GIBS); la **Luna y Marte** muestran **un modelo aproximado**, nunca una medición; humedad y precipitación **solo existen para la Tierra**; los datos de la sección "Procesamiento" son **simulados**.

---

## 1. Verificación de lo que dicen los textos (contra el código y el catálogo de GIBS)

Se descargó el `WMTSCapabilities` de GIBS (EPSG:4326) el 2026-11-14 y se leyó `frontend/src/config/planetLayers.ts` y `lib/thermalModel.ts`.

| Afirmación del texto | Respaldo comprobado | Veredicto |
| :--- | :--- | :--- |
| Temperatura: "NASA AIRS, temperatura del aire en superficie (pasada de día)" | Capa `AIRS_L3_Surface_Air_Temperature_Daily_Day`, título oficial "Air Temperature at Surface (L3, Daytime/Ascending, Daily, AIRS, Aqua)"; última fecha publicada (`Default`) = 2026-11-08 | Correcto. Falta decir que es el satélite **Aqua** (opcional) |
| Humedad: "NASA AIRS, humedad relativa en superficie (pasada de día)" | `AIRS_L3_Surface_Relative_Humidity_Daily_Day`, "Relative Humidity at Surface (L3, Daytime/Ascending, Daily, AIRS, Aqua)"; `Default` = 2026-11-08 | Correcto |
| Precipitación: "NASA GPM IMERG, tasa de precipitación diaria" | `IMERG_Precipitation_Rate`, título "Precipitation Rate (IMERG)"; paso de tiempo **`P1D`** (un mapa por día); `Default` = 2026-11-13; **hay días sin publicar** (p. ej. entre 2025-10-22 y 2025-10-30) | Correcto en lo del paso diario. **`PENDIENTE: confirmar con la documentación de GPM si cada mapa diario es un promedio o un instante`**: por eso se propone no decir "media" |
| `sourceEarth`: "Fecha: {date} (**la más reciente publicada**)" | El código pide `min(fecha elegida, hoy − 7 días)` para AIRS y `hoy − 2` para IMERG (`layerDate`). Con la fecha por defecto (ayer) se muestra **hoy − 7**, pero la última publicada es 2026-11-08 (hoy − 6) | **Impreciso:** puede no ser la más reciente, y si la persona elige una fecha antigua **tampoco lo es**. Se propone quitar el paréntesis (ver §2) |
| Luna: "unos 390 K bajo el Sol, unos 95 K de noche y unos 40 K en los polos" | `modelTemperature`: día 392·cos(i)^¼, noche 95 − 55·(lat/90)⁴, es decir ≈ 40 K en los polos | Es lo que **da el modelo**, no una medición: en la Luna real solo los cráteres en sombra permanente se acercan a 40 K. Se reescribe atribuyéndolo al modelo |
| Marte: "unos 290 K bajo el Sol y entre 150 y 190 K de noche" | `modelTemperature`: día 290·cos(i)^¼, noche 190 K en el ecuador y 150 K en los polos | Correcto como descripción del modelo; se reescribe igual |
| Luna: "no tiene atmósfera: no hay humedad ni lluvia" | La Luna tiene una exosfera casi inexistente | Simplificación aceptable; se propone "casi no tiene atmósfera" |
| Marte: "No hay datos globales diarios de humedad ni de lluvia en Marte" | Afirmación sobre el mundo, no verificable en el repo | Se reescribe como afirmación sobre **esta aplicación**: "esta aplicación no tiene…" |
| Posición del Sol: "punto subsolar" | `moonSubsolarPoint` tiene un error de **≈ ±8°** (comentario del código); Marte < 0,1° | Falta decir la incertidumbre de la Luna |

---

## 2. Propuestas por clave

Leyenda: **✔ conservar** · **✎ cambiar**.

### 2.1 Título y ayuda

| Clave | Decisión | ES propuesto | EN propuesto | Motivo |
| :--- | :-: | :--- | :--- | :--- |
| `explorer.layers.title` | ✎ | Capas globales | Global layers | La Luna no es un planeta: "Capas del planeta" es incorrecto fuera de la Tierra y de Marte |
| `explorer.layers.hint` | ✎ | Muestra una variable sobre toda la superficie visible. | Show one variable over the whole visible surface. | Mismo motivo; también sirve para el mapa 2D |

### 2.2 Botones (verbo + nombre; ya cumplen la regla de verbos)

| Clave | Decisión | ES | EN | Motivo |
| :--- | :-: | :--- | :--- | :--- |
| `explorer.layers.temperature` | ✔ | Mostrar temperatura | Show temperature | Es la capa de satélite en la Tierra |
| `explorer.layers.humidity` | ✔ | Mostrar humedad | Show humidity | — |
| `explorer.layers.precipitation` | ✔ | Mostrar precipitación | Show precipitation | No choca con "Procesar precipitación simulada" |
| **`explorer.layers.temperatureModel`** (clave **nueva**, para Luna y Marte; requiere cambio de código) | ✎ | Mostrar temperatura (modelo) | Show temperature (model) | En la Luna y en Marte el botón **no debe parecer una medición**; hoy dice solo "Mostrar temperatura". Es el cambio más importante de este documento |

### 2.3 Cuándo no hay capa

| Clave | Decisión | ES propuesto | EN propuesto | Motivo |
| :--- | :-: | :--- | :--- | :--- |
| `explorer.layers.unavailable.moon` | ✎ | La Luna casi no tiene atmósfera, así que no hay humedad ni lluvia. Solo está la temperatura, calculada con un modelo. | The Moon has almost no atmosphere, so there is no humidity or rain. Only temperature is available, calculated with a model. | Precisión científica y deja claro que es un modelo |
| `explorer.layers.unavailable.mars` | ✎ | Esta aplicación no tiene datos globales de humedad ni de lluvia de Marte. Solo está la temperatura, calculada con un modelo. | This app has no global humidity or rain data for Mars. Only temperature is available, calculated with a model. | Habla de la aplicación, no del mundo real |

### 2.4 Fuentes (Tierra)

| Clave | Decisión | ES propuesto | EN propuesto | Motivo |
| :--- | :-: | :--- | :--- | :--- |
| `explorer.layers.sources.temperature` | ✎ | NASA AIRS (satélite Aqua): temperatura del aire en superficie, pasada de día | NASA AIRS (Aqua satellite): surface air temperature, daytime pass | Añade el satélite, verificado en GIBS |
| `explorer.layers.sources.humidity` | ✎ | NASA AIRS (satélite Aqua): humedad relativa en superficie, pasada de día | NASA AIRS (Aqua satellite): surface relative humidity, daytime pass | Ídem |
| `explorer.layers.sources.precipitation` | ✎ | NASA GPM IMERG: tasa de precipitación, un mapa por día | NASA GPM IMERG: precipitation rate, one map per day | Dice lo verificado (paso `P1D`) sin afirmar "media" |
| `explorer.layers.sourceEarth` | ✎ | Datos de satélite: {source}. Fecha de la capa: {date}. | Satellite data: {source}. Layer date: {date}. | Se quita "(la más reciente publicada)", que puede ser falso (§1) |
| **`explorer.layers.dateAdjusted`** (clave **nueva**; se muestra solo si la fecha mostrada ≠ la elegida) | ✎ | La fecha elegida es muy reciente: se muestra la última que suele estar publicada. | The chosen date is very recent: the latest date that is usually published is shown. | Explica por qué el campo de fecha y la leyenda no coinciden (ver [auditoria-ux.md](auditoria-ux.md), hallazgo N3) |
| `explorer.layers.gapsNote` | ✔ | Las franjas vacías son zonas por donde el satélite no pasó ese día. | Empty stripes are areas the satellite did not pass over that day. | Claro y exacto (producto "Daily, Daytime/Ascending") |
| **`explorer.layers.kelvinHint`** (clave **nueva**, opcional; solo en la capa de temperatura) | ✎ | Kelvin (K): 273 K equivale a 0 °C. | Kelvin (K): 273 K equals 0 °C. | La leyenda va en K (200–320 K) y el público no lo asocia a grados |

### 2.5 Modelo (Luna y Marte)

| Clave | Decisión | ES propuesto | EN propuesto | Motivo |
| :--- | :-: | :--- | :--- | :--- |
| `explorer.layers.sourceModel` | ✎ | Modelo aproximado, calculado para este momento ({date} {time} UTC). No es una medición ni un dato de satélite. | Approximate model, calculated for this moment ({date} {time} UTC). It is not a measurement or satellite data. | Reglas de honestidad: "no es una medición" **y** "no es dato de satélite" |
| `explorer.layers.subsolar` | ✎ | Punto subsolar (donde el Sol está justo encima): lat. {lat}°, lon. {lon}° | Subsolar point (where the Sun is directly overhead): lat. {lat}°, lon. {lon}° | "Punto subsolar" es jerga sin definir |
| `explorer.layers.modelNote.moon` | ✎ | El modelo usa la posición del Sol y da unos 390 K bajo el Sol, unos 95 K de noche en el ecuador y unos 40 K en los polos. Ignora el relieve y la inercia térmica, y la posición del Sol tiene un error de unos 8°. | The model uses the Sun's position and gives about 390 K under the Sun, about 95 K at night at the equator and about 40 K at the poles. It ignores relief and thermal inertia, and the Sun's position has an error of about 8°. | Atribuye las cifras al modelo y declara la incertidumbre (comentario de `moonSubsolarPoint`: ±~8°) |
| `explorer.layers.modelNote.mars` | ✎ | El modelo usa la posición del Sol y da unos 290 K bajo el Sol y entre 150 y 190 K de noche. Ignora el polvo, el relieve y la inercia térmica. | The model uses the Sun's position and gives about 290 K under the Sun and 150–190 K at night. It ignores dust, relief and thermal inertia. | Ídem |
| **`explorer.layers.modelBadge`** (clave **nueva**; rótulo opaco sobre el globo, como los otros `mapLabel`) | ✎ | Capa de modelo: no es una medición | Model layer: not a measurement | En móvil el panel con el aviso queda debajo del globo ([auditoria-ux.md](auditoria-ux.md), hallazgo N5): el aviso debe verse **sobre la imagen** |

### 2.6 Leyenda, escala y estados

| Clave | Decisión | ES propuesto | EN propuesto | Motivo |
| :--- | :-: | :--- | :--- | :--- |
| `explorer.layers.names.*` | ✔ | temperatura · humedad relativa · precipitación | temperature · relative humidity · precipitation | — |
| `explorer.layers.legendLabel` | ✔ | Escala de {name}: de {min} a {max} {unit} | {name} scale: from {min} to {max} {unit} | Se mantiene para las escalas lineales |
| **`explorer.layers.legendLabelLog`** (clave **nueva**; precipitación) | ✎ | Escala logarítmica de {name}: de {min} a {max} {unit} o más | Logarithmic scale of {name}: from {min} to {max} {unit} or more | Hoy el código pasa `max = "≥ 50"`, y el lector de pantalla oye "de 0,1 a ≥ 50 mm/h" |
| `explorer.layers.logScale` | ✔ | escala logarítmica | logarithmic scale | Se añade al glosario (ver §4) |
| `explorer.layers.opacity` | ✔ | Opacidad de la capa: {value} % | Layer opacity: {value}% | Cifras y espacio según el glosario |
| `explorer.layers.loading` | ✔ | Cargando capa {loaded} de {total} | Loading layer {loaded} of {total} | — |
| `explorer.layers.failed` | ✎ | No hay imagen de esta capa para esa fecha (algunos días no se publican). Prueba con otra fecha. | There is no image of this layer for that date (some days are not published). Try another date. | Dice la causa real (días sin publicar en IMERG, verificado) y da una salida |

### 2.7 Globo y procesamiento

| Clave | Decisión | ES propuesto | EN propuesto | Motivo |
| :--- | :-: | :--- | :--- | :--- |
| `explorer.globe.hintShort` | ✎ | Arrastra para girar · toca o haz clic para mover el BBox | Drag to rotate · tap or click to move the BBox | "Toca" solo sirve en pantallas táctiles; la pista corta también se ve en una ventana estrecha de escritorio |
| `explorer.globe.tileErrors` | ✎ | Parte del detalle no cargó; se muestra la imagen base del globo. | Some detail did not load; showing the base image of the globe. | "Textura local" es jerga |
| `explorer.processing.modes.jaxa_precip` | ✔ | Procesar precipitación simulada | Process simulated precipitation | Se distingue claramente de la capa "Mostrar precipitación" (satélite) |
| `explorer.processing.modes.diviner_thermal` | ✔ | Procesar perfil térmico simulado | Process simulated thermal profile | Se distingue de la capa de modelo "Mostrar temperatura (modelo)" |

**Distinción verbal que conviene mantener** (se añade al glosario): **"Mostrar …" = capa global** (satélite en la Tierra, modelo en la Luna y Marte) · **"Procesar / Calcular …" = procesamiento con datos simulados**. Así nadie confunde el mapa real de temperatura con el perfil simulado.

---

## 3. Lista de comprobación de honestidad

| Regla | Estado con los textos actuales | Con las propuestas |
| :--- | :--- | :--- |
| La Tierra se presenta como dato de satélite con fuente y fecha | Sí | Sí (sin "la más reciente") |
| La Luna y Marte se presentan como modelo, no como medición | **Parcial:** el aviso ámbar lo dice, pero el botón no | Sí: botón "(modelo)", rótulo sobre el globo y aviso |
| Humedad y precipitación solo en la Tierra | Sí | Sí |
| El texto no afirma más de lo que se verificó | **No:** "la más reciente publicada", "unos 40 K en los polos" sin atribuir al modelo | Sí |
| No se confunde la capa con el procesamiento simulado | Sí (los nombres ya se separaron) | Sí, y se fija la regla "Mostrar" / "Procesar" |
| Errores sin culpar y con salida | Sí | Sí |
| Cifras según idioma (0,45 / 0.45) | Sí, con `formatNumber` | Sí |
| Botones con verbo | Sí | Sí |

---

## 4. Términos nuevos para el glosario

Se añaden a [glosario.md](glosario.md) (sección 3) junto con esta entrega: **capa global**, **modelo térmico aproximado**, **punto subsolar**, **escala logarítmica** y **AIRS / IMERG**.

---

## 5. Autoevaluación y dudas

| Criterio del encargo | Cumple | Dónde |
| :--- | :--- | :--- |
| Revisa `explorer.layers.*`, `hintShort`, `tileErrors` y los dos nombres de procesamiento | Sí | §2 |
| Contra el glosario y la regla de honestidad | Sí | §1, §3, §4 |
| Propuestas concretas (clave → texto ES/EN) | Sí; 5 claves nuevas marcadas en negrita y 15 cambios de texto | §2 |
| No se editaron los JSON | Sí | — |
| Verificación de datos | Sí, contra `WMTSCapabilities` de GIBS y el código | §1 |

**Claves nuevas que requieren código (para el PM):** `temperatureModel`, `dateAdjusted`, `kelvinHint`, `modelBadge` y `legendLabelLog`.

**Dudas abiertas**
1. **`PENDIENTE: ¿el mapa diario de IMERG es un promedio del día o un instante?`** — confirmar con la documentación de GPM antes de afinar la fuente.
2. **`PENDIENTE: confirmar si se quiere mostrar °C además de K`** en la capa de temperatura (la leyenda sale de GIBS en kelvin).
3. Todas las propuestas son un solo pase de revisión: `PENDIENTE: lectura en voz alta por una persona`, como el resto de `docs/p6/`.
