# T2 · Paleta, tipografía y espaciado — propuesta de design tokens

> **Nota:** los textos de interfaz vigentes están en `frontend/src/i18n/es.json` y `en.json`; los rótulos de este documento son orientativos.

**Estado:** EVALUADA por el PM el 2026-11-14 · **Fecha:** 2026-11-14
**Decisiones:** `ink-muted` → `#a3b1c6` **APROBADO y aplicado** en `frontend/src/index.css`; `accent` → `#1d4ed8` **RECHAZADO** (se mantiene `#2563eb`; el foco interior sobre `accent` se resuelve en el código con `outline-ink`, 4,94:1). Los puntos 3.3 a–e, 4.2 y 5.2 pasan al backlog de P5 (B27–B31). Las secciones 1–3 conservan la propuesta original como registro; ver la sección 0.
Base: bloque `@theme` actual de `frontend/src/index.css` y los usos reales de clases `text-*`, `bg-*`, `border-*`, `ring-*` y `outline-*` en `frontend/src/` (búsqueda por `grep`).
Cálculo de contraste: fórmula WCAG 2.x (luminancia relativa sRGB); script reproducible en el scratchpad de la sesión (`contrast.mjs`). Las capas translúcidas (`/10`, `/80`) se mezclaron sobre su fondo real.

---

## 0. Decisión del PM (vigente)

| Token | Valor vigente | Nota |
| :--- | :--- | :--- |
| `ink-muted` | **`#a3b1c6`** (aplicado) | Corrige `ink-muted` sobre `line` (4,04 → 4,76:1) |
| `accent` | **`#2563eb`** (sin cambios) | `ink` sobre `accent` 4,94:1; `accent` sobre `surface` 3,45:1. Foco interior: `outline-ink` en el código |
| Los otros 9 | Sin cambios | — |

En las secciones siguientes, las referencias a `accent` `#1d4ed8` son el registro de la propuesta y **no están vigentes**.

## 1. Resumen de la propuesta

1. **Solo cambian 2 de los 11 tokens** (nombres intactos): `ink-muted` y `accent`. Los otros 9 conservan su valor.
2. **Tema único oscuro** (el globo y el espacio son oscuros). No se propone tema claro.
3. Con los dos cambios, **pasan todas las combinaciones de texto** que la interfaz usa hoy; quedan **5 incumplimientos de no-texto** que no se resuelven con tokens y requieren cambio de clases en el código (sección 3.3, para P5).
4. Sin glassmorphism ni degradados decorativos: hoy no hay `backdrop-blur` ni degradados salvo la **leyenda de color del resultado**, que es funcional (`ProcessingPanel.tsx:64`). Solo hay una sombra (`shadow-lg` en el conmutador de vista).

### Tokens: valor actual → propuesto

| Token | Actual | Propuesto | Rol | Cambio |
| :--- | :--- | :--- | :--- | :--- |
| `canvas` | `#020617` | `#020617` | Fondo de la app, del globo y del espacio | — |
| `surface` | `#0f172a` | `#0f172a` | Cabecera, panel lateral, campos | — |
| `raised` | `#1e293b` | `#1e293b` | Tarjetas dentro del panel | — |
| `line` | `#334155` | `#334155` | Divisores **decorativos** y fondo de hover | — |
| `ink` | `#f8fafc` | `#f8fafc` | Texto principal | — |
| `ink-muted` | `#94a3b8` | **`#a3b1c6`** | Texto secundario | Más claro: sobre `line` pasa de 4,04 a 4,76 |
| `accent` | `#2563eb` | **`#1d4ed8`** | Botón activo / acción principal | Más oscuro: texto `ink` 6,41 (antes 4,94) y foco interior 3,13 (antes 2,41) |
| `info` | `#38bdf8` | `#38bdf8` | Información, enlaces y **foco** | — |
| `ok` | `#10b981` | `#10b981` | Acción afirmativa (Buscar) | — |
| `warn` | `#f59e0b` | `#f59e0b` | Advertencia (muestra de demostración) | — |
| `danger` | `#f87171` | `#f87171` | Error | — |

### Distribución 60-30-10

| Parte | Tokens | Dónde se ve |
| :--- | :--- | :--- |
| **60 % · base oscura** | `canvas`, `surface` | Fondo del globo y del espacio, cabecera, panel lateral |
| **30 % · estructura y texto** | `raised`, `line`, `ink`, `ink-muted` | Tarjetas, divisores, texto principal y secundario |
| **10 % · énfasis y estado** | `accent`, `info`, `ok`, `warn`, `danger` | Botón activo, foco, enlaces, avisos y errores |

Regla de uso: los colores de estado (`ok`, `warn`, `danger`, `info`) se reservan para **significado**, nunca para decorar; `warn` es solo para la muestra de demostración y las advertencias.

---

## 2. Bloque `@theme` propuesto (NO aplicado)

```css
@theme {
  --color-canvas: #020617;
  --color-surface: #0f172a;
  --color-raised: #1e293b;
  --color-line: #334155;
  --color-ink: #f8fafc;
  --color-ink-muted: #a3b1c6;   /* antes #94a3b8 */
  --color-accent: #1d4ed8;      /* antes #2563eb */
  --color-info: #38bdf8;
  --color-ok: #10b981;
  --color-warn: #f59e0b;
  --color-danger: #f87171;

  --font-sans: system-ui, "Segoe UI", Roboto, sans-serif;
}
```

---

## 3. Contraste calculado (combinaciones reales de la interfaz)

Umbrales: **≥ 4,5:1** texto normal · **≥ 3:1** texto grande, bordes de controles y contornos de foco. ✔ = cumple · ✘ = no cumple.

### 3.1 Tabla completa

| Combinación (texto o elemento / fondo) | Umbral | Actual | Propuesto |
| :--- | :-: | :-: | :-: |
| `ink` / `canvas` | 4,5 | 19,28 ✔ | 19,28 ✔ |
| `ink` / `surface` | 4,5 | 17,06 ✔ | 17,06 ✔ |
| `ink` / `raised` | 4,5 | 13,98 ✔ | 13,98 ✔ |
| `ink-muted` / `canvas` | 4,5 | 7,87 ✔ | 9,28 ✔ |
| `ink-muted` / `surface` | 4,5 | 6,96 ✔ | 8,21 ✔ |
| `ink-muted` / `raised` | 4,5 | 5,71 ✔ | 6,73 ✔ |
| `ink-muted` / `line` (meta de la lista con hover) | 4,5 | 4,04 ✘ | 4,76 ✔ |
| `ink` / `line` (hover de botones y filas) | 4,5 | 9,90 ✔ | 9,90 ✔ |
| `ink` / `accent` (botón activo, descarga) | 4,5 | 4,94 ✔ | 6,41 ✔ |
| `canvas` / `ok` (botón "Buscar escenas en vivo") | 4,5 | 7,95 ✔ | 7,95 ✔ |
| `info` / `canvas` | 4,5 | 9,42 ✔ | 9,42 ✔ |
| `info` / `surface` | 4,5 | 8,33 ✔ | 8,33 ✔ |
| `info` / `raised` (pista del mapa) | 4,5 | 6,83 ✔ | 6,83 ✔ |
| `danger` / `canvas` | 4,5 | 7,29 ✔ | 7,29 ✔ |
| `danger` / `surface` | 4,5 | 6,45 ✔ | 6,45 ✔ |
| `danger` / `raised` (mensaje bajo el campo BBox) | 4,5 | 5,29 ✔ | 5,29 ✔ |
| `warn` / `canvas` | 4,5 | 9,39 ✔ | 9,39 ✔ |
| `warn` / `surface` | 4,5 | 8,31 ✔ | 8,31 ✔ |
| `warn` / `raised` | 4,5 | 6,81 ✔ | 6,81 ✔ |
| `info` / `info` al 10 % sobre `surface` (StatusBanner) | 4,5 | 7,02 ✔ | 7,02 ✔ |
| `info` / `info` al 10 % sobre `raised` (StatusBanner dentro de un panel) | 4,5 | 5,65 ✔ | 5,65 ✔ |
| `danger` / `danger` al 10 % sobre `surface` | 4,5 | 5,69 ✔ | 5,69 ✔ |
| **`danger` / `danger` al 10 % sobre `raised`** (el caso más ajustado) | 4,5 | 4,61 ✔ | 4,61 ✔ |
| `warn` / `warn` al 10 % sobre `surface` | 4,5 | 7,14 ✔ | 7,14 ✔ |
| `warn` / `warn` al 10 % sobre `raised` | 4,5 | 5,75 ✔ | 5,75 ✔ |
| `ink-muted` / `surface` al 80 % sobre fondo **negro** (rótulos sobre el globo) | 4,5 | 7,26 ✔ | 8,57 ✔ |
| `ink-muted` / `surface` al 80 % sobre fondo **blanco** | 4,5 | 3,72 ✘ | 4,39 ✘ |
| `ink-muted` / `surface` al 70 % sobre fondo **negro** (atribución) | 4,5 | 7,40 ✔ | 8,73 ✔ |
| `ink-muted` / `surface` al 70 % sobre fondo **blanco** | 4,5 | 2,59 ✘ | 3,05 ✘ |
| Contorno de foco `info` / `canvas` | 3 | 9,42 ✔ | 9,42 ✔ |
| Contorno de foco `info` / `surface` | 3 | 8,33 ✔ | 8,33 ✔ |
| Contorno de foco `info` / `raised` | 3 | 6,83 ✔ | 6,83 ✔ |
| Contorno de foco `info` / `accent` (foco **interior** del conmutador de vista) | 3 | 2,41 ✘ | 3,13 ✔ |
| Borde `line` / `surface` (campos de texto) | 3 | 1,72 ✘ | 1,72 ✘ |
| Borde `line` / `raised` | 3 | 1,41 ✘ | 1,41 ✘ |
| `accent` / `canvas` (botón activo frente al fondo) | 3 | 3,90 ✔ | 3,01 ✔ |
| `accent` / `surface` | 3 | 3,45 ✔ | 2,66 ✘ |
| `accent` / `raised` (selector de cuerpo: activo frente a inactivo) | 3 | 2,83 ✘ | 2,18 ✘ |
| `danger` (borde de campo inválido) / `surface` | 3 | 6,45 ✔ | 6,45 ✔ |
| `ok` / `surface` | 3 | 7,04 ✔ | 7,04 ✔ |
| Borde de control con `ink-muted` / `surface` (alternativa) | 3 | 6,96 ✔ | 8,21 ✔ |
| Borde de control con `ink-muted` / `raised` (alternativa) | 3 | 5,71 ✔ | 6,73 ✔ |

### 3.2 Resultado

- **Texto: 100 % de las combinaciones de la interfaz cumplen ≥ 4,5:1** con los valores propuestos, **salvo** los rótulos translúcidos sobre el globo cuando el fondo es blanco (ver 3.3-a). Hoy falla una más: `ink-muted` sobre `line` (4,04).
- **Foco:** el contorno `info` cumple ≥ 3:1 sobre `canvas`, `surface`, `raised` y, con el nuevo `accent`, también sobre `accent`.

### 3.3 Incumplimientos que NO se arreglan con tokens (cambios de clases para P5)

| # | Problema | Dónde | Causa | Corrección sugerida |
| :-- | :--- | :--- | :--- | :--- |
| a | Rótulos del globo (pista, "Cargando mosaico", atribución) con fondo translúcido: sobre zonas blancas (casquetes polares, nubes) el texto baja a **3,05–4,39:1**. Además, la translucidez roza el estilo "vidrio" que se prohíbe | `GlobeView.tsx` (`bg-surface/80`, `bg-surface/70`) | Transparencia | Usar `bg-surface` **opaco** (así `ink-muted` / `surface` = 8,21) |
| b | Los bordes de los campos (`border-line`) miden **1,72:1** sobre `surface` y **1,41:1** sobre `raised`; el mínimo para el límite de un control es 3:1 | `SearchPanel.tsx` (`inputClass`) | `line` es un divisor decorativo y no se puede subir a 3:1 sin romper `ink-muted` sobre `line` (sería necesaria una luminancia ≈ 0,92 para ambos) | En los campos usar `border-ink-muted` (8,21 sobre `surface`) y reservar `line` para divisores decorativos |
| c | El botón activo del selector de cuerpo se distingue del inactivo solo por color: `accent` / `raised` = **2,18:1** (antes 2,83) | `BodySelector.tsx` | Con texto `ink` blanco no existe un `accent` que dé 3:1 contra `raised` **y** 4,5:1 contra el texto: es físicamente incompatible | Añadir una señal que no dependa del color en el estado activo (borde `info` de 2 px, o una marca ✓) |
| d | Idem para el conmutador de vista y los modos de procesamiento: el estado se comunica por color; `accent` / `surface` baja de 3,45 a **2,66** | `ExplorerView.tsx`, `ProcessingPanel.tsx` | Mismo motivo | Misma señal no cromática. Nota: los modos de procesamiento ya llevan un `ring-info` cuando están activos (`aria-pressed:ring-info`) |
| e | `text-[11px]` en la atribución: por debajo de 12 px | `GlobeView.tsx` | Tamaño arbitrario | Usar `text-xs` (12 px) |

**Compromiso reconocido:** oscurecer `accent` mejora el texto y el foco interior, pero empeora el contraste del botón activo frente a `surface` (3,45 → 2,66). Esto es aceptable porque **(c)/(d)** exigen de todos modos una señal que no sea solo color. Si el PM prefiere no cambiar `accent`, el valor actual `#2563eb` se mantiene y solo queda sin resolver el foco interior (2,41:1) del conmutador de vista.

### 3.4 Sobre el globo y el espacio

- La interfaz entera es oscura, así que los paneles (`surface`, `canvas`) se funden con el espacio del globo, y `line` separa sin brillo.
- Los **rótulos que flotan sobre el globo** deben ser **opacos** (3.3-a): el fondo de la imagen cambia (negro del espacio, blanco de los casquetes).
- Los colores de acento del propio mapa (`#38bdf8` para la caja BBox, en `globeEngine.ts:140` y `PlanetMap.tsx:75`) coinciden con `info`. `PENDIENTE: comprobar a ojo (captura a 1280 y 375 px) cómo se ve la caja BBox sobre las zonas claras de la Tierra y la Luna — P6 en el QA visual de la Fase 5; el contraste de un color contra una textura variable no se calcula con una sola cifra`.

---

## 4. Tipografía

### 4.1 Estado actual

- Familia: `system-ui, "Segoe UI", Roboto, sans-serif` (`--font-sans`). Monoespaciada: `font-mono` (el campo BBox).
- Tamaños en uso: `text-xs` (12 px, el más frecuente), `text-sm` (14), `text-base` (16, título), `text-lg` (18, marcador de posición) y **`text-[11px]`** (atribución, fuera de escala).
- Pesos en uso: **`font-medium`, `font-semibold` y `font-bold`** → **3 pesos** (el criterio pide máximo 2).

### 4.2 Escala propuesta (base 16 px)

| Nombre | Tamaño / interlineado | Clase Tailwind | Uso |
| :--- | :--- | :--- | :--- |
| Pequeño | 12 / 16 px | `text-xs` | Metadatos, leyendas, etiquetas de campos, atribución (mínimo absoluto) |
| Cuerpo | 14 / 20 px | `text-sm` | Texto de paneles, botones, campos |
| Base | 16 / 24 px | `text-base` | Título de la app |
| Título de sección | 18 / 28 px | `text-lg` | Encabezados de pantalla (p. ej. módulo A, ficha) |

Se descarta cualquier tamaño por debajo de 12 px. **Dos pesos:** **400** (texto) y **700** (títulos, botones y valores destacados). Los usos de `font-medium` y `font-semibold` pasan a 400 o 700 según el caso (cambio de clases para P5).

### 4.3 Reglas

- Texto de párrafo ≤ 75 caracteres por línea (el panel de 400 px ya lo cumple).
- Números: `font-mono` solo en el BBox y en las estadísticas (mín/media/máx), con espacio fino antes de la unidad.
- Los botones empiezan con verbo (ver [glosario](glosario.md) §5).

---

## 5. Espaciado (escala de 4 / 8 px)

### 5.1 Escala propuesta

| Paso | px | Clases Tailwind equivalentes | Uso |
| :--- | :--: | :--- | :--- |
| 1 | 4 | `p-1` `gap-1` | Separación mínima entre iconos y texto |
| 2 | 8 | `p-2` `gap-2` | Relleno de botones y campos; separación entre controles relacionados |
| 3 | 12 | `p-3` `gap-3` `space-y-3` | Relleno de tarjetas; separación entre bloques de un panel |
| 4 | 16 | `p-4` | Relleno del panel lateral |
| 6 | 24 | `p-6` | Pantallas vacías y modales |
| 8 | 32 | `p-8` | Separación entre secciones grandes |

### 5.2 Desvíos detectados (múltiplos de 4 que no lo son)

Con la escala de Tailwind 1 unidad = 4 px, los valores con `.5` son **medios pasos fuera de la cuadrícula de 4 px**:

| Valor en el código | px | Aparece en | Sugerencia |
| :--- | :--: | :--- | :--- |
| `py-1.5`, `gap-1.5`, `space-y-1.5` | 6 | Botones, selectores, listas | 8 px (`py-2`, `gap-2`) |
| `px-2.5` | 10 | Pista del globo | 8 px (`px-2`) o 12 px (`px-3`) |
| `mt-0.5` | 2 | Leyenda | 4 px (`mt-1`) |

Las alturas táctiles mínimas en móvil (40 px, aceptado por el PM) se cumplen con `min-h-10`.

---

## 6. Otras reglas visuales

- **Sin glassmorphism:** no usar `backdrop-blur` ni superficies translúcidas encima de contenido variable (3.3-a).
- **Sin degradados decorativos:** solo el degradado de la leyenda de color de un resultado, porque representa datos.
- **Sombras:** solo la actual de `shadow-lg` del conmutador de vista; no añadir más.
- **Radio de esquina:** `rounded` (4 px) para controles y `rounded-md` (6 px) para tarjetas; no mezclar más valores.
- **Foco visible:** contorno de 2 px en `info` con desfase de 2 px en todos los controles (ya aplicado); el de los controles pegados a un borde usa desfase interior (`-outline-offset-2`).

---

## 7. Autoevaluación contra los criterios de aceptación de T2

| Criterio | Cumple | Dónde |
| :--- | :--- | :--- |
| Cada combinación texto/fondo en uso tiene su contraste calculado (≥ 4,5:1 texto; ≥ 3:1 texto grande y bordes de foco), en una tabla | Sí | §3.1: 42 filas, sacadas de los usos reales del código |
| Casos pedidos por el PM: `ink-muted` sobre `surface` y `raised`; `canvas` sobre `ok`; `ink` sobre `accent`; `danger`/`warn`/`info` sobre su fondo al 10 % y sobre `surface`; foco `info` sobre `surface` | Sí | §3.1 |
| Funciona sobre fondo oscuro (globo y espacio) | Sí, con una salvedad: los rótulos translúcidos sobre zonas blancas (3.3-a) | §3.3, §3.4 |
| Sin glassmorphism, sin degradados arcoíris ni efectos decorativos | Sí; se pide además quitar la translucidez de los rótulos | §1, §6 |
| Distribución 60-30-10 | Sí | §1 |
| Escala tipográfica con máximo 2 pesos | Propuesta: 400 y 700; hoy hay 3 pesos en el código | §4 |
| Escala de espaciado 4/8 px | Sí; desvíos detectados | §5 |
| Mantiene los 11 nombres de los tokens | Sí | §1 |
| No se tocó `index.css`, ni código, ni se hizo commit | Sí | — |

## 8. Dudas abiertas

1. **¿Apruebas cambiar `accent` a `#1d4ed8`?** Mejora texto (4,94 → 6,41) y foco interior (2,41 → 3,13), pero empeora `accent` / `surface` (3,45 → 2,66). Alternativa: dejar `#2563eb`.
2. **¿Apruebas `ink-muted` `#a3b1c6`?** Es el cambio que corrige el único fallo de texto actual (4,04 → 4,76 sobre `line`).
3. **Cambios de clases (3.3 a–e, 4.2 y 5.2)** son de P5. ¿Los pasas al backlog como B27–B31?
4. **PENDIENTE (P6, QA visual):** aspecto real de la caja BBox sobre zonas claras del globo.
5. **Solo tema oscuro:** si el equipo quiere también tema claro, habrá que calcular otra tabla.
