/* ============================================================
   gestion-acciones.fixed.js  (ARREGLADO)
   - Quita el error depNombre no definido
   - Colores por "Grupo Interno de Trabajo"
   - Leyenda en el panel (nombre + color, y conteo opcional)
   - NO dibuja registros sin lat/lng (ni los trae desde Supabase)
   Contexto: Bootstrap + Bootstrap Icons + Leaflet + Supabase
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

// En "gestion" (según tu contexto):
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

function buildGroupStats(rows) {
    const groupSet = new Set();
    const counts = new Map();

    (rows || []).forEach(r => {
        const g = normText(r[G_GRUPO]) || "Sin grupo";
        groupSet.add(g);
        counts.set(g, (counts.get(g) || 0) + 1);
    });

    const groups = Array.from(groupSet).sort((a, b) => a.localeCompare(b, "es"));

    const colorMap = new Map();
    let i = 0;
    groups.forEach(g => {
        const color = i < GROUP_PALETTE.length ? GROUP_PALETTE[i] : colorFromHash(g);
        colorMap.set(g, color);
        i++;
    });

    return { groups, colorMap, counts };
}

function renderLegend({ groups, colorMap, counts }) {
    if (!groups.length) return "";

    const items = groups.map(g => {
        const c = colorMap.get(g) || "#6c757d";
        const n = counts.get(g) || 0;
        return `
      <div class="d-flex align-items-center justify-content-between py-1">
        <div class="d-flex align-items-center">
          <span class="d-inline-block rounded-circle me-2" style="width:12px;height:12px;background:${c};"></span>
          <span class="small">${g}</span>
        </div>
        <span class="badge text-bg-light border">${n}</span>
      </div>
    `;
    }).join("");

    return `
    <div class="mt-3 border rounded p-3 bg-white">
      <div class="fw-semibold mb-2"><i class="bi bi-palette me-2"></i>Leyenda por grupo</div>
      ${items}
    </div>
  `;
}

/* -------------------- Leaflet -------------------- */
let map = null;
let layerGestiones = null;

function initMap() {
    map = L.map("map", { zoomControl: false }).setView([4.65, -74.10], 6);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);

    layerGestiones = L.layerGroup().addTo(map);
}

/* -------------------- Supabase helpers -------------------- */
function sb() {
    if (!window.supabaseClient) {
        throw new Error("Falta window.supabaseClient (inicializa Supabase antes de este script).");
    }
    return window.supabaseClient;
}

/* -------------------- Cargar selects -------------------- */
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
        `<option value="">Seleccione...</option>` +
        (data || []).map(d => `<option value="${d[DEP_ID]}">${d[DEP_NOMBRE]}</option>`).join("");
}

async function cargarMunicipios(deptoId) {
    const selMun = $("selMunicipio");
    if (!selMun) throw new Error("No existe #selMunicipio en el HTML.");

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

/* -------------------- Conteos en gestion -------------------- */
async function contarGestionesPorDepartamento(nombreDepartamento) {
    const dep = normText(nombreDepartamento).toLowerCase();
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

async function contarGestionesPorMunicipio(nombreMunicipio) {
    const mun = normText(nombreMunicipio).toLowerCase();
    if (!mun) return 0;

    const { count, error } = await sb()
        .from(T_GESTION)
        .select(G_LAT, { count: "exact", head: true })
        .ilike(G_MUN, mun)
        .not(G_LAT, "is", null)
        .not(G_LNG, "is", null);

    if (error) throw error;
    return count || 0;
}

/* -------------------- Pintar en el mapa -------------------- */
async function traerGestionesPorDepartamento(nombreDepartamento) {
    const dep = normText(nombreDepartamento).toLowerCase();
    if (!dep) return [];

    const { data, error } = await sb()
        .from(T_GESTION)
        // Importante: incluir grupo y filtrar sin coordenadas
        .select(`${G_MUN},${G_LAT},${G_LNG},"${G_ID}","${G_GRUPO}","${G_PROGRAMA}","${G_OBJETIVO}","${G_SECTOR}","${G_PRESUPUESTO}","${G_ESTADO}"`)
        .ilike(G_DEP, dep)
        .not(G_LAT, "is", null)
        .not(G_LNG, "is", null);

    if (error) throw error;
    return data || [];
}

function pintarGestionesEnMapa(rows, depNombre) {
    if (!map || !layerGestiones) return { groups: [], colorMap: new Map(), counts: new Map() };

    layerGestiones.clearLayers();

    const stats = buildGroupStats(rows);
    const bounds = [];
    let pintados = 0;

    (rows || []).forEach(r => {
        const lat = Number(r[G_LAT]);
        const lng = Number(r[G_LNG]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        const mun = r[G_MUN] || "";
        const grupo = normText(r[G_GRUPO]) || "Sin grupo";
        const programa = normText(r[G_PROGRAMA]) || "Sin programa";
        const objetivo = normText(r[G_OBJETIVO]) || "Sin objetivo";
        const sector = normText(r[G_SECTOR]) || "Sin sector";
        const estado = normText(r[G_ESTADO]) || "Sin estado";
        const presupuesto = normText(r[G_PRESUPUESTO]) || "Sin estado";
        
        ;
        const id = normText(r[G_ID]) || "Sin id";

        const color = stats.colorMap.get(grupo) || "#6c757d";

        L.circleMarker([lat, lng], {
            radius: 6,
            color,
            fillColor: color,
            fillOpacity: 0.75,
            weight: 1
        })
            .addTo(layerGestiones)
            .bindPopup(`
        <strong>${mun}</strong>
        <br>${depNombre}<br>
        <div>
            <span class="small text-primary">${grupo}</span>
        </div>
        <div>
            <span class="small text-muted">${programa}</span>
        </div>
        <div>
            <span class="small text-dark fw-bold fs-6">${sector}</span>
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

        bounds.push([lat, lng]);
        pintados++;
    });

    console.log(`Gestiones (con coordenadas) en "${depNombre}":`, rows?.length || 0);
    console.log(`Puntos pintados:`, pintados);

    if (bounds.length) map.fitBounds(bounds, { padding: [20, 20] });

    return stats;
}

/* -------------------- App Init -------------------- */
function initUI() {
    // Panel inicial (sin variables no definidas)
    setPanel(`
    <div class="alert alert-light border mb-0">
      <div class="d-flex align-items-center gap-2">
        <i class="bi bi-info-circle"></i>
        <div>
          <div class="fw-semibold">Seleccione un departamento</div>
          <div class="small text-muted">Se dibujan solo registros de <code>gestion</code> con <code>lat</code> y <code>lng</code>.</div>
        </div>
      </div>
    </div>
  `);

    const selDep = $("selDepartamento");
    const selMun = $("selMunicipio");

    if (!selDep) throw new Error("No existe #selDepartamento en el HTML.");
    if (!selMun) throw new Error("No existe #selMunicipio en el HTML.");

    // Estado inicial municipios
    selMun.innerHTML = `<option value="">Seleccione un departamento primero</option>`;
    selMun.disabled = true;

    // Listener: Departamento
    selDep.addEventListener("change", async () => {
        const depId = selDep.value;

        if (!depId) {
            layerGestiones?.clearLayers();
            selMun.innerHTML = `<option value="">Seleccione un departamento primero</option>`;
            selMun.disabled = true;
            return;
        }

        const depNombre = selDep.selectedOptions[0]?.textContent || "";

        try {
            await cargarMunicipios(depId);

            const conteoDep = await contarGestionesPorDepartamento(depNombre);
            const rows = await traerGestionesPorDepartamento(depNombre);

            const stats = pintarGestionesEnMapa(rows, depNombre);
            const legendHtml = renderLegend(stats);

            setPanel(`
        <div class="border rounded p-3 bg-white">
          <div class="d-flex align-items-center justify-content-between">
            <div class="fw-semibold"><i class="bi bi-geo-alt me-2"></i>${depNombre}</div>
            <span class="badge text-bg-secondary">${conteoDep} gestiones</span>
          </div>
          <div class="small text-muted mt-2">
            Colores por <code>${G_GRUPO}</code>. Solo se dibujan registros con coordenadas.
          </div>
        </div>
        ${legendHtml}
      `);
        } catch (e) {
            console.error(e);
            setPanel(`<div class="alert alert-danger mb-0">Error cargando datos. Revise consola.</div>`);
        }
    });

    // Listener: Municipio (solo consola + centrar)
    selMun.addEventListener("change", async () => {
        const opt = selMun.selectedOptions[0];
        if (!opt || !selMun.value) return;

        const lugar = opt.textContent;
        const lat = Number(opt.dataset.lat);
        const lng = Number(opt.dataset.lng);

        console.log("Municipio seleccionado (tabla municipios):", { lugar, lat, lng });

        try {
            const conteoMun = await contarGestionesPorMunicipio(lugar);
            console.log(`Gestiones (con coordenadas) en gestion para municipio "${lugar}":`, conteoMun);

            if (Number.isFinite(lat) && Number.isFinite(lng) && map) {
                map.flyTo([lat, lng], 10, { duration: 0.6 });
            }
        } catch (e) {
            console.error(e);
        }
    });
}

async function initApp() {
    initMap();
    initUI();
    await cargarDepartamentos();
}

document.addEventListener("DOMContentLoaded", () => {
    initApp().catch(err => console.error("initApp error:", err));
});
function aPesosCOP(valor) {
  const n = Number(valor ?? 0);
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(n);
}