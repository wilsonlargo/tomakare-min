/* ============================================================
   gestion-acciones.v4.js
   - Marcadores por grupo (colores) + controles en panel para activar/desactivar por grupo
   - Filtro "Todos" (default) en Departamentos y al iniciar muestra todos los marcadores
   - NO trae / NO dibuja registros sin lat/lng
   Contexto: Bootstrap + Bootstrap Icons + Leaflet + Supabase
   Requiere en tu HTML:
     - #selDepartamento, #selMunicipio, #map, #panelContenido
     - (Opcional) switches #chkDeptos y #chkMpios si manejas capas GIS
   Requiere: window.supabaseClient (ya autenticado)
   ============================================================ */

/* -------------------- Config -------------------- */
const T_GESTION = "gestion";
const T_DEPTOS = "departamentos";
const T_MUN = "municipios";

// Columnas (ajusta solo si difieren)
const DEP_ID = "id";
const DEP_NOMBRE = "departamento";

const MUN_ID = "id";
const MUN_LUGAR = "lugar";
const MUN_LAT = "lat";
const MUN_LNG = "lng";
const MUN_FK_DEP = "departamento_id";

// En "gestion": columnas (según tu contexto)
const G_DEP = "Departamentos";
const G_MUN = "Municipios";
const G_LAT = "lat";
const G_LNG = "lng";
const G_GRUPO = "Grupo Interno de Trabajo";

const G_PROGRAMA = "Programa"
const G_OBJETIVO = "Objetivo del programa"

const G_SECTOR = "1 Pueblo /Sector"
const G_ESTADO = "ESTADO"
const G_PRESUPUESTO = "Presupuesto"
const G_ID = "id"

const DEP_ALL_VALUE = "__ALL__";

/* -------------------- Helpers -------------------- */
const $ = (id) => document.getElementById(id);

function normText(v) {
    return String(v ?? "").trim().replace(/\s+/g, " ");
}

function setPanel(html) {
    const el = $("panelContenido");
    if (el) el.innerHTML = html;
}

/* -------------------- Colores por grupo -------------------- */
const GROUP_PALETTE = [
    "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
    "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"
];

function hashString(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i);
    return Math.abs(h);
}

function colorFromHash(name) {
    const hue = hashString(name) % 360;
    return `hsl(${hue}, 55%, 42%)`;
}

function buildGroupColorMap(groups) {
    const map = new Map();
    let i = 0;
    groups.forEach(g => {
        if (map.has(g)) return;
        const color = i < GROUP_PALETTE.length ? GROUP_PALETTE[i] : colorFromHash(g);
        map.set(g, color);
        i++;
    });
    return map;
}

/* -------------------- Leaflet -------------------- */
let map = null;
let layerGestiones = null;

// Por grupo
let groupLayers = new Map();       // grupo -> L.LayerGroup
let groupVisibility = new Map();   // grupo -> boolean (persistente entre filtros)

function initMap() {
    map = L.map("map", { zoomControl: false }).setView([4.65, -74.10], 6);
    //https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png

    L.tileLayer("", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);

    layerGestiones = L.layerGroup().addTo(map);


}
function crearPanes() {
    // Crea panes
    map.createPane("pane1");
    map.createPane("pane2");
    map.createPane("pane3");
    map.createPane("pane4");
    map.createPane("pane5");
    map.createPane("pane6");
    map.createPane("labels");

    // Orden (zIndex). Más alto = más arriba
    map.getPane("pane1").style.zIndex = 200;
    map.getPane("pane2").style.zIndex = 302;
    map.getPane("pane3").style.zIndex = 403;
    map.getPane("pane4").style.zIndex = 504;
    map.getPane("pane5").style.zIndex = 605;
    map.getPane("pane6").style.zIndex = 706;

    // Labels arriba de todo
    map.getPane("labels").style.zIndex = 850;
    map.getPane("labels").style.pointerEvents = "none"; // para que no bloqueen clicks
}

/* -------------------- Supabase helpers -------------------- */
function sb() {
    if (!window.supabaseClient) {
        throw new Error("Falta window.supabaseClient (inicializa Supabase antes de este script).");
    }
    return window.supabaseClient;
}

/* -------------------- Selects -------------------- */
async function cargarDepartamentos() {
    const sel = $("selDepartamento");
    if (!sel) throw new Error("No existe #selDepartamento en el HTML.");

    sel.innerHTML = `<option value="">Cargando...</option>`;

    const { data, error } = await sb()
        .from(T_DEPTOS)
        .select(`${DEP_ID},${DEP_NOMBRE}`)
        .order(DEP_NOMBRE, { ascending: true });

    if (error) throw error;

    sel.innerHTML =
        `<option value="${DEP_ALL_VALUE}">Todos</option>` +
        (data || []).map(d => `<option value="${d[DEP_ID]}">${d[DEP_NOMBRE]}</option>`).join("");
}

async function cargarMunicipios(deptoId) {
    const selMun = $("selMunicipio");
    if (!selMun) throw new Error("No existe #selMunicipio en el HTML.");

    // Si es "Todos", no cargamos lista completa (muy grande)
    if (deptoId === DEP_ALL_VALUE) {
        selMun.disabled = true;
        selMun.innerHTML = `<option value="">(Todos los municipios)</option>`;
        return;
    }

    selMun.disabled = true;
    selMun.innerHTML = `<option value="">Cargando...</option>`;

    const { data, error } = await sb()
        .from(T_MUN)
        .select(`${MUN_ID},${MUN_LUGAR},${MUN_LAT},${MUN_LNG}`)
        .eq(MUN_FK_DEP, deptoId)
        .order(MUN_LUGAR, { ascending: true });

    if (error) throw error;

    selMun.innerHTML =
        `<option value="">Seleccione...</option>` +
        (data || []).map(m =>
            `<option value="${m[MUN_ID]}" data-lat="${m[MUN_LAT]}" data-lng="${m[MUN_LNG]}">${m[MUN_LUGAR]}</option>`
        ).join("");

    selMun.disabled = false;

    console.log("Municipios del departamento (lugar, lat, lng):", data || []);
}

/* -------------------- Gestión: traer + contar (solo con coord) -------------------- */
async function traerGestionesTodas() {
    const { data, error } = await sb()
        .from(T_GESTION)
        .select(`${G_MUN},${G_LAT},${G_LNG},"${G_ID}","${G_GRUPO}","${G_PROGRAMA}","${G_OBJETIVO}","${G_SECTOR}","${G_PRESUPUESTO}","${G_ESTADO}"`)

        .not(G_LAT, "is", null)
        .not(G_LNG, "is", null);

    if (error) throw error;
    return data || [];
}

async function traerGestionesPorDepartamento(depNombre) {
    const dep = normText(depNombre).toLowerCase();
    if (!dep) return [];

    const { data, error } = await sb()
        .from(T_GESTION)
        .select(`${G_MUN},${G_LAT},${G_LNG},"${G_ID}","${G_GRUPO}","${G_PROGRAMA}","${G_OBJETIVO}","${G_SECTOR}","${G_PRESUPUESTO}","${G_ESTADO}"`)

        .ilike(G_DEP, dep)
        .not(G_LAT, "is", null)
        .not(G_LNG, "is", null);

    if (error) throw error;
    return data || [];
}

async function contarGestionesTodas() {
    const { count, error } = await sb()
        .from(T_GESTION)
        .select(G_LAT, { count: "exact", head: true })
        .not(G_LAT, "is", null)
        .not(G_LNG, "is", null);

    if (error) throw error;
    return count || 0;
}

async function contarGestionesPorDepartamento(depNombre) {
    const dep = normText(depNombre).toLowerCase();
    if (!dep) return 0;

    const { count, error } = await sb()
        .from(T_GESTION)
        .select(G_LAT, { count: "exact", head: true })
        .ilike(G_DEP, dep)
        .not(G_LAT, "is", null)
        .not(G_LNG, "is", null);

    if (error) throw error;
    return count || 0;
}

/* -------------------- Grupos: capas + controles -------------------- */
function clearGroupLayers() {
    if (!layerGestiones) return;
    for (const [, lg] of groupLayers) {
        layerGestiones.removeLayer(lg);
    }
    groupLayers.clear();
}

function toggleGrupo(grupo, visible) {
    groupVisibility.set(grupo, visible);

    const lg = groupLayers.get(grupo);
    if (!lg || !layerGestiones) return;

    if (visible) layerGestiones.addLayer(lg);
    else layerGestiones.removeLayer(lg);
}

function renderLegendControls(stats) {
    const { groups, colorMap, counts } = stats;
    if (!groups.length) return "";

    const items = groups.map(g => {
        const c = colorMap.get(g) || "#6c757d";
        const n = counts.get(g) || 0;
        const id = `grp_${hashString(g)}`;
        const checked = groupVisibility.has(g) ? groupVisibility.get(g) : true;

        // Persistimos default
        if (!groupVisibility.has(g)) groupVisibility.set(g, true);

        return `
      <div class="d-flex align-items-center justify-content-between py-1">
        <div class="d-flex align-items-center">
          <span class="d-inline-block rounded-circle me-2" style="width:12px;height:12px;background:${c};"></span>
          <label class="small mb-0" for="${id}">${g}</label>
          <span class="badge text-bg-light border ms-2">${n}</span>
        </div>

        <div class="form-check form-switch m-0">
          <input class="form-check-input js-grp-toggle"
                 type="checkbox"
                 role="switch"
                 id="${id}"
                 data-grupo="${encodeURIComponent(g)}"
                 ${checked ? "checked" : ""}>
        </div>
      </div>
    `;
    }).join("");

    return `
    <div class="mt-3 border rounded p-3 bg-white">
      <div class="fw-semibold mb-2"><i class="bi bi-people me-2"></i>Grupos de gestión</div>
      ${items}
      <div class="small text-muted mt-2">
        Activa/desactiva marcadores por <code>${G_GRUPO}</code>.
      </div>
    </div>
  `;
}

function bindGroupToggleEvents() {
    document.querySelectorAll(".js-grp-toggle").forEach(inp => {
        inp.addEventListener("change", () => {
            const grupo = decodeURIComponent(inp.dataset.grupo || "");
            toggleGrupo(grupo, inp.checked);
        });
    });
}

/* -------------------- Pintar marcadores (por grupo) -------------------- */
function pintarGestionesEnMapa(rows, tituloDepto) {
    if (!map || !layerGestiones) return { groups: [], colorMap: new Map(), counts: new Map() };

    // 1) limpiar lo anterior
    layerGestiones.clearLayers();
    clearGroupLayers();

    // 2) grupos + conteos
    const counts = new Map();
    (rows || []).forEach(r => {
        const g = normText(r[G_GRUPO]) || "Sin grupo";
        counts.set(g, (counts.get(g) || 0) + 1);
    });

    const groups = Array.from(counts.keys()).sort((a, b) => a.localeCompare(b, "es"));
    const colorMap = buildGroupColorMap(groups);

    // 3) crear una capa por grupo
    groups.forEach(g => groupLayers.set(g, L.layerGroup()));

    // 4) crear marcadores y meterlos en su grupo
    const bounds = [];
    let pintados = 0;

    (rows || []).forEach(r => {
        const lat = Number(r[G_LAT]);
        const lng = Number(r[G_LNG]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        const mun = r[G_MUN] || "";
        const depReal = r[G_DEP] || tituloDepto || "";
        const grupo = normText(r[G_GRUPO]) || "Sin grupo";
        const color = colorMap.get(grupo) || "#6c757d";

        const programa = normText(r[G_PROGRAMA]) || "Sin programa";
        const objetivo = normText(r[G_OBJETIVO]) || "Sin objetivo";
        const sector = normText(r[G_SECTOR]) || "Sin sector";
        const estado = normText(r[G_ESTADO]) || "Sin estado";
        const id = normText(r[G_ID]) || "Sin estado";
        const presupuesto = normText(r[G_PRESUPUESTO]) || "Sin estado";

        const marker = L.circleMarker([lat, lng], {
            radius: 6,
            color: "black",
            fillColor: color,
            fillOpacity: 0.70,
            weight: 1,
            pane: "pane4" // si no existe, Leaflet ignora
        });

        marker.bindPopup(`<strong>${mun}</strong>
        
        <div>
            <span class="small text-primary">${grupo}</span>
        </div>
        <div>
            <span class="small text-muted">${programa}</span>
        </div>
        <div>
            <span class="small text-dark fw-bold mb-1 mt-1">${sector}</span>
        </div>
        <div>
            <span class="small text-dark fw-bold mb-1 mt-1">${estado}</span>
        </div>
        <div>
            <span class="small text-success fw-bold">${presupuesto}</span>
        </div>
        <div>
            <i class="small text-muted">${objetivo}</i>
        </div>

        <div>
            <span class="small text-mute">${id}</span>
        </div>
    `);

        const gl = groupLayers.get(grupo);
        if (gl) gl.addLayer(marker);

        bounds.push([lat, lng]);
        pintados++;
    });

    // 5) aplicar visibilidad por grupo (por defecto: visible)
    groups.forEach(g => {
        const visible = groupVisibility.has(g) ? groupVisibility.get(g) : true;
        groupVisibility.set(g, visible);
        if (visible) layerGestiones.addLayer(groupLayers.get(g));
    });

    //console.log(`Puntos pintados (${tituloDepto || "Todos"}):`, pintados);

    if (bounds.length) map.fitBounds(bounds, { padding: [20, 20] });

    return { groups, colorMap, counts };
}

/* -------------------- UI -------------------- */
function initUI() {
    // Panel inicial (sin variables no definidas)
    setPanel(`
    <div class="alert alert-light border mb-0">
      <div class="d-flex align-items-center gap-2">
        <i class="bi bi-info-circle"></i>
        <div>
          <div class="fw-semibold">Mapa de acciones</div>
          <div class="small text-muted">Seleccione un departamento (o "Todos") y use los switches para filtrar por grupo.</div>
        </div>
      </div>
    </div>
      
  `);

    const selDep = $("selDepartamento");
    const selMun = $("selMunicipio");
    if (!selDep || !selMun) throw new Error("Faltan #selDepartamento o #selMunicipio en el HTML.");

    selDep.addEventListener("change", async () => {
        const depId = selDep.value;
        const depNombre = selDep.selectedOptions[0]?.textContent || "";

        try {
            // Municipios dependientes
            await cargarMunicipios(depId);

            // Traer gestiones según depto
            let rows = [];
            let total = 0;
            let titulo = depNombre || "Todos";

            if (depId === DEP_ALL_VALUE) {
                rows = await traerGestionesTodas();
                total = await contarGestionesTodas();
                titulo = "Todos";
            } else {
                rows = await traerGestionesPorDepartamento(depNombre);
                total = await contarGestionesPorDepartamento(depNombre);
            }

            // Pintar y generar controles por grupo
            const stats = pintarGestionesEnMapa(rows, titulo);
            const legend = renderLegendControls(stats);

            setPanel(`
        <div class="border rounded p-3 bg-white">
          <div class="d-flex align-items-center justify-content-between">
            <div class="fw-semibold"><i class="bi bi-geo-alt me-2"></i>${titulo}</div>
            <span class="badge text-bg-secondary">${total} gestiones</span>
          </div>
          <div class="small text-muted mt-2">Solo se dibujan registros con <code>lat</code> y <code>lng</code>.</div>
        </div>
        ${legend}
      `);

            // IMPORTANTE: después de pintar el HTML
            bindGroupToggleEvents();

        } catch (e) {
            console.error(e);
            setPanel(`<div class="alert alert-danger mb-0">Error cargando datos. Revise consola.</div>`);
        }
    });

    // Municipio: solo consola + centrar
    selMun.addEventListener("change", async () => {
        const opt = selMun.selectedOptions[0];
        if (!opt || !selMun.value) return;

        const lugar = opt.textContent;
        const lat = Number(opt.dataset.lat);
        const lng = Number(opt.dataset.lng);

        console.log("Municipio seleccionado (tabla municipios):", { lugar, lat, lng });

        if (Number.isFinite(lat) && Number.isFinite(lng) && map) {
            map.flyTo([lat, lng], 10, { duration: 0.6 });
        }
    });
}

/* -------------------- App Init -------------------- */
async function initApp() {
    initMap();
    crearPanes();
    await cargarCapasGIS();
    initUI();
    await cargarDepartamentos();

    // Default: Todos + dispara carga inicial
    const selDep = $("selDepartamento");
    if (selDep) {
        selDep.value = DEP_ALL_VALUE;
        selDep.dispatchEvent(new Event("change"));
    }
}

document.addEventListener("DOMContentLoaded", () => {
    initApp().catch(err => console.error("initApp error:", err));
});

function initControlCapas() {
    const chkDeptos = document.getElementById("chkDeptos");
    const chkMpios = document.getElementById("chkMpios");

    if (!chkDeptos || !chkMpios) return;

    // Estado inicial según si están en el mapa
    chkDeptos.checked = !!layerDeptos && map.hasLayer(layerDeptos);
    chkMpios.checked = !!layerMpios && map.hasLayer(layerMpios);

    chkDeptos.addEventListener("change", () => {
        if (!layerDeptos) return;
        if (chkDeptos.checked) {
            layerDeptos.addTo(map);
            layerDeptos.bringToFront();
        } else {
            map.removeLayer(layerDeptos);
        }
    });

    chkMpios.addEventListener("change", () => {
        if (!layerMpios) return;
        if (chkMpios.checked) {
            layerMpios.addTo(map);
            layerMpios.bringToFront();
        } else {
            map.removeLayer(layerMpios);
        }
    });
}

let layerBase = null;
let layerMpios = null;
let layerDeptos = null;
// let layerTablero = null;

async function cargarGeoJSON(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`No pude cargar: ${url} (${r.status})`);
    return await r.json();
}

function bindHover(layer, baseStyle, hoverStyle) {
    layer.on("mouseover", () => layer.setStyle(hoverStyle));
    layer.on("mouseout", () => layer.setStyle(baseStyle));
}

function initControlCapas() {
    const chkDeptos = document.getElementById("chkDeptos");
    const chkMpios = document.getElementById("chkMpios");

    if (!chkDeptos || !chkMpios) return;

    // Estado inicial según si están en el mapa
    chkDeptos.checked = !!layerDeptos && map.hasLayer(layerDeptos);
    chkMpios.checked = !!layerMpios && map.hasLayer(layerMpios);

    chkDeptos.addEventListener("change", () => {
        if (!layerDeptos) return;
        if (chkDeptos.checked) {
            layerDeptos.addTo(map);
            layerDeptos.bringToFront();
        } else {
            map.removeLayer(layerDeptos);
        }
    });

    chkMpios.addEventListener("change", () => {
        if (!layerMpios) return;
        if (chkMpios.checked) {
            layerMpios.addTo(map);
            layerMpios.bringToFront();
        } else {
            map.removeLayer(layerMpios);
        }
    });
}

async function cargarCapasGIS() {
    // Ajusta si tu carpeta real difiere
    const URL_BASE = "../GIS/Layers/001tablero.geojson";
    const URL_DEPTO = "../GIS/Layers/003departamentos.geojson";
    const URL_MPIO = "../GIS/Layers/004municipios.geojson";
    // const URL_TABLERO = "GIS/Layers/001tablero.geojson";

    const [base, deptos, mpios] = await Promise.all([
        cargarGeoJSON(URL_BASE),
        cargarGeoJSON(URL_DEPTO),
        cargarGeoJSON(URL_MPIO),
        // cargarGeoJSON(URL_TABLERO),
    ]);

    // (Opcional rendimiento)
    const canvas = L.canvas();

    // 1) Basemap
    const baseStyle = { color: "white", weight: 1, fillOpacity: 1 };
    layerBase = L.geoJSON(base, {
        pane: "pane1",
        style: baseStyle
    }).addTo(map);




    // 3) Departamentos
    const depStyle = { color: "#495057", weight: 1.4, fillOpacity: 0 };
    const depHover = { color: "#212529", weight: 2.2, fillOpacity: 0.2 };

    layerDeptos = L.geoJSON(deptos, {
        pane: "pane3",
        style: styleDeptFeature, // ✅ usa la función (respeta heatMode)
        onEachFeature: (f, lyr) => {
            const n = f?.properties?.DPTO_CNMBR || "";
            if (n) lyr.bindTooltip(n, { sticky: true });

            // hover que respeta el heatmap
            lyr.on("mouseover", () => lyr.setStyle(deptHoverStyle(lyr.feature)));
            lyr.on("mouseout", () => lyr.setStyle(styleDeptFeature(lyr.feature)));

            // click: popup con valor según modo actual
            lyr.on("click", (e) => {
                const depName = getDeptNameFromFeature(lyr.feature);
                const val = heatMode === "none" ? null : getDeptValue(depName, heatMode);

                const txt =
                    heatMode === "benef" ? fmtInt.format(Math.round(val)) :
                        heatMode === "pres" ? fmtCOP.format(Math.round(val)) :
                            "";

                L.popup()
                    .setLatLng(e.latlng)
                    .setContent(`
          <div class="fw-semibold">${depName}</div>
          ${heatMode === "none" ? `<div class="small text-muted">Sin mapa de calor</div>` : `
            <div class="small text-muted">${heatMode === "benef" ? "Personas a impactar" : "Presupuesto"}</div>
            <div>${txt}</div>
          `}
        `)
                    .openOn(map);
            });
        }
    }).addTo(map);


    // Ajusta vista a departamentos (o a tablero si lo activas)
    const b = layerDeptos.getBounds();
    if (b && b.isValid()) map.fitBounds(b, { padding: [20, 20] });


    // 2) Municipios
    const mpioStyle = { color: "black", weight: 1, fillOpacity: 0.5, fillColor: "lightgray" };
    const mpioHover = { color: "#6c757d", weight: 1.2, fillOpacity: 1 };

    layerMpios = L.geoJSON(mpios, {
        pane: "pane4",
        style: mpioStyle,
        renderer: canvas,
        onEachFeature: (f, lyr) => {
            const m = f?.properties?.MPIO_CNMBR || "";
            const d = f?.properties?.DEPTO || "";
            if (m) lyr.bindTooltip(`${m}${d ? " — " + d : ""}`, { sticky: true });

            bindHover(lyr, mpioStyle, mpioHover);
        }
    }).addTo(map);

    console.log("Capas GIS cargadas:", {
        base: !!layerBase,
        municipios: !!layerMpios,
        departamentos: !!layerDeptos
    });
    initControlCapas();
    // Heatmap deptos: engancha controles (radio buttons) una sola vez
    bindHeatmapControls();
}
const G_BEN = "Personas a impactar";
const G_PRES = "Presupuesto";
// ===================== HEATMAP DEPARTAMENTOS =====================
let heatMode = "none"; // "none" | "benef" | "pres"

// cache agregados de gestion por departamento
let depAggCache = null; // Map depKey -> { depName, benef, pres }

// clasificación + leyenda
let heatBreaks = [];      // 4 cortes (5 clases)
let heatBinCounts = [];   // frecuencia por clase
let heatMinMax = { min: 0, max: 0 }; // para leyenda
const HEAT_COLORS = ["#ffffb2", "#fecc5c", "#fd8d3c", "#f03b20", "#bd0026"]; // YlOrRd (visible) // sobrio (azules)

// formateadores
const fmtInt = new Intl.NumberFormat("es-CO");
const fmtCOP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

function normKey(s) {
    return String(s ?? "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // quita tildes
        .replace(/\s+/g, " ");
}

function parseNum(v) {
    if (v == null) return 0;
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    // quita $ puntos, comas, espacios, etc. deja solo dígitos y signo
    const s = String(v).replace(/[^\d-]/g, "");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
}

async function cargarAgregadosDepartamentos() {
    if (depAggCache) return depAggCache;

    // OJO: si tus columnas tienen mayúsculas, este select con comillas funciona mejor
    const { data, error } = await window.supabaseClient
        .from("gestion")
        .select(`"${G_DEP}","${G_BEN}","${G_PRES}"`);

    if (error) throw error;

    const m = new Map();

    (data || []).forEach(r => {
        const dep = r?.[G_DEP];
        if (!dep) return;
        const key = normKey(dep);

        const prev = m.get(key) || { depName: dep, benef: 0, pres: 0 };
        prev.benef += parseNum(r?.[G_BEN]);
        prev.pres += parseNum(r?.[G_PRES]);
        m.set(key, prev);
    });

    depAggCache = m;
    return m;
}

// cortes por cuantiles (5 clases)
function computeQuantileBreaks(values, k = 5) {
    const sorted = [...values].sort((a, b) => a - b);
    if (!sorted.length) return [0, 0, 0, 0];

    const breaks = [];
    for (let i = 1; i < k; i++) {
        const idx = Math.floor((i / k) * (sorted.length - 1));
        breaks.push(sorted[idx]);
    }

    // asegurar que sean crecientes (si hay muchos iguales)
    for (let i = 1; i < breaks.length; i++) {
        if (breaks[i] < breaks[i - 1]) breaks[i] = breaks[i - 1];
    }
    return breaks;
}

function classIndex(v, breaks) {
    for (let i = 0; i < breaks.length; i++) {
        if (v <= breaks[i]) return i;
    }
    return breaks.length;
}

function getDeptNameFromFeature(f) {
    return f?.properties?.DPTO_CNMBR || f?.properties?.DPTO || "";
}

function getDeptValue(depName, mode) {
    const rec = depAggCache?.get(normKey(depName));
    if (!rec) return 0;
    return mode === "benef" ? rec.benef : rec.pres;
}

function styleDeptFeature(feature) {
    // tu estilo base si NO hay calor
    const base = { color: "#495057", weight: 1.4, fillOpacity: 0, fillColor: "transparent" };

    if (!layerDeptos) return base;
    if (heatMode === "none") return base;

    const depName = getDeptNameFromFeature(feature);
    const v = getDeptValue(depName, heatMode);
    const idx = classIndex(v, heatBreaks);
    const fill = HEAT_COLORS[idx] || HEAT_COLORS[0];

    return {
        color: "#212529",
        weight: 1.2,
        fillColor: fill,
        fillOpacity: 0.70
    };
}

function deptHoverStyle(feature) {
    const s = styleDeptFeature(feature);
    return { ...s, weight: (s.weight || 1.2) + 1 };
}

function updateHeatLegendUI() {
  const el = document.getElementById("heatLegend");
  if (!el) return;

  if (heatMode === "none") {
    el.innerHTML = `<div class="small text-muted">Mapa de calor desactivado.</div>`;
    return;
  }

  const isBenef = heatMode === "benef";
  const fmt = isBenef ? (n) => fmtInt.format(Math.round(n)) : (n) => fmtCOP.format(Math.round(n));
  const label = isBenef ? "Personas a impactar" : "Presupuesto";

  const b = heatBreaks; // 4 breaks => 5 clases
  const min = heatMinMax?.min ?? 0;

  const ranges = [
    [min, b[0]],
    [b[0], b[1]],
    [b[1], b[2]],
    [b[2], b[3]],
    [b[3], null]
  ];

  const items = ranges.map((r, i) => {
    const left = fmt(r[0]);
    const right = r[1] == null ? "más" : fmt(r[1]);
    const freq = heatBinCounts[i] || 0;

    return `
      <div class="d-flex align-items-center justify-content-between py-1">
        <div class="d-flex align-items-center">
          <span class="d-inline-block rounded me-2" style="width:14px;height:14px;background:${HEAT_COLORS[i]};border:1px solid #dee2e6;"></span>
          <span class="small">${left} – ${right}</span>
        </div>
        <span class="badge text-bg-light border">${freq}</span>
      </div>
    `;
  }).join("");

  el.innerHTML = `
    <div class="small text-muted mb-2">${label} por departamento (frecuencia = # deptos)</div>
    ${items}
  `;
}

async function aplicarCalorDepartamentos(mode) {
    heatMode = mode;

    if (!layerDeptos) return;

    // recalcular breaks y frecuencia
    if (heatMode === "none") {
        layerDeptos.setStyle(styleDeptFeature);
        updateHeatLegendUI();
        return;
    }

    await cargarAgregadosDepartamentos();

    // valores por cada feature (depto)
    const values = [];
    const binCounts = [0, 0, 0, 0, 0];

    layerDeptos.eachLayer(lyr => {
        const depName = getDeptNameFromFeature(lyr.feature);
        const v = getDeptValue(depName, heatMode);
        values.push(v);
    });

    heatMinMax = values.length ? { min: Math.min(...values), max: Math.max(...values) } : { min: 0, max: 0 };

  heatBreaks = computeQuantileBreaks(values, 5);

    // bin frequency
    values.forEach(v => {
        const idx = classIndex(v, heatBreaks);
        binCounts[idx] = (binCounts[idx] || 0) + 1;
    });
    heatBinCounts = binCounts;

    // aplicar estilo
    layerDeptos.setStyle(styleDeptFeature);
    updateHeatLegendUI();


}


function renderHeatmapControls() {
    // Se renderiza dentro del panel (Bootstrap)
    return `
    <div class="mt-3 border rounded p-3 bg-white">
      <div class="fw-semibold mb-2"><i class="bi bi-thermometer-half me-2"></i>Mapa de calor (Departamentos)</div>

      <div class="btn-group w-100" role="group" aria-label="Heatmap deptos">
        <input type="radio" class="btn-check" name="hmDeptos" id="hmNone" autocomplete="off" ${heatMode === "none" ? "checked" : ""}>
        <label class="btn btn-outline-secondary" for="hmNone">Ninguno</label>

        <input type="radio" class="btn-check" name="hmDeptos" id="hmBenef" autocomplete="off" ${heatMode === "benef" ? "checked" : ""}>
        <label class="btn btn-outline-secondary" for="hmBenef">Beneficiarios</label>

        <input type="radio" class="btn-check" name="hmDeptos" id="hmPres" autocomplete="off" ${heatMode === "pres" ? "checked" : ""}>
        <label class="btn btn-outline-secondary" for="hmPres">Presupuesto</label>
      </div>

      <div class="mt-3" id="heatLegend"></div>
    </div>
  `;
}

function bindHeatmapControls() {
    const a = document.getElementById("hmNone");
    const b = document.getElementById("hmBenef");
    const c = document.getElementById("hmPres");
    if (!a || !b || !c) return;

    a.addEventListener("change", () => a.checked && aplicarCalorDepartamentos("none"));
    b.addEventListener("change", () => b.checked && aplicarCalorDepartamentos("benef"));
    c.addEventListener("change", () => c.checked && aplicarCalorDepartamentos("pres"));

    updateHeatLegendUI();

    // Pintar inmediatamente según selección actual
    mode = b.checked ? "benef" : (c.checked ? "pres" : "none");
    aplicarCalorDepartamentos(mode).catch(console.error);
}

// =================== FIN HEATMAP DEPARTAMENTOS ===================
