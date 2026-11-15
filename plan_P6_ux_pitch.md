# P6 — UI/UX, textos, coordinación y pitch: plan de tareas delegadas

**Asignado a:** orquestador `nasa-space-7f` (sesión de Claude)
**Arquitecto/PM y revisor:** sesión principal del frontend (P5)
**Rama:** `Frontend/WebGIS` · **Fecha:** 2026-11-14
**Contexto obligatorio antes de empezar:** [plan maestro](plan_maestro_terraan_loga_v2_0_hackathon_24h.md), [plan P5](plan_P5_frontend_webgis.md) (secciones 1, 5, 8 y 9) y [frontend/README.md](frontend/README.md).

Las tareas de P6 (UI/UX, textos bilingües, control de tiempos, guion de video, deck y registro de IA) pasan al equipo frontend. Este documento define qué entregar, dónde, con qué criterio se acepta y en qué orden.

---

## 1. Reglas de trabajo (no negociables)

1. **Solo se escribe en `docs/p6/`**, salvo T3 (que también toca `frontend/src/i18n/es.json` y `en.json`) y T2 en su fase de aplicación (solo el bloque `@theme` de `frontend/src/index.css`, y únicamente después de que el PM apruebe la propuesta).
2. **No tocar** nada más de `frontend/src/`, ni `backend/`, `package.json`, `pnpm-lock.yaml`, los planes ni `.claude/`. El árbol tiene trabajo **sin commitear** de P5.
3. **No hacer commit, push, merge ni cambiar de rama.** El PM revisa e integra.
4. **No inventar datos.** Nada de puntuaciones IFA, candidatos, métricas ni resultados de usuarios que no existan. Si falta un dato, se escribe `PENDIENTE: <qué falta y quién lo da>`.
5. **Honestidad del producto:** el pitch y el video no pueden decir que el procesamiento usa datos reales del bbox (usa muestras de demostración, B12) ni que el módulo A ya funciona (está en construcción).
6. Idioma de trabajo: español. Los textos de la interfaz, en ES y EN.
7. Al terminar cada tarea, **reportar al PM**: archivos creados o modificados, una autoevaluación contra los criterios de aceptación y las dudas abiertas.

---

## 2. Tareas, entregables y criterios de aceptación

Orden de ejecución: **T1 → T3 → T2 → T4 → T5 → T6 → T7 → T8**. T1 y T3 son las prioritarias porque desbloquean a P5.

### T1 · Wireframes de los módulos A y B — *prioridad alta*
**Entregable:** `docs/p6/wireframes.md`
- Pantallas: módulo A (inicio: selector de objetivo, presets, sliders, Top N, ficha con radar y comparador), módulo B (como está hoy: panel + globo 3D / mapa 2D), puente A → B, estados vacío, de carga y de error, y versión móvil (375 px).
- Formato: bloques ASCII o Mermaid con anotaciones numeradas (qué hace cada zona, qué dato muestra y de qué campo del contrato JSON sale).

**Se acepta si:**
- Cubre todas las secciones de la ficha que exige el contrato del plan maestro: `similar_properties`, `similar_processes`, `differences_and_limits`, `exploration_use_cases`, `subsurface_and_biology` y `datasets_used`.
- Respeta el orden de lectura propiedad → proceso → límites → usos.
- El módulo B coincide con lo implementado (revisar `frontend/src/modules/explorer/`).
- Indica el comportamiento en 375 px y en 1280 px.

### T2 · Paleta, tipografía y espaciado — *prioridad alta*
**Entregable:** `docs/p6/design-tokens.md` (propuesta). Solo tras la aprobación del PM: aplicar los valores al bloque `@theme` de `frontend/src/index.css`, **manteniendo los nombres de los tokens** (`canvas`, `surface`, `raised`, `line`, `ink`, `ink-muted`, `accent`, `info`, `ok`, `warn`, `danger`).
- Distribución 60-30-10, escala tipográfica (máximo 2 pesos), escala de espaciado de 4/8 px.

**Se acepta si:**
- Cada combinación texto/fondo que se usa en la interfaz tiene su **relación de contraste calculada** (≥ 4,5:1 para texto normal y ≥ 3:1 para texto grande y bordes de foco), en una tabla.
- Funciona sobre fondo oscuro (el globo y el espacio).
- No usa glassmorphism, degradados arcoíris ni efectos decorativos.

### T3 · Textos finales ES/EN y glosario — *prioridad alta*
**Entregables:** `docs/p6/glosario.md` y la revisión de `frontend/src/i18n/es.json` y `en.json`.
- Glosario único: IFA, análogo, PSR, propiedad vs proceso, bbox, muestra de demostración, etc., con su traducción y una definición breve para el público.
- Revisar tono, coherencia y claridad de **todas** las claves existentes. Los botones empiezan con verbo; no se usan "OK", "Enviar" ni "Proceder". Los errores no culpan al usuario y ofrecen una salida.
- Proponer en `docs/p6/textos-modulo-a.md` (todavía no en el JSON) las claves y los textos del módulo A.

**Se acepta si:**
- `es.json` y `en.json` tienen **exactamente las mismas claves**, se conservan todos los marcadores `{variable}` y no se renombra ni elimina ninguna clave (el código depende de ellas).
- Pasa `pnpm test` desde `frontend/`. La prueba `i18n.test.ts` comprueba que ambos idiomas tengan las mismas claves. Node está en `C:\Program Files\nodejs` y pnpm en `%APPDATA%\npm`; hay que anteponerlos al PATH.
- Se actualiza el campo `_status` de ambos archivos para indicar que es la versión revisada.

### T4 · Cronograma y check-ins — *prioridad media*
**Entregable:** `docs/p6/cronograma-checkins.md`
- Franjas H0–H24 del plan maestro con un responsable por rol, checkpoints (H4, H8, **H12**, H16, H20 congelamiento, H23 envío) y una plantilla de check-in de 2 minutos (hecho / siguiente / bloqueos).
- Estado real del frontend hoy, tomado de las casillas del plan P5 (sección 7).

**Se acepta si** cada checkpoint tiene un criterio verificable (no "avanzar en X") y se marcan explícitamente las dependencias entre roles (P1/P2 → P3 → P4 → P5).

### T5 · Guion del video (≤ 30 s) — *prioridad media*
**Entregable:** `docs/p6/guion-video.md`
- Tabla de planos: segundo inicial y final, qué se ve en pantalla, voz en off ES y EN, y texto en pantalla.
- Basado en el guion de demo de la sección 9.3 del plan P5, usando **solo funciones que existen** (globo de 3 cuerpos, búsqueda federada, procesamiento, descarga). Lo que todavía no existe se marca como `PENDIENTE (Fase 2)`.

**Se acepta si** dura ≤ 30 s en total, cada plano dura ≥ 2 s, la voz en off cabe en el tiempo (unas 2,5 palabras por segundo) y respeta la regla 5.

### T6 · Deck de 7 diapositivas (contenido) — *prioridad media*
**Entregable:** `docs/p6/deck-contenido.md`. Por diapositiva: título, 3 viñetas como máximo, visual sugerido y notas del orador.
- Estructura sugerida: problema/tesis → solución → datos de agencias → método (IFA, propiedad vs proceso) → demo → límites y honestidad científica → equipo y próximos pasos.

**Se acepta si:**
- Cada afirmación técnica tiene su fuente en el repo (archivo y sección).
- Menciona las 4 agencias con los datasets reales que se usan.
- Incluye la tesis central del plan maestro.
- Cumple la regla 5.

### T7 · Registro de uso de IA — *prioridad media*
**Entregable:** `docs/p6/registro-ia.md`
- Plantilla: fecha y hora, herramienta o modelo, quién la usó, para qué, qué se aceptó y qué se revisó a mano.
- Entradas ya conocidas: el trabajo de las sesiones de Claude en este repo (planes P5/P6, merge, refactor, globo 3D, instalación del entorno). Usar el historial de git y los propios planes como fuente.

**Se acepta si** no incluye datos personales (correos ni nombres completos más allá de los alias del README) y distingue lo generado por IA de lo revisado por personas.

### T8 · Protocolo de prueba de usabilidad — *prioridad baja*
**Entregable:** `docs/p6/prueba-usabilidad.md`
- Basado en la sección 9.4 del plan P5: guion para el moderador, las 4 tareas, métricas (completada sí/no, tiempo, errores y dudas), hoja de registro vacía y criterio de éxito (≥ 80 %).

**Se acepta si** se puede ejecutar con 3 personas en 20 minutos sin preparación adicional. **No se simulan resultados.**

---

## 3. Cómo evaluará el PM

| Criterio | Peso | Qué se mira |
| :--- | :--- | :--- |
| Cumple los criterios de aceptación | 40 % | Cada punto del apartado de la tarea |
| Fidelidad al repo | 25 % | Ninguna afirmación sin respaldo; coincide con el código y los planes |
| Calidad UX y del texto | 20 % | Claridad, coherencia, accesibilidad, verbos en botones, tono |
| Respeto de las reglas | 15 % | Sin archivos fuera de su alcance, sin commits, sin datos inventados |

Resultado por tarea: **Aceptada**, **Aceptada con cambios menores** (el PM los aplica) o **Rechazada** (se devuelve con observaciones concretas). Una infracción de las reglas 2, 3 o 4 rechaza la tarea automáticamente.

## 4. Seguimiento

| Tarea | Estado | Evaluación del PM |
| :--- | :--- | :--- |
| T1 Wireframes | **Aceptada con cambios menores** (2026-11-14) | Nota ≈ 92/100. Cumple todos los criterios, coincide con el código y no inventa datos. Cambios aplicados por el PM: contador de carga realista, presets filtrados por objetivo, peso relativo en % en lugar de "suma = 1", formato numérico según idioma y visor del módulo A al 45 % en móvil. U1–U6 pasan al backlog de P5 (B20–B25). |
| T2 Design tokens | **Aceptada con una decisión del PM** (2026-11-14) | Nota ≈ 95/100. 42 combinaciones con su contraste; el PM recalculó 13 y todas coinciden. Diagnóstico excelente de lo que no se resuelve con tokens. **Aprobado:** `ink-muted` → `#a3b1c6`. **Rechazado:** `accent` → `#1d4ed8`; se mantiene `#2563eb` (3,45:1 frente a `surface` y 4,94:1 con `ink`), y el foco interior sobre `accent` se resuelve con `outline-ink` (4,94:1), que entra en el backlog (B27). Las secciones 3.3 a–e, 4.2 y 5.2 pasan al backlog de P5 como B27–B31. Aplicación del `@theme`: autorizada solo para `ink-muted`. |
| T3 Textos ES/EN + glosario | **Aceptada con cambios menores** (2026-11-14) | Nota ≈ 90/100. Mismas claves y marcadores en ES y EN; `pnpm test` 35/35 (verificado por el PM). Verbos en los botones, errores con salida y textos honestos sobre muestras y módulo A. Glosario sólido con fuentes del repo. Cambios del PM: botón Diviner → "Mostrar temperatura (LRO Diviner)"; nueva clave `analogs.placeholderAction`, ya conectada en `AnalogsView`. Se acepta el separador "·". El formato de números según idioma pasa al backlog de P5 (B26). |
| T4 Cronograma y check-ins | **Aceptada** (2026-11-14) | Nota ≈ 93/100. Checkpoints con criterio verificable, responsable y contingencia; cadena de dependencias con hora límite; estado real con su respaldo; no inventa la hora de H0. El PM actualizó la fila de T2 (desactualizada) y marcó el globo y las 35 pruebas en el plan P5. |
| T5 Guion de video | **Aceptada con cambios** (2026-11-14) | Nota ≈ 88/100. 30 s, voz contada, regla 5 revisada afirmación por afirmación, buena corrección "en vivo = NASA/ESA". Cambios pedidos: (1) plano 4 → Diviner en la Luna con el panel "Polo lunar vs. Tierra"; (2) voz del plano 3 con la redacción segura (CMR devuelve 0 resultados, comprobado); (3) redacción del plano 1. Los aplica el subagente. |
| T5 v2 | **Aceptada** (2026-11-14) | Aplicó los 3 cambios (Diviner, voz segura del plano 3 y plano 1); 30 s; 57/50 palabras. Pendiente: sincronizar los textos en pantalla con la interfaz actualizada (S1). |
| T6 Deck | **Aceptada con cambios** (2026-11-14) | Nota ≈ 92/100. 7 diapositivas con fuentes por afirmación y 4 agencias diferenciadas por nivel de uso (en vivo, textura, catálogo, planificado). **Hallazgo crítico:** las muestras de `sample_data` son sintéticas (lo comprobó el PM en `prepare_samples.py`); el PM corrigió la interfaz y el glosario. Pendiente (S1): la diap. 5 debe decir "en vivo" solo de ESA y los rótulos deben coincidir con la interfaz nueva. |
| T7 Registro de IA | **Aceptada con cambios** (2026-11-14) | Nota ≈ 90/100. Sin datos personales; separa la revisión de IA de la humana; borrador de declaración ES/EN. Pendiente (S1): modelo de la sesión 2.1 = Claude Opus 5.5 y una entrada por la corrección de honestidad. La revisión humana sigue PENDIENTE (la hace el usuario). |
| T8 Prueba de usabilidad | **Aceptada con cambios** (2026-11-14) | Nota ≈ 92/100. Protocolo ejecutable, sin resultados simulados y con tareas de respaldo R1–R3 ejecutables hoy. Se acepta la interpretación de 3 sesiones de ~6 min. Pendiente (S1): la respuesta esperada de R2 debe citar el texto nuevo ("Datos simulados de demostración"). |
| S2 Sincronización con la API de Mongo (`c3e2be9`) | **Aceptada** (2026-11-14) | Cronograma (dependencias, H8 exige datos que cumplan el contrato §05, estado real), deck (diap. 3, 5 y 7, sin decir que el buscador funciona), wireframes (A4 y estado de descartes) y claves `analogs.status.invalid/allInvalid` propuestas. Decisión del PM: la interfaz muestra solo el conteo de descartes y el detalle va a `console.warn` en desarrollo. |
| S1 Sincronización final | **Aceptada** (2026-11-14) | Textos alineados en guion, deck, registro, usabilidad y glosario; notas de vigencia en wireframes y design-tokens. El PM verificó con grep que no quedan textos antiguos (salvo los históricos marcados como RESUELTA) y resolvió el cliente de la sesión 2.1 (Claude Code en la app de escritorio). **Bloque P6 cerrado por el subagente.** Pendiente del equipo: revisión humana de `docs/p6/`, hora de H0, fecha de `candidates.json` y declaración de IA de P1–P4. |
