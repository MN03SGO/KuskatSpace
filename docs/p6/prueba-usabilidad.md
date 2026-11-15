# T8 · Protocolo de prueba de usabilidad

**Estado:** protocolo listo para usar, para revisión del PM · **Fecha:** 2026-11-14
Base: `plan_P5_frontend_webgis.md` §9.4 (4 tareas) y §9.1 (criterio de usabilidad ≥ 80 %). **No se simulan resultados:** las hojas de registro están vacías hasta que se haga la prueba con personas reales ajenas al equipo (entrega H14, plan P5 §7, Fase 4).

**Cómo cabe en 20 minutos con 3 personas:** cada sesión dura **≤ 6 minutos** (1 de bienvenida + 4 tareas con tope de 90 s cada una, pero normalmente menos + 1 de preguntas finales). Tres sesiones seguidas = **≈ 18–20 minutos**. Sin preparación adicional: basta este documento impreso o abierto, un cronómetro (el del teléfono) y la app abierta en la URL de Vercel (o `pnpm preview` local).

> ### ⚠ Qué se puede probar hoy y qué no
> Las tareas 1–3 usan el **módulo A (buscador de análogos), que todavía no existe** (`AnalogsView.tsx` es un marcador de posición). Hoy solo se puede ejecutar la **tarea 4** y las **tareas de respaldo R1–R3** (módulo B). Cuando el módulo A esté listo (`PENDIENTE (Fase 2)` — P5), se ejecutan las 4 tareas originales. **No se debe presentar a una persona el marcador de posición como si fuera el buscador.**

---

## 1. Antes de empezar (2 minutos, una sola vez)

| Qué | Cómo se comprueba |
| :--- | :--- |
| App abierta en la URL de pruebas, idioma ES, pestaña de inicio | Se ve el título "TerraAnáloga" |
| Backend encendido (para la tarea 4 y R1–R3) | Al pulsar "Buscar escenas en vivo" aparecen resultados o el aviso de la sección "Sin resultados…" (si sale un error de conexión, arrancar el backend) |
| Pantalla a 1280 px (o el móvil, si se prueba a 375 px) | — |
| Cronómetro, bolígrafo y 3 copias de la **hoja de registro** (sección 5) | — |
| Participantes: **3 personas ajenas al equipo** que no hayan visto la app | Anotar solo "Persona A, B, C" y su perfil general (p. ej. "estudiante", "ingeniera"); **sin nombres ni correos** |
| Moderador (observa y anota) y, si hay otra persona, observador | — |

---

## 2. Guion del moderador (≈ 1 minuto por persona)

**Texto de bienvenida (leer tal cual):**

> "Gracias por ayudarnos. Estamos probando una aplicación, **no te estamos probando a ti**: si algo te confunde, es culpa de la aplicación y eso nos sirve. Te voy a pedir que hagas cuatro tareas. Mientras las haces, **piensa en voz alta**: dime qué buscas y qué esperas que pase. **No te voy a ayudar**, y si en algún momento quieres parar una tarea, dilo y pasamos a la siguiente. Anotaré tiempos y dudas; no se grabará tu voz ni tu imagen y tu nombre no aparece en ningún registro."

**Reglas del moderador:**
1. **No ayudar, no señalar, no explicar.** Si pregunta "¿es por aquí?", responder: "¿Qué te parece a ti?".
2. Iniciar el cronómetro cuando termine de leer la tarea y pararlo cuando la persona **diga que terminó** o se alcance el tope de 90 s.
3. Anotar **lo que hace y lo que dice** (dudas, errores, frases literales), no lo que el moderador cree.
4. Si una tarea no se puede completar por un fallo técnico (p. ej. el backend no responde), anotar "fallo técnico" y **no** contarla como error de la persona; repetirla cuando se arregle.
5. Entre tareas, volver a la pantalla de inicio sin comentar.

---

## 3. Las tareas

### 3.1 Tareas originales (plan P5 §9.4)

| # | Texto que se lee a la persona (no cambiarlo) | Módulo | Se considera **completada** si… | Disponible hoy |
| :-: | :--- | :-: | :--- | :-: |
| 1 | "Encuentra el mejor análogo terrestre para extraer hielo en el Polo Sur lunar." | A | Elige el escenario de la Luna para hielo en cráteres en sombra (Z4) y abre la ficha del sitio que queda **primero** en la lista | No (módulo A) |
| 2 | "Explica por qué ese sitio *no* es un análogo perfecto." | A | Lee en la ficha la sección **"Diferencias y límites"** y menciona con sus palabras **al menos una** (p. ej. gravedad, presión o radiación) | No (módulo A) |
| 3 | "Compara visualmente ese sitio con la Luna." | A | Abre el **comparador** y mueve el deslizador entre las dos imágenes | No (módulo A) |
| 4 | "Descarga los datos procesados de una zona de Centroamérica." | B | Elige el cuerpo Tierra, ubica una zona (clic en el globo o BBox), **procesa** una imagen y **pulsa "Descargar resultado GeoTIFF"** | **Sí** |

> `PENDIENTE: criterio exacto de "mejor análogo" de la tarea 1` — depende de `candidates.json` real y de los pesos de los presets (P3/P4). Hasta entonces no se puede definir cuál es "el primero".

### 3.2 Tareas de respaldo del módulo B (ejecutables hoy)

Se usan **solo si el módulo A no está listo** el día de la prueba, **además** de la tarea 4. Están hechas con las funciones que existen (búsqueda, procesamiento, idioma).

| # | Texto que se lee a la persona | Se considera **completada** si… |
| :-: | :--- | :--- |
| R1 | "Busca imágenes de satélite de la Tierra en esa zona y dime de qué agencias salen." | Pulsa "Buscar escenas en vivo", aparece la lista, y nombra **al menos una** agencia o fuente de los grupos que ve |
| R2 | "Procesa una imagen y dime: ¿esto son datos reales de esta zona?" | Procesa una imagen y responde que **no** (son datos simulados), citando o señalando el aviso ámbar **"Datos simulados de demostración"** (EN: *Simulated demo data*). Si responde "sí", se anota como **hallazgo de honestidad** (prioridad alta) |
| R3 | "Cambia la aplicación a inglés." | Usa el selector **ES / EN** y la interfaz cambia de idioma |

---

## 4. Qué se mide y cómo se anota

| Métrica | Cómo se mide | Cómo se anota |
| :--- | :--- | :--- |
| **Completada** | Cumple el criterio de la tarea **sin ayuda** | **Sí** / **No** / **Fallo técnico** |
| **Tiempo** | Cronómetro de lectura de la tarea hasta "terminé" (tope 90 s) | Segundos (si llega al tope: "90 (tope)") |
| **Errores** | Cada vez que pulsa algo que no lleva a la meta o se equivoca de pantalla | Número y una frase por error |
| **Dudas** | Frases de la persona: "no sé si…", "¿esto qué es?", silencios largos (> 10 s) | Frase literal y dónde ocurrió |
| **Cierre** | Después de la tarea 4 (o R3), tres preguntas rápidas (sección 5, abajo de la hoja) | Respuesta literal |

### Criterio de éxito

- **Éxito de la prueba:** **≥ 80 % de las tareas completadas sin ayuda**, sumando los intentos de las 3 personas. Los intentos con "Fallo técnico" no cuentan. Ejemplo: 3 personas × 4 tareas = 12 intentos → **≥ 10 completados**.
- **Alerta aparte:** cualquier persona que crea que el procesamiento usa **datos reales del BBox** (R2) es un hallazgo de **prioridad alta**, aunque el 80 % se cumpla.

### Prioridad de los hallazgos

| Prioridad | Cuándo | Qué pasa |
| :--- | :--- | :--- |
| **Alta** | Impide completar una tarea, o confunde sobre la **honestidad** de los datos, o ≥ 2 de 3 personas fallan igual | Se corrige antes de H20 (P5) |
| **Media** | Hace dudar o tardar (> 60 s) a ≥ 2 personas pero la tarea se completa | Se corrige si hay tiempo |
| **Baja** | Duda aislada, preferencia o detalle estético | Se anota |

Resultado de la prueba (entrega H14): **lista de hallazgos priorizada** (tabla de la sección 6) enviada a P5 y al PM.

---

## 5. Hoja de registro (una por persona; **vacía**)

**Persona:** ☐ A ☐ B ☐ C · **Perfil general:** __________ · **Idioma de la prueba:** ☐ ES ☐ EN · **Dispositivo:** ☐ escritorio ☐ móvil · **Fecha y hora:** __________ · **Moderador:** ______

| Tarea | ¿Completada? (Sí / No / Fallo técnico) | Tiempo (s) | Errores (nº y descripción) | Dudas (frases literales) |
| :--- | :-: | :-: | :--- | :--- |
| 1 · Mejor análogo para extraer hielo | | | | |
| 2 · Por qué no es perfecto | | | | |
| 3 · Comparar con la Luna | | | | |
| 4 · Descargar datos de Centroamérica | | | | |
| R1 · Buscar imágenes y agencias | | | | |
| R2 · ¿Son datos reales? | | | | |
| R3 · Cambiar a inglés | | | | |

**Preguntas de cierre (anotar la respuesta literal):**
1. En una escala de 1 (muy difícil) a 5 (muy fácil), ¿qué tan fácil te pareció? ____
2. ¿Qué fue lo que más te confundió? ____________________
3. Con tus palabras, ¿para qué sirve esta aplicación? ____________________

**Observaciones del moderador:** ____________________________________________

---

## 6. Hoja de resumen (rellenar al terminar las 3 sesiones; **vacía**)

| Tarea | Completada A | B | C | Total completadas / intentos | % |
| :--- | :-: | :-: | :-: | :-: | :-: |
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| R1 | | | | | |
| R2 | | | | | |
| R3 | | | | | |
| **Total** | | | | | **≥ 80 %: ☐ Sí ☐ No** |

**Hallazgos priorizados:**

| # | Prioridad (Alta/Media/Baja) | Qué pasó (con la frase literal) | Cuántas personas | Dónde (pantalla/clave) | Responsable | Corregido |
| :-: | :-: | :--- | :-: | :--- | :-: | :-: |
| | | | | | | |

---

## 7. Notas para la versión en inglés

El texto de bienvenida y las tareas se leen en el idioma de la persona. Versión EN de las tareas: (1) "Find the best Earth analog for extracting ice at the Moon's south pole." (2) "Explain why that site is *not* a perfect analog." (3) "Visually compare that site with the Moon." (4) "Download the processed data for an area in Central America." R1 "Search for satellite images of Earth in that area and tell me which agencies they come from." R2 "Process an image and tell me: is this real data for this area?" R3 "Switch the app to Spanish."

---

## 8. Autoevaluación contra los criterios de aceptación de T8

| Criterio | Cumple | Dónde |
| :--- | :--- | :--- |
| Basado en la sección 9.4 del plan P5 | Sí: las 4 tareas con el mismo texto | §3.1 |
| Guion para el moderador | Sí | §2 |
| Las 4 tareas | Sí, con criterio observable de "completada" | §3.1 |
| Métricas (completada sí/no, tiempo, errores y dudas) | Sí | §4 |
| Hoja de registro vacía | Sí | §5, §6 |
| Criterio de éxito (≥ 80 %) | Sí | §4 |
| Ejecutable con 3 personas en 20 minutos sin preparación adicional | Sí: 3 sesiones de ≈ 6 min; lista de verificación de 2 minutos | cabecera, §1 |
| **No se simulan resultados** | Sí: todas las hojas están vacías | §5, §6 |

### Dudas abiertas
1. **Interpretación de "3 personas en 20 minutos":** lo entendí como 3 sesiones seguidas de ≈ 6 min. Si el PM se refería a 20 minutos **por persona**, se pueden añadir tareas (hay margen).
2. **`PENDIENTE (P3/P4):`** criterio de "mejor análogo" (tarea 1) y datos reales de candidatos.
3. **`PENDIENTE (P5):`** que el módulo A exista antes de H14; si no, la prueba solo cubre la tarea 4 y R1–R3, y el resultado de 80 % **no** valida el buscador. Debe decirse así en el informe.
4. **`PENDIENTE (equipo):`** quiénes son las 3 personas ajenas y quién modera.
