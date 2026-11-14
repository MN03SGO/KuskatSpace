# Plan de Desarrollo Inicial: Plataforma SIG en la Nube con Procesamiento de Teledetección

## Estructura y Distribución del Equipo (6 Personas)

- **1 Arquitecto Cloud y Líder Técnico (Tech Lead):** Diseño de la arquitectura en la nube, definición de estándares técnicos, seguridad e IAM, configuración de infraestructura como código (IaC), pipelines CI/CD y supervisión de integración entre módulos.
- **2 Ingenieros Backend y Cloud:** Desarrollo de APIs RESTful, gestión de autenticación, orquestación de colas de tareas asíncronas, despliegue de servidores de teselas dinámicas y conectores hacia catálogos externos.
- **1 Ingeniero de Datos Geoespaciales y Teledetección:** Diseño del catálogo espacial, pipelines de ingesta y conversión a formatos nativos de la nube, implementación de algoritmos de procesamiento óptico, SAR, geofísico y planetario, y validación científica.
- **2 Desarrolladores Frontend WebGIS:** Diseño UI/UX, implementación del visor cartográfico interactivo, manejo de proyecciones terrestres y planetarias, gestión de capas, visualización de resultados y paneles de control de procesos.

---

## Fase 1: Planificación, Alcance MVP y Arquitectura Conceptual

### 1.1. Definición de Alcance y Funcionalidades Mínimas Viables (MVP)

**Objetivo operativo:** Construir una versión funcional de extremo a extremo que permita descubrir, visualizar y ejecutar procesamientos esenciales sobre datos satelitales y planetarios sin descargar volúmenes masivos al cliente.

**Módulos prioritarios del MVP:**
- **Catálogo federado de búsqueda:** Consulta unificada por área de interés (AOI), rango temporal y sensor hacia repositorios de NASA, CSA, ESA y JAXA.
- **Visor WebGIS multi-entorno:** Renderizado dinámico de capas raster y vectoriales con soporte para Tierra (WGS84 / Web Mercator / UTM) y cuerpos planetarios (Luna y Marte).
- **Motor de procesamiento bajo demanda (3 flujos base):**
  - Cálculo de índices espectrales ópticos (NDVI, NDWI).
  - Preprocesamiento básico de radar de apertura sintética (SAR): calibración radiométrica y filtrado de speckle.
  - Extracción de variables geofísicas y análisis térmico comparativo (precipitación, nieve y temperaturas polares lunares frente a zonas criosféricas terrestres).
- **Exportación básica:** Descarga de resultados procesados en formato GeoTIFF y metadatos en JSON/STAC.

### 1.2. Selección y Diseño de la Arquitectura Cloud General

**Proveedor y patrón arquitectónico:** Arquitectura desacoplada orientada a eventos sobre un proveedor cloud principal (AWS o GCP), separando el plano de control (APIs y metadatos) del plano de cómputo pesado (procesamiento raster).

**Componentes clave de infraestructura:**
- **Almacenamiento de objetos (Object Storage):** Buckets diferenciados para datos crudos temporales (staging), productos estandarizados en formato Cloud Optimized GeoTIFF (COG) y resultados generados por usuarios, con políticas de ciclo de vida para eliminar archivos intermedios tras 7 días.
- **Base de datos espacial:** Instancia gestionada de PostgreSQL con extensiones PostGIS y pgSTAC para indexación espacial y temporal.
- **Cómputo elástico:** Contenedores Docker sin estado para las APIs y workers de procesamiento bajo demanda (AWS Batch / ECS Fargate o Google Cloud Run Jobs) que escalan a cero cuando no hay tareas activas.
- **Mensajería y caché:** Broker ligero (Redis o RabbitMQ) para gestión de colas de trabajos y caché de teselas cartográficas frecuentes.
- **Redes y seguridad:** Red privada virtual (VPC), subredes privadas para bases de datos y workers, gestión centralizada de secretos (Vault / Secrets Manager) para almacenar credenciales de agencias espaciales y control de acceso basado en roles (RBAC).

### 1.3. Estrategia de Integración de Fuentes y Datos de Teledetección

**Estandarización interna:** Todo producto ingerido para visualización o análisis persistente se transforma a COG (para escenas 2D) o Zarr (para series temporales multidimensionales), permitiendo lecturas parciales vía peticiones HTTP Range sin descargar escenas completas.

**Integración de recursos NASA (Tierra, Luna y Marte):**
- **NASA Earthdata Search:** Integración con la API CMR (Common Metadata Repository) y autenticación mediante Earthdata Login para búsqueda programática y descarga directa de observaciones terrestres.
- **NASA Worldview:** Consumo directo de capas de visualización rápida y series temporales históricas mediante el servicio GIBS (Global Imagery Browse Services) bajo protocolos WMTS/TMS como capas base de referencia en el visor.
- **NASA Planetary Data System (PDS):** Implementación de lectores de etiquetas PDS3/PDS4 (`.lbl` / `.xml`) y soporte para sistemas de referencia de coordenadas planetarios (IAU) para catalogar observaciones orbitales y de superficie de Luna y Marte.
- **NASA Lunar Reconnaissance Orbiter (LRO):** Ingesta de productos de instrumentos clave: imágenes ópticas de alta resolución (LROC), modelos digitales de elevación altimétrica (LOLA), datos de radar (Mini-RF) y mapas de detección de hidrógeno/neutrones (LEND).
- **NASA LRO Diviner Lunar Data:** Incorporación de mapas radiométricos de temperatura superficial lunar (especialmente en los polos lunares) y creación de un flujo analítico para comparar perfiles térmicos extremos con entornos terrestres fríos o cubiertos de hielo (glaciares, permafrost y regiones polares).

**Integración de recursos CSA (Agencia Espacial Canadiense):**
- **RADARSAT Constellation Mission (RCM) - Data:** Conector hacia el sistema EODMS para acceso a datos de la constelación de tres satélites SAR en banda C, configurando flujos predefinidos para sus tres ejes principales: vigilancia marítima (hielo marino, vientos superficiales, detección de derrames de petróleo y embarcaciones), gestión de desastres (mitigación, alerta y respuesta) y monitoreo de ecosistemas (agricultura, humedales, silvicultura y cambios costeros).
- **RADARSAT-1 - Data:** Conexión al archivo histórico abierto de RADARSAT-1 para análisis multitemporal de radar en cualquier condición meteorológica, día o noche, atravesando nubosidad y humo.
- **Synthetic Aperture Radar (SAR) Python Tutorial:** Adopción directa de la metodología del tutorial (procesamiento con Python y validación en QGIS) como plantilla estándar del backend para apertura de productos SAR, calibración radiométrica, reducción de ruido speckle y renderizado en escala de decibelios (dB).

**Integración de recursos ESA (Agencia Espacial Europea):**
- **Copernicus Data Space Ecosystem (CDSE):** Integración con sus APIs STAC / OpenSearch y OData para descubrir y extraer observaciones de misiones Sentinel (Sentinel-1 SAR y Sentinel-2 multiespectral) sobre tierra, océanos y atmósfera.
- **ESA Open Science Catalog:** Sincronización de metadatos de conjuntos de datos geocientíficos abiertos y adopción de sus flujos de trabajo de referencia (workflows) como casos de prueba reproducibles dentro de la plataforma.

**Integración de recursos JAXA (Agencia Japonesa de Exploración Aeroespacial):**
- **JAXA G-Portal:** Implementación de un cliente de consulta y descarga (HTTPS/SFTP y catálogo de metadatos) para recuperar productos geofísicos de misiones JAXA filtrables por variables temáticas: precipitación (GPM/GSMaP), cobertura de nieve e índices de vegetación (GCOM-C).

### 1.4. Selección del Stack Tecnológico Inicial

- **Backend y procesamiento geoespacial:** Python 3.11+, FastAPI (APIs asíncronas), GDAL/OGR, Rasterio, Rioxarray, Xarray, Dask (procesamiento por bloques en memoria limitada), PySTAC, PyroSAR y TiTiler (servidor dinámico de teselas COG).
- **Base de datos y colas:** PostgreSQL 16 + PostGIS 3.4 + pgSTAC, Redis + Celery (o Dramatiq).
- **Frontend WebGIS:** React + TypeScript, MapLibre GL JS (renderizado vectorial y raster rápido en WebGL) complementado con OpenLayers (necesario para reproyecciones personalizadas de Luna y Marte), Tailwind CSS y Zustand para gestión de estado.
- **DevOps y validación:** Docker, Terraform, GitHub Actions y QGIS (herramienta de escritorio para auditoría de calidad espacial).

### 1.5. Metodología de Trabajo del Equipo

- **Marco ágil:** Sprints de 2 semanas con tablero Kanban compartido, reuniones diarias de 15 minutos y demostraciones funcionales al cierre de cada sprint.
- **Control de versiones:** Repositorio monorepo o multi-repo en GitHub con ramas protegidas (`main`, `develop`), Pull Requests obligatorios con revisión de al menos un par y convenciones de commits semánticos.

---

## Fase 2: Diseño Detallado y Configuración del Entorno

### 2.1. Diseño de la Base de Datos y Catálogo STAC

**Responsables:** Ingeniero de Datos Geoespaciales + 1 Ingeniero Backend.

**Esquema relacional operativo:**
- `users` y `workspaces`: Gestión de cuentas, cuotas de almacenamiento y credenciales encriptadas de terceros (NASA Earthdata, CDSE, JAXA G-Portal, CSA EODMS).
- `datasets_catalog`: Esquema basado en STAC Items y Collections almacenado en PostGIS, incluyendo geometrías (`footprint`), `bbox`, `datetime`, `constellation` (Sentinel, RCM, RADARSAT-1, LRO, GCOM), `body` (`earth`, `moon`, `mars`), bandas disponibles y rutas URI hacia el Object Storage.
- `processing_jobs`: Registro de tareas con estado (`PENDING`, `RUNNING`, `COMPLETED`, `FAILED`), parámetros de entrada, algoritmo ejecutado, procedencia (`lineage`) y URI del producto resultante.

### 2.2. Diseño de la Arquitectura de Procesamiento de Teledetección

**Responsables:** Arquitecto Cloud + Ingeniero de Datos Geoespaciales.

**Flujo de ejecución asíncrona:**
1. El usuario solicita una escena o un algoritmo vía API REST (`POST /api/v1/jobs`).
2. FastAPI valida parámetros, crea el registro en `processing_jobs` y publica un mensaje JSON en Redis.
3. Un worker contenerizado toma la tarea, descarga únicamente las bandas necesarias desde NASA Earthdata, Copernicus, JAXA G-Portal, CSA o NASA PDS mediante streaming autenticado.
4. El motor ejecuta el pipeline con Xarray/Dask/GDAL en bloques (chunks) para evitar desbordamientos de RAM.
5. El producto final se escribe como COG optimizado (pirámides internas + compresión DEFLATE/LZW) en el bucket de resultados y se registra como nuevo STAC Item.
6. El frontend recibe notificación vía WebSockets o polling y solicita las teselas directamente a TiTiler.

### 2.3. Diseño de la Interfaz de Usuario (UI/UX)

**Responsables:** 2 Desarrolladores Frontend + Tech Lead.

**Wireframes y vistas esenciales del MVP:**
- **Selector de Entorno Planetario:** Conmutador superior (`Tierra` | `Luna (LRO/Diviner)` | `Marte (PDS)`) que ajusta dinámicamente el mapa base y el sistema de coordenadas.
- **Panel Izquierdo (Explorador Multi-Agencia):** Dibujo de polígono/AOI en el mapa, selector de fechas y checkboxes por fuente (NASA Earthdata/Worldview, Copernicus Sentinel, CSA RCM/RADARSAT-1, JAXA G-Portal, NASA PDS/LRO).
- **Panel Derecho (Capas y Procesamiento):** Control de opacidad, selección de combinaciones de bandas (RGB, falso color, dB SAR, rampa térmica Diviner), lanzador de algoritmos rápidos y cola de trabajos en curso.
- **Barra Inferior / Inspector:** Coordenadas en tiempo real, lectura del valor exacto del píxel bajo el cursor (reflectancia, retrodispersión en dB, temperatura en Kelvin/Celsius, precipitación en mm/h) y botón de descarga.

### 2.4. Configuración del Entorno de Desarrollo, Staging y Producción

**Responsables:** Arquitecto Cloud + 1 Ingeniero Backend.

**Tareas de aprovisionamiento:**
- Definir módulos de Terraform para desplegar redes, buckets S3/GCS, base de datos PostGIS y clúster de contenedores en tres entornos aislados (`dev`, `staging`, `prod`).
- Configurar `docker-compose.yml` local con PostGIS, Redis, TiTiler, backend FastAPI y frontend React para que los 6 integrantes desarrollen en condiciones idénticas.
- Registrar cuentas de servicio institucionales y almacenar tokens en el gestor de secretos cloud.

---

## Fase 3: Desarrollo e Implementación Iterativa

### 3.1. Sprint 1: Núcleo Backend, Seguridad y Conectores de Catálogo

**Backend (2 personas):**
- Implementar estructura base en FastAPI con autenticación JWT interna y almacenamiento seguro de credenciales externas.
- Construir el servicio adaptador de búsqueda federada con interfaz común (`BaseCatalogConnector`) e implementar:
  - Conector NASA Earthdata Search (consultas CMR STAC/JSON) y NASA PDS (búsqueda de productos LRO: LROC, LOLA, Diviner, LEND, Mini-RF).
  - Conector Copernicus Data Space Ecosystem (APIs STAC/OpenSearch) y parser de metadatos del ESA Open Science Catalog.
  - Conector CSA para catálogos de RADARSAT Constellation Mission (RCM) y archivo abierto de RADARSAT-1.
  - Conector JAXA G-Portal para búsqueda por variables temáticas (precipitación, nieve, vegetación).

### 3.2. Sprint 2: Ingesta Raster, Conversión a COG y Servidor de Teselas

**Ingeniero de Datos Geoespaciales + 1 Backend:**
- Desarrollar el pipeline de normalización de formatos: conversión de `.SAFE` (Sentinel), HDF5/NetCDF (JAXA / NASA Earthdata), CEOS/GeoTIFF (RADARSAT-1 / RCM) y archivos IMG/LBL (NASA PDS / LRO Diviner) hacia Cloud Optimized GeoTIFF.
- Desplegar TiTiler conectado al almacenamiento de objetos y configurar endpoints dinámicos para generación de teselas XYZ, histogramas y estadísticas por banda.
- Configurar proxy de capas WMTS/TMS de NASA Worldview (GIBS) para servir capas base históricas sin latencia adicional.

### 3.3. Sprint 3: Módulo de Procesamiento de Teledetección (MVP)

**Ingeniero de Datos Geoespaciales + 1 Backend:**
- **Pipeline Óptico (Sentinel-2 / NASA Earthdata):** Implementar cálculo vectorizado de NDVI y NDWI con enmascaramiento básico de nubes.
- **Pipeline SAR (RADARSAT-1, RCM y Sentinel-1):** Traducir a microservicios Python los flujos del *Synthetic Aperture Radar (SAR) Python Tutorial*:
  - Calibración radiométrica a coeficiente de retrodispersión ($\sigma^0$ en decibelios).
  - Aplicación de filtro espacial Lee para reducción de ruido speckle.
  - Corrección geométrica del terreno (Terrain Correction) usando modelos digitales de elevación, habilitando casos de uso de vigilancia marítima, monitoreo de ecosistemas y respuesta a desastres.
- **Pipeline Geofísico y Comparativo Planetario (JAXA + LRO Diviner):**
  - Agregación espacial y extracción de estadísticas zonales para productos de precipitación, nieve y vegetación de JAXA G-Portal.
  - Procesamiento de productos térmicos polares de NASA LRO Diviner Lunar Data y creación de un endpoint comparativo que contraste distribuciones de temperatura superficial lunar extrema con zonas terrestres criosféricas/polares obtenidas de Earthdata/Sentinel.

### 3.4. Sprint 4: Desarrollo del Frontend WebGIS e Integración Completa

**Frontend (2 personas):**
- Construir el visor cartográfico principal con MapLibre GL JS (modo Tierra) y puente hacia OpenLayers para soportar proyecciones estereográficas polares lunares (LRO/Diviner) y marcianas (PDS).
- Integrar el buscador federado multi-agencia con previsualización de huellas (footprints) en el mapa.
- Conectar el gestor de capas con las teselas dinámicas de TiTiler y las capas base de NASA Worldview.
- Implementar los formularios de ejecución de algoritmos (índices ópticos, calibración/filtrado SAR, variables JAXA y comparación térmica Diviner), barra de progreso de tareas en tiempo real e inspector de píxeles.

---

## Fase 4: Pruebas, Validación Técnica y Despliegue

### 4.1. Pruebas Unitarias y de Integración

**Responsables:** Todo el equipo de desarrollo (20% del tiempo del sprint).

**Ejecución:**
- Escribir suites con `pytest` para validar parsers de metadatos (NASA CMR, PDS labels, STAC de Copernicus, respuestas de JAXA G-Portal y CSA), lógica de colas y permisos de API.
- Implementar pruebas de componentes UI con Vitest/React Testing Library para formularios de búsqueda y gestión de capas.
- Ejecutar pruebas de integración de extremo a extremo en el entorno `staging` verificando el ciclo completo: `búsqueda -> ingesta -> conversión a COG -> visualización en mapa -> descarga`.

### 4.2. Validación Geoespacial con Datos Reales

**Responsables:** Ingeniero de Datos Geoespaciales + 1 Desarrollador Frontend.

**Protocolo de verificación:**
- Ejecutar 5 casos de prueba reales representativos:
  1. Detección de embarcaciones o derrames en costa mediante datos CSA RCM y archivo abierto RADARSAT-1.
  2. Monitoreo de vegetación e inundaciones combinando Copernicus Sentinel-1/2 y flujos de referencia del ESA Open Science Catalog.
  3. Análisis de precipitación y cobertura de nieve con productos de JAXA G-Portal superpuestos con capas de NASA Worldview.
  4. Exploración de cráteres y altimetría lunar usando NASA PDS y LRO (LROC/LOLA).
  5. Comparación térmica entre datos polares de NASA LRO Diviner Lunar Data y glaciares terrestres de NASA Earthdata Search.
- Contrastar los GeoTIFF generados por la plataforma abriéndolos directamente en QGIS (siguiendo los pasos de verificación del *SAR Python Tutorial*) para confirmar exactitud radiométrica, ausencia de desplazamientos espaciales y correcta asignación de sistemas de referencia (EPSG / IAU).

### 4.3. Pruebas de Rendimiento y Escalabilidad Básica

**Responsables:** Arquitecto Cloud + 2 Ingenieros Backend.

**Evaluación:**
- Simular cargas concurrentes de peticiones de teselas en TiTiler (con k6 o Locust) y ejecución simultánea de 10 tareas pesadas de procesamiento SAR/óptico.
- Ajustar el tamaño de bloques de Dask/Rasterio, límites de memoria de los contenedores worker y políticas de autoescalado para evitar errores OOM (Out of Memory) y mantener tiempos de respuesta de teselas inferiores a 500 ms.

### 4.4. Automatización CI/CD y Despliegue en Producción (MVP)

**Responsables:** Arquitecto Cloud + 1 Ingeniero Backend.

**Pasos de liberación:**
- Configurar pipelines en GitHub Actions que ejecuten linters, pruebas unitarias, escaneo de vulnerabilidades en imágenes Docker y despliegue automático a `staging` tras cada merge a `develop`.
- Ejecutar promoción controlada hacia `prod` mediante aprobación manual y `terraform apply`.
- Activar tableros de observabilidad (logs centralizados, métricas de CPU/RAM de workers, tasa de errores HTTP y alertas de presupuesto cloud).

---

## Fase 5: Documentación y Entrega

### 5.1. Documentación Técnica y de Arquitectura

**Responsables:** Arquitecto Cloud + Ingeniero de Datos Geoespaciales + Backend.

**Entregables:**
- Diagramas de arquitectura cloud, flujos de datos asíncronos y modelo entidad-relación de PostGIS/pgSTAC.
- Documentación interactiva de APIs generada automáticamente (OpenAPI / Swagger) con ejemplos de peticiones para cada conector (NASA, CSA, ESA, JAXA).
- Guía de extensibilidad para desarrolladores: instrucciones paso a paso para registrar nuevos conectores de agencias espaciales o añadir nuevos algoritmos Python al worker de procesamiento.

### 5.2. Documentación de Usuario (Guía Rápida del MVP)

**Responsables:** 2 Desarrolladores Frontend.

**Entregables:**
- Guía ilustrada de inicio rápido cubriendo: configuración de credenciales de agencias espaciales, búsqueda federada en Tierra/Luna/Marte, uso de capas de NASA Worldview, ejecución de flujos SAR/ópticos/térmicos y exportación de resultados.
- Catálogo de formatos soportados, proyecciones disponibles y limitaciones conocidas de la versión inicial.

### 5.3. Revisión Post-Lanzamiento y Planificación de Siguiente Iteración

**Responsables:** Todo el equipo liderado por el Tech Lead.

**Actividades:**
- Realizar sesiones de prueba asistida con usuarios piloto (analistas SIG, investigadores y desarrolladores) sobre el entorno de producción.
- Recopilar métricas de uso real, tiempos de procesamiento por sensor y errores reportados.
- Priorizar el backlog de la Versión 1.1 (ej. soporte para series temporales largas en Zarr, nuevos algoritmos de clasificación supervisada y exportación directa de mapas web compartibles).
