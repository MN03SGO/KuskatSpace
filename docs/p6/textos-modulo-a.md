# T3 · Propuesta de textos del módulo A (ES/EN)

**Estado:** propuesta; **todavía no está en los JSON**. Cuando P5 implemente el módulo A, copia estas claves a `es.json` y `en.json` (mismas claves en ambos). Términos según [glosario.md](glosario.md). Zonas citadas (A1–A9, F1–F10) corresponden a [wireframes.md](wireframes.md).

**Reglas aplicadas:** botones con verbo; errores sin culpar y con salida; cifras según idioma (ES `0,45` / EN `0.45`; ES `45 %` / EN `45%`), formateadas por el código con `Intl.NumberFormat`, no escritas a mano en el texto; **no se afirma que el módulo ya funciona** hasta que P5 lo confirme; **ningún dato inventado** (nombres de sitios, IFA y métricas llegan desde el contrato). Marcadores `{var}` idénticos en ES y EN.

## 1. Estructura de claves propuesta (`analogs.*`)

La clave `analogs.placeholderTitle` y `analogs.placeholderBody` existentes se conservan hasta que el módulo esté listo.

### Escenario (A1–A4)

| Clave | ES | EN |
| :--- | :--- | :--- |
| `analogs.scenario.title` | Define tu escenario | Define your scenario |
| `analogs.target.label` | Objetivo | Target |
| `analogs.target.moon` | Luna · Polo Sur | Moon · South Pole |
| `analogs.target.mars` | Marte · Superficie | Mars · Surface |
| `analogs.target.subsurface` | Subsuelo · Tubos de lava | Subsurface · Lava tubes |
| `analogs.presets.label` | Escenarios rápidos | Quick scenarios |
| `analogs.presets.z1` | Z1 · Crestas iluminadas | Z1 · Illuminated ridges |
| `analogs.presets.z2` | Z2 · Mesetas de alunizaje | Z2 · Landing plateaus |
| `analogs.presets.z4` | Z4 · Cráteres en sombra | Z4 · Shadowed craters |
| `analogs.presets.mars` | Marte · Superficie | Mars · Surface |
| `analogs.presets.subsurface` | Subsuelo · Tubos de lava | Subsurface · Lava tubes |
| `analogs.presets.hint` | Un escenario rápido ajusta los pesos por ti. Puedes cambiarlos después. | A quick scenario sets the weights for you. You can change them afterwards. |
| `analogs.weights.title` | Qué importa más | What matters most |
| `analogs.weights.relieve` | Relieve | Relief |
| `analogs.weights.iluminacion` | Iluminación | Illumination |
| `analogs.weights.frio` | Frío | Cold |
| `analogs.weights.hielo` | Hielo y agua | Ice and water |
| `analogs.weights.polvo` | Polvo | Dust |
| `analogs.weights.share` | {name}: {value} del total | {name}: {value} of the total |
| `analogs.weights.reset` | Restablecer pesos | Reset weights |
| `analogs.weights.zero` | Sube al menos un peso para calcular el IFA. | Raise at least one weight to calculate the IFA. |
| `analogs.source.label` | Origen de los datos | Data source |
| `analogs.source.api` | Servidor | Server |
| `analogs.source.backup` | Respaldo | Backup |

### Resultados (A5–A8)

| Clave | ES | EN |
| :--- | :--- | :--- |
| `analogs.list.title` | Mejores análogos (Top {n}) | Best analogs (Top {n}) |
| `analogs.list.empty` | Elige un escenario rápido para ver los mejores análogos. | Choose a quick scenario to see the best analogs. |
| `analogs.list.noMatch` | Ningún sitio cumple este filtro. | No site matches this filter. |
| `analogs.list.showAll` | Mostrar todos los sitios | Show all sites |
| `analogs.list.ifa` | IFA {value} | IFA {value} |
| `analogs.filter.label` | Qué sitios mostrar | Which sites to show |
| `analogs.filter.all` | Todos | All |
| `analogs.filter.discoveries` | Solo descubrimientos | Discoveries only |
| `analogs.badge.discovery` | Descubrimiento | Discovery |
| `analogs.badge.calibration` | Calibración | Calibration |
| `analogs.camera.south` | Ver Polo Sur | View South Pole |
| `analogs.camera.north` | Ver Polo Norte | View North Pole |
| `analogs.camera.centralAmerica` | Ver Centroamérica | View Central America |
| `analogs.mapLabel` | Mapa de sitios análogos | Map of analog sites |

### Ficha (F1–F10)

| Clave | ES | EN |
| :--- | :--- | :--- |
| `analogs.card.back` | Volver al listado | Back to the list |
| `analogs.card.close` | Cerrar ficha | Close site card |
| `analogs.card.radar` | Parecido por dimensión | Similarity by dimension |
| `analogs.card.radarCandidate` | Este sitio | This site |
| `analogs.card.radarTarget` | Objetivo | Target |
| `analogs.card.properties` | 1 · En qué se parece (propiedades) | 1 · How it is similar (properties) |
| `analogs.card.processes` | 2 · Qué fenómenos comparte (procesos) | 2 · Which phenomena it shares (processes) |
| `analogs.card.limits` | 3 · En qué no se parece (límites) | 3 · Where it differs (limits) |
| `analogs.card.uses` | 4 · Qué se puede ensayar aquí | 4 · What can be tested here |
| `analogs.card.subsurface` | Subsuelo | Subsurface |
| `analogs.card.extremophiles` | Vida extremófila | Extremophile life |
| `analogs.card.datasets` | Datos usados | Data used |
| `analogs.card.pending` | Pendiente | Pending |
| `analogs.card.compare` | Comparar con la Luna o Marte | Compare with the Moon or Mars |
| `analogs.card.compareEarth` | Tierra | Earth |
| `analogs.card.comparePlanet` | Luna o Marte | Moon or Mars |
| `analogs.card.compareSlider` | Desliza para comparar las dos imágenes | Slide to compare the two images |
| `analogs.card.partialNote` | Ningún lugar de la Tierra reproduce a la vez la gravedad, el vacío y la radiación. Por eso este sitio es un análogo parcial. | No place on Earth reproduces gravity, vacuum and radiation at the same time. That is why this site is a partial analog. |
| `analogs.card.openExplorer` | Explorar datos de este sitio | Explore data for this site |

### Puente A → B y estados

| Clave | ES | EN |
| :--- | :--- | :--- |
| `explorer.origin.banner` | Mostrando el explorador para: {name}. | Showing the explorer for: {name}. |
| `explorer.origin.back` | Volver a la ficha | Back to the site card |
| `analogs.status.loading` | Cargando sitios... | Loading sites... |
| `analogs.status.backup` | Modo respaldo: usamos datos guardados en la aplicación porque el servidor no respondió. | Backup mode: we are using data saved in the app because the server did not respond. |
| `analogs.status.retry` | Reintentar con el servidor | Retry with the server |
| `analogs.status.mock` | Datos de ejemplo: todavía no son los resultados científicos finales. | Sample data: these are not the final scientific results yet. |
| `analogs.status.invalid` | {n} de {total} sitios no tienen datos completos y no se muestran. | {n} of {total} sites do not have complete data and are not shown. |
| `analogs.status.allInvalid` | Todavía no hay sitios con datos completos para mostrar. Los datos reales se están cargando. | There are no sites with complete data to show yet. The real data is still being loaded. |
| `analogs.errors.load` | No pudimos cargar los sitios. Reintenta o cambia al modo respaldo. | We could not load the sites. Try again or switch to backup mode. |
| `analogs.errors.card` | No pudimos mostrar esta ficha. Vuelve al listado y elige otro sitio. | We could not show this site card. Go back to the list and choose another site. |

> `analogs.status.mock` solo debe mostrarse mientras se use `candidates.mock.json` (solo desarrollo, D8). `PENDIENTE: confirmar con P5/P4 cuándo se pasa a candidates.json real`.
>
> **Aviso de descartes (S2; el adaptador B37 todavía no existe, estas claves son para cuando exista):** `analogs.status.invalid` es **informativo, no un error** (tono `info` del `StatusBanner`, sin culpar y sin pedir acción). `{n}` y `{total}` son enteros formateados por el código (`Intl.NumberFormat`). Se muestra solo si `n > 0` y junto al conmutador de origen de datos (zona A4 de [wireframes.md](wireframes.md)). Si **todos** se descartan se usa `analogs.status.allInvalid`, que dice lo que pasa sin afirmar que haya resultados. **Decidido (PM): la interfaz muestra solo el conteo; el detalle (`_id` y motivo) va a `console.warn` solo en desarrollo (B37), no en un texto de la interfaz.**.
>
> **Términos del glosario:** no hace falta término nuevo; se reutilizan "sitios" y "datos completos". La base de datos y su API no se nombran en los textos de la interfaz.

## 2. Nombres de dimensiones y su explicación (tooltips)

Textos opcionales para que las personas no especialistas entiendan los sliders (clave `analogs.weights.<dim>Help`).

| Dimensión | ES | EN |
| :--- | :--- | :--- |
| `relieveHelp` | Qué tan parecidas son las pendientes y la rugosidad del terreno. | How similar the slopes and the roughness of the terrain are. |
| `iluminacionHelp` | Cuánta luz y sombra recibe el lugar con el Sol bajo. | How much light and shadow the place gets with a low Sun. |
| `frioHelp` | Qué tan frío es el lugar, comparado con el objetivo. | How cold the place is, compared with the target. |
| `hieloHelp` | Si hay hielo o permafrost bajo una capa seca. | Whether there is ice or permafrost under a dry layer. |
| `polvoHelp` | Cuánto polvo fino y viento hay. | How much fine dust and wind there is. |

> Claves completas: `analogs.weights.relieveHelp`, `iluminacionHelp`, `frioHelp`, `hieloHelp` y `polvoHelp`.

## 3. Observaciones para P5

1. **Puntos de integración:** los textos de las fichas largas (`similar_properties`, etc.) llegan del contrato JSON y no se traducen aquí: `PENDIENTE: ¿P3 entregará las fichas en ES y EN o solo en ES? (decide el equipo)`.
2. **Formato de números:** usar `Intl.NumberFormat(lang)` para IFA, pesos y porcentajes; así `0,45` (ES) y `0.45` (EN) no dependen del texto.
3. **Botón de la pantalla "en construcción":** `AnalogsView` usa `app.tabs.explorer` ("Explorador de datos") como etiqueta del botón; es un sustantivo. Sugerencia: una clave nueva `analogs.placeholderAction` = "Ir al Explorador de datos" / "Go to the Data explorer".
4. **Textos del código que no pasan por i18n:** los valores de la leyenda (`Bajo`/`Alto`) sí están en i18n; los números de `stats` y `unit` vienen del servidor sin traducir.
