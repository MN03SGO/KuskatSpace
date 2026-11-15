# T7 · Registro de uso de IA — TerraAnáloga

**Estado:** plantilla + entradas conocidas, para revisión del PM · **Fecha de corte:** 2026-11-14
**Fuentes de las entradas:** historial de git (`git log`), `plan_P5_frontend_webgis.md`, `plan_P6_ux_pitch.md` y el trabajo de esta sesión. **No se incluyen correos ni nombres completos**: solo los alias del README (P1 Jorge · P2 Ansorje · P3 Abel · P4 Anthony · P5 Amiguito · P6 Paola) y los identificadores de las sesiones de Claude.

**Regla de este registro:** una entrada solo dice lo que se puede respaldar. Lo que no consta se marca `PENDIENTE: <qué falta y quién lo confirma>`. **Lo generado por IA y lo revisado por personas se anotan por separado**: que una sesión de Claude evalúe a otra **no cuenta como revisión humana**.

---

## 1. Plantilla (copiar una fila por cada uso de IA)

| Campo | Qué se escribe |
| :--- | :--- |
| **Fecha y hora** | `AAAA-MM-DD HH:MM` (zona horaria del equipo) |
| **Herramienta / modelo** | Nombre y versión (p. ej. "Claude Code, Sonnet 5.5"). Si no se sabe: `PENDIENTE` |
| **Quién la usó** | Alias del README (P1–P6) o "sesión X" |
| **Para qué** | Una frase: qué se le pidió |
| **Qué se aceptó** | Qué parte del resultado entró al repo o a un entregable, y dónde (archivo o commit) |
| **Qué se revisó a mano** | Qué comprobó una **persona** (no otra IA) y cómo: prueba, lectura, ejecución |
| **Qué se rechazó o corrigió** | Cambios que la persona hizo sobre el resultado de la IA |

```
FECHA/HORA:
HERRAMIENTA/MODELO:
QUIÉN:
PARA QUÉ:
ACEPTADO (archivo/commit):
REVISADO A MANO (por quién y cómo):
RECHAZADO O CORREGIDO:
```

**Cuándo anotar:** en cuanto se usa la IA en algo que llega al repo, a los datos, a los textos o al pitch. P5 aporta sus entradas (plan P5 §1; plan maestro, H20–H23).

---

## 2. Entradas conocidas (14-nov-2026)

### 2.1 Sesión de Claude del frontend (arquitecto/PM de P5 y P6)

| Campo | Valor |
| :--- | :--- |
| **Sesión** | Sesión "Leer todos los archivos" (Claude Desktop, en la laptop) |
| **Herramienta / modelo** | Claude Opus 5.5 (`claude-opus-5-5`), en Claude Code dentro de la aplicación de escritorio de Claude (pestaña Code). Por eso el listado de sesiones la marca como "Claude Desktop"; los dos datos son compatibles |
| **Quién la usó** | Persona que opera la sesión; según el plan, el equipo de frontend (P5 + P6). `PENDIENTE: confirmar alias` |

| # | Fecha y hora | Para qué | Qué se aceptó (respaldo) | Revisado a mano |
| :-: | :--- | :--- | :--- | :--- |
| 1 | 2026-11-14 (antes de 17:38; `PENDIENTE: hora exacta`) | Análisis de ramas y plan P5: leer `back-AR` y `feature/database`, decisiones D1–D6, backlog B1–B19 | `plan_P5_frontend_webgis.md` | `PENDIENTE: quién lo leyó y lo aprobó` |
| 2 | 2026-11-14 17:38 | Merge de `origin/back-AR` en `Frontend/WebGIS` (único conflicto: `.gitignore`) | Commit `f8ba6fc` | `PENDIENTE: confirmar que una persona comprobó el merge` |
| 3 | 2026-11-14 (hasta 18:30) | Instalación del entorno (Node, pnpm, Python 3.13 y `.venv` del backend) | Sin archivos versionados: configuración local | `PENDIENTE: confirmar` |
| 4 | 2026-11-14 (hasta 18:30) | Refactor del `App.jsx` de `back-AR` en `modules/explorer/`, `api/`, store, i18n (corrige B1–B9, B12, B14–B19) | Commit `093a1a8` | Pruebas automáticas (35 de Vitest) y prueba de punta a punta contra el backend local. `PENDIENTE: revisión humana del código` |
| 5 | 2026-11-14 (hasta 18:30) | Globo 3D con three.js para Tierra, Luna y Marte (`GlobeView.tsx`, `globeEngine.ts`) y texturas locales | Commit `093a1a8` | Comprobación visual en el navegador. `PENDIENTE: quién` |
| 6 | 2026-11-14 | Plan de tareas delegadas P6 (`plan_P6_ux_pitch.md`) y evaluación de cada entrega de T1–T5 de esta sesión | `plan_P6_ux_pitch.md`; cambios menores aplicados en `docs/p6/` y en `frontend/src/i18n/*.json` | Es **revisión de una IA sobre otra IA**. `PENDIENTE: revisión humana de los entregables de P6` |
| 6b | 2026-11-14 (después de la entrega de T6–T8; `PENDIENTE: hora exacta`) | **Corrección de honestidad** a partir del hallazgo de la sesión 2.2 (las muestras de `backend/prepare_samples.py` son sintéticas): la sesión 2.1 cambió los textos de la interfaz (`processing.title`, botones sin atribución a agencias, `demoSample`, panel `cryo.*`), la entrada del glosario y B12 en el plan P5 | `frontend/src/i18n/es.json` y `en.json`, `docs/p6/glosario.md`, `plan_P5_frontend_webgis.md` (B12) | La sesión 2.1 comprobó el hallazgo en `backend/prepare_samples.py` y corrió las 35 pruebas (en verde). **Revisión humana: `PENDIENTE`** (no se da por hecha) |

### 2.2 Sesión de Claude del orquestador (tareas P6)

| Campo | Valor |
| :--- | :--- |
| **Sesión** | `nasa-space-7f` (Claude Code, en la laptop) |
| **Herramienta / modelo** | Claude Code con el modelo Sonnet 5.5 |
| **Quién la usó** | Persona que opera la sesión, con el encargo del arquitecto/PM (sesión 2.1). `PENDIENTE: confirmar alias` |

| # | Fecha y hora | Para qué | Qué se aceptó (respaldo) | Revisado a mano |
| :-: | :--- | :--- | :--- | :--- |
| 7 | 2026-11-14 | `.gitignore`: añadir `.claude/` y reglas de limpieza (cachés y artefactos). Se comprobó que no había archivos sucios versionados | `.gitignore` | La persona pidió la tarea y vio el resultado. `PENDIENTE: confirmar revisión del diff` |
| 8 | 2026-11-14 | Mensajes de commit sugeridos en español y explicación de los avisos de saltos de línea (LF/CRLF) | Texto de apoyo. El commit `093a1a8` quedó con un mensaje distinto al sugerido (no se adoptó la propuesta tal cual) | `PENDIENTE: confirmar quién redactó el mensaje final` |
| 9 | 2026-11-14 | T1 · Wireframes de los módulos A y B | `docs/p6/wireframes.md` (el PM aplicó 5 cambios) | Cada zona del módulo B se contrastó con el código; el PM (otra IA) lo evaluó. `PENDIENTE: revisión humana` |
| 10 | 2026-11-14 | T3 · Revisión de textos ES/EN y glosario | `frontend/src/i18n/es.json`, `en.json`, `docs/p6/glosario.md`, `textos-modulo-a.md` | Script de paridad de claves y marcadores; 35 pruebas de Vitest en verde. `PENDIENTE: lectura en voz alta por una persona` |
| 11 | 2026-11-14 | T2 · Propuesta de design tokens con contraste calculado | `docs/p6/design-tokens.md`; en `frontend/src/index.css` solo se aplicó `--color-ink-muted: #a3b1c6` (aprobado por el PM) | Contrastes recalculados por el PM; `pnpm build` y `tsc` sin errores |
| 12 | 2026-11-14 | T4 · Cronograma y check-ins | `docs/p6/cronograma-checkins.md` | Contrastado con el plan maestro y el plan P5 §7. `PENDIENTE: confirmar H0 y fechas con el equipo` |
| 13 | 2026-11-14 | T5 · Guion de video (≤ 30 s) | `docs/p6/guion-video.md` (v2, con los cambios del PM) | Recuento de palabras con script. `PENDIENTE: la persona que graba lo valida contra la app` |
| 14 | 2026-11-14 | T6 · Contenido del deck de 7 diapositivas | `docs/p6/deck-contenido.md` | Fuentes citadas contrastadas con el repo. **Hallazgo:** las muestras GeoTIFF son sintéticas (`backend/prepare_samples.py`). `PENDIENTE: revisión humana` |
| 15 | 2026-11-14 | T7 y T8 · Este registro y el protocolo de usabilidad | `docs/p6/registro-ia.md`, `docs/p6/prueba-usabilidad.md` | `PENDIENTE: revisión humana` |
| 16 | 2026-11-14 | S2 · Alinear `cronograma-checkins.md`, `deck-contenido.md`, `wireframes.md` y `textos-modulo-a.md` con la integración de MongoDB (D7, D8, B32–B38), a partir del plan P5 actualizado y verificado por la sesión 2.1 | Ediciones en esos cuatro archivos de `docs/p6/` (claves nuevas `analogs.status.invalid` y `allInvalid`, solo propuestas) | Contrastado con el plan P5 por la sesión 2.1 (otra IA). **Revisión humana: `PENDIENTE`** |

### 2.3 Trabajo previo de otros integrantes (commits anteriores a 16:45)

Commits del historial sin información sobre el uso de IA: `70b6116` (Initial commit), `8c1169b`, `3bb8997` (plan sobre el proyecto), `42e835b`, `05c74cd`, `e9b1ec9`, `ee32232`, `dcb6576`, `1757c6b` (posible plan), `16e9501`, `ca31584`, `c205261`, `d261550`, `394b79d`, `47cfe92` y `f87dc3e`.

| Qué se sabe | Qué falta |
| :--- | :--- |
| Que existen y su fecha y asunto (`git log`) | **`PENDIENTE: cada autor (P1, P2, P3, P4) declara si usó IA para el plan maestro, el backend `back-AR` y `feature/database`, con herramienta, modelo y qué se revisó a mano`**. No se asume que se usó ni que no |

Filas para completar:

| Fecha y hora | Herramienta / modelo | Quién | Para qué | Qué se aceptó | Qué se revisó a mano | Qué se rechazó o corrigió |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| | | P1 | | | | |
| | | P2 | | | | |
| | | P3 | | | | |
| | | P4 | | | | |
| | | P5 | | | | |
| | | P6 | | | | |

---

## 3. Distinción entre lo generado por IA y lo revisado por personas

| Entregable | Generado con IA | Revisión humana confirmada |
| :--- | :--- | :--- |
| `plan_P5_frontend_webgis.md`, `plan_P6_ux_pitch.md` | Sí (sesión 2.1) | `PENDIENTE` |
| Refactor del frontend y globo 3D (`093a1a8`) | Sí (sesión 2.1) | Solo pruebas automáticas y comprobación en el navegador; `PENDIENTE: lectura del código por una persona` |
| `docs/p6/*` (T1–T8) | Sí (sesión 2.2) | `PENDIENTE` (el PM que las evaluó es otra sesión de IA) |
| `frontend/src/i18n/es.json` y `en.json` (revisión T3, sesión 2.2; y corrección de honestidad "datos simulados", sesión 2.1) | Sí (sesiones 2.2 y 2.1) | `PENDIENTE: lectura en voz alta por una persona` (la corrección de honestidad tampoco tiene revisión humana confirmada) |
| `frontend/src/index.css` (un valor) | Sí (sesión 2.2) | `PENDIENTE` |
| Plan maestro, backend `back-AR`, `feature/database` | `PENDIENTE: declaración de sus autores` | `PENDIENTE` |
| **Datos científicos** (candidatos, IFA, fichas de P3) | Aún no existen | — |

**Dato clave para la declaración final:** los GeoTIFF de `backend/sample_data/` **no son datos de agencias**: los generó un script con números simulados (`backend/prepare_samples.py`). Esto debe declararse en la documentación técnica (H20–H23). La interfaz ya lo dice ("Datos simulados de demostración").

---

## 4. Borrador de declaración de uso de IA (para la entrega)

> **ES:** En este proyecto se usaron asistentes de IA (Claude, de Anthropic) para planificar, programar el frontend, revisar textos y redactar documentación. Cada uso está registrado en `docs/p6/registro-ia.md` con su fecha, herramienta, propósito y revisión. Los datos de las muestras de procesamiento son simulados y así se indica en la interfaz. `PENDIENTE: confirmar con todos los integrantes antes de enviar.`
>
> **EN:** AI assistants (Claude, by Anthropic) were used in this project to plan, build the frontend, review copy and write documentation. Every use is logged in `docs/p6/registro-ia.md` with its date, tool, purpose and review. The processing samples are simulated data, and the interface says so. `PENDIENTE: confirm with all team members before submitting.`

---

## 5. Autoevaluación contra los criterios de aceptación de T7

| Criterio | Cumple | Dónde |
| :--- | :--- | :--- |
| Plantilla: fecha y hora, herramienta o modelo, quién, para qué, qué se aceptó y qué se revisó a mano | Sí | §1 |
| Entradas conocidas: planes P5/P6, merge, refactor, globo 3D, instalación del entorno | Sí | §2.1 (entradas 1–6) |
| Fuente: historial de git y los planes | Sí; hashes de commit citados | §2 |
| Sin datos personales (correos ni nombres completos; solo alias del README) | Sí: ni correo, ni nombres de autores de git | todo el documento |
| Distingue lo generado por IA de lo revisado por personas | Sí; y señala que una IA revisando a otra no cuenta | §3 |
| Sin datos inventados | Sí: todo lo no respaldado es `PENDIENTE` | §2, §3 |

### Dudas abiertas
1. ~~PENDIENTE: modelo y versión de la sesión 2.1~~ **RESUELTA (S1):** Claude Opus 5.5 (`claude-opus-5-5`), en Claude Code dentro de la aplicación de escritorio de Claude (pestaña Code), confirmado por la sesión 2.1.
2. **`PENDIENTE: declaración de cada integrante sobre sus propios usos de IA`** (§2.3); sin eso, el registro solo cubre las sesiones de Claude de este repo.
3. **`PENDIENTE: horas exactas`** de cada entrada (las de las sesiones se aproximaron con el historial de git).
4. ¿Quién es la persona que **revisa a mano** y firma el registro? `PENDIENTE: decisión del equipo`.
