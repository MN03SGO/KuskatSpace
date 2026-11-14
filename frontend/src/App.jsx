import React, { useState, useEffect } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, ImageOverlay, Rectangle, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const API_BASE = "http://localhost:8000";
const WORLD_BOUNDS = [[-90, -180], [90, 180]];

function MapController({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.flyToBounds(bounds, { padding: [40, 40], maxZoom: 6, duration: 0.7 });
    }
  }, [bounds, map]);
  return null;
}

function MapClickSelector({ onSelectPoint }) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      const clampedLat = Math.max(-85, Math.min(85, lat));
      const clampedLng = Math.max(-175, Math.min(175, lng));
      const newBbox = `${(clampedLng - 1.5).toFixed(2)},${(clampedLat - 1.0).toFixed(2)},${(clampedLng + 1.5).toFixed(2)},${(clampedLat + 1.0).toFixed(2)}`;
      onSelectPoint(newBbox);
    },
  });
  return null;
}

export default function App() {
  const [bodyMode, setBodyMode] = useState("earth");
  const [gibsDate, setGibsDate] = useState("2024-08-15");
  const [bbox, setBbox] = useState("-90.1,13.1,-87.6,14.5");
  const [variableFilter, setVariableFilter] = useState("all");
  const [opacity, setOpacity] = useState(0.82);
  const [searchResults, setSearchResults] = useState(null);
  const [processResult, setProcessResult] = useState(null);
  const [activeSceneLabel, setActiveSceneLabel] = useState("Tierra - Región Mesoamérica");
  const [loading, setLoading] = useState(false);

  const parsedBboxBounds = () => {
    const p = bbox.split(",").map(Number);
    if (p.length !== 4 || p.some(isNaN)) return [[13.1, -90.1], [14.5, -87.6]];
    return [[p[1], p[0]], [p[3], p[2]]];
  };

  const switchBodyMode = (mode) => {
    setBodyMode(mode);
    setSearchResults(null);
    setProcessResult(null);
    if (mode === "earth") {
      setBbox("-90.1,13.1,-87.6,14.5");
      setActiveSceneLabel("Tierra - Región Mesoamérica");
    } else if (mode === "moon") {
      setBbox("-30.0,-85.0,30.0,-65.0");
      setActiveSceneLabel("Luna - Polo Sur / LRO Diviner");
    } else {
      setBbox("135.0,-6.0,140.0,-3.0");
      setActiveSceneLabel("Marte - Cráter Gale / NASA PDS");
    }
  };

  const handleFederatedSearch = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        bbox,
        body: bodyMode,
        variable: variableFilter,
        limit: "5",
      });
      const res = await fetch(`${API_BASE}/api/search?${params.toString()}`);
      setSearchResults(await res.json());
    } catch (err) {
      alert("Error conectando con el backend: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRunProcessing = async (mode, customBbox = bbox, sceneTitle = activeSceneLabel) => {
    setLoading(true);
    setActiveSceneLabel(sceneTitle);
    try {
      const params = new URLSearchParams({ mode, bbox: customBbox });
      const res = await fetch(`${API_BASE}/api/process?${params.toString()}`, { method: "POST" });
      const data = await res.json();
      setProcessResult(data);
    } catch (err) {
      alert("Error en procesamiento: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSearchItem = (item) => {
    const itemBboxStr = item.bbox ? item.bbox.join(",") : bbox;
    setBbox(itemBboxStr);
    const title = item.title || item.mission || item.id;
    const mode = item.recommended_mode || (bodyMode === "earth" ? "ndvi" : "diviner_thermal");
    handleRunProcessing(mode, itemBboxStr, title);
  };

  const isEarth = bodyMode === "earth";

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "system-ui, sans-serif", background: "#020617" }}>
      {/* Panel Lateral */}
      <div style={{ width: "420px", padding: "16px", background: "#0f172a", color: "#f8fafc", overflowY: "auto", borderRight: "1px solid #1e293b" }}>
        <h2 style={{ margin: "0 0 12px 0", fontSize: "18px" }}>SIG Cloud & Teledetección Multi-Agencia</h2>

        {/* Selector Tierra / Luna / Marte */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
          {[
            { id: "earth", label: "Tierra (Worldview)" },
            { id: "moon", label: "Luna (LRO/Diviner)" },
            { id: "mars", label: "Marte (PDS)" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => switchBodyMode(tab.id)}
              style={{
                flex: 1,
                padding: "8px 4px",
                fontSize: "12px",
                fontWeight: "bold",
                background: bodyMode === tab.id ? "#2563eb" : "#1e293b",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Búsqueda Federada */}
        <div style={{ background: "#1e293b", padding: "10px", borderRadius: "6px", marginBottom: "12px" }}>
          <div style={{ fontSize: "11px", color: "#38bdf8", marginBottom: "6px" }}>
            Haz clic en cualquier punto del mapa para mover el BBox
          </div>

          {isEarth && (
            <div style={{ marginBottom: "8px" }}>
              <label style={{ fontSize: "11px", color: "#94a3b8" }}>Fecha capa NASA Worldview GIBS:</label>
              <input
                type="date"
                value={gibsDate}
                onChange={(e) => setGibsDate(e.target.value)}
                style={{ width: "100%", padding: "5px", marginTop: "2px", boxSizing: "border-box", background: "#0f172a", color: "#fff", border: "1px solid #334155" }}
              />
            </div>
          )}

          <label style={{ fontSize: "11px", color: "#94a3b8" }}>BBox (minLon, minLat, maxLon, maxLat):</label>
          <input
            value={bbox}
            onChange={(e) => setBbox(e.target.value)}
            style={{ width: "100%", padding: "5px", marginBottom: "8px", boxSizing: "border-box", background: "#0f172a", color: "#fff", border: "1px solid #334155" }}
          />

          <label style={{ fontSize: "11px", color: "#94a3b8" }}>Filtro de Agencia / Variable:</label>
          <select
            value={variableFilter}
            onChange={(e) => setVariableFilter(e.target.value)}
            style={{ width: "100%", padding: "5px", marginBottom: "8px", background: "#0f172a", color: "#fff", border: "1px solid #334155" }}
          >
            <option value="all">Todas las misiones (NASA, CSA, ESA, JAXA)</option>
            <option value="maritime">CSA RCM (Marítimo / Desastres / Ecosistemas)</option>
            <option value="sar_historical">CSA RADARSAT-1 (Archivo SAR Abierto)</option>
            <option value="precipitation">JAXA G-Portal (Precipitación / Nieve / Vegetación)</option>
            <option value="land_ocean">ESA Open Science & Copernicus</option>
          </select>

          <button
            onClick={handleFederatedSearch}
            disabled={loading}
            style={{ width: "100%", padding: "8px", background: "#10b981", color: "#022c22", fontWeight: "bold", border: "none", borderRadius: "4px", cursor: "pointer" }}
          >
            {loading ? "Consultando catálogos..." : "Buscar Escenas en Vivo"}
          </button>
        </div>

        {/* Algoritmos Bajo Demanda */}
        <div style={{ background: "#1e293b", padding: "10px", borderRadius: "6px", marginBottom: "12px" }}>
          <h4 style={{ margin: "0 0 8px 0", fontSize: "14px" }}>Procesamiento Bajo Demanda</h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            <button onClick={() => handleRunProcessing("sar_db")} style={{ padding: "7px", fontSize: "12px", cursor: "pointer" }}>
              SAR dB + Lee (CSA)
            </button>
            <button onClick={() => handleRunProcessing("ndvi")} style={{ padding: "7px", fontSize: "12px", cursor: "pointer" }}>
              Índice NDVI (ESA/NASA)
            </button>
            <button onClick={() => handleRunProcessing("jaxa_precip")} style={{ padding: "7px", fontSize: "12px", cursor: "pointer" }}>
              Precipitación (JAXA)
            </button>
            <button onClick={() => handleRunProcessing("diviner_thermal")} style={{ padding: "7px", fontSize: "12px", cursor: "pointer" }}>
              Térmico LRO Diviner
            </button>
          </div>

          {processResult && (
            <div style={{ marginTop: "10px", paddingTop: "8px", borderTop: "1px solid #334155", fontSize: "12px" }}>
              <div style={{ color: "#38bdf8", fontWeight: "bold", marginBottom: "4px" }}>{activeSceneLabel}</div>
              <div><strong>Unidad:</strong> {processResult.unit}</div>
              <div>
                <strong>Mín:</strong> {processResult.stats.min} | <strong>Máx:</strong> {processResult.stats.max} | <strong>Media:</strong> {processResult.stats.mean}
              </div>

              <div style={{ marginTop: "6px" }}>
                <label style={{ fontSize: "11px" }}>Opacidad: {Math.round(opacity * 100)}%</label>
                <input
                  type="range"
                  min="0.2"
                  max="1"
                  step="0.05"
                  value={opacity}
                  onChange={(e) => setOpacity(parseFloat(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>

              <a
                href={`${API_BASE}/api/export/geotiff?mode=${processResult.mode}&bbox=${encodeURIComponent(bbox)}`}
                style={{
                  display: "block",
                  textAlign: "center",
                  marginTop: "8px",
                  padding: "6px",
                  background: "#3b82f6",
                  color: "#fff",
                  textDecoration: "none",
                  borderRadius: "4px",
                  fontWeight: "bold",
                }}
              >
                Descargar Resultado GeoTIFF (.tif)
              </a>

              {processResult.cryosphere_comparison && (
                <div style={{ background: "#0f172a", padding: "8px", borderRadius: "4px", marginTop: "8px", borderLeft: "3px solid #38bdf8" }}>
                  <strong>Comparativa Polo Lunar vs. Tierra:</strong>
                  <div>Mín. Polo Lunar (Diviner): {processResult.cryosphere_comparison.lunar_psr_min_k} K</div>
                  <div>Media Antártida (Tierra): {processResult.cryosphere_comparison.earth_antarctica_avg_k} K</div>
                  <div style={{ color: "#94a3b8", marginTop: "4px" }}>{processResult.cryosphere_comparison.insight}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Resultados Interactivos */}
        {searchResults && (
          <div style={{ fontSize: "12px" }}>
            <div style={{ color: "#94a3b8", marginBottom: "6px" }}>Haz clic en cualquier escena para ubicarla y procesarla:</div>

            {searchResults.live_copernicus?.length > 0 && (
              <>
                <h4 style={{ margin: "6px 0" }}>ESA Copernicus STAC en Vivo ({searchResults.live_copernicus.length})</h4>
                {searchResults.live_copernicus.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelectSearchItem(item)}
                    style={{ background: "#1e293b", padding: "7px", marginBottom: "5px", borderRadius: "4px", cursor: "pointer", borderLeft: "3px solid #10b981" }}
                  >
                    <div style={{ fontWeight: "bold", wordBreak: "break-all" }}>{item.id}</div>
                    <div style={{ color: "#94a3b8" }}>{item.collection} | Nubes: {item.cloud_cover ?? "N/A"}%</div>
                  </div>
                ))}
              </>
            )}

            {searchResults.live_earthdata?.length > 0 && (
              <>
                <h4 style={{ margin: "6px 0" }}>NASA Earthdata CMR en Vivo ({searchResults.live_earthdata.length})</h4>
                {searchResults.live_earthdata.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelectSearchItem(item)}
                    style={{ background: "#1e293b", padding: "7px", marginBottom: "5px", borderRadius: "4px", cursor: "pointer", borderLeft: "3px solid #3b82f6" }}
                  >
                    <div style={{ fontWeight: "bold" }}>{item.title}</div>
                    <div style={{ color: "#94a3b8" }}>Fecha: {item.date}</div>
                  </div>
                ))}
              </>
            )}

            {searchResults.live_pds_planetary?.length > 0 && (
              <>
                <h4 style={{ margin: "6px 0" }}>NASA PDS Planetario en Vivo ({searchResults.live_pds_planetary.length})</h4>
                {searchResults.live_pds_planetary.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelectSearchItem(item)}
                    style={{ background: "#1e293b", padding: "7px", marginBottom: "5px", borderRadius: "4px", cursor: "pointer", borderLeft: "3px solid #f59e0b" }}
                  >
                    <strong>{item.id}</strong> — Instrumento: {item.instrument}
                  </div>
                ))}
              </>
            )}

            <h4 style={{ margin: "8px 0 4px" }}>Agencias Asociadas ({searchResults.partner_resources?.length || 0})</h4>
            {searchResults.partner_resources?.map((r) => (
              <div
                key={r.id}
                onClick={() => handleSelectSearchItem(r)}
                style={{ background: "#1e293b", padding: "7px", marginBottom: "5px", borderRadius: "4px", cursor: "pointer" }}
              >
                <strong>[{r.agency}] {r.mission}</strong>
                <div style={{ color: "#cbd5e1", fontSize: "11px" }}>{r.instruments}</div>
                <div style={{ color: "#94a3b8", fontSize: "11px" }}>{r.description}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Visor Cartográfico con Proyección Dinámica (EPSG:3857 Tierra / EPSG:4326 Luna-Marte) */}
      <div style={{ flex: 1 }}>
        <MapContainer
          key={bodyMode}
          crs={isEarth ? L.CRS.EPSG3857 : L.CRS.EPSG4326}
          center={isEarth ? [13.8, -88.9] : [0, 0]}
          zoom={isEarth ? 5 : 2}
          minZoom={1}
          maxZoom={isEarth ? 14 : 6}
          maxBounds={WORLD_BOUNDS}
          maxBoundsViscosity={1.0}
          style={{ height: "100%", width: "100%", background: "#050811" }}
        >
          {isEarth && (
            <>
              {/* Capa base satelital de alta disponibilidad (evita pantalla negra a cualquier zoom) */}
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution="Esri World Imagery"
                noWrap={true}
                bounds={WORLD_BOUNDS}
              />
              {/* Capa orbital diaria NASA Worldview GIBS */}
              <TileLayer
                key={gibsDate}
                url={`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${gibsDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`}
                attribution="NASA Worldview GIBS"
                maxNativeZoom={9}
                opacity={0.65}
                noWrap={true}
                bounds={WORLD_BOUNDS}
              />
            </>
          )}

          {bodyMode === "moon" && (
            <TileLayer
              url="https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/{z}/{y}/{x}.jpg"
              attribution="NASA PDS / LRO Moon Trek"
              noWrap={true}
              bounds={WORLD_BOUNDS}
            />
          )}

          {bodyMode === "mars" && (
            <TileLayer
              url="https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg"
              attribution="NASA PDS Mars Trek"
              noWrap={true}
              bounds={WORLD_BOUNDS}
            />
          )}

          <MapController bounds={parsedBboxBounds()} />
          <MapClickSelector onSelectPoint={(newBbox) => setBbox(newBbox)} />

          <Rectangle bounds={parsedBboxBounds()} pathOptions={{ color: "#38bdf8", weight: 2, fillOpacity: 0.05 }} />

          {processResult && (
            <ImageOverlay
              key={`${processResult.mode}-${bbox}`}
              url={processResult.overlay_png_base64}
              bounds={processResult.bounds}
              opacity={opacity}
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
}