/* =========================================================
   Dashboard Gestión (PP-III)
   - Requiere: window.supabaseClient (ya autenticado)
   - Tabla: TABLE_NAME
   - Estrategia: carga única (select '*') + filtros/KPIs en memoria
   ========================================================= */
function normTxt(s) {
  return (s ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function parseListFlexible(s) {
  if (!s) return [];
  let t = String(s).trim();
  if (!t) return [];
  // convierte conectores comunes en separador
  t = t.replace(/\s+y\s+/gi, ";");
  // separa por ; , saltos de línea, | /
  const parts = t.split(/[;\n,|/]+/g).map(x => x.trim()).filter(Boolean);
  // únicos
  const seen = new Set();
  const out = [];
  for (const p of parts) {
    const k = normTxt(p);
    if (!k) continue;
    if (!seen.has(k)) { seen.add(k); out.push(p); }
  }
  return out;
}
let mapAcciones, layerDept, layerMun, layerPts, geoDept, geoMun, geoBase;
let breaksDept = [], breaksMun = [];
let deptAgg = new Map();   // normDept -> value
let munAgg = new Map();    // normDept|normMun -> value

// índices de coordenadas desde supabase
let munIndex = new Map();  // normDept|normMun -> {lat,lng, departamento_id, lugar, departamento}
let munByName = new Map(); // normMun -> [rows]

// colores categóricos
const CAT_COLORS = ["#1f77b4","#ff7f0e","#2ca02c","#d62728","#9467bd","#8c564b","#e377c2","#7f7f7f","#bcbd22","#17becf"];

const TABLE_NAME = "gestion"; // <-- AJUSTA si tu tabla se llama distinto

// Columnas (tal como están en tu tabla en Supabase)
const COL = {
  id: "id",
  grupo: "Grupo Interno de Trabajo",
  programa: "Programa",
  subprograma: "Sub programa",
  objetivo: "Objetivo del programa",
  presupuesto: "Presupuesto",
  personas: "Personas a impactar",
  avance: "AVANCE CORTE JULIO - DICIEMBRE",
  estado: "ESTADO"
};

// UI
const els = {
  supabaseMissing: document.getElementById("supabaseMissing"),
  fGrupo: document.getElementById("fGrupo"),
  fPrograma: document.getElementById("fPrograma"),
  fSubprograma: document.getElementById("fSubprograma"),
  fObjetivo: document.getElementById("fObjetivo"),
  btnReset: document.getElementById("btnReset"),

  lblScope: document.getElementById("lblScope"),

  kpiActividades: document.getElementById("kpiActividades"),
  kpiPresupuesto: document.getElementById("kpiPresupuesto"),
  kpiPresupuestoNota: document.getElementById("kpiPresupuestoNota"),
  kpiPersonas: document.getElementById("kpiPersonas"),
  kpiAvance: document.getElementById("kpiAvance"),

  badgeEstados: document.getElementById("badgeEstados"),
  tblEstados: document.getElementById("tblEstados"),

  ttlAgrupado: document.getElementById("ttlAgrupado"),
  colAgrupa: document.getElementById("colAgrupa"),
  tblAgrupado: document.getElementById("tblAgrupado"),

  dbg: document.getElementById("dbg"),
};

function hasSupabase() {
  return typeof window.supabaseClient !== "undefined" && window.supabaseClient;
}

// --- helpers robustos para leer columnas con espacios (y fallback por si hay normalización) ---
function getVal(row, colName) {
  if (!row || !colName) return undefined;
  if (Object.prototype.hasOwnProperty.call(row, colName)) return row[colName];

  // fallbacks típicos (por si alguna vista/normalización cambia nombres)
  const altNoSpaces = colName.replaceAll(" ", "");
  if (Object.prototype.hasOwnProperty.call(row, altNoSpaces)) return row[altNoSpaces];

  const altUnderscore = colName.replaceAll(" ", "_");
  if (Object.prototype.hasOwnProperty.call(row, altUnderscore)) return row[altUnderscore];

  return row[colName];
}

function fmtInt(n) {
  const x = Number.isFinite(n) ? n : 0;
  return x.toLocaleString("es-CO");
}

function fmtMoneyCOP(n) {
  const x = Number.isFinite(n) ? n : 0;
  return x.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

function parseNumberLoose(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v).trim();
  if (!s) return 0;

  const cleaned = s.replace(/[^\d.,-]/g, "");
  if (!cleaned) return 0;

  const mostlyInt = cleaned.replace(/[.,]/g, "");
  const num = Number(mostlyInt);
  return Number.isFinite(num) ? num : 0;
}

function parsePercentLoose(v) {
  if (v === null || v === undefined) return NaN;

  // Si viene numérico
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return NaN;
    if (v >= 0 && v <= 1) return v * 100;      // 0.45 => 45%
    if (v >= 0 && v <= 100) return v;          // 45 => 45%
    return NaN;                                 // cualquier cosa rara
  }

  let s = String(v).trim();
  if (!s) return NaN;

  // Quita el símbolo % y deja solo dígitos/separadores
  s = s.replace("%", "").trim();
  s = s.replace(/[^\d.,-]/g, "");
  if (!s) return NaN;

  // Normaliza separadores:
  // Caso típico ES/CO: 12.345,67  => 12345.67
  if (s.includes(".") && s.includes(",")) {
    s = s.replaceAll(".", "").replace(",", ".");
  } else {
    // Si hay una sola coma y ningún punto: 45,5 => 45.5
    const dotCount = (s.match(/\./g) || []).length;
    const commaCount = (s.match(/,/g) || []).length;

    if (commaCount === 1 && dotCount === 0) s = s.replace(",", ".");
    // Si hay varios puntos (miles): 4.290.565 => 4290565
    if (dotCount > 1 && commaCount === 0) s = s.replaceAll(".", "");
    // Si hay varias comas (miles): 4,290,565 => 4290565
    if (commaCount > 1 && dotCount === 0) s = s.replaceAll(",", "");
    // Si hay 1 punto y 1 coma (ambiguo) ya quedó cubierto arriba
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return NaN;

  if (n >= 0 && n <= 1) return n * 100;
  if (n >= 0 && n <= 100) return n;

  return NaN; // descarta outliers que revientan el promedio
}


function setSelectOptions(selectEl, values, includeAll = true) {
  const current = selectEl.value;

  selectEl.innerHTML = "";
  if (includeAll) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "(Todos)";
    selectEl.appendChild(opt);
  }

  values.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    selectEl.appendChild(opt);
  });

  // restaura si aún existe
  if ([...selectEl.options].some(o => o.value === current)) {
    selectEl.value = current;
  } else {
    selectEl.value = "";
  }
}

function uniqSorted(arr) {
  const set = new Set();
  arr.forEach(v => {
    const s = (v ?? "").toString().trim();
    if (s) set.add(s);
  });
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}

function scopeLabel() {
  const parts = [];
  if (els.fGrupo.value) parts.push(`GIT: ${els.fGrupo.value}`);
  if (els.fPrograma.value) parts.push(`Programa: ${els.fPrograma.value}`);
  if (els.fSubprograma.value) parts.push(`Sub: ${els.fSubprograma.value}`);
  if (els.fObjetivo.value) parts.push(`Objetivo: ${els.fObjetivo.value}`);
  return parts.length ? parts.join(" / ") : "Sin filtros (todo)";
}

function getNextGroupField() {
  if (!els.fGrupo.value) return { field: COL.grupo, label: "Grupo Interno de Trabajo" };
  if (!els.fPrograma.value) return { field: COL.programa, label: "Programa" };
  if (!els.fSubprograma.value) return { field: COL.subprograma, label: "Sub programa" };
  if (!els.fObjetivo.value) return { field: COL.objetivo, label: "Objetivo del programa" };
  return { field: COL.estado, label: "ESTADO" };
}

async function requireAuth() {
  const { data, error } = await window.supabaseClient.auth.getSession();
  if (error) throw error;
  if (!data?.session) window.location.href = "./index.html";
}

// ======================
// Data cache (carga única)
// ======================
let ALL_ROWS = [];

async function loadAllRows() {
  // 350 registros → perfecto para memoria
  const { data, error } = await window.supabaseClient
    .from(TABLE_NAME)
    .select("*")
    .range(0, 9999); // por si crece un poco

  if (error) throw error;
  ALL_ROWS = Array.isArray(data) ? data : [];
  return ALL_ROWS;
}

function getFilteredRows() {
  const g = els.fGrupo.value;
  const p = els.fPrograma.value;
  const s = els.fSubprograma.value;
  const o = els.fObjetivo.value;

  return ALL_ROWS.filter(r => {
    if (g && (getVal(r, COL.grupo) ?? "").toString().trim() !== g) return false;
    if (p && (getVal(r, COL.programa) ?? "").toString().trim() !== p) return false;
    if (s && (getVal(r, COL.subprograma) ?? "").toString().trim() !== s) return false;
    if (o && (getVal(r, COL.objetivo) ?? "").toString().trim() !== o) return false;
    return true;
  });
}

// ======================
// Opciones en cascada (local)
// ======================
function refreshCascadeOptionsLocal() {
  // Grupo
  const grupos = uniqSorted(ALL_ROWS.map(r => getVal(r, COL.grupo)));
  setSelectOptions(els.fGrupo, grupos);

  // Programa depende de Grupo
  const g = els.fGrupo.value;
  const rowsG = g ? ALL_ROWS.filter(r => (getVal(r, COL.grupo) ?? "").toString().trim() === g) : [];
  const programas = g ? uniqSorted(rowsG.map(r => getVal(r, COL.programa))) : [];
  els.fPrograma.disabled = !g;
  setSelectOptions(els.fPrograma, programas);

  // Subprograma depende de Programa
  const p = els.fPrograma.value;
  const rowsGP = (g && p)
    ? rowsG.filter(r => (getVal(r, COL.programa) ?? "").toString().trim() === p)
    : [];
  const subprogramas = (g && p) ? uniqSorted(rowsGP.map(r => getVal(r, COL.subprograma))) : [];
  els.fSubprograma.disabled = !(g && p);
  setSelectOptions(els.fSubprograma, subprogramas);

  // Objetivo depende de Subprograma
  const s = els.fSubprograma.value;
  const rowsGPS = (g && p && s)
    ? rowsGP.filter(r => (getVal(r, COL.subprograma) ?? "").toString().trim() === s)
    : [];
  const objetivos = (g && p && s) ? uniqSorted(rowsGPS.map(r => getVal(r, COL.objetivo))) : [];
  els.fObjetivo.disabled = !(g && p && s);
  setSelectOptions(els.fObjetivo, objetivos);
}

// ======================
// KPIs + Tablas
// ======================
function computeKPIs(rows = []) {
  if (!Array.isArray(rows)) rows = [];

  const total = rows.length;
  let sumBudget = 0;
  let sumPeople = 0;
  let avanceSum = 0;
  let avanceCount = 0;

  const byEstado = new Map();

  rows.forEach(r => {
    sumBudget += parseNumberLoose(getVal(r, COL.presupuesto));
    sumPeople += parseNumberLoose(getVal(r, COL.personas));

    const av = parsePercentLoose(getVal(r, COL.avance));
    if (Number.isFinite(av)) {
      avanceSum += av;
      avanceCount += 1;
    }

    const est = (getVal(r, COL.estado) ?? "Sin estado").toString().trim() || "Sin estado";
    byEstado.set(est, (byEstado.get(est) || 0) + 1);
  });

  const avgAvance = avanceCount ? (avanceSum / avanceCount) : NaN;
  return { total, sumBudget, sumPeople, avgAvance, byEstado, avanceCount };
}

function groupRows(rows, field) {
  const m = new Map();

  rows.forEach(r => {
    const key = (getVal(r, field) ?? "Sin dato").toString().trim() || "Sin dato";
    if (!m.has(key)) {
      m.set(key, { key, actividades: 0, presupuesto: 0, personas: 0, avanceSum: 0, avanceCount: 0 });
    }
    const g = m.get(key);
    g.actividades += 1;
    g.presupuesto += parseNumberLoose(getVal(r, COL.presupuesto));
    g.personas += parseNumberLoose(getVal(r, COL.personas));

    const av = parsePercentLoose(getVal(r, COL.avance));
    if (Number.isFinite(av)) {
      g.avanceSum += av;
      g.avanceCount += 1;
    }
  });

  const out = [...m.values()].map(x => ({
    ...x,
    avance: x.avanceCount ? (x.avanceSum / x.avanceCount) : NaN
  }));

  out.sort((a, b) => (b.presupuesto - a.presupuesto));
  return out;
}

function renderEstados(byEstado) {
  const entries = [...byEstado.entries()].sort((a, b) => b[1] - a[1]);

  els.badgeEstados.textContent = entries.length ? `${entries.length} estados` : "0 estados";
  els.tblEstados.innerHTML = "";

  if (!entries.length) {
    els.tblEstados.innerHTML = `<tr><td colspan="2" class="text-muted">Sin datos</td></tr>`;
    return;
  }

  for (const [estado, n] of entries) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${estado}</td>
      <td class="text-end">${fmtInt(n)}</td>
    `;
    els.tblEstados.appendChild(tr);
  }
}

function renderAgrupado(rows, groupField, groupLabel) {
  els.ttlAgrupado.textContent = `Resumen por ${groupLabel}`;
  els.colAgrupa.textContent = groupLabel;

  const grouped = groupRows(rows, groupField);
  els.tblAgrupado.innerHTML = "";

  if (!grouped.length) {
    els.tblAgrupado.innerHTML = `<tr><td colspan="5" class="text-muted">Sin datos</td></tr>`;
    return;
  }

  grouped.slice(0, 50).forEach(g => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${g.key}</td>
      <td class="text-end">${fmtInt(g.actividades)}</td>
      <td class="text-end">${fmtMoneyCOP(g.presupuesto)}</td>
      <td class="text-end">${fmtInt(g.personas)}</td>
      <td class="text-end">${Number.isFinite(g.avance) ? `${g.avance.toFixed(1)}%` : "—"}</td>
    `;
    els.tblAgrupado.appendChild(tr);
  });
}

function renderKPIs(k) {
  els.kpiActividades.textContent = fmtInt(k.total);
  els.kpiPresupuesto.textContent = fmtMoneyCOP(k.sumBudget);
  els.kpiPersonas.textContent = fmtInt(k.sumPeople);
  els.kpiAvance.textContent = Number.isFinite(k.avgAvance) ? `${k.avgAvance.toFixed(1)}%` : "—";
  els.kpiPresupuestoNota.textContent = k.total ? `(${fmtInt(k.total)} registros)` : "";
}

async function refreshDashboard() {
  els.lblScope.textContent = "Cargando…";
  els.dbg.textContent = "";

  const rows = getFilteredRows();
  const kpis = computeKPIs(rows);

  renderKPIs(kpis);
  renderEstados(kpis.byEstado);

  const next = getNextGroupField();
  renderAgrupado(rows, next.field, next.label);

  els.lblScope.textContent = scopeLabel();
  els.dbg.textContent =
    `Tabla: ${TABLE_NAME} · Filtrado: ${scopeLabel()} · Registros total: ${ALL_ROWS.length} · Registros usados: ${rows.length}`;
refreshMapaAcciones(rows);


}

// ======================
// Eventos
// ======================
function wireEvents() {
  els.fGrupo.addEventListener("change", async () => {
    // limpia niveles inferiores
    els.fPrograma.value = "";
    els.fSubprograma.value = "";
    els.fObjetivo.value = "";
    refreshCascadeOptionsLocal();
    await refreshDashboard();
  });

  els.fPrograma.addEventListener("change", async () => {
    els.fSubprograma.value = "";
    els.fObjetivo.value = "";
    refreshCascadeOptionsLocal();
    await refreshDashboard();
  });

  els.fSubprograma.addEventListener("change", async () => {
    els.fObjetivo.value = "";
    refreshCascadeOptionsLocal();
    await refreshDashboard();
  });

  els.fObjetivo.addEventListener("change", async () => {
    await refreshDashboard();
  });

  els.btnReset.addEventListener("click", async () => {
    els.fGrupo.value = "";
    els.fPrograma.value = "";
    els.fSubprograma.value = "";
    els.fObjetivo.value = "";
    refreshCascadeOptionsLocal();
    await refreshDashboard();
  });
}

// ======================
// Init
// ======================
(async function init() {
  if (!hasSupabase()) {
    els.supabaseMissing.classList.remove("d-none");
    els.lblScope.textContent = "Falta supabaseClient";
    return;
  }

  try {
    await requireAuth();

    els.fPrograma.disabled = true;
    els.fSubprograma.disabled = true;
    els.fObjetivo.disabled = true;

    await loadAllRows(); 
    await initMapaAcciones();
             // <-- carga única
    refreshCascadeOptionsLocal();     // <-- llena combos
    wireEvents();
    await refreshDashboard();         // <-- pinta KPIs/tablas
  } catch (err) {
    console.error(err);
    els.lblScope.textContent = "Error";
    els.dbg.textContent = `Error: ${err?.message || err}`;
  }
})();
async function loadGeoJSON(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`No se pudo cargar ${path}: ${r.status}`);
  return r.json();
}

async function loadMunicipiosCatalog() {
  // OJO: requiere policy SELECT para authenticated en municipios (y departamentos si luego lo usas)
  const { data, error } = await window.supabaseClient
    .from("municipios")
    .select("departamento_id,departamento,lugar,lat,lng,tipo")
    .limit(10000);

  if (error) throw error;

  munIndex.clear();
  munByName.clear();

  for (const m of (data || [])) {
    const dept = normTxt(m.departamento);
    const mpio = normTxt(m.lugar);
    if (!dept || !mpio || !Number.isFinite(m.lat) || !Number.isFinite(m.lng)) continue;

    const key = `${dept}|${mpio}`;
    munIndex.set(key, m);

    if (!munByName.has(mpio)) munByName.set(mpio, []);
    munByName.get(mpio).push(m);
  }
}
async function initMapaAcciones() {
  // GeoJSON en tu estructura
  const basePath = "./GIS/Layers/";
  [geoBase, geoDept, geoMun] = await Promise.all([
    loadGeoJSON(basePath + "002basemap.geojson"),
    loadGeoJSON(basePath + "003departamentos.geojson"),
    loadGeoJSON(basePath + "004municipios.geojson"),
  ]);

  await loadMunicipiosCatalog();

  mapAcciones = L.map("mapAcciones", { zoomControl: true }).setView([4.5, -74.0], 5);

  // Si quieres tiles (opcional). Si prefieres solo geojson, puedes quitar esto:
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap"
  }).addTo(mapAcciones);

  // Base geojson (bordes)
  L.geoJSON(geoBase, { style: { weight: 1, color: "#777", fillOpacity: 0 } }).addTo(mapAcciones);

  layerDept = L.geoJSON(geoDept, { style: () => ({ weight: 1, color: "#555", fillOpacity: 0.75 }) });
  layerMun  = L.geoJSON(geoMun,  { style: () => ({ weight: 0.7, color: "#666", fillOpacity: 0.75 }) });
  layerPts  = L.layerGroup();

  layerDept.addTo(mapAcciones);
  layerPts.addTo(mapAcciones);

  // eventos UI
  document.getElementById("selMetric")?.addEventListener("change", () => refreshMapaAcciones(getFilteredRows()));
  document.getElementById("selNivel")?.addEventListener("change",  () => refreshMapaAcciones(getFilteredRows()));
  document.getElementById("selPuntos")?.addEventListener("change", () => refreshMapaAcciones(getFilteredRows()));
}
function getMetricValue(row) {
  const metric = document.getElementById("selMetric")?.value || "presupuesto";
  if (metric === "beneficiarios") return parseNumberLoose(getVal(row, COL.personas));
  return parseNumberLoose(getVal(row, COL.presupuesto));
}

function computeBreaks(values, k = 5) {
  const arr = values.filter(v => Number.isFinite(v) && v > 0).sort((a,b) => a-b);
  if (!arr.length) return [];
  const b = [];
  for (let i = 1; i <= k; i++) {
    const idx = Math.min(arr.length - 1, Math.floor(arr.length * i / k) - 1);
    b.push(arr[idx]);
  }
  // únicos crecientes
  return [...new Set(b)].sort((a,b)=>a-b);
}

function seqColor(v, breaks) {
  const colors = ["#f0f0f0","#d9f0ff","#b6e1ff","#7fc8ff","#3aa6ff","#0077cc"];
  if (!Number.isFinite(v) || v <= 0) return colors[0];
  if (!breaks.length) return colors[colors.length - 1];
  let idx = breaks.findIndex(b => v <= b);
  if (idx === -1) idx = breaks.length;
  return colors[Math.min(idx + 1, colors.length - 1)];
}

function rebuildAggregates(rows) {
  deptAgg = new Map();
  munAgg = new Map();

  for (const r of rows) {
    const val = getMetricValue(r);
    if (!Number.isFinite(val) || val <= 0) continue;

    const depts = parseListFlexible(getVal(r, "Departamentos"));
    const munis = parseListFlexible(getVal(r, "Municipios"));

    // Si hay municipios: intentamos ubicarlos con munIndex usando depto(s)
    if (munis.length) {
      // si hay 1 depto, desambiguamos mejor
      const deptCandidates = depts.length ? depts.map(normTxt) : [];

      const resolved = [];
      for (const mName of munis) {
        const mNorm = normTxt(mName);

        // 1) si hay deptCandidates, prueba cada uno
        let hit = null;
        if (deptCandidates.length) {
          for (const dNorm of deptCandidates) {
            const key = `${dNorm}|${mNorm}`;
            if (munIndex.has(key)) { hit = { dNorm, mNorm }; break; }
          }
        } else {
          // 2) sin depto: si el nombre es único en catálogo, úsalo
          const list = munByName.get(mNorm) || [];
          if (list.length === 1) hit = { dNorm: normTxt(list[0].departamento), mNorm };
        }

        if (hit) resolved.push(hit);
      }

      const share = resolved.length ? (val / resolved.length) : 0;
      for (const x of resolved) {
        const mKey = `${x.dNorm}|${x.mNorm}`;
        munAgg.set(mKey, (munAgg.get(mKey) || 0) + share);
        deptAgg.set(x.dNorm, (deptAgg.get(x.dNorm) || 0) + share);
      }

    } else if (depts.length) {
      // Solo departamentos
      const share = val / depts.length;
      for (const d of depts) {
        const dNorm = normTxt(d);
        deptAgg.set(dNorm, (deptAgg.get(dNorm) || 0) + share);
      }
    }
  }

  // breaks
  const deptVals = [...deptAgg.values()];
  const munVals  = [...munAgg.values()];
  breaksDept = computeBreaks(deptVals, 5);
  breaksMun  = computeBreaks(munVals, 5);
}

function deptNameFromFeature(f) {
  return f?.properties?.DPTO_CNMBR || f?.properties?.NOMBRE || f?.properties?.departamento || "";
}

function munNameFromFeature(f) {
  const d = f?.properties?.DEPTO || f?.properties?.DPTO_CNMBR || "";
  const m = f?.properties?.MPIO_CNMBR || f?.properties?.MUNICIPIO || "";
  return { dept: d, mun: m };
}

function setLegend() {
  const metric = document.getElementById("selMetric")?.value || "presupuesto";
  const nivel  = document.getElementById("selNivel")?.value || "departamentos";
  const breaks = (nivel === "municipios") ? breaksMun : breaksDept;

  const fmt = (n) => metric === "presupuesto" ? fmtMoneyCOP(n) : fmtInt(Math.round(n));
  const items = [];

  if (!breaks.length) {
    items.push(`<div><span style="display:inline-block;width:14px;height:14px;background:#f0f0f0;border:1px solid #ccc;margin-right:6px;"></span> Sin datos</div>`);
  } else {
    let prev = 0;
    for (let i = 0; i < breaks.length; i++) {
      const b = breaks[i];
      const color = seqColor(b, breaks);
      items.push(`<div><span style="display:inline-block;width:14px;height:14px;background:${color};border:1px solid #ccc;margin-right:6px;"></span> ${fmt(prev)} – ${fmt(b)}</div>`);
      prev = b;
    }
    items.push(`<div><span style="display:inline-block;width:14px;height:14px;background:${seqColor(breaks[breaks.length-1]+1, breaks)};border:1px solid #ccc;margin-right:6px;"></span> > ${fmt(breaks[breaks.length-1])}</div>`);
  }

  document.getElementById("mapLegend").innerHTML = items.join("");
}
function colorForCategory(cat, mapRef) {
  if (!mapRef.has(cat)) mapRef.set(cat, CAT_COLORS[mapRef.size % CAT_COLORS.length]);
  return mapRef.get(cat);
}

function getDominantPoblacion(row) {
  // regla simple: primera categoría con valor > 0 (puedes ajustar prioridades)
  const POP_COLS = [
    "Indígena","Victimas del conflicto","Campesinos","Persona con discapacidad",
    "Madre / Padre cabeza de familia","Migrante","Firmantes de paz",
    "Población OSIGD /LGTBIQ+","ASP - Actividades sexuales pagadas",
    "Negro(a)","Afro colombiano(a)","Raizal","Palenquero(a)","Gitano(a) Rrom"
  ];
  for (const c of POP_COLS) {
    const v = parseNumberLoose(getVal(row, c));
    if (v > 0) return c;
  }
  return "Sin clasificar";
}

function openFicha(row, ubicacionLabel) {
  const body = document.getElementById("fichaBody");
  const git = getVal(row, COL.grupo) ?? "";
  const prog = getVal(row, COL.programa) ?? "";
  const sub = getVal(row, COL.subprograma) ?? "";
  const obj = getVal(row, COL.objetivo) ?? "";
  const act = getVal(row, "ACTIVIDAD") ?? "";
  const det = getVal(row, "DETALLE ACTIVIDAD") ?? "";
  const est = getVal(row, COL.estado) ?? "";
  const av  = parsePercentLoose(getVal(row, COL.avance));
  const pre = parseNumberLoose(getVal(row, COL.presupuesto));
  const per = parseNumberLoose(getVal(row, COL.personas));

  body.innerHTML = `
    <div class="card">
      <div class="card-body">
        <div class="text-muted small mb-1">${ubicacionLabel || ""}</div>
        <div class="fw-semibold">${git}</div>
        <div class="small text-muted">${prog} · ${sub}</div>
        <div class="small text-muted mb-2">${obj}</div>

        <div class="fw-semibold">${act}</div>
        <div class="small mb-2">${det}</div>

        <div class="d-flex flex-wrap gap-2">
          <span class="badge text-bg-secondary">Estado: ${est || "—"}</span>
          <span class="badge text-bg-secondary">Avance: ${Number.isFinite(av) ? av.toFixed(1) + "%" : "—"}</span>
        </div>

        <hr>
        <div class="small"><b>Presupuesto:</b> ${fmtMoneyCOP(pre)}</div>
        <div class="small"><b>Beneficiarios:</b> ${fmtInt(per)}</div>
      </div>
    </div>
  `;

  const off = bootstrap.Offcanvas.getOrCreateInstance(document.getElementById("offcanvasFicha"));
  off.show();
}
function refreshMapaAcciones(rows) {
  if (!mapAcciones) return;

  rebuildAggregates(rows);

  const nivel = document.getElementById("selNivel")?.value || "departamentos";
  const modoPuntos = document.getElementById("selPuntos")?.value || "git";

  // capas polígonos
  mapAcciones.removeLayer(layerDept);
  mapAcciones.removeLayer(layerMun);

  if (nivel === "municipios") layerMun.addTo(mapAcciones);
  else layerDept.addTo(mapAcciones);

  layerDept.setStyle((f) => {
    const d = normTxt(deptNameFromFeature(f));
    const v = deptAgg.get(d) || 0;
    return { weight: 1, color: "#555", fillOpacity: 0.75, fillColor: seqColor(v, breaksDept) };
  });

  layerMun.setStyle((f) => {
    const { dept, mun } = munNameFromFeature(f);
    const k = `${normTxt(dept)}|${normTxt(mun)}`;
    const v = munAgg.get(k) || 0;
    return { weight: 0.7, color: "#666", fillOpacity: 0.75, fillColor: seqColor(v, breaksMun) };
  });

  setLegend();

  // puntos
  layerPts.clearLayers();
  const catMap = new Map();

  for (const r of rows) {
    const git = (getVal(r, COL.grupo) ?? "Sin GIT").toString().trim() || "Sin GIT";
    const pop = getDominantPoblacion(r);

    const cat = (modoPuntos === "poblacion") ? pop : git;
    const color = colorForCategory(cat, catMap);

    const depts = parseListFlexible(getVal(r, "Departamentos")).map(normTxt);
    const munis = parseListFlexible(getVal(r, "Municipios"));

    // si hay municipios: poner punto por municipio (si lo encontramos)
    let placed = 0;
    if (munis.length) {
      for (const mName of munis) {
        const mNorm = normTxt(mName);

        // desambiguar por depto si solo hay uno
        let hit = null;
        if (depts.length === 1) {
          const key = `${depts[0]}|${mNorm}`;
          hit = munIndex.get(key) || null;
        } else if (depts.length > 1) {
          for (const d of depts) {
            const key = `${d}|${mNorm}`;
            if (munIndex.has(key)) { hit = munIndex.get(key); break; }
          }
        } else {
          const list = munByName.get(mNorm) || [];
          if (list.length === 1) hit = list[0];
        }

        if (hit) {
          const marker = L.circleMarker([hit.lat, hit.lng], {
            radius: 6,
            color,
            fillColor: color,
            fillOpacity: 0.9,
            weight: 2
          });
          marker.on("click", () => openFicha(r, `${hit.departamento} · ${hit.lugar}`));
          marker.addTo(layerPts);
          placed++;
        }
      }
    }

    // si no se pudo ubicar por municipios, no ponemos punto (evita puntos “inventados”)
    // (si quieres, luego agregamos fallback por centroide de departamento)
  }

  // leyenda puntos
  const ptsLegend = [...catMap.entries()]
    .map(([k,c]) => `<div><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${c};margin-right:6px;"></span>${k}</div>`)
    .join("");
  document.getElementById("pointsLegend").innerHTML = ptsLegend || "Sin puntos";

  document.getElementById("lblMapaInfo").textContent =
    `Registros filtrados: ${rows.length} · Puntos: ${layerPts.getLayers().length}`;
}

