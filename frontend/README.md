# Frontend WebGIS y Panel de Control

## Overview
El paquete `frontend` provee la aplicación cliente interactiva desarrollada en React con Vite, Leaflet y soporte para capas satelitales NASA GIBS (Global Imagery Browse Services). Permite conmutar la visualización entre la Tierra, la Luna y Marte, ejecutar búsquedas federadas multi-agencia, controlar opacidades y renderizar sobrecapas de teledetección procesadas.

## Interface
- [frontend/src/App.jsx:App](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/frontend/src/App.jsx#L32) - Componente raíz de la interfaz gráfica que gestiona el estado de selección de cuerpo celeste (`earth`, `moon`, `mars`), bounding box activo, filtros temáticos y resultados de procesamiento.
- [frontend/src/App.jsx:MapController](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/frontend/src/App.jsx#L9) - Controlador de cámara Leaflet que sincroniza de forma fluida (`flyToBounds`) los límites visuales del mapa al cambiar de objetivo o seleccionar un resultado.
- [frontend/src/App.jsx:MapClickSelector](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/frontend/src/App.jsx#L19) - Manejador de eventos de interacción sobre el mapa que calcula y acota automáticamente una caja delimitadora (bounding box) de $\pm 1.5^\circ \times \pm 1.0^\circ$ alrededor del punto cliqueado.
- [frontend/src/App.jsx:handleFederatedSearch](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/frontend/src/App.jsx#L65) - Disparador de peticiones asíncronas hacia el endpoint `/api/search` del backend.
- [frontend/src/App.jsx:handleRunProcessing](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/frontend/src/App.jsx#L83) - Disparador de procesamiento ráster hacia el endpoint `/api/process` del backend.
- [frontend/src/main.jsx](file:///c:/Users/andres/Documents/GitHub/NASA_SPACE/frontend/src/main.jsx#L1) - Punto de entrada del árbol React montado sobre el elemento DOM `#root`.

## Invariants
- La latitud geográfica delimitada por clics en el mapa está restringida al rango $[-85^\circ, 85^\circ]$ para prevenir distorsiones singulares en la proyección Web Mercator de Leaflet.
- La variable `API_BASE` se conecta por defecto a `http://localhost:8000`, coincidente con el puerto expuesto por el contenedor Docker `terraanaloga_api`.

## Side Effects
- Disparo de solicitudes HTTP de red vía `fetch` hacia el backend en `http://localhost:8000`.
- Carga de teselas de mapas base e imágenes satelitales externas desde servidores de OpenStreetMap y NASA GIBS WMTS/WMS.
- Manipulación directa del DOM y renderizado acelerado en lienzo mediante Leaflet.

## Verification
- Run: `cd frontend && pnpm build` (o `npm run build`)
