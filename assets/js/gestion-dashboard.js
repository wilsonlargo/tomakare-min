/* =========================================================
   Dashboard Gestión (PP-III)
   - Requiere: window.supabaseClient (ya autenticado)
   - Tabla: TABLE_NAME
   - Estrategia: carga única (select '*') + filtros/KPIs en memoria
   ========================================================= */

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

    await loadAllRows();              // <-- carga única
    refreshCascadeOptionsLocal();     // <-- llena combos
    wireEvents();
    await refreshDashboard();         // <-- pinta KPIs/tablas
  } catch (err) {
    console.error(err);
    els.lblScope.textContent = "Error";
    els.dbg.textContent = `Error: ${err?.message || err}`;
  }
})();
