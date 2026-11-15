# TerraAnáloga — Frontend WebGIS

## Overview
Aplicación cliente interactiva de visualización geoespacial desarrollada en React 19, TypeScript, Vite, Tailwind 4, Three.js y Leaflet con soporte de capas NASA GIBS y Trek. Provee visualización dual:
- **Globo 3D Interactivo**: Esferas tridimensionales de la Tierra (Blue Marble, GIBS), la Luna (LRO WAC, Trek) y Marte (Viking MDIM 2.1, Trek) con texturas 2K precargadas en `public/textures/`.
- **Mapa 2D**: Proyección de la Tierra en EPSG:3857 (Web Mercator) y Luna/Marte en EPSG:4326 con capas ráster procesadas.
- **Soporte Bilingüe**: Internacionalización completa (i18n) en Español e Inglés (`src/i18n/es.json` y `src/i18n/en.json`).

## Interface
- [frontend/src/App.tsx:App](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/frontend/src/App.tsx) - Componente raíz que orquesta los módulos `ExplorerView` y `AnalogsView`, selector de idioma `LangToggle` y banner de estado `StatusBanner`.
- [frontend/src/modules/explorer/GlobeView.tsx](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/frontend/src/modules/explorer/GlobeView.tsx) - Renderizador del globo 3D acelerado con Three.js mediante `globeEngine.ts`.
- [frontend/src/modules/explorer/PlanetMap.tsx](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/frontend/src/modules/explorer/PlanetMap.tsx) - Mapa 2D Leaflet para análisis cartográfico de teselas y selección de bounding box.
- [frontend/src/modules/explorer/SearchPanel.tsx](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/frontend/src/modules/explorer/SearchPanel.tsx) - Panel de búsqueda federada en catálogos espaciales.
- [frontend/src/modules/explorer/ProcessingPanel.tsx](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/frontend/src/modules/explorer/ProcessingPanel.tsx) - Panel de control para ejecución de pipelines ráster (SAR, NDVI, NDWI, Diviner).
- [frontend/src/modules/analogs/AnalogsView.tsx](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/frontend/src/modules/analogs/AnalogsView.tsx) - Módulo de análogos planetarios para visualización de candidatos y sliders.
- [frontend/src/store/useExplorerStore.ts](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/frontend/src/store/useExplorerStore.ts) - Estado global reactivo con Zustand para cuerpo celeste, bounding box, filtros y resultados.
- [frontend/src/api/explorer.ts](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/frontend/src/api/explorer.ts) - Cliente HTTP tipado con funciones `searchCatalogs`, `processScene` y `exportGeotiffUrl`.

## Invariants
- La variable de entorno `VITE_API_BASE` (declarada en `frontend/.env.example`) apunta por defecto al backend en `http://localhost:8000`.
- El cliente HTTP tipado (`src/api/http.ts`) impone un timeout preventivo de 30 000 ms para evitar que la UI se bloquee ante retrasos en APIs externas.
- Si el backend no responde, la interfaz muestra advertencias contextuales amigables mediante `StatusBanner` sin lanzar excepciones no controladas.

## Side Effects
- Disparo de peticiones HTTP de red asíncronas vía `fetch` hacia el backend unificado en `http://localhost:8000`.
- Carga de texturas e imágenes satelitales externas desde servidores de NASA GIBS WMTS/WMS y NASA Trek.
- Asignación de contextos WebGL para el renderizado del globo 3D y manipulación directa del DOM con Leaflet.

## Verification
- Run: `cd frontend && pnpm test && pnpm build`
