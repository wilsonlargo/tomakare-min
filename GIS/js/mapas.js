// js/mapas.js (reescrito): sin controles Leaflet dentro del mapa.
// Panel Bootstrap externo controla todas las capas.

let map;

// Capas base
let layerTablero = null;
let layerMapabase = null;

// Familias (polígonos) y colores
let familiasLayers = {};   // { "Arawak": L.GeoJSON, ... }
let familiasColors = {};   // { "Arawak": "#xxxxxx", ... }

// Lenguas (puntos) por familia
let familiasLenguasLayers = {}; // { "Arawak": L.LayerGroup, ... }
let coloresFamiliaLenguas = {}; // { "Arawak": "#xxxxxx", ... }

document.addEventListener("DOMContentLoaded", async () => {
  initMap();

  // Cargar todo (pueden correr en paralelo)
  await Promise.allSettled([
    cargarTableroGeoJSON(),
    cargarMapabaseGeoJSON(),
    cargarFamiliasLinguisticas(),
    cargarLenguasComoCapas()
  ]);

  // Render final del panel (por si algo llegó después)
  renderPanelExterno();
});

function initMap() {
  map = L.map("map", {
    center: [4.6, -74.1],
    zoom: 6,
    zoomSnap: 0.1,
    zoomDelta: 0.1,
    wheelPxPerZoomLevel: 200,
    zoomControl: false // (si quieres, luego ponemos botones propios fuera del mapa)
  });

  createPane("base", 200);
  createPane("pane1", 300);
  createPane("pane2", 400);
  createPane("pane3", 500);
  createPane("pane4", 600);

  // Base OSM (puedes cambiar a tu tileset)
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap",
    pane: "base"
  }).addTo(map);
}

function createPane(name, zIndex) {
  map.createPane(name);
  map.getPane(name).style.zIndex = String(zIndex);
}

// =========================
// Cargar tablero GeoJSON
// =========================
async function cargarTableroGeoJSON() {
  const url = "../GIS/Layers/001tablero.geojson";

  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`No se pudo cargar ${url} (HTTP ${resp.status})`);

    const geojson = await resp.json();

    if (layerTablero) map.removeLayer(layerTablero);

    layerTablero = L.geoJSON(geojson, {
      pane: "pane2",
      style: () => ({
        weight: 2,
        opacity: 1,
        fillOpacity: 1,
        fillColor: "white"
      })
    });

    layerTablero.addTo(map);

    // Ajustar vista una sola vez si es válido
    const b = layerTablero.getBounds();
    if (b.isValid()) map.fitBounds(b, { padding: [20, 20] });

  } catch (e) {
    console.error("Error cargando tablero:", e);
  }

  renderPanelExterno();
}

// =========================
// Cargar mapa base GeoJSON
// =========================
async function cargarMapabaseGeoJSON() {
  const url = "../GIS/Layers/002basemap.geojson";

  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`No se pudo cargar ${url} (HTTP ${resp.status})`);

    const geojson = await resp.json();

    if (layerMapabase) map.removeLayer(layerMapabase);

    layerMapabase = L.geoJSON(geojson, {
      pane: "pane1",
      style: () => ({
        weight: 0,
        opacity: 1,
        fillOpacity: 1,
        fillColor: "#E7E5E4"
      })
    });

    layerMapabase.addTo(map);

  } catch (e) {
    console.error("Error cargando mapa base:", e);
  }

  renderPanelExterno();
}

// =========================
// Familias (polígonos)
// =========================
async function cargarFamiliasLinguisticas() {
  const url = "../GIS/Layers/Familias.geojson";

  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`No se pudo cargar ${url} (HTTP ${resp.status})`);
    const geojson = await resp.json();

    const normalizarFamilia = (f) => {
      if (!f) return "Sin familia";
      const x = String(f).trim();
      if (x.toLowerCase() === "arawawk") return "Arawak";
      return x;
    };

    // Agrupar por familia
    const grupos = {};
    for (const feat of (geojson.features || [])) {
      const fam = normalizarFamilia(feat?.properties?.Familia);
      if (!grupos[fam]) grupos[fam] = [];
      grupos[fam].push(feat);
    }

    // Paleta (reutilizamos en puntos)
    const palette = [
      "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728",
      "#9467bd", "#8c564b", "#e377c2", "#7f7f7f",
      "#bcbd22", "#17becf"
    ];

    const familias = Object.keys(grupos).sort((a, b) => a.localeCompare(b));
    familiasColors = {};
    familias.forEach((fam, i) => familiasColors[fam] = palette[i % palette.length]);

    // Limpiar capas anteriores
    for (const fam in familiasLayers) {
      if (map.hasLayer(familiasLayers[fam])) map.removeLayer(familiasLayers[fam]);
    }
    familiasLayers = {};

    // Crear una capa por familia
    const paneFamilias = "pane3";
    for (const fam of familias) {
      const fc = { type: "FeatureCollection", features: grupos[fam] };

      familiasLayers[fam] = L.geoJSON(fc, {
        pane: paneFamilias,
        style: () => ({
          color: familiasColors[fam],
          weight: 2,
          opacity: 0.95,
          fillColor: familiasColors[fam],
          fillOpacity: 0.20
        }),
        onEachFeature: (feature, layer) => {
          const f = normalizarFamilia(feature?.properties?.Familia);
          const lenguas = feature?.properties?.Lenguas ?? "";
          layer.bindPopup(`
            <div style="min-width:220px">
              <b>Familia:</b> ${escapeHtml(f)}<br>
              <b>Lenguas:</b> ${escapeHtml(lenguas)}
            </div>
          `);
        }
      });

      // Por defecto: mostrar todas
      familiasLayers[fam].addTo(map);
    }

  } catch (e) {
    console.error("Error cargando Familias:", e);
  }

  renderPanelExterno();
}

// =========================
// Lenguas (puntos)
// =========================
async function cargarLenguasComoCapas() {
  const url = "../GIS/Layers/Lenguas.json";

  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`No se pudo cargar ${url} (HTTP ${resp.status})`);
    const arr = await resp.json();

    // Familias únicas
    const familias = [...new Set(arr.map(x => (x.familia || "Sin familia").trim()))]
      .sort((a, b) => a.localeCompare(b));

    // Paleta
    const palette = [
      "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728",
      "#9467bd", "#8c564b", "#e377c2", "#7f7f7f",
      "#bcbd22", "#17becf"
    ];
    coloresFamiliaLenguas = {};
    familias.forEach((f, i) => coloresFamiliaLenguas[f] = palette[i % palette.length]);

    // Limpiar anteriores
    for (const f in familiasLenguasLayers) {
      if (map.hasLayer(familiasLenguasLayers[f])) map.removeLayer(familiasLenguasLayers[f]);
    }
    familiasLenguasLayers = {};
    for (const fam of familias) {
      familiasLenguasLayers[fam] = L.layerGroup([], { pane: "pane4" });
    }

    for (const lengua of arr) {
      const nombre = lengua.nombre || "Sin nombre";
      const iso = lengua.iso || lengua.iso639_3 || "";
      const fam = (lengua.familia || "Sin familia").trim();
      const pobl = lengua.poblacion_aprox ?? null;
      const color = coloresFamiliaLenguas[fam] || "#444";

      if (!Array.isArray(lengua.lugares)) continue;

      for (const lugar of lengua.lugares) {
        const lat = Number(lugar.lat);
        const lng = Number(lugar.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

        const municipio = lugar.municipio || lugar.nombre || "";
        const depto = lugar.departamento || "";

        const m = L.circleMarker([lat, lng], {
          pane: "pane4",
          radius: 6,
          color: "black",
          weight: 2,
          fillColor: color,
          fillOpacity: 1
        }).bindPopup(`
          <div style="min-width:240px">
            <div style="font-weight:700; margin-bottom:4px;">${escapeHtml(nombre)}</div>
            <div><b>ISO:</b> ${escapeHtml(iso)}</div>
            <div><b>Familia:</b> ${escapeHtml(fam)}</div>
            ${pobl !== null ? `<div><b>Población aprox:</b> ${Number(pobl).toLocaleString("es-CO")}</div>` : ""}
            <hr style="margin:8px 0">
            <div><b>Lugar:</b> ${escapeHtml(municipio)} ${depto ? `(${escapeHtml(depto)})` : ""}</div>
          </div>
        `);

        familiasLenguasLayers[fam].addLayer(m);
      }
    }

    // Por defecto: mostrar todas
    for (const fam of familias) {
      familiasLenguasLayers[fam].addTo(map);
    }

  } catch (e) {
    console.error("Error cargando Lenguas:", e);
  }

  renderPanelExterno();
}

// =========================
// Panel externo (Bootstrap)
// =========================
function renderPanelExterno() {
  renderPanelBase();
  renderPanelFamilias();
  renderPanelLenguas();
}

function renderPanelBase() {
  const baseEl = document.getElementById("panel-base");
  if (!baseEl) return;

  baseEl.innerHTML = `
    ${renderToggle("toggle-tablero", "001 Tablero", !!layerTablero && map.hasLayer(layerTablero))}
    ${renderToggle("toggle-mapabase", "001 Mapa base", !!layerMapabase && map.hasLayer(layerMapabase))}
  `;

  wireToggle("toggle-tablero", (checked) => {
    if (!layerTablero) return;
    checked ? layerTablero.addTo(map) : map.removeLayer(layerTablero);
  });
  wireToggle("toggle-mapabase", (checked) => {
    if (!layerMapabase) return;
    checked ? layerMapabase.addTo(map) : map.removeLayer(layerMapabase);
  });
}

function renderPanelFamilias() {
  const famEl = document.getElementById("panel-familias");
  if (!famEl) return;

  const familias = Object.keys(familiasLayers || {}).sort((a, b) => a.localeCompare(b));
  famEl.innerHTML = familias.length
    ? familias.map(f => renderLegendToggle(`fam-${slug(f)}`, f, familiasColors[f], map.hasLayer(familiasLayers[f]))).join("")
    : `<div class="text-secondary small">Sin datos de familias.</div>`;

  familias.forEach(f => {
    wireToggle(`fam-${slug(f)}`, (checked) => {
      const lyr = familiasLayers[f];
      if (!lyr) return;
      checked ? lyr.addTo(map) : map.removeLayer(lyr);
    });
  });
}

function renderPanelLenguas() {
  const lenEl = document.getElementById("panel-lenguas");
  if (!lenEl) return;

  const familias = Object.keys(familiasLenguasLayers || {}).sort((a, b) => a.localeCompare(b));
  lenEl.innerHTML = familias.length
    ? familias.map(f => renderLegendToggle(`len-${slug(f)}`, f, coloresFamiliaLenguas[f], map.hasLayer(familiasLenguasLayers[f]))).join("")
    : `<div class="text-secondary small">Sin datos de lenguas.</div>`;

  familias.forEach(f => {
    wireToggle(`len-${slug(f)}`, (checked) => {
      const grp = familiasLenguasLayers[f];
      if (!grp) return;
      checked ? grp.addTo(map) : map.removeLayer(grp);
    });
  });

  // Buscador simple (filtra familias de puntos)
  const input = document.getElementById("buscarLenguas");
  if (input) {
    input.oninput = () => {
      const q = input.value.trim().toLowerCase();
      lenEl.querySelectorAll(".form-check").forEach(row => {
        const txt = row.textContent.toLowerCase();
        row.style.display = txt.includes(q) ? "" : "none";
      });
    };
  }
}

// =========================
// Helpers UI
// =========================
function renderToggle(id, label, checked) {
  return `
    <div class="form-check d-flex align-items-center justify-content-between py-1">
      <label class="form-check-label" for="${id}">${escapeHtml(label)}</label>
      <input class="form-check-input" type="checkbox" id="${id}" ${checked ? "checked" : ""}>
    </div>
  `;
}

function renderLegendToggle(id, label, color, checked) {
  return `
    <div class="form-check d-flex align-items-center justify-content-between py-1">
      <label class="form-check-label" for="${id}" style="display:flex;align-items:center;">
        <span class="legend-dot" style="background:${color || "#777"}"></span>
        <span>${escapeHtml(label)}</span>
      </label>
      <input class="form-check-input" type="checkbox" id="${id}" ${checked ? "checked" : ""}>
    </div>
  `;
}

function wireToggle(id, onChange) {
  const el = document.getElementById(id);
  if (!el) return;
  el.onchange = (e) => onChange(!!e.target.checked);
}

function slug(s) {
  return String(s).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "");
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[m]));
}
