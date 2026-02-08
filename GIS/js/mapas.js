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
                    pane:"pane2"
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

