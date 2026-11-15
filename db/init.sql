-- Extensión espacial requerida por PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Tabla de ítems STAC (Sentinel-2 y otras colecciones)
CREATE TABLE IF NOT EXISTS stac_items (
    id          TEXT PRIMARY KEY,
    collection  TEXT,
    datetime    TIMESTAMPTZ,
    platform    TEXT,
    cloud_cover NUMERIC,
    bbox        NUMERIC[],
    footprint   GEOMETRY(Geometry, 4326),
    assets      JSONB,
    properties  JSONB,
    raw         JSONB,
    inserted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stac_items_footprint
    ON stac_items USING GIST (footprint);

CREATE INDEX IF NOT EXISTS idx_stac_items_collection
    ON stac_items (collection);

CREATE INDEX IF NOT EXISTS idx_stac_items_datetime
    ON stac_items (datetime);
