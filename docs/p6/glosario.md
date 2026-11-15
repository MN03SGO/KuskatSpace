# T3 · Glosario único ES/EN — TerraAnáloga

**Estado:** propuesta P6 para aprobación del PM · **Fecha:** 2026-11-14
Fuentes: plan maestro (§01–§05), plan P5 (§4–§5), código de `frontend/src/`. Si un término no tiene respaldo en el repo, se marca `PENDIENTE`.

**Reglas de uso:** (1) en toda la interfaz, el pitch y el deck se usa **un solo término por concepto** (columna "Usar"); (2) la sigla se mantiene igual en ES y EN; (3) la definición es para público no especialista: máximo 2 frases; (4) los números se escriben según el idioma: **0,45 en ES y 0.45 en EN**. Excepción: el campo BBox siempre usa punto decimal (`-90.1,13.1,…`), porque las comas separan los valores.

## 1. Conceptos del producto

| Usar (ES) | Use (EN) | No usar | Definición breve para el público |
| :--- | :--- | :--- | :--- |
| **análogo** (terrestre) | **analog** (Earth analog) | "sitio gemelo", "réplica" | Lugar de la Tierra que se parece a un lugar de la Luna o de Marte en algo medible. Ninguno lo reproduce todo. |
| **análogo parcial** | **partial analog** | "análogo perfecto" | Sitio que coincide en algunas condiciones (frío, relieve, polvo…) pero no en otras, como la gravedad o la radiación. Es la idea central del proyecto: una cartera de análogos parciales. |
| **IFA** (Índice de Fidelidad Analógica) | **IFA** (Analog Fidelity Index) | "puntaje", "nota" | Número de 0 a 1 que resume cuánto se parece un sitio al objetivo elegido. Se recalcula con los pesos que tú eliges. |
| **dimensión** | **dimension** | "variable" (en el módulo A) | Cada aspecto que se compara: relieve, iluminación, frío, hielo y polvo. |
| **peso** | **weight** | "importancia" | Cuánto cuenta una dimensión en el IFA. Se muestra como porcentaje relativo. |
| **preset** (escenario rápido) | **preset** (quick scenario) | "plantilla" | Combinación de pesos ya preparada para un objetivo (por ejemplo, Luna Z4). |
| **objetivo** | **target** | "destino" | Lugar planetario con el que se compara: Polo Sur lunar, Marte (superficie) o Subsuelo (tubos de lava). |
| **ficha** | **site card** | "tarjeta", "reporte" | Página de detalle de un sitio candidato con su radar, parecidos, límites y usos. |
| **propiedad** (similitud de propiedad) | **property** (property similarity) | — | El sitio coincide en un **valor físico** (pendiente, temperatura…). |
| **proceso** (similitud de proceso) | **process** (process similarity) | — | El sitio coincide en **cómo funciona** un fenómeno (sublimación del hielo, transporte del polvo por el viento…), aunque el valor no sea igual. |
| **propiedad vs. proceso** | **property vs. process** | — | Distinción clave de la ficha: parecerse en un número no es lo mismo que parecerse en el fenómeno. |
| **límites** (diferencias y límites) | **limits** (differences and limits) | "defectos", "fallos" | Lo que el sitio terrestre **no** reproduce (gravedad, presión, radiación). Siempre visible en la ficha. |
| **uso en exploración** | **exploration use** | — | Qué tecnología o protocolo se puede ensayar en ese sitio (ISRU, trajes EVA, rovers…). |
| **descubrimiento** | **discovery** | "sitio nuevo" | Sitio poco estudiado que los datos abiertos destacan, más allá de los clásicos. Valor del contrato: `understudied_discovery`. |
| **calibración** | **calibration site** | "sitio clásico" (en la interfaz) | Sitio muy conocido (por ejemplo, Valles Secos de McMurdo o Devon Island) que sirve solo para comprobar que el método funciona. |
| **cartera de análogos** | **analog portfolio** | — | Conjunto de sitios que, juntos, cubren varias condiciones que ninguno cubre solo. |
| **modo respaldo** | **backup mode** | "modo offline", "modo estático" | La app usa datos guardados (`candidates.json`) cuando el servidor no responde. |
| **servidor de datos** | **data server** | "backend" (en textos al público) | Programa que responde a las búsquedas y al procesamiento. |

## 2. Geografía y datos

| Usar (ES) | Use (EN) | Definición breve para el público |
| :--- | :--- | :--- |
| **BBox** (caja de coordenadas) | **BBox** (coordinate box) | Rectángulo que delimita una zona con cuatro números: longitud y latitud mínimas y máximas. |
| **escena** | **scene** | Una imagen o producto de satélite devuelto por una búsqueda. |
| **datos simulados de demostración** (muestra de demostración) | **simulated demo data** (demo sample) | Archivos **generados por el equipo** (`backend/prepare_samples.py`, con NumPy) que usa el procesamiento. **No son mediciones de ninguna misión** (tampoco el perfil "tipo Diviner") **ni datos del BBox**: la imagen solo se coloca sobre él. Debe decirse siempre así en la interfaz, el pitch y el video. |
| **búsqueda federada** | **federated search** | Una sola búsqueda que consulta varios catálogos de agencias a la vez. |
| **procesamiento** | **processing** | Cálculo que convierte una muestra en una imagen coloreada con estadísticas. |
| **GeoTIFF** | **GeoTIFF** | Archivo de imagen con coordenadas, para abrir en programas de mapas. |
| **superposición** | **overlay** | Imagen procesada que se dibuja sobre el globo o el mapa. |
| **resolución homóloga** | **matched resolution** | Llevar los datos de la Tierra y del otro cuerpo a una escala comparable antes de compararlos (~240 m, plan maestro §4.1). |
| **globo 3D / mapa 2D** | **3D globe / 2D map** | Las dos vistas del explorador. |

## 3. Cuerpos, zonas y términos científicos

| Usar (ES) | Use (EN) | Definición breve para el público |
| :--- | :--- | :--- |
| **PSR** (cráter en sombra permanente) | **PSR** (permanently shadowed region) | Cráter lunar donde el Sol nunca llega; es tan frío que puede conservar hielo. |
| **Z1 · Crestas iluminadas** | **Z1 · Illuminated ridges** | Zona lunar con mucha luz solar: útil para energía y hábitat. |
| **Z2 · Mesetas de alunizaje** | **Z2 · Landing plateaus** | Zona lunar llana, para alunizar e instalar infraestructura. |
| **Z3 · Laderas de transición** | **Z3 · Transition slopes** | Zona intermedia entre las crestas y los cráteres. |
| **Z4 · Cráteres en sombra permanente** | **Z4 · Permanently shadowed craters** | Zonas frías con posible hielo, para extraer recursos (ISRU). |
| **tubo de lava** | **lava tube** | Cueva larga que dejó un flujo de lava; puede servir de refugio. |
| **subsuelo** | **subsurface** | Lo que hay bajo la superficie: cuevas, hielo, rocas. |
| **extremófilo** | **extremophile** | Microorganismo que vive en condiciones extremas; sirve para estudiar la vida posible en otros mundos. |
| **permafrost** | **permafrost** | Suelo que permanece helado todo el año. |
| **regolito** | **regolith** | Capa de polvo y fragmentos de roca que cubre la superficie. |
| **ISRU** | **ISRU** (in-situ resource utilization) | Usar los recursos del lugar (como el hielo) en vez de llevarlos desde la Tierra. |
| **EVA** | **EVA** (extravehicular activity) | Salida al exterior con traje espacial. |
| **K** (kelvin) | **K** (kelvin) | Unidad de temperatura. 0 K es el frío absoluto; el hielo se funde a 273 K. |
| **NDVI** | **NDVI** | Índice que indica cuánta vegetación hay. |
| **NDWI** | **NDWI** | Índice que indica cuánta agua hay. |
| **SAR** | **SAR** | Radar de satélite que forma imágenes de la superficie de día y de noche, con nubes o sin ellas. |
| **dB** | **dB** | Decibelios: unidad en la que se expresa la señal del radar. |
| **capa global** | **global layer** | Variable (temperatura, humedad o precipitación) pintada sobre toda la superficie visible del globo o del mapa. En la Tierra viene de un satélite; en la Luna y Marte es un modelo. Se enciende con los botones "Mostrar …". |
| **modelo térmico aproximado** | **approximate thermal model** | Cálculo sencillo de la temperatura a partir de la posición del Sol. **No es una medición ni un dato de satélite**; ignora el relieve y la inercia térmica. Se usa solo para la Luna y Marte. |
| **punto subsolar** | **subsolar point** | Lugar de la superficie donde el Sol está justo encima. El modelo lo usa para saber qué lado es de día. |
| **escala logarítmica** | **logarithmic scale** | Escala de color en la que cada paso multiplica el valor (en vez de sumarlo); permite ver a la vez lluvia débil y lluvia fuerte. |
| **AIRS / IMERG** | **AIRS / IMERG** | AIRS: instrumento del satélite Aqua (NASA) que mide temperatura y humedad. IMERG: producto de la misión GPM (NASA y JAXA) que estima la precipitación. Ambos llegan por NASA GIBS. |
| **"Mostrar" frente a "Procesar"** | **"Show" vs. "Process"** | "Mostrar …" enciende una capa global (satélite o modelo). "Procesar / Calcular …" lanza el procesamiento con datos simulados. No mezclar los dos verbos. |

## 4. Fuentes de datos (nombres propios: no se traducen)

| Nombre | Agencia | Qué es, en una frase |
| :--- | :--- | :--- |
| **LRO / Diviner** | NASA | Satélite lunar; Diviner mide las temperaturas de la superficie. |
| **LOLA, LEND, Mini-RF, LROC** | NASA | Instrumentos de LRO: altimetría, neutrones (hidrógeno), radar e imágenes. |
| **PDS** (Planetary Data System) | NASA | Archivo oficial de datos de misiones planetarias. |
| **MOLA, TES, THEMIS** | NASA | Instrumentos de Marte: topografía, térmica y mineralogía. |
| **GIBS / Worldview** | NASA | Servicio de mapas de satélite de la Tierra casi en tiempo real. |
| **Earthdata CMR** | NASA | Catálogo de datos de observación de la Tierra. |
| **Trek (Moon/Mars Trek)** | NASA | Portal de mapas de la Luna y Marte. |
| **Copernicus / CDSE / STAC** | ESA | Datos de observación de la Tierra (Sentinel-1, Sentinel-2) y su catálogo. |
| **Open Science Catalog** | ESA | Productos abiertos de permafrost y criósfera. |
| **G-Portal** | JAXA | Portal de datos de JAXA (precipitación, nieve, vegetación). |
| **RADARSAT-1, RCM** | CSA | Radares canadienses (archivo abierto y constelación actual). |

## 5. Mensajes de interfaz: estilo

- **Botones:** empiezan con verbo en infinitivo (ES) o en imperativo (EN): "Buscar escenas en vivo", "Descargar resultado", "Search live scenes". Nunca "OK", "Enviar" ni "Proceder".
- **Errores:** dicen qué pasó, no culpan a la persona y ofrecen una salida ("Inténtalo de nuevo…", "Prueba con otras fechas…").
- **Tono:** claro, directo y cercano; tuteo en ES; sin signos de exclamación; sin jerga técnica sin explicar ("servidor de datos", no "backend").
- **Honestidad:** nunca decir que el procesamiento usa datos reales del BBox ni que el buscador de análogos ya funciona. Mientras sea cierto: "datos simulados de demostración" y "estamos construyendo".
- **Cifras:** coma decimal en ES (0,45) y punto en EN (0.45); espacio antes de `%` en ES ("45 %"), sin espacio en EN ("45%"); unidades con espacio ("175 K").
