function isMobileUI() {
  return window.matchMedia("(max-width: 768px)").matches;
}

function hideLeafletControlsOnMobile() {
  if (!isMobileUI()) return;

  // Oculta TODOS los controles Leaflet en móvil
  // (si quieres dejar alguno, me dices y lo ajustamos)
  const container = map.getContainer();
  container.querySelectorAll(".leaflet-control").forEach(el => {
    el.style.display = "none";
  });
}


// js/mapas.js
let map;
let layerTablero = null;
let layerMapabase = null;
let controlCapas = null;

document.addEventListener("DOMContentLoaded", () => {
    initMap();
    cargarTableroGeoJSON(); // ✅ cargar al iniciar
    cargarMapabaseGeoJSON()
    cargarFamiliasLinguisticas();
    cargarLenguasComoCapas();  

});

function initMap() {
    map = L.map("map", {

        center: [4.6, -74.1],
        zoom: 8,
        zoomSnap: 0.1,
        zoomDelta: 0.1,
        wheelPxPerZoomLevel: 200,
        zoomControl: false
    }).setView([4.6, -74.1], 6);

    createPane("base", 200);
    createPane("pane1", 300);
    createPane("pane2", 400);
    createPane("pane3", 500);
    createPane("pane4", 600);
    createPane("labels", 650);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
        pane: "base"
    }).addTo(map);

    map.getPane("labels").style.pointerEvents = "none";

    // ✅ Control de capas (vacío por ahora, luego le añadimos el tablero)
    controlCapas = L.control.layers(
        {},  // base layers
        {},  // overlays
        { collapsed: false }
    ).addTo(map);
    hideLeafletControlsOnMobile();

}

function createPane(name, zIndex) {
    map.createPane(name);
    map.getPane(name).style.zIndex = String(zIndex);
}

// =========================
// ✅ Cargar tablero GeoJSON
// =========================
async function cargarTableroGeoJSON() {
    const url = "../GIS/Layers/001tablero.geojson"; // ruta relativa

    try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`No se pudo cargar ${url} (HTTP ${resp.status})`);

        const geojson = await resp.json();

        // Si ya existía, la removemos para recargar
        if (layerTablero) {
            map.removeLayer(layerTablero);
            // si ya estaba registrada en el control, la quitamos y la volvemos a agregar
            // (Leaflet no tiene removeOverlay directo, así que recreamos control si quieres más adelante)
        }

        layerTablero = L.geoJSON(geojson, {
            pane: "pane2", // 👈 elige el pane que quieras
            style: () => ({
                weight: 2,
                opacity: 1,
                fillOpacity: 1,
                fillColor: "white",
                pane: "base"
            }),
            onEachFeature: (feature, layer) => {
                const nombre = feature?.properties?.nombre || feature?.properties?.Name || "Tablero";
                layer.bindPopup(`<b>${nombre}</b>`);
            }
        });

        // ✅ Por defecto: mostrar la capa
        layerTablero.addTo(map);

        // ✅ Agregar al control para mostrar/ocultar
        controlCapas.addOverlay(layerTablero, "001 Tablero");

        // (Opcional) ajustar vista a la capa
        const b = layerTablero.getBounds();
        if (b.isValid()) map.fitBounds(b, { padding: [20, 20] });

    } catch (e) {
        console.error("Error cargando tablero:", e);
        // Si tienes un label de estado, aquí lo puedes actualizar
    }
    renderMobilePanel();

}
async function cargarMapabaseGeoJSON() {
    const url = "../GIS/Layers/002basemap.geojson"; // ruta relativa

    try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`No se pudo cargar ${url} (HTTP ${resp.status})`);

        const geojson = await resp.json();

        // Si ya existía, la removemos para recargar
        if (layerMapabase) {
            map.removeLayer(layerMapabase);
            // si ya estaba registrada en el control, la quitamos y la volvemos a agregar
            // (Leaflet no tiene removeOverlay directo, así que recreamos control si quieres más adelante)
        }

        layerMapabase = L.geoJSON(geojson, {
            pane: "pane2", // 👈 elige el pane que quieras
            style: () => ({
                weight: 0,
                opacity: 1,
                fillOpacity: 1,
                fillColor: "#E7E5E4",
                pane: "pane1"
            }),
            onEachFeature: (feature, layer) => {
                const nombre = feature?.properties?.nombre || feature?.properties?.Name || "Mapa base";
                layer.bindPopup(`<b>${nombre}</b>`);
            }
        });

        // ✅ Por defecto: mostrar la capa
        layerMapabase.addTo(map);

        // ✅ Agregar al control para mostrar/ocultar
        controlCapas.addOverlay(layerMapabase, "001 Mapa base");

        // (Opcional) ajustar vista a la capa
        const b = layerMapabase.getBounds();
        if (b.isValid()) map.fitBounds(b, { padding: [20, 20] });

    } catch (e) {
        console.error("Error cargando tablero:", e);
        // Si tienes un label de estado, aquí lo puedes actualizar
    }
    renderMobilePanel();

}
let familiasLayers = {};     // { "Arawak": L.GeoJSON, ... }
let familiasColors = {};     // { "Arawak": "#xxxxxx", ... }
let controlFamilias = null;

async function cargarFamiliasLinguisticas() {
    const url = "../GIS/Layers/Familias.geojson";

    try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`No se pudo cargar ${url} (HTTP ${resp.status})`);
        const geojson = await resp.json();

        // --- Normalización opcional (por si hay typos: "Arawawk" -> "Arawak") ---
        const normalizarFamilia = (f) => {
            if (!f) return "Sin familia";
            const x = String(f).trim();
            if (x.toLowerCase() === "arawawk") return "Arawak"; // 👈 corrige typo del archivo
            return x;
        };

        // 1) Agrupar features por familia
        const grupos = {};
        for (const feat of geojson.features || []) {
            const fam = normalizarFamilia(feat?.properties?.Familia);
            if (!grupos[fam]) grupos[fam] = [];
            grupos[fam].push(feat);
        }

        // 2) Asignar colores (paleta simple, suficiente para 8-12 familias)
        const palette = [
            "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728",
            "#9467bd", "#8c564b", "#e377c2", "#7f7f7f",
            "#bcbd22", "#17becf"
        ];

        const familias = Object.keys(grupos).sort((a, b) => a.localeCompare(b));
        familias.forEach((fam, i) => {
            familiasColors[fam] = palette[i % palette.length];
        });

        // 3) Crear una capa por familia (en el pane que tú elijas)
        //    Tip: usa pane3 o pane4 para que quede encima del tablero
        const paneFamilias = "pane3";

        // Si ya existía, remover layers anteriores del mapa
        for (const fam in familiasLayers) {
            if (map.hasLayer(familiasLayers[fam])) map.removeLayer(familiasLayers[fam]);
        }
        familiasLayers = {};

        for (const fam of familias) {
            const fc = { type: "FeatureCollection", features: grupos[fam] };

            familiasLayers[fam] = L.geoJSON(fc, {
                pane: paneFamilias,
                style: () => ({
                    color: familiasColors[fam],
                    weight: 2,
                    opacity: 0.95,
                    fillColor: familiasColors[fam],
                    fillOpacity: 0.20,
                    pane: "pane2"
                }),
                onEachFeature: (feature, layer) => {
                    const f = normalizarFamilia(feature?.properties?.Familia);
                    const lenguas = feature?.properties?.Lenguas ?? "";
                    layer.bindPopup(`
            <div style="min-width:220px">
              <b>Familia:</b> ${f}<br>
              <b>Lenguas:</b> ${lenguas}
            </div>
          `);
                }
            });

            // Por defecto: se muestran todas
            familiasLayers[fam].addTo(map);
        }

        // 4) Control aparte (leyenda + checkboxes)
        if (controlFamilias) controlFamilias.remove();
        controlFamilias = crearControlFamilias(familias);
        controlFamilias.addTo(map);

    } catch (e) {
        console.error("Error cargando Familias lingüísticas:", e);
    }
    renderMobilePanel();

}

function crearControlFamilias(familias) {
    const ctrl = L.control({ position: "topright" });

    ctrl.onAdd = function () {
        const div = L.DomUtil.create("div", "leaflet-control leaflet-bar p-2 bg-white");
        div.style.minWidth = "220px";
        div.style.borderRadius = "8px";

        div.innerHTML = `
      <div class="fw-semibold" style="font-size:13px; padding:2px 4px;">Familias lingüísticas</div>
      <div style="max-height: 220px; overflow:auto; padding:4px;">
        ${familias.map(fam => `
          <label style="display:flex; align-items:center; gap:8px; font-size:13px; margin:6px 0;">
            <input type="checkbox" data-fam="${fam}" checked />
            <span style="width:14px; height:14px; border-radius:3px; background:${familiasColors[fam]}; border:1px solid rgba(0,0,0,.2);"></span>
            <span>${fam}</span>
          </label>
        `).join("")}
      </div>
    `;

        // Evita que al hacer click en el control se mueva el mapa
        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.disableScrollPropagation(div);

        // listeners checkbox
        div.querySelectorAll('input[type="checkbox"][data-fam]').forEach(chk => {
            chk.addEventListener("change", (e) => {
                const fam = e.target.dataset.fam;
                const lyr = familiasLayers[fam];
                if (!lyr) return;

                if (e.target.checked) lyr.addTo(map);
                else map.removeLayer(lyr);
            });
        });

        return div;
    };

    return ctrl;
}

let controlLenguas = null;
let familiasLenguasLayers = {}; // { "Arawak": L.LayerGroup, ... }
let coloresFamiliaLenguas = {}; // { "Arawak": "#xxxxxx", ... }
async function cargarLenguasComoCapas() {
    const url = "../GIS/Layers/Lenguas.json"; // ajusta ruta

    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`No se pudo cargar ${url} (HTTP ${resp.status})`);
    const arr = await resp.json(); // array de lenguas

    // 1) familia -> color (puedes reusar tu paleta)
    const familias = [...new Set(arr.map(x => (x.familia || "Sin familia").trim()))]
        .sort((a, b) => a.localeCompare(b));

    const palette = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"];
    coloresFamiliaLenguas = {};
    familias.forEach((f, i) => coloresFamiliaLenguas[f] = palette[i % palette.length]);

    // 2) construir un layerGroup por familia (con circleMarkers)
    // limpiar anteriores si existen
    for (const f in familiasLenguasLayers) {
        if (map.hasLayer(familiasLenguasLayers[f])) map.removeLayer(familiasLenguasLayers[f]);
    }
    familiasLenguasLayers = {};

    for (const fam of familias) {
        familiasLenguasLayers[fam] = L.layerGroup([], { pane: "pane4" });
    }

    for (const lengua of arr) {
        const nombre = lengua.nombre || "Sin nombre";
        const iso = lengua.iso || "";
        const fam = (lengua.familia || "Sin familia").trim();
        const pobl = lengua.poblacion_aprox ?? null;
        const color = coloresFamiliaLenguas[fam] || "#444";

        if (!Array.isArray(lengua.lugares)) continue;

        for (const lugar of lengua.lugares) {
            const lat = Number(lugar.lat);
            const lng = Number(lugar.lng);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

            const m = L.circleMarker([lat, lng], {
                pane: "pane4",
                radius: 6,
                color:"black",
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
          <div><b>Lugar:</b> ${escapeHtml(lugar.nombre || "")}</div>
        </div>
      `);

            // meter en la capa de su familia
            familiasLenguasLayers[fam].addLayer(m);
        }
    }

    // 3) Crear control Leaflet (aparte, a la izquierda)
    if (controlLenguas) controlLenguas.remove();

    // overlays con etiqueta + color
    const overlays = {};
    for (const fam of familias) {
        const c = coloresFamiliaLenguas[fam];
        overlays[`<span class="legend-dot" style="background:${c}"></span>${escapeHtml(fam)}`] = familiasLenguasLayers[fam];
    }

    controlLenguas = L.control.layers(
        {},          // base layers
        overlays,    // overlays (familias)
        { collapsed: false, position: "topleft" }
    );
    controlLenguas.addTo(map);

    // 4) Mostrar por defecto todas (o comenta esto si quieres que inicien apagadas)
    for (const fam of familias) {
        familiasLenguasLayers[fam].addTo(map);
    }

    // 5) aplicar clase para scroll al control
    setTimeout(() => {
        const el = controlLenguas.getContainer();
        el.classList.add("leaflet-control-lenguajes");
    }, 0);
    renderMobilePanel();

}
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}
function renderMobilePanel() {
  if (!isMobileUI()) return;

  // 1) Capas base (tablero + mapa base)
  const baseEl = document.getElementById("panel-base");
  if (baseEl) {
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

  // 2) Familias (polígonos)
  const famEl = document.getElementById("panel-familias");
  if (famEl) {
    const familias = Object.keys(familiasLayers || {}).sort((a,b)=>a.localeCompare(b));
    famEl.innerHTML = familias.length
      ? familias.map(f => renderLegendToggle(`fam-${slug(f)}`, f, familiasColors[f], map.hasLayer(familiasLayers[f]))).join("")
      : `<div class="text-secondary small">Cargando familias…</div>`;

    familias.forEach(f => {
      wireToggle(`fam-${slug(f)}`, (checked) => {
        const lyr = familiasLayers[f];
        if (!lyr) return;
        checked ? lyr.addTo(map) : map.removeLayer(lyr);
      });
    });
  }

  // 3) Lenguas (puntos) por familia
  const lenEl = document.getElementById("panel-lenguas");
  if (lenEl) {
    const familias = Object.keys(familiasLenguasLayers || {}).sort((a,b)=>a.localeCompare(b));
    lenEl.innerHTML = familias.length
      ? familias.map(f => renderLegendToggle(`len-${slug(f)}`, f, coloresFamiliaLenguas[f], map.hasLayer(familiasLenguasLayers[f]))).join("")
      : `<div class="text-secondary small">Cargando lenguas…</div>`;

    familias.forEach(f => {
      wireToggle(`len-${slug(f)}`, (checked) => {
        const grp = familiasLenguasLayers[f];
        if (!grp) return;
        checked ? grp.addTo(map) : map.removeLayer(grp);
      });
    });
  }
}

function renderToggle(id, label, checked) {
  return `
    <div class="form-check d-flex align-items-center justify-content-between py-1">
      <label class="form-check-label" for="${id}">${label}</label>
      <input class="form-check-input" type="checkbox" id="${id}" ${checked ? "checked" : ""}>
    </div>
  `;
}

function renderLegendToggle(id, label, color, checked) {
  const dot = `<span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${color || "#777"};border:1px solid rgba(0,0,0,.2);margin-right:8px;"></span>`;
  return `
    <div class="form-check d-flex align-items-center justify-content-between py-1">
      <label class="form-check-label" for="${id}" style="display:flex;align-items:center;gap:0;">
        ${dot}<span>${escapeHtml(label)}</span>
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


