// assets/js/proyecto.js
let cacheRubros = [];
let cachePresupuesto = [];

function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setMsg(text, type = "info") {
  const el = document.getElementById("msg");
  if (!el) return;
  el.className = `alert alert-${type}`;
  el.textContent = text;
  el.style.display = "block";
}

function hideMsg() {
  const el = document.getElementById("msg");
  if (!el) return;
  el.style.display = "none";
}

function setMsgOAP(text, type = "info") {
  const el = document.getElementById("msgOAP");
  if (!el) return;
  el.className = `alert alert-${type}`;
  el.textContent = text;
  el.style.display = "block";
}

function hideMsgOAP() {
  const el = document.getElementById("msgOAP");
  if (!el) return;
  el.style.display = "none";
}

function setMsgModal(id, text, type = "info") {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = `alert alert-${type}`;
  el.textContent = text;
  el.style.display = "block";
}

function hideMsgModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = "none";
}

const proyectoId = qs("id");

// Selecciones activas
let objetivoActivoId = null;
let actividadActivaId = null;

// Caches
let cacheObjetivos = [];
let cacheActividades = [];
let cacheProductos = [];

/* =========================
   Medios de verificación (Producto)
========================= */
let mvDraft = [];

function renderMVRows() {
  const tb = document.getElementById("mvRows");
  if (!tb) return; // si aún no pegaste el bloque HTML, no revienta

  if (!Array.isArray(mvDraft) || mvDraft.length === 0) {
    tb.innerHTML = `<tr><td colspan="5" class="text-muted">Sin soportes aún.</td></tr>`;
    return;
  }

  tb.innerHTML = mvDraft
    .map(
      (m, i) => `
    <tr>
      <td>
        <input class="form-control form-control-sm" data-mv="label" data-i="${i}" value="${escapeHtml(m.label ?? "")}">
      </td>
<td>
  <div class="input-group input-group-sm">
    <input
      class="form-control"
      data-mv="url"
      data-i="${i}"
      value="${escapeHtml(m.url ?? "")}"
      placeholder="https://..."
    >
    <button
      class="btn btn-outline-secondary"
      type="button"
      data-mv-open="${i}"
      title="Abrir enlace"
      ${!m.url ? "disabled" : ""}
    >
      <i class="bi bi-box-arrow-up-right"></i>
    </button>
  </div>
</td>

      <td>
        <select class="form-select form-select-sm" data-mv="tipo" data-i="${i}">
          ${["acta", "asistencia", "factura", "informe", "foto", "diapositiva", "carpeta digital", "audio", "video", "otro"]
          .map((t) => `<option value="${t}" ${m.tipo === t ? "selected" : ""}>${t}</option>`)
          .join("")}
        </select>
      </td>
      <td>
        <input type="date" class="form-control form-control-sm" data-mv="date" data-i="${i}" value="${escapeHtml(m.date ?? "")}">
      </td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-danger" type="button" data-mv-del="${i}">X</button>
      </td>
    </tr>
  `
    )
    .join("");

  // cambios
  tb.querySelectorAll("[data-mv]").forEach((el) => {
    const handler = () => {
      const i = parseInt(el.dataset.i, 10);
      const k = el.dataset.mv;
      mvDraft[i][k] = el.value;
    };
    el.addEventListener("input", handler);
    el.addEventListener("change", handler);
  });

  // borrar
  tb.querySelectorAll("[data-mv-del]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = parseInt(btn.dataset.mvDel, 10);
      mvDraft.splice(i, 1);
      renderMVRows();
    });
  });

  // abrir enlace por fila
  tb.querySelectorAll("[data-mv-open]").forEach(btn => {
    btn.addEventListener("click", () => {
      const i = parseInt(btn.dataset.mvOpen, 10);
      const url = mvDraft[i]?.url;
      if (!url) return;
      window.open(url, "_blank", "noopener,noreferrer");
    });
  });

}

/* =========================
   PROYECTO / DEP / MUN
========================= */
async function loadDepartamentos() {
  const sel = document.getElementById("inpDepartamento");
  if (!sel) return;

  sel.innerHTML = `<option value="">Cargando…</option>`;

  const { data, error } = await supabaseClient
    .from("departamentos")
    .select("id, departamento, macroregion")
    .order("departamento", { ascending: true });

  if (error) throw error;

  sel.innerHTML = `<option value="">Seleccione…</option>`;
  sel.insertAdjacentHTML(
    "beforeend",
    (data || [])
      .map((d) => {
        const label = d.macroregion ? `${d.departamento} — ${d.macroregion}` : d.departamento;
        return `<option value="${escapeHtml(d.departamento)}" data-id="${escapeHtml(d.id ?? "")}">${escapeHtml(label)}</option>`;
      })
      .join("")
  );
}

async function loadMunicipiosByDepartamento(dep, selected = null) {
  const sel = document.getElementById("inpMunicipio");
  if (!sel) return;

  sel.innerHTML = `<option value="">Seleccione…</option>`;
  sel.disabled = true;

  if (!dep) return;

  const { data, error } = await supabaseClient
    .from("municipios")
    .select("id, lugar, lat, lng, departamento_id, departamento")
    .eq("departamento", dep)
    .order("lugar", { ascending: true });

  if (error) throw error;

  sel.insertAdjacentHTML(
    "beforeend",
    (data || [])
      .map((m) => {
        const v = m.lugar;
        const isSel = selected && String(selected) === String(v);
        return `<option value="${escapeHtml(v)}" ${isSel ? "selected" : ""} data-id="${escapeHtml(m.id ?? "")}" data-lugar="${escapeHtml(v)}" data-lat="${escapeHtml(m.lat ?? "")}" data-lng="${escapeHtml(m.lng ?? "")}" data-dep-id="${escapeHtml(m.departamento_id ?? "")}">${escapeHtml(v)}</option>`;
      })
      .join("")
  );

  sel.disabled = false;
}

/* =========================
   TERRITORIALIZACIÓN (MÚLTIPLE) — proyecto_territorios
   - Se agrega en el formulario de Proyecto (no afecta Bitácora)
   - Usa catálogo departamentos/municipios para autollenar lat/lng
========================= */

let territoriosDraft = [];

function parseFloatSafe(v) {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function setMsgTerritorios(text, type = "muted") {
  const el = document.getElementById("msgTerritorios");
  if (!el) return;
  const cls =
    type === "danger" ? "text-danger" :
    type === "warning" ? "text-warning" :
    type === "success" ? "text-success" : "text-muted";
  el.className = `small ${cls}`;
  el.textContent = text || "";
}

function getSelectedDepartamentoMeta() {
  const sel = document.getElementById("inpDepartamento");
  const opt = sel?.selectedOptions?.[0];
  return {
    id: opt?.dataset?.id || "",
    nombre: (sel?.value || opt?.textContent || "").split(" — ")[0].trim(),
  };
}

function getSelectedMunicipioMeta() {
  const sel = document.getElementById("inpMunicipio");
  const opt = sel?.selectedOptions?.[0];
  return {
    id: opt?.dataset?.id || "",
    lugar: (sel?.value || opt?.dataset?.lugar || opt?.textContent || "").trim(),
    lat: opt?.dataset?.lat || "",
    lng: opt?.dataset?.lng || "",
  };
}

function syncTerritorioInputsFromMunicipio() {
  const meta = getSelectedMunicipioMeta();
  const inpLat = document.getElementById("inpTerrLat");
  const inpLng = document.getElementById("inpTerrLng");
  if (inpLat && meta.lat) inpLat.value = meta.lat;
  if (inpLng && meta.lng) inpLng.value = meta.lng;
}

function renderTerritoriosRows() {
  const tb = document.getElementById("tblTerritoriosRows");
  const badge = document.getElementById("badgeTerritorios");
  if (badge) badge.textContent = String((territoriosDraft || []).length);

  if (!tb) return;

  if (!Array.isArray(territoriosDraft) || territoriosDraft.length === 0) {
    tb.innerHTML = `<tr><td colspan="6" class="text-muted">Sin territorios agregados.</td></tr>`;
    return;
  }

  tb.innerHTML = (territoriosDraft || []).map((t, i) => `
    <tr>
      <td class="text-nowrap">${escapeHtml(t.departamento_nombre || "")}</td>
      <td class="text-nowrap">${escapeHtml(t.municipio_lugar || "")}</td>
      <td>${escapeHtml(t.lugar_detalle || "")}</td>
      <td class="text-nowrap">${escapeHtml(t.lat ?? "")}</td>
      <td class="text-nowrap">${escapeHtml(t.lng ?? "")}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-danger" type="button" data-terr-del="${i}">
          <i class="bi bi-x-lg"></i>
        </button>
      </td>
    </tr>
  `).join("");

  tb.querySelectorAll("[data-terr-del]").forEach(btn => {
    btn.addEventListener("click", () => {
      const i = parseInt(btn.dataset.terrDel, 10);
      territoriosDraft.splice(i, 1);
      renderTerritoriosRows();
    });
  });
}

function addTerritorioDraftFromUI() {
  const dep = getSelectedDepartamentoMeta();
  const mun = getSelectedMunicipioMeta();

  if (!dep.nombre) {
    setMsgTerritorios("Selecciona un departamento para agregar territorio.", "warning");
    return;
  }
  if (!mun.lugar) {
    setMsgTerritorios("Selecciona un municipio para agregar territorio.", "warning");
    return;
  }

  // evita duplicados por municipio (id si existe; si no, por texto)
  const dup = (territoriosDraft || []).some(x =>
    (mun.id && String(x.municipio_id) === String(mun.id)) ||
    (!mun.id && String(x.municipio_lugar || "").toLowerCase() === String(mun.lugar).toLowerCase()
              && String(x.departamento_nombre || "").toLowerCase() === String(dep.nombre).toLowerCase())
  );
  if (dup) {
    setMsgTerritorios("Ese municipio ya está agregado en este proyecto.", "warning");
    return;
  }

  const detalle = document.getElementById("inpTerrLugarDetalle")?.value?.trim() || null;

  const lat = parseFloatSafe(document.getElementById("inpTerrLat")?.value);
  const lng = parseFloatSafe(document.getElementById("inpTerrLng")?.value);

  territoriosDraft.push({
    departamento_id: dep.id || null,
    municipio_id: mun.id || null,
    departamento_nombre: dep.nombre || null,
    municipio_lugar: mun.lugar || null,
    lugar_detalle: detalle,
    lat,
    lng,
    fuente_coord: (mun.lat && mun.lng) ? "catálogo municipios" : "manual",
  });

  // limpiar solo campos complementarios
  const det = document.getElementById("inpTerrLugarDetalle");
  if (det) det.value = "";
  renderTerritoriosRows();
  setMsgTerritorios("Territorio agregado.", "success");
}

async function loadTerritoriosProyecto() {
  const tb = document.getElementById("tblTerritoriosRows");
  if (tb) tb.innerHTML = `<tr><td colspan="6" class="text-muted">Cargando territorios…</td></tr>`;

  const { data, error } = await supabaseClient
    .from("proyecto_territorios")
    .select("departamento_id, municipio_id, departamento_nombre, municipio_lugar, lugar_detalle, lat, lng, fuente_coord, created_at")
    .eq("proyecto_id", proyectoId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("LOAD territorios error:", error);
    territoriosDraft = [];
    renderTerritoriosRows();
    setMsgTerritorios("No pude cargar territorios (revisa RLS o tabla).", "warning");
    return;
  }

  territoriosDraft = (data || []).map((r) => ({
    departamento_id: r.departamento_id,
    municipio_id: r.municipio_id,
    departamento_nombre: r.departamento_nombre,
    municipio_lugar: r.municipio_lugar,
    lugar_detalle: r.lugar_detalle,
    lat: r.lat,
    lng: r.lng,
    fuente_coord: r.fuente_coord,
  }));

  renderTerritoriosRows();
  setMsgTerritorios("", "muted");
}

async function saveTerritoriosProyecto() {
  if (!Array.isArray(territoriosDraft)) territoriosDraft = [];

  // estrategia simple: borrar + insertar
  const { error: delError } = await supabaseClient
    .from("proyecto_territorios")
    .delete()
    .eq("proyecto_id", proyectoId);

  if (delError) throw delError;

  if (territoriosDraft.length === 0) return;

  const rows = territoriosDraft.map((t) => ({
    proyecto_id: proyectoId,
    departamento_id: t.departamento_id || null,
    municipio_id: t.municipio_id || null,
    departamento_nombre: t.departamento_nombre || null,
    municipio_lugar: t.municipio_lugar || null,
    lugar_detalle: t.lugar_detalle || null,
    lat: t.lat ?? null,
    lng: t.lng ?? null,
    fuente_coord: t.fuente_coord || "manual",
  }));

  const { error } = await supabaseClient.from("proyecto_territorios").insert(rows);
  if (error) throw error;
}


async function loadProyecto() {
  const { data, error } = await supabaseClient
    .from("proyecto")
    .select(`
      id, vigencia, nombre, manager, objetivo, nodo, linea, estrategia,
      departamento, municipio, lugar,
      tipo_poblacion, nombre_poblacion
    `)
    .eq("id", proyectoId)
    .single();

  if (error) throw error;

  document.getElementById("lblProyecto").textContent = data.nombre ?? "—";
  document.getElementById("lblProyectoId").textContent = data.id ?? "";

  const setVal = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = v ?? "";
  };

  setVal("inpVigencia", data.vigencia);
  setVal("inpNombre", data.nombre);
  setVal("inpManager", data.manager);
  setVal("inpObjetivo", data.objetivo);
  setVal("inpNodo", data.nodo);
  setVal("inpLinea", data.linea);
  setVal("inpEstrategia", data.estrategia);
  setVal("inpLugar", data.lugar);
  setVal("inpTipoPoblacion", data.tipo_poblacion);
  setVal("inpNombrePoblacion", data.nombre_poblacion);

  await loadDepartamentos();
  document.getElementById("inpDepartamento").value = data.departamento ?? "";
  await loadMunicipiosByDepartamento(data.departamento ?? "", data.municipio ?? "");

// Territorialización múltiple (si existe en la página)
try {
  if (document.getElementById("btnAddTerritorio")) {
    await loadTerritoriosProyecto();
    try { syncTerritorioInputsFromMunicipio(); } catch (_) {}
  }
} catch (e) {
  console.error("LOAD territorios error:", e);
}
  pintarTotalesObjetivos(data.id)
}

async function guardarCambios() {
  try {
    hideMsg();

    const nombre = document.getElementById("inpNombre")?.value?.trim();
    if (!nombre) return setMsg("El nombre del proyecto es obligatorio.", "warning");

    const tipoP = document.getElementById("inpTipoPoblacion")?.value || "";
    const nomPob = document.getElementById("inpNombrePoblacion")?.value?.trim() || "";
    if ((tipoP && !nomPob) || (!tipoP && nomPob)) {
      return setMsg("Completa ambos: Tipo de población y Nombre población/pueblo.", "warning");
    }

    // ✅ SOLO campos de proyecto (NO mezclar con producto/actividad)
    const payload = {
      vigencia: parseInt(document.getElementById("inpVigencia")?.value, 10) || null,
      nombre,
      manager: document.getElementById("inpManager")?.value?.trim() || null,
      objetivo: document.getElementById("inpObjetivo")?.value?.trim() || null,
      nodo: document.getElementById("inpNodo")?.value?.trim() || null,
      linea: document.getElementById("inpLinea")?.value?.trim() || null,
      estrategia: document.getElementById("inpEstrategia")?.value?.trim() || null,

      departamento: document.getElementById("inpDepartamento")?.value || null,
      municipio: document.getElementById("inpMunicipio")?.value || null,
      lugar: document.getElementById("inpLugar")?.value?.trim() || null,

      tipo_poblacion: tipoP || null,
      nombre_poblacion: nomPob || null,
    };

    const { error } = await supabaseClient.from("proyecto").update(payload).eq("id", proyectoId);
    if (error) throw error;


// Guardar territorialización múltiple (si hay UI en la página)
try {
  if (document.getElementById("btnAddTerritorio")) {
    await saveTerritoriosProyecto();
  }
} catch (e) {
  console.error("SAVE territorios error:", e);
  setMsg("✅ Proyecto guardado, pero falló guardando territorios: " + (e.message || e), "warning");
  document.getElementById("lblProyecto").textContent = nombre;
  return;
}

    document.getElementById("lblProyecto").textContent = nombre;
    setMsg("✅ Cambios guardados.", "success");
  } catch (e) {
    console.error("UPDATE ERROR:", e);
    setMsg("❌ " + (e.message || e), "danger");
  }
}

/* =========================
   OBJETIVOS (CRUD + LISTA)
========================= */
async function loadObjetivos() {
  const { data, error } = await supabaseClient
    .from("objetivo")
    .select("id, proyecto_id, codigo, nombre, orden, created_at")
    .eq("proyecto_id", proyectoId)
    .order("orden", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("OBJ LOAD ERROR:", error);
    setMsgOAP("❌ " + error.message, "danger");
    cacheObjetivos = [];
    renderObjetivosList();
    return;
  }

  hideMsgOAP();
  cacheObjetivos = data || [];

  if (objetivoActivoId && !cacheObjetivos.find((o) => o.id === objetivoActivoId)) {
    objetivoActivoId = null;
    actividadActivaId = null;
  }

  renderObjetivosList();
  await pintarTotalesObjetivos(proyectoId);
  await pintarTotalProyecto(proyectoId);
  await pintarAvanceObjetivos(proyectoId);
  await pintarAvanceProyecto(proyectoId);

}

function openModalObjetivoNew() {
  hideMsgModal("msgObjModal");
  document.getElementById("lblModalObjetivo").textContent = "Nuevo objetivo";
  document.getElementById("objId").value = "";
  document.getElementById("objCodigo").value = "";
  document.getElementById("objOrden").value = 1;
  document.getElementById("objNombre").value = "";
  new bootstrap.Modal(document.getElementById("modalObjetivo")).show();
}

function openModalObjetivoEdit(id) {
  const obj = cacheObjetivos.find((x) => x.id === id);
  if (!obj) return;

  hideMsgModal("msgObjModal");
  document.getElementById("lblModalObjetivo").textContent = "Editar objetivo";
  document.getElementById("objId").value = obj.id;
  document.getElementById("objCodigo").value = obj.codigo ?? "";
  document.getElementById("objOrden").value = obj.orden ?? 1;
  document.getElementById("objNombre").value = obj.nombre ?? "";
  new bootstrap.Modal(document.getElementById("modalObjetivo")).show();
}

async function saveObjetivo() {
  try {
    hideMsgModal("msgObjModal");

    const id = document.getElementById("objId").value || null;
    const codigo = document.getElementById("objCodigo").value.trim() || null;
    const orden = parseInt(document.getElementById("objOrden").value, 10) || 1;
    const nombre = document.getElementById("objNombre").value.trim();

    if (!nombre) return setMsgModal("msgObjModal", "El nombre del objetivo es obligatorio.", "warning");

    const payload = { proyecto_id: proyectoId, codigo, orden, nombre };

    const { error } = id
      ? await supabaseClient.from("objetivo").update(payload).eq("id", id)
      : await supabaseClient.from("objetivo").insert([payload]);

    if (error) throw error;

    bootstrap.Modal.getInstance(document.getElementById("modalObjetivo")).hide();
    await loadObjetivos();
  } catch (e) {
    console.error("OBJ SAVE ERROR:", e);
    setMsgModal("msgObjModal", "❌ " + (e.message || e), "danger");
  }
}

async function deleteObjetivo(id) {
  const ok = confirm("¿Seguro que deseas borrar este objetivo? (se borrarán sus actividades y productos)");
  if (!ok) return;

  try {
    const { error } = await supabaseClient.from("objetivo").delete().eq("id", id);
    if (error) throw error;

    if (objetivoActivoId === id) {
      objetivoActivoId = null;
      actividadActivaId = null;
      cacheActividades = [];
      cacheProductos = [];
      renderActividadesList();
      renderProductosList();
      syncActionButtons();
    }

    await loadObjetivos();
  } catch (e) {
    console.error("OBJ DEL ERROR:", e);
    setMsgOAP("❌ " + (e.message || e), "danger");
  }
}

function renderObjetivosList() {
  const box = document.getElementById("listObjetivos");
  if (!box) return;

  if (!cacheObjetivos.length) {
    box.innerHTML = `<div class="text-muted small">Aún no hay objetivos. Crea el primero.</div>`;
    syncActionButtons();
    return;
  }

  box.innerHTML = cacheObjetivos
    .map((o) => {
      const active = o.id === objetivoActivoId ? "active" : "";
      const label = `${o.codigo ? o.codigo + " — " : ""}${o.nombre || ""}`;
      return `
      <div class="cursor-app bg-primary-subtle mb-1 list-group-item d-flex justify-content-between align-items-start ${active}" data-obj="${o.id}">
        <div class="me-2">
          <div class="fw-semibold">${escapeHtml(label)}</div>
          <div class="text-muted small">Orden: ${o.orden ?? ""}</div>
          <span class="badge bg-light text-dark border mt-1 fs-6" id="badgeObj${o.id}">$0</span>
          <span class="badge bg-primary text-white border mt-1 fs-6" id="badgeObjAv${o.id}">%0</span>
        </div>
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-outline-primary" data-obj-edit="${o.id}" type="button" title="Editar">
            <i class="bi bi-pencil-fill"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" data-obj-del="${o.id}" type="button" title="Borrar">
            <i class="bi bi-trash3-fill"></i>
          </button>
        </div>
      </div>
    `;
    })
    .join("");

  box.querySelectorAll("[data-obj]").forEach((item) => {
    item.addEventListener("click", async (e) => {
      if (e.target.closest("button")) return;

      objetivoActivoId = item.dataset.obj;
      actividadActivaId = null;

      cacheProductos = [];
      renderProductosList();
      syncActionButtons();

      cachePresupuesto = [];
      await loadPresupuestoActividad(null);

      await loadActividades(objetivoActivoId);

    });
  });

  box.querySelectorAll("[data-obj-edit]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openModalObjetivoEdit(btn.dataset.objEdit);
    });
  });

  box.querySelectorAll("[data-obj-del]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteObjetivo(btn.dataset.objDel);
    });
  });

  syncActionButtons();
}

/* =========================
   ACTIVIDADES (CRUD + LISTA)
========================= */
async function loadActividades(objetivoId) {
  if (!objetivoId) {
    cacheActividades = [];
    renderActividadesList();
    return;
  }

  const { data, error } = await supabaseClient
    .from("actividad")
    .select("id, objetivo_id, codigo, nombre, orden, estado, created_at")
    .eq("objetivo_id", objetivoId)
    .order("orden", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("ACT LOAD ERROR:", error);
    setMsgOAP("❌ " + error.message, "danger");
    cacheActividades = [];
    renderActividadesList();
    return;
  }

  hideMsgOAP();
  cacheActividades = data || [];

  if (actividadActivaId && !cacheActividades.find((a) => a.id === actividadActivaId)) {
    actividadActivaId = null;
    cacheProductos = [];
    renderProductosList();
  }
  renderActividadesList();
  await pintarTotalesActividades(objetivoId);
  await pintarAvanceActividades(objetivoId);



}

function openModalActividadNew() {
  if (!objetivoActivoId) return;

  hideMsgModal("msgActModal");
  document.getElementById("lblModalActividad").textContent = "Nueva actividad";
  document.getElementById("actId").value = "";
  document.getElementById("actCodigo").value = "";
  document.getElementById("actOrden").value = 1;
  document.getElementById("actEstado").value = "Pendiente";
  document.getElementById("actNombre").value = "";
  new bootstrap.Modal(document.getElementById("modalActividad")).show();
}

function openModalActividadEdit(id) {
  const act = cacheActividades.find((x) => x.id === id);
  if (!act) return;

  hideMsgModal("msgActModal");
  document.getElementById("lblModalActividad").textContent = "Editar actividad";
  document.getElementById("actId").value = act.id;
  document.getElementById("actCodigo").value = act.codigo ?? "";
  document.getElementById("actOrden").value = act.orden ?? 1;
  document.getElementById("actEstado").value = act.estado ?? "Pendiente";
  document.getElementById("actNombre").value = act.nombre ?? "";
  new bootstrap.Modal(document.getElementById("modalActividad")).show();
}

async function saveActividad() {
  try {
    hideMsgModal("msgActModal");
    if (!objetivoActivoId) return setMsgModal("msgActModal", "Selecciona un objetivo.", "warning");

    const id = document.getElementById("actId").value || null;
    const codigo = document.getElementById("actCodigo").value.trim() || null;
    const orden = parseInt(document.getElementById("actOrden").value, 10) || 1;
    const estado = document.getElementById("actEstado").value || "Pendiente";
    const nombre = document.getElementById("actNombre").value.trim();

    if (!nombre) return setMsgModal("msgActModal", "El nombre de la actividad es obligatorio.", "warning");

    const payload = { objetivo_id: objetivoActivoId, codigo, orden, estado, nombre };

    const { error } = id
      ? await supabaseClient.from("actividad").update(payload).eq("id", id)
      : await supabaseClient.from("actividad").insert([payload]);

    if (error) throw error;

    bootstrap.Modal.getInstance(document.getElementById("modalActividad")).hide();
    await loadActividades(objetivoActivoId);
  } catch (e) {
    console.error("ACT SAVE ERROR:", e);
    setMsgModal("msgActModal", "❌ " + (e.message || e), "danger");
  }
}

async function deleteActividad(id) {
  const ok = confirm("¿Seguro que deseas borrar esta actividad? (se borrarán sus productos)");
  if (!ok) return;

  try {
    const { error } = await supabaseClient.from("actividad").delete().eq("id", id);
    if (error) throw error;

    if (actividadActivaId === id) {
      actividadActivaId = null;
      cacheProductos = [];
      renderProductosList();
      syncActionButtons();
    }

    await loadActividades(objetivoActivoId);
  } catch (e) {
    console.error("ACT DEL ERROR:", e);
    setMsgOAP("❌ " + (e.message || e), "danger");
  }
}

function renderActividadesList() {
  const box = document.getElementById("listActividades");
  if (!box) return;

  if (!objetivoActivoId) {
    box.innerHTML = `<div class="text-muted small">Selecciona un objetivo…</div>`;
    syncActionButtons();
    return;
  }

  if (!cacheActividades.length) {
    box.innerHTML = `<div class="text-muted small">No hay actividades para este objetivo.</div>`;
    syncActionButtons();
    return;
  }

  box.innerHTML = cacheActividades
    .map((a) => {
      const active = a.id === actividadActivaId ? "active" : "";
      const label = `${a.codigo ? a.codigo + " — " : ""}${a.nombre || ""}`;
      return `
      <div class="bg-warning-subtle cursor-app mb-1 list-group-item d-flex justify-content-between align-items-start ${active}" data-act="${a.id}">
        <div class="me-2">
          <div class="fw-semibold">${escapeHtml(label)}</div>
          <div class="text-muted small">Estado: ${escapeHtml(a.estado ?? "Pendiente")} · Orden: ${a.orden ?? ""}</div>
          <span class="badge bg-light text-dark border mt-1" id="badgeAct${a.id}">$0</span>
          <span class="badge bg-primary text-white border mt-1" id="badgeActAv${a.id}">%0</span>
        </div>
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-outline-secondary" data-act-bit="${a.id}" type="button" title="Bitácora">
            <i class="bi bi-journal-text"></i>
          </button>
          <button class="btn btn-sm btn-outline-primary" data-act-edit="${a.id}" type="button" title="Editar">
            <i class="bi bi-pencil-fill"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" data-act-del="${a.id}" type="button" title="Borrar">
            <i class="bi bi-trash3-fill"></i>
          </button>
        </div>
      </div>
    `;
    })
    .join("");

  box.querySelectorAll("[data-act]").forEach((item) => {
    item.addEventListener("click", async (e) => {
      if (e.target.closest("button")) return;

      actividadActivaId = item.dataset.act;
      syncActionButtons();

      await loadProductos(actividadActivaId);
      renderProductosList();

      // ✅ NUEVO: cargar presupuesto de esta actividad
      await loadPresupuestoActividad(actividadActivaId);
    });
  });

  box.querySelectorAll("[data-act-edit]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openModalActividadEdit(btn.dataset.actEdit);
    });
  });

  box.querySelectorAll("[data-act-del]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteActividad(btn.dataset.actDel);
    });
  });box.querySelectorAll("[data-act-bit]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openModalBitacora(btn.dataset.actBit);
    });
  });

  syncActionButtons();
}

/* =========================
   BITÁCORA DE ACTIVIDAD (Reporte cualitativo acumulativo)
   Tabla: actividad_bitacora
   - lugares: jsonb array (sin lat/lng)
   - productos/evidencias: se leen de 'producto' por actividad_id
========================= */

let bitActividadId = null;
let bitLugaresDraft = [];
let bitEditId = null;
let bitCacheById = new Map();

function setMsgBit(text, type = "info") {
  setMsgModal("msgBitModal", text, type);
}
function clearMsgBit() {
  hideMsgModal("msgBitModal");
}

function getActividadLabelById(id) {
  const a = (cacheActividades || []).find((x) => x.id === id);
  if (!a) return "Actividad";
  const label = `${a.codigo ? a.codigo + " — " : ""}${a.nombre || ""}`;
  return label;
}

async function loadDepartamentosBit() {
  const sel = document.getElementById("bitDep");
  if (!sel) return;

  sel.innerHTML = `<option value="">Cargando…</option>`;

  const { data, error } = await supabaseClient
    .from("departamentos")
    .select("departamento, macroregion")
    .order("departamento", { ascending: true });

  if (error) throw error;

  sel.innerHTML = `<option value="">Seleccione…</option>`;
  sel.insertAdjacentHTML(
    "beforeend",
    (data || [])
      .map((d) => {
        const label = d.macroregion ? `${d.departamento} — ${d.macroregion}` : d.departamento;
        return `<option value="${escapeHtml(d.departamento)}">${escapeHtml(label)}</option>`;
      })
      .join("")
  );
}

async function loadMunicipiosBitByDepartamento(depTxt) {
  const sel = document.getElementById("bitMun");
  if (!sel) return;

  sel.innerHTML = `<option value="">Seleccione…</option>`;
  sel.disabled = true;

  if (!depTxt) return;

  const norm = (s) =>
    String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // quita tildes
      .replace(/[^a-z0-9\s]/g, " ") // quita puntuación
      .replace(/\s+/g, " ")
      .trim();

  const depNorm = norm(depTxt);

  let rows = [];

  // 1) intento exacto
  {
    const { data, error } = await supabaseClient
      .from("municipios")
      .select("lugar, departamento")
      .eq("departamento", depTxt)
      .order("lugar", { ascending: true });

    if (error) throw error;
    rows = data || [];
  }

  // 2) fallback con ilike (por variaciones de mayúsculas/puntuación)
  if (!rows.length) {
    const { data, error } = await supabaseClient
      .from("municipios")
      .select("lugar, departamento")
      .ilike("departamento", `%${depTxt}%`)
      .order("lugar", { ascending: true });

    if (error) throw error;
    rows = data || [];
  }

  // 3) fallback final: trae y filtra en cliente por normalización (más tolerante)
  if (!rows.length) {
    const { data, error } = await supabaseClient
      .from("municipios")
      .select("lugar, departamento")
      .limit(5000);

    if (error) throw error;

    rows = (data || [])
      .filter((r) => norm(r.departamento) === depNorm)
      .sort((a, b) => String(a.lugar || "").localeCompare(String(b.lugar || ""), "es"));
  }

  if (!rows.length) {
    sel.innerHTML = `<option value="">(Sin municipios)</option>`;
    sel.disabled = true;
    setMsgBit(`No encontré municipios para "${depTxt}". Revisa el catálogo municipios.departamento.`, "warning");
    return;
  }

  sel.insertAdjacentHTML(
    "beforeend",
    rows.map((m) => `<option value="${escapeHtml(m.lugar)}">${escapeHtml(m.lugar)}</option>`).join("")
  );

  sel.disabled = false;
}

function renderBitLugaresRows() {
  const tb = document.getElementById("bitLugaresRows");
  const badge = document.getElementById("badgeBitLugares");
  if (badge) badge.textContent = String((bitLugaresDraft || []).length);

  if (!tb) return;

  if (!Array.isArray(bitLugaresDraft) || bitLugaresDraft.length === 0) {
    tb.innerHTML = `<tr><td colspan="4" class="text-muted">Agrega al menos un lugar.</td></tr>`;
    return;
  }

  tb.innerHTML = bitLugaresDraft
    .map(
      (l, i) => `
      <tr>
        <td class="text-nowrap">${escapeHtml(l.departamento || "")}</td>
        <td class="text-nowrap">${escapeHtml(l.municipio || "")}</td>
        <td>${escapeHtml(l.detalle || "")}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-danger" type="button" data-bit-del="${i}">
            <i class="bi bi-x-lg"></i>
          </button>
        </td>
      </tr>
    `
    )
    .join("");

  tb.querySelectorAll("[data-bit-del]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = parseInt(btn.dataset.bitDel, 10);
      bitLugaresDraft.splice(i, 1);
      renderBitLugaresRows();
    });
  });
}

function addBitLugarFromUI() {
  const dep = document.getElementById("bitDep")?.value || "";
  const mun = document.getElementById("bitMun")?.value || "";
  const detalle = document.getElementById("bitLugarDetalle")?.value?.trim() || "";

  if (!dep) return setMsgBit("Selecciona un departamento.", "warning");
  if (!mun) return setMsgBit("Selecciona un municipio.", "warning");

  const key = `${dep}::${mun}::${detalle}`.toLowerCase();
  const exists = (bitLugaresDraft || []).some(
    (x) => `${x.departamento}::${x.municipio}::${x.detalle || ""}`.toLowerCase() === key
  );
  if (exists) return setMsgBit("Ese lugar ya está agregado.", "warning");

  bitLugaresDraft.push({ departamento: dep, municipio: mun, detalle });

  const det = document.getElementById("bitLugarDetalle");
  if (det) det.value = "";
  renderBitLugaresRows();
  clearMsgBit();
}

function resetBitForm() {
  clearMsgBit();
  bitEditId = null;

  const btn = document.getElementById("btnGuardarBitacora");
  if (btn) {
    btn.innerHTML = `<i class="bi bi-save2 me-1"></i>Guardar reporte`;
    btn.dataset.editId = "";
  }

  bitLugaresDraft = [];
  renderBitLugaresRows();

  const set = (id, v = "") => {
    const el = document.getElementById(id);
    if (el) el.value = v;
  };
  set("bitFechaInicio", "");
  set("bitFechaFin", "");
  set("bitParticipantesTotal", "");
  set("bitParticipantesDetalle", "");
  set("bitContenido", "");
  set("bitDep", "");

  const mun = document.getElementById("bitMun");
  if (mun) {
    mun.innerHTML = `<option value="">Seleccione…</option>`;
    mun.disabled = true;
  }
}

function validateBitForm() {
  const fi = document.getElementById("bitFechaInicio")?.value || "";
  const pt = parseInt(document.getElementById("bitParticipantesTotal")?.value, 10) || 0;
  const contenido = (document.getElementById("bitContenido")?.value || "").trim();

  if (!fi) return "La fecha de realización (inicio) es obligatoria.";
  if (pt <= 0) return "El total de participantes debe ser mayor a 0.";
  if (!Array.isArray(bitLugaresDraft) || bitLugaresDraft.length === 0) return "Agrega al menos un lugar.";
  if (contenido.length < 300) return "El contenido es muy corto. Mínimo 300 caracteres.";
  return null;
}

function scrollModalBitacoraTop() {
  const modalBody = document.querySelector("#modalBitacora .modal-body");
  if (modalBody) modalBody.scrollTop = 0;
}

function fillBitFormFromRow(row) {
  document.getElementById("bitFechaInicio").value = row.fecha_inicio || "";
  document.getElementById("bitFechaFin").value = row.fecha_fin || "";
  document.getElementById("bitParticipantesTotal").value = row.participantes_total ?? "";
  document.getElementById("bitParticipantesDetalle").value = row.participantes_detalle ?? "";
  document.getElementById("bitContenido").value = row.contenido || "";

  bitLugaresDraft = Array.isArray(row.lugares) ? row.lugares : [];
  renderBitLugaresRows();

  const btn = document.getElementById("btnGuardarBitacora");
  if (btn) btn.innerHTML = `<i class="bi bi-check2-circle me-1"></i>Actualizar reporte`;

  setMsgBit("✏️ Editando reporte. Puedes modificar y actualizar. (Si quieres crear uno nuevo, limpia el formulario o cierra el modal).", "info");
  scrollModalBitacoraTop();
}

function startEditBitacora(reporteId) {
  const row = bitCacheById.get(reporteId);
  if (!row) return setMsgBit("No encontré ese reporte para editar.", "warning");

  bitEditId = reporteId;
  fillBitFormFromRow(row);
}

async function copyTextToClipboard(text) {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    // fallback below
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "readonly");
    ta.style.position = "absolute";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  } catch (e) {
    return false;
  }
}

async function fetchProductosValidadosConEvidencia(actividadId) {
  try {
    if (!actividadId) return [];

    const { data, error } = await supabaseClient
      .from("producto")
      .select("descripcion, estado, medios_verificacion, orden, created_at")
      .eq("actividad_id", actividadId)
      .order("orden", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw error;

    const norm = (s) => String(s ?? "").trim().toLowerCase();

    const extractUrls = (mv) => {
      if (!mv) return [];
      if (Array.isArray(mv)) {
        return mv
          .map((x) => {
            if (!x) return "";
            if (typeof x === "string") return x;
            if (typeof x === "object") return x.url || x.link || x.href || "";
            return "";
          })
          .filter(Boolean);
      }
      if (typeof mv === "object") return [mv.url || mv.link || mv.href].filter(Boolean);
      if (typeof mv === "string") {
        const matches = mv.match(/https?:\/\/\S+/g);
        return (matches || []).map((u) => u.replace(/[),.;]+$/g, ""));
      }
      return [];
    };

    return (data || [])
      .filter((p) => norm(p.estado) === "validado" || norm(p.estado) === "validada")
      .map((p) => {
        const urls = extractUrls(p.medios_verificacion);
        return { producto: p.descripcion || "", urls };
      });
  } catch (e) {
    console.error("FETCH productos validados ERROR:", e);
    return [];
  }
}

async function copyBitacora(reporteId) {
  const row = bitCacheById.get(reporteId);
  if (!row) return setMsgBit("No encontré ese reporte para copiar.", "warning");

  const actLabel = getActividadLabelById(bitActividadId);
  const fi = row.fecha_inicio || "";
  const ff = row.fecha_fin || "";
  const fecha = ff && ff !== fi ? `${fi} → ${ff}` : fi;

  const lugares = Array.isArray(row.lugares) ? row.lugares : [];
  const lugaresTxt = lugares
    .map((l) =>
      `${l.departamento || ""} — ${l.municipio || ""}${l.detalle ? " — " + l.detalle : ""}`
        .replace(/^ — /, "")
        .trim()
    )
    .filter(Boolean)
    .map((x) => `- ${x}`)
    .join("\n");

  const pd = row.participantes_detalle;
  const participantesDetTxt =
    pd && typeof pd === "object" ? (pd.texto ? String(pd.texto) : JSON.stringify(pd)) : pd ? String(pd) : "";

  const participantesDet = participantesDetTxt ? `\nParticipantes (detalle): ${participantesDetTxt}` : "";

  // Productos validados + evidencia (desde tabla producto)
  const validados = await fetchProductosValidadosConEvidencia(bitActividadId);
  const validadosTxt = validados.length
    ? validados
        .map((v) => {
          const urlsTxt = (v.urls || []).length
            ? (v.urls || []).map((u) => `  - ${u}`).join("\n")
            : "  - (Sin link de evidencia)";
          return `- ${v.producto}\n${urlsTxt}`;
        })
        .join("\n")
    : "- —";

  const text = [
    `BITÁCORA DE ACTIVIDAD`,
    `Actividad: ${actLabel}`,
    `Fecha: ${fecha || "—"}`,
    `Participantes: ${row.participantes_total ?? "—"}${participantesDet}`,
    ``,
    `Lugares:`,
    lugaresTxt || "- —",
    ``,
    `Contenido ejecutado:`,
    (row.contenido || "").trim(),
    ``,
    `Productos validados y evidencia (desde Productos de la actividad):`,
    validadosTxt,
  ].join("\n");

  const ok = await copyTextToClipboard(text);
  if (ok) setMsgBit("📋 Reporte copiado al portapapeles (incluye productos validados).", "success");
  else setMsgBit("No pude copiar al portapapeles en este navegador.", "warning");
}

async function loadBitacoraHistorial(actividadId) {
  const box = document.getElementById("bitHistorial");
  if (box) box.innerHTML = `<div class="text-muted small">Cargando historial…</div>`;

  const { data, error } = await supabaseClient
    .from("actividad_bitacora")
    .select("id, fecha_inicio, fecha_fin, lugares, participantes_total, participantes_detalle, contenido, created_at")
    .eq("actividad_id", actividadId)
    .order("fecha_inicio", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("BIT LOAD ERROR:", error);
    if (box) box.innerHTML = `<div class="text-danger small">Error cargando bitácora.</div>`;
    return;
  }

  const rows = data || [];

  // cache rápido por id (para editar/copiar)
  bitCacheById = new Map(rows.map(r => [r.id, r]));
  if (!rows.length) {
    if (box) box.innerHTML = `<div class="text-muted small">Aún no hay reportes para esta actividad.</div>`;
    return;
  }

  if (!box) return;

  box.innerHTML = rows
    .map((r) => {
      const fi = r.fecha_inicio || "";
      const ff = r.fecha_fin || "";
      const fecha = ff && ff !== fi ? `${fi} → ${ff}` : fi;

      const lugares = Array.isArray(r.lugares) ? r.lugares : [];
      const lugaresTxt = lugares
        .slice(0, 2)
        .map((l) => `${l.municipio}${l.departamento ? " (" + l.departamento + ")" : ""}`)
        .join(", ");
      const more = lugares.length > 2 ? ` +${lugares.length - 2} más` : "";

      const prev = String(r.contenido || "").trim();
      const preview = prev.length > 180 ? prev.slice(0, 180) + "…" : prev;

      return `
        <div class="border rounded-3 p-2 mb-2 bg-body">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <div class="fw-semibold">${escapeHtml(fecha || "—")}</div>
              <div class="small text-muted">Participantes: ${escapeHtml(r.participantes_total ?? "")} · Lugares: ${escapeHtml(String(lugares.length))}</div>
              <div class="small text-muted">${escapeHtml(lugaresTxt)}${escapeHtml(more)}</div>
            </div>
            <div class="btn-group" role="group">
  <button class="btn btn-sm btn-outline-secondary" type="button" data-bit-view="${r.id}" title="Ver">
    <i class="bi bi-eye"></i>
  </button>
  <button class="btn btn-sm btn-outline-secondary" type="button" data-bit-edit="${r.id}" title="Editar">
    <i class="bi bi-pencil"></i>
  </button>
  <button class="btn btn-sm btn-outline-secondary" type="button" data-bit-copy="${r.id}" title="Copiar">
    <i class="bi bi-clipboard"></i>
  </button>
</div>
          </div>
          <div class="small mt-2">${escapeHtml(preview)}</div>

          <div class="collapse mt-2" id="bitView${r.id}">
            <div class="small">
              <div class="fw-semibold mb-1">Detalle</div>
              <div class="mb-2"><span class="text-muted">Contenido:</span><br>${escapeHtml(r.contenido || "")}</div>

              <div class="mb-2"><span class="text-muted">Lugares:</span>
                <ul class="mb-0">
                  ${(lugares || [])
                    .map(
                      (l) =>
                        `<li>${escapeHtml(
                          (l.departamento || "") +
                            " — " +
                            (l.municipio || "") +
                            (l.detalle ? " — " + l.detalle : "")
                        )}</li>`
                    )
                    .join("")}
                </ul>
              </div>

              <div class="mb-0"><span class="text-muted">Participantes (detalle):</span><br>${escapeHtml(
                typeof r.participantes_detalle === "string"
                  ? r.participantes_detalle
                  : JSON.stringify(r.participantes_detalle || {})
              )}</div>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  box.querySelectorAll("[data-bit-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.bitView;
      const el = document.getElementById("bitView" + id);
      if (!el) return;
      new bootstrap.Collapse(el, { toggle: true });
    });
  });

  box.querySelectorAll("[data-bit-edit]").forEach((btn) => {
    btn.addEventListener("click", () => startEditBitacora(btn.dataset.bitEdit));
  });

  box.querySelectorAll("[data-bit-copy]").forEach((btn) => {
    btn.addEventListener("click", () => copyBitacora(btn.dataset.bitCopy));
  });
}

async function loadProductosEvidenciasBitacora(actividadId) {
  const tb = document.getElementById("bitProdRows");
  if (!tb) return;

  tb.innerHTML = `<tr><td colspan="4" class="text-muted">Cargando productos…</td></tr>`;

  const { data, error } = await supabaseClient
    .from("producto")
    .select("id, descripcion, estado, medios_verificacion, revisiones, orden, created_at")
    .eq("actividad_id", actividadId)
    .order("orden", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("BIT PROD ERROR:", error);
    tb.innerHTML = `<tr><td colspan="4" class="text-danger">Error cargando productos.</td></tr>`;
    return;
  }

  const rows = data || [];
  if (!rows.length) {
    tb.innerHTML = `<tr><td colspan="4" class="text-muted">No hay productos asociados a esta actividad.</td></tr>`;
    return;
  }

  tb.innerHTML = rows
    .map((p) => {
      const ev =
        Array.isArray(p.medios_verificacion) && p.medios_verificacion.length
          ? p.medios_verificacion[0].url || ""
          : "";
      const btn = ev
        ? `<button class="btn btn-sm btn-outline-secondary" type="button" data-bit-open="${escapeHtml(
            ev
          )}" title="Ver evidencia">
             <i class="bi bi-box-arrow-up-right"></i>
           </button>`
        : `<span class="badge text-bg-warning">Sin evidencia</span>`;

      return `
        <tr>
          <td>${escapeHtml(p.descripcion || "")}</td>
          <td class="text-nowrap">${escapeHtml(p.estado || "Pendiente")}</td>
          <td class="text-nowrap">${escapeHtml(p.revisiones || "")}</td>
          <td class="text-end">${btn}</td>
        </tr>
      `;
    })
    .join("");

  tb.querySelectorAll("[data-bit-open]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const url = btn.dataset.bitOpen || "";
      if (!url) return;
      window.open(url, "_blank", "noopener,noreferrer");
    });
  });
}

async function saveBitacoraEntry() {
  try {
    clearMsgBit();
    if (!bitActividadId) return;

    const err = validateBitForm();
    if (err) return setMsgBit(err, "warning");

    const fi = document.getElementById("bitFechaInicio").value;
    const ff = document.getElementById("bitFechaFin").value || null;

    const participantes_total = parseInt(document.getElementById("bitParticipantesTotal").value, 10) || 0;
    const participantes_detalle = (document.getElementById("bitParticipantesDetalle").value || "").trim() || null;

    const contenido = document.getElementById("bitContenido").value.trim();

    const payload = {
      actividad_id: bitActividadId,
      fecha_inicio: fi,
      fecha_fin: ff,
      lugares: bitLugaresDraft,
      participantes_total,
      participantes_detalle,
      contenido,
    };

    const btn = document.getElementById("btnGuardarBitacora");
const editId = bitEditId || (btn?.dataset?.editId ? String(btn.dataset.editId) : null);

if (editId) {
  const { data, error } = await supabaseClient
    .from("actividad_bitacora")
    .update(payload)
    .eq("id", editId)
    .select("id");

  if (error) throw error;

  // Si RLS bloquea el update, a veces no da error y simplemente retorna 0 filas.
  if (!data || data.length === 0) {
    return setMsgBit(
      "No se pudo actualizar (0 filas). Si tienes RLS activo, agrega una policy UPDATE para actividad_bitacora.",
      "warning"
    );
  }

  setMsgBit("✅ Reporte actualizado.", "success");
} else {
  const { error } = await supabaseClient.from("actividad_bitacora").insert([payload]);
  if (error) throw error;
  setMsgBit("✅ Reporte guardado en la bitácora.", "success");
}
    resetBitForm();
    await loadBitacoraHistorial(bitActividadId);
  } catch (e) {
    console.error("BIT SAVE ERROR:", e);
    setMsgBit("❌ " + (e.message || e), "danger");
  }
}

async function openModalBitacora(actividadId) {
  bitActividadId = actividadId;

  const title = document.getElementById("lblModalBitacora");
  if (title) title.textContent = "Bitácora — " + getActividadLabelById(actividadId);

  // Bind de eventos (reemplaza handlers anteriores si existían)
  const depSel = document.getElementById("bitDep");
  const munSel = document.getElementById("bitMun");
  const btnAddLugar = document.getElementById("btnBitAddLugar");
  const btnSave = document.getElementById("btnGuardarBitacora");

  if (depSel) {
    depSel.onchange = async () => {
      try {
        clearMsgBit();
        await loadMunicipiosBitByDepartamento(depSel.value);
      } catch (e) {
        console.error("BIT MUN ERROR:", e);
        setMsgBit("No pude cargar municipios: " + (e.message || e), "danger");
        if (munSel) {
          munSel.innerHTML = `<option value="">(Error)</option>`;
          munSel.disabled = true;
        }
      }
    };
  }

  if (btnAddLugar) {
    btnAddLugar.onclick = (e) => {
      e.preventDefault();
      addBitLugarFromUI();
    };
  }

  if (btnSave) {
    btnSave.onclick = (e) => {
      e.preventDefault();
      saveBitacoraEntry();
    };
  }

  resetBitForm();

  try {
    await loadDepartamentosBit();
  } catch (e) {
    console.error("BIT DEP ERROR:", e);
    setMsgBit("No pude cargar departamentos: " + (e.message || e), "danger");
  }

  await loadBitacoraHistorial(actividadId);
  await loadProductosEvidenciasBitacora(actividadId);

  new bootstrap.Modal(document.getElementById("modalBitacora")).show();
}

// para evitar que vuelva el ReferenceError por alcance/orden de carga
window.openModalBitacora = openModalBitacora;

// asegurar disponibilidad global (evita ReferenceError si el listener está en otro scope)
window.openModalBitacora = openModalBitacora;

/* =========================
   PRODUCTOS (CRUD + LISTA)
========================= */
async function loadProductos(actividadId) {
  if (!actividadId) {
    cacheProductos = [];
    renderProductosList();
    return;
  }

  const { data, error } = await supabaseClient
    .from("producto")
    .select("id, actividad_id, descripcion, tipo, estado, orden, indicador, medios_verificacion, created_at,revisiones")
    .eq("actividad_id", actividadId)
    .order("orden", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    console.error("PROD LOAD ERROR:", error);
    setMsgOAP("❌ " + error.message, "danger");
    cacheProductos = [];
    renderProductosList();
    await pintarAvanceActividades(objetivoActivoId);

    return;
  }

  hideMsgOAP();
  cacheProductos = data || [];
  renderProductosList();
}

function openModalProductoNew() {
  if (!actividadActivaId) return;

  hideMsgModal("msgProdModal");
  document.getElementById("lblModalProducto").textContent = "Nuevo producto";
  document.getElementById("prodId").value = "";
  document.getElementById("prodTipo").value = "";
  document.getElementById("prodEstado").value = "Pendiente";
  document.getElementById("prodOrden").value = 1;
  document.getElementById("prodDescripcion").value = "";
  document.getElementById("prodRevision").value = "";

  // opcionales
  const ind = document.getElementById("prodIndicador");
  if (ind) ind.value = "";

  mvDraft = [];
  renderMVRows();

  new bootstrap.Modal(document.getElementById("modalProducto")).show();
}

function openModalProductoEdit(id) {
  const p = cacheProductos.find((x) => x.id === id);
  if (!p) return;

  hideMsgModal("msgProdModal");
  document.getElementById("lblModalProducto").textContent = "Editar producto";
  document.getElementById("prodId").value = p.id;
  document.getElementById("prodTipo").value = p.tipo ?? "";
  document.getElementById("prodEstado").value = p.estado ?? "Pendiente";
  document.getElementById("prodOrden").value = p.orden ?? 1;
  document.getElementById("prodDescripcion").value = p.descripcion ?? "";
  document.getElementById("prodRevision").value = p.revisiones ?? "";

  const ind = document.getElementById("prodIndicador");
  if (ind) ind.value = p.indicador ?? "";

  mvDraft = Array.isArray(p.medios_verificacion) ? p.medios_verificacion : [];
  renderMVRows();

  new bootstrap.Modal(document.getElementById("modalProducto")).show();
}

async function saveProducto() {
  try {
    hideMsgModal("msgProdModal");
    if (!actividadActivaId) return setMsgModal("msgProdModal", "Selecciona una actividad.", "warning");

    const id = document.getElementById("prodId").value || null;
    const tipo = document.getElementById("prodTipo").value.trim() || null;
    const estado = document.getElementById("prodEstado").value || "Pendiente";
    const orden = parseInt(document.getElementById("prodOrden").value, 10) || 1;
    const descripcion = document.getElementById("prodDescripcion").value.trim();
    const revisiones = document.getElementById("prodRevision").value.trim();
    console.log("productos", revisiones)

    if (!descripcion) {
      return setMsgModal("msgProdModal", "La descripción del producto es obligatoria.", "warning");
    }

    const indicador = document.getElementById("prodIndicador")?.value?.trim() || null;

    const medios_verificacion = (mvDraft || [])
      .filter((x) => (x.url && x.url.trim()) || (x.label && x.label.trim()))
      .map((x) => ({
        label: (x.label || "").trim(),
        url: (x.url || "").trim(),
        tipo: (x.tipo || "otro").trim(),
        date: (x.date || "").trim(),
      }));

    const payload = {
      actividad_id: actividadActivaId,
      tipo,
      estado,
      orden,
      descripcion,
      indicador,
      medios_verificacion,
      revisiones,
    };

    const { error } = id
      ? await supabaseClient.from("producto").update(payload).eq("id", id)
      : await supabaseClient.from("producto").insert([payload]);

    if (error) throw error;

    bootstrap.Modal.getInstance(document.getElementById("modalProducto")).hide();
    await loadProductos(actividadActivaId);

    await pintarAvanceActividades(objetivoActivoId);
    await pintarAvanceObjetivos(proyectoId);
    await pintarAvanceProyecto(proyectoId);

  } catch (e) {
    console.error("PROD SAVE ERROR:", e);
    setMsgModal("msgProdModal", "❌ " + (e.message || e), "danger");
  }
}

async function deleteProducto(id) {
  const ok = confirm("¿Seguro que deseas borrar este producto?");
  if (!ok) return;

  try {
    const { error } = await supabaseClient.from("producto").delete().eq("id", id);
    if (error) throw error;
    await loadProductos(actividadActivaId);
    await pintarAvanceActividades(objetivoActivoId);
    await pintarAvanceObjetivos(proyectoId);
    await pintarAvanceProyecto(proyectoId);

  } catch (e) {
    console.error("PROD DEL ERROR:", e);
    setMsgOAP("❌ " + (e.message || e), "danger");
  }
}

function renderProductosList() {
  const box = document.getElementById("listProductos");
  if (!box) return;

  if (!actividadActivaId) {
    box.innerHTML = `<div class="text-muted small">Selecciona una actividad…</div>`;
    syncActionButtons();
    return;
  }

  if (!cacheProductos.length) {
    box.innerHTML = `<div class="text-muted small">No hay productos para esta actividad.</div>`;
    syncActionButtons();
    return;
  }

  box.innerHTML = cacheProductos
    .map((p) => {
      const label = p.descripcion || "";
      const meta = `Estado: ${p.estado ?? "Pendiente"} · Revisión: ${p.revisiones ?? ""}`;

      const firstUrl =
        Array.isArray(p.medios_verificacion) && p.medios_verificacion.length
          ? p.medios_verificacion[0].url || ""
          : "";

      const btnVer = firstUrl
        ? `<button class="btn btn-sm btn-outline-secondary" data-prod-open="${escapeHtml(firstUrl)}" type="button" title="Ver soporte">
             <i class="bi bi-box-arrow-up-right"></i>
           </button>`
        : "";

      return `
      <div class="cursor-app bg-body-secondary mb-1 list-group-item d-flex justify-content-between align-items-start">
        <div class="me-2">
          <div class="fw-semibold">${escapeHtml(label)}</div>
          <div class="text-muted small">${escapeHtml(meta)}</div>
        </div>

        <div class="d-flex gap-2">
          ${btnVer}
          <button class="btn btn-sm btn-outline-primary" data-prod-edit="${p.id}" type="button" title="Editar">
            <i class="bi bi-pencil-fill"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" data-prod-del="${p.id}" type="button" title="Borrar">
            <i class="bi bi-trash3-fill"></i>
          </button>
        </div>
      </div>
    `;
    })
    .join("");

  box.querySelectorAll("[data-prod-open]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const url = btn.dataset.prodOpen || "";
      if (!url) return;
      window.open(url, "_blank", "noopener,noreferrer");
    });
  });

  box.querySelectorAll("[data-prod-edit]").forEach((btn) => {
    btn.addEventListener("click", () => openModalProductoEdit(btn.dataset.prodEdit));
  });

  box.querySelectorAll("[data-prod-del]").forEach((btn) => {
    btn.addEventListener("click", () => deleteProducto(btn.dataset.prodDel));
  });

  syncActionButtons();
}

/* =========================
   Botones estado UI
========================= */
function syncActionButtons() {
  document.getElementById("btnNuevaActividad").disabled = !objetivoActivoId;
  document.getElementById("btnNuevoProducto").disabled = !actividadActivaId;
}

/* =========================
   INIT
========================= */
async function init() {
  const session = await requireAuth();
  if (!session) return;

  if (!proyectoId) {
    setMsg("Falta el parámetro ?id. Vuelve a la lista y selecciona un proyecto.", "warning");
    return;
  }

  document.getElementById("btnVolver")?.addEventListener("click", () => {
    window.location.href = "proyectos.html";
  });

  document.getElementById("btnGuardarCambios")?.addEventListener("click", guardarCambios);

  document.getElementById("inpDepartamento")?.addEventListener("change", async (e) => {
    try {
      await loadMunicipiosByDepartamento(e.target.value, null);
    } catch (err) {
      console.error("MUN ERROR:", err);
      setMsg("No pude cargar municipios: " + (err.message || err), "danger");
    }
  });


// Territorialización múltiple (UI opcional)
if (document.getElementById("btnAddTerritorio")) {
  document.getElementById("btnAddTerritorio")?.addEventListener("click", addTerritorioDraftFromUI);
  document.getElementById("inpMunicipio")?.addEventListener("change", () => {
    try { syncTerritorioInputsFromMunicipio(); } catch (e) { console.error(e); }
  });
}

  document.getElementById("btnLogout")?.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
  });

  // Botones O/A/P
  document.getElementById("btnNuevoObjetivo")?.addEventListener("click", openModalObjetivoNew);
  document.getElementById("btnGuardarObjetivo")?.addEventListener("click", saveObjetivo);

  document.getElementById("btnNuevaActividad")?.addEventListener("click", openModalActividadNew);
  document.getElementById("btnGuardarActividad")?.addEventListener("click", saveActividad);

  document.getElementById("btnNuevoProducto")?.addEventListener("click", openModalProductoNew);
  document.getElementById("btnGuardarProducto")?.addEventListener("click", saveProducto);

  // Soportes MV
  document.getElementById("btnAddMV")?.addEventListener("click", () => {
    mvDraft.push({ label: "", url: "", tipo: "otro", date: "" });
    renderMVRows();
  });

  syncActionButtons();

  try {
    await loadProyecto();
  } catch (e) {
    console.error("LOAD PROYECTO ERROR:", e);
    setMsg("❌ No pude cargar el proyecto: " + (e.message || e), "danger");
  }

  await loadObjetivos();
  renderActividadesList();
  renderProductosList();




  document.getElementById("btnNuevoRubroItem")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    addPresupuestoItem();
  });




  // al iniciar
  await loadRubrosCatalogo();


}
//Carga solo la lista de los rubros
async function loadRubrosCatalogo() {
  const { data, error } = await supabaseClient
    .from("rubro")
    .select("id, nombre, categoria, unidad, codigo, activo")
    .order("nombre", { ascending: true });

  if (error) throw error;
  cacheRubros = (data || []).filter(r => r.activo !== false);
}

async function loadPresupuestoActividad(actividadId) {
  const tb = document.getElementById("tblPresupuesto");
  if (!tb) return;

  if (!actividadId) {
    tb.innerHTML = `<tr><td colspan="9" class="text-muted p-2">Selecciona una actividad…</td></tr>`;
    document.getElementById("btnNuevoRubroItem").disabled = true;
    document.getElementById("sumActividad").textContent = "$ 0";
    return;
  }

  tb.innerHTML = `<tr><td colspan="9" class="text-muted p-2">Cargando…</td></tr>`;
  document.getElementById("btnNuevoRubroItem").disabled = false;

  const { data, error } = await supabaseClient
    .from("presupuesto_item")
    .select(`
      id, actividad_id, rubro_id, beneficiarios, veces, valor_unitario, costo_operativo_pct,
      valor_bruto, costo_operativo_val, valor_total, orden, observaciones, created_at
    `)
    .eq("actividad_id", actividadId)
    .order("orden", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    tb.innerHTML = `<tr><td colspan="9" class="text-danger p-2">Error cargando presupuesto.</td></tr>`;
    return;
  }

  cachePresupuesto = data || [];
  renderPresupuestoGrid();
}

function money(n) {
  const v = Number(n || 0);
  return v.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

function renderPresupuestoGrid() {
  const tb = document.getElementById("tblPresupuesto");
  if (!tb) return;

  if (!cachePresupuesto.length) {
    tb.innerHTML = `<tr><td colspan="9" class="text-muted p-2">Aún no hay rubros para esta actividad.</td></tr>`;
    document.getElementById("sumActividad").textContent = "$ 0";
    return;
  }

  tb.innerHTML = cachePresupuesto.map(row => {
    const rubroOptions = cacheRubros.map(r =>
      `<option value="${r.id}" ${r.id === row.rubro_id ? "selected" : ""}>${escapeHtml(r.nombre)}</option>`
    ).join("");

    return `
      <tr data-row="${row.id}">
        <td>
          <select class="form-select form-select-sm" data-k="rubro_id">${rubroOptions}</select>
        </td>
        <td><input class="form-control form-control-sm text-start" data-k="observaciones" type="text" value="${row.observaciones ?? ""}"></td>
       
        <td><input class="form-control form-control-sm" data-k="beneficiarios" type="number" min="0" value="${row.beneficiarios ?? 0}"></td>
        <td><input class="form-control form-control-sm text-end" data-k="veces" type="number" min="0" value="${row.veces ?? 0}"></td>
        <td><input class="form-control form-control-sm text-end" data-k="valor_unitario" type="number" min="0" step="0.01" value="${row.valor_unitario ?? 0}"></td>
        <td><input class="form-control form-control-sm text-end" data-k="costo_operativo_pct" type="number" min="0" step="0.01" value="${row.costo_operativo_pct ?? 0}"></td>
        <td class="text-end">${money(row.valor_bruto)}</td>
        <td class="text-end">${money(row.costo_operativo_val)}</td>
        <td class="text-end fw-semibold">${money(row.valor_total)}</td>
        <td class="text-center">
          <button class="btn btn-sm btn-outline-danger" data-del="${row.id}" type="button">X</button>
        </td>
      </tr>
    `;
  }).join("");

  // listeners edición (estilo excel)
  tb.querySelectorAll("tr[data-row]").forEach(tr => {
    const id = tr.dataset.row;

    tr.querySelectorAll("[data-k]").forEach(ctrl => {
      ctrl.addEventListener("change", async () => {
        const k = ctrl.dataset.k;
        let v = ctrl.value;

        if (["beneficiarios", "veces"].includes(k)) v = parseInt(v, 10) || 0;
        if (["valor_unitario", "costo_operativo_pct"].includes(k)) v = parseFloat(v) || 0;

        await updatePresupuestoItem(id, { [k]: v });
      });
    });

    tr.querySelector("[data-del]")?.addEventListener("click", () => deletePresupuestoItem(id));
  });

  // suma total actividad
  const sum = cachePresupuesto.reduce((acc, r) => acc + Number(r.valor_total || 0), 0);
  document.getElementById("sumActividad").textContent = money(sum);
}
async function updatePresupuestoItem(id, patch) {
  const { error } = await supabaseClient
    .from("presupuesto_item")
    .update(patch)
    .eq("id", id);

  if (error) {
    console.error(error);
    return;
  }

  // recargar para traer los calculados (valor_bruto/total)
  await loadPresupuestoActividad(actividadActivaId);
}

async function deletePresupuestoItem(id) {
  const ok = confirm("¿Borrar esta fila de presupuesto?");
  if (!ok) return;

  const { error } = await supabaseClient.from("presupuesto_item").delete().eq("id", id);
  if (error) {
    console.error(error);
    return;
  }
  await loadPresupuestoActividad(actividadActivaId);
}

async function addPresupuestoItem() {
  try {
    if (!actividadActivaId) {
      alert("Selecciona una actividad antes de agregar un rubro.");
      return;
    }

    if (!cacheRubros || cacheRubros.length === 0) {
      alert("No hay rubros en el catálogo.");
      return;
    }

    const firstRubro = cacheRubros[0];

    const nextOrden =
      (cachePresupuesto && cachePresupuesto.length)
        ? Math.max(...cachePresupuesto.map(x => x.orden || 0)) + 1
        : 1;

    const payload = {
      actividad_id: actividadActivaId,
      rubro_id: firstRubro.id,
      observaciones: "Detalle rubro",
      beneficiarios: 0,
      veces: 0,
      valor_unitario: 0,
      costo_operativo_pct: 0,
      orden: nextOrden
    };

    console.log("INSERT presupuesto_item:", payload);

    const { data, error } = await supabaseClient
      .from("presupuesto_item")
      .insert([payload])
      .select()
      .single();

    if (error) throw error;

    console.log("INSERT OK:", data);

    await loadPresupuestoActividad(actividadActivaId);

  } catch (e) {
    console.error("addPresupuestoItem ERROR:", e);
    alert("Error agregando fila: " + (e.message || e));
  }
}
//Esta función pega y configura si saco datos de una talba externa
async function pastePresupuestoItem(db) {
  try {
    if (!actividadActivaId) {
      alert("Selecciona una actividad antes de agregar un rubro.");
      return;
    }

    if (!cacheRubros || cacheRubros.length === 0) {
      alert("No hay rubros en el catálogo.");
      return;
    }

    const firstRubro = cacheRubros[0];

    let oper = document.getElementById("inputOperativos").value
    const nextOrden =
      (cachePresupuesto && cachePresupuesto.length)
        ? Math.max(...cachePresupuesto.map(x => x.orden || 0)) + 1
        : 1;
    const payload = {
      actividad_id: actividadActivaId,
      rubro_id: firstRubro.id,
      observaciones: db.observaciones,
      beneficiarios: db.beneficiarios,
      veces: db.veces,
      valor_unitario: db.valor_unitario,
      costo_operativo_pct: oper,
      orden: nextOrden
    };

    //console.log("INSERT presupuesto_item:", payload);

    const { data, error } = await supabaseClient
      .from("presupuesto_item")
      .insert([payload])
      .select()
      .single();

    if (error) throw error;

    console.log("INSERT OK:", data);

    await loadPresupuestoActividad(actividadActivaId);

  } catch (e) {
    console.error("addPresupuestoItem ERROR:", e);
    alert("Error agregando fila: " + (e.message || e));
  }
}

/* =========================
       CONFIG
       ========================= */
const RUBRO_HEADERS = ["Rubro", "Beneficiarios", "Veces", "Valor Unitario"];
const EXPECTED_COLS = RUBRO_HEADERS.length; // 4

/* =========================
   UTILIDADES
   ========================= */
function setMsg(html, type = "muted") {
  const el = document.getElementById("importRubroMsg");
  el.className = `small mt-2 text-${type}`;
  el.innerHTML = html || "";
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function escapeAttr(s) { return escapeHtml(s).replace(/`/g, "&#096;"); }

/**
 * Limpia valores numéricos pegados desde Excel/Sheets:
 * - elimina $ y espacios
 * - elimina separadores de miles (.) y (,)
 * - convierte formato 1.234,56 -> 1234.56
 */
function normalizeNumericCell(raw) {
  let s = String(raw ?? "").trim();
  if (!s) return "";

  // quitar $ y espacios
  s = s.replace(/\$/g, "").replace(/\s+/g, "");

  // si NO parece número, devolver tal cual (para Rubro)
  if (!/^-?[\d.,]+$/.test(s)) return s;

  const hasDot = s.includes(".");
  const hasComma = s.includes(",");

  // 1.234,56 -> 1234.56
  if (hasDot && hasComma) {
    s = s.replace(/\./g, "");
    s = s.replace(/,/g, ".");
    return s;
  }

  // Si solo tiene puntos, el usuario pidió eliminar puntos (miles): 1.234 -> 1234
  if (hasDot && !hasComma) {
    return s.replace(/\./g, "");
  }

  // Si solo tiene comas: decidir decimal vs miles
  if (!hasDot && hasComma) {
    const parts = s.split(",");
    // si es 12,5 o 12,50 => decimal
    if (parts.length === 2 && parts[1].length <= 2) {
      return parts[0].replace(/,/g, "") + "." + parts[1];
    }
    // si no, tratar como miles: 1,234,567 -> 1234567
    return s.replace(/,/g, "");
  }

  return s; // solo dígitos
}

/**
 * Parser TSV estricto: cada fila debe tener EXACTAMENTE 4 columnas.
 * Ignora líneas vacías.
 */
function parseTSVStrict(text, expectedCols) {
  const clean = String(text ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  if (!clean) return [];

  const lines = clean.split("\n").filter(l => l.trim() !== "");
  const rows = lines.map((line, idx) => {
    const cols = line.split("\t");
    if (cols.length !== expectedCols) {
      throw new Error(`Fila ${idx + 1}: se esperaban ${expectedCols} columnas y llegaron ${cols.length}.`);
    }
    return cols;
  });

  // Si la primera fila es header (igual a nuestros encabezados), la removemos
  const first = rows[0].map(c => String(c).trim().toLowerCase());
  const expected = RUBRO_HEADERS.map(h => h.toLowerCase());
  const isHeaderRow = first.every((v, i) => v === expected[i]);
  return isHeaderRow ? rows.slice(1) : rows;
}

/* =========================
   RENDER TABLA EDITABLE
   ========================= */
function renderRubrosTable(rows) {
  const tbl = document.getElementById("tblRubrosPreview");
  const thead = tbl.querySelector("thead");
  const tbody = tbl.querySelector("tbody");

  // Header fijo
  thead.innerHTML = `
    <tr>
      ${RUBRO_HEADERS.map(h => `<th class="text-nowrap">${escapeHtml(h)}</th>`).join("")}
      <th style="width:1%;">Acción</th>
    </tr>
  `;

  if (!rows || rows.length === 0) {
    tbody.innerHTML = `<tr><td class="text-muted" colspan="${EXPECTED_COLS + 1}">No hay filas.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map((r, rowIdx) => {
    // Normalizar largo (aunque el parser ya lo valida)
    const row = r.slice(0, EXPECTED_COLS);
    while (row.length < EXPECTED_COLS) row.push("");

    return `
      <tr data-row="${rowIdx}">
        ${row.map((cell, colIdx) => {
      const isNumeric = (colIdx === 1 || colIdx === 2 || colIdx === 3); // Beneficiarios, Veces, Valor Unitario
      const val = isNumeric ? normalizeNumericCell(cell) : String(cell ?? "").trim();
      return `
            <td>
              <input
                class="form-control form-control-sm"
                type="${isNumeric ? "number" : "text"}"
                ${isNumeric ? 'step="0.01" min="0"' : ""}
                data-row="${rowIdx}"
                data-col="${colIdx}"
                value="${escapeAttr(val)}"
              />
            </td>
          `;
    }).join("")}
        <td class="text-center">
          <button class="btn btn-outline-danger btn-sm" type="button" data-action="del" data-row="${rowIdx}">
            ✕
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

function collectRubrosFromTable() {
  const tbl = document.getElementById("tblRubrosPreview");
  const inputs = Array.from(tbl.querySelectorAll("tbody tr"));
  return inputs.map(tr => {
    const cells = Array.from(tr.querySelectorAll("input"));
    const observaciones = (cells[0]?.value ?? "").trim();
    const beneficiarios = normalizeNumericCell(cells[1]?.value ?? "");
    const veces = normalizeNumericCell(cells[2]?.value ?? "");
    const valor_unitario = normalizeNumericCell(cells[3]?.value ?? "");

    return {
      observaciones,
      beneficiarios: beneficiarios === "" ? null : Number(beneficiarios),
      veces: veces === "" ? null : Number(veces),
      valor_unitario: valor_unitario === "" ? null : Number(valor_unitario),
    };
  });
}

function addEmptyRow() {
  const current = collectRubrosAsRows();
  current.push(["", "", "", ""]);
  renderRubrosTable(current);
}

function collectRubrosAsRows() {
  const data = collectRubrosFromTable();
  return data.map(o => [
    o.observaciones ?? "",
    (o.beneficiarios ?? "") + "",
    (o.veces ?? "") + "",
    (o.valor_unitario ?? "") + ""
  ]);
}

/* =========================
   ACCIONES: LEER PORTAPAPELES / PEGADO / LIMPIAR / EXPORTAR
   ========================= */
async function buildFromClipboardRubros() {
  setMsg("");
  try {
    const text = await navigator.clipboard.readText();
    const rows = parseTSVStrict(text, EXPECTED_COLS);

    // limpiar numéricos al construir
    const cleaned = rows.map(r => ([
      String(r[0] ?? "").trim(),
      normalizeNumericCell(r[1]),
      normalizeNumericCell(r[2]),
      normalizeNumericCell(r[3]),
    ]));

    renderRubrosTable(cleaned);
    setMsg(`Listo: ${cleaned.length} fila(s) importada(s).`, "success");
  } catch (e) {
    console.error(e);
    setMsg(`No pude leer el portapapeles o hay error de formato. ${escapeHtml(e.message)}<br>
      Usa el cuadro de pegado manual si es un tema de permisos.`, "danger");
  }
}

function buildFromTextareaRubros() {
  setMsg("");
  try {
    const text = document.getElementById("txtPegadoRubro").value || "";
    const rows = parseTSVStrict(text, EXPECTED_COLS);
    const cleaned = rows.map(r => ([
      String(r[0] ?? "").trim(),
      normalizeNumericCell(r[1]),
      normalizeNumericCell(r[2]),
      normalizeNumericCell(r[3]),
    ]));
    renderRubrosTable(cleaned);
    setMsg(`Listo: ${cleaned.length} fila(s) importada(s) desde pegado.`, "success");
  } catch (e) {
    setMsg(`Error: ${escapeHtml(e.message)}`, "danger");
  }
}

function clearRubros() {
  document.getElementById("txtPegadoRubro").value = "";
  renderRubrosTable([]);
  setMsg("Tabla limpiada.", "muted");
}

async function exportRubrosJSON() {
  try {
    const text = await navigator.clipboard.readText();
    const json = JSON.parse(text);

    if (!Array.isArray(json) || json.length === 0) {
      return setMsg("importRubroMsg", "❌ El portapapeles no contiene un array JSON válido.", "danger");
    }

    // 👇 IMPORTANTE: eliminar inserción duplicada
    for (const item of json) {
      await pastePresupuestoItem(item);
    }

    setMsg("importRubroMsg", `✅ Importados ${json.length} rubros.`, "success");

  } catch (e) {
    console.error(e);
    setMsg("importRubroMsg", "❌ " + (e.message || e), "danger");
  }
}


/* =========================
   INIT (Bootstrap + listeners)
   ========================= */
document.addEventListener("DOMContentLoaded", () => {
  const modalEl = document.getElementById("modalImportRubro");
  const modal = new bootstrap.Modal(modalEl);

  document.getElementById("btnAbrirImportRubro").addEventListener("click", () => {
    modal.show();
    setMsg("");
  });

  document.getElementById("btnLeerClipboardRubro").addEventListener("click", buildFromClipboardRubros);
  document.getElementById("btnConstruirDesdePegadoRubro").addEventListener("click", buildFromTextareaRubros);
  document.getElementById("btnLimpiarTablaRubro").addEventListener("click", clearRubros);
  document.getElementById("btnExportarRubrosJSON").addEventListener("click", exportRubrosJSON);
  document.getElementById("btnAgregarFilaRubro").addEventListener("click", addEmptyRow);

  // Delegación para eliminar fila
  document.getElementById("tblRubrosPreview").addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-action='del']");
    if (!btn) return;

    const rowIndex = Number(btn.dataset.row);
    const rows = collectRubrosAsRows();
    rows.splice(rowIndex, 1);
    renderRubrosTable(rows);
    setMsg("Fila eliminada.", "muted");
  });

  // Render inicial con header fijo (sin filas)
  renderRubrosTable([]);
});


async function pintarTotalesActividades(objetivoId) {
  const { data, error } = await supabaseClient.rpc(
    "get_totales_actividades_por_objetivo",
    { p_objetivo_id: objetivoId }
  );

  if (error) return console.error(error);

  data.forEach(r => {

    const el = document.getElementById(`badgeAct${r.actividad_id}`);
    if (el) el.textContent = "Valor actividad:  " + money(r.total);



  });
}

async function pintarTotalesObjetivos(proyectoId) {
  const { data, error } = await supabaseClient.rpc(
    "get_totales_objetivos_por_proyecto",
    { p_proyecto_id: proyectoId }
  );

  if (error) return console.error(error);

  data.forEach(r => {
    const el = document.getElementById(`badgeObj${r.objetivo_id}`);
    if (el) el.textContent = "Valor objetivo:  " + money(r.total);
  });
}
async function pintarTotalProyecto(proyectoId) {
  const { data, error } = await supabaseClient.rpc(
    "get_total_proyecto",
    { p_proyecto_id: proyectoId }
  );

  if (error) return console.error(error);

  const el = document.getElementById("badgeTotalProyecto");
  if (el) el.textContent = "VALOR TOTAL PROYECTO -  " + money(data);
}

function pct(n) { return `${Number(n || 0).toFixed(2)}%`; }

async function pintarAvanceActividades(objetivoId) {
  const { data, error } = await supabaseClient.rpc("get_avance_actividades_por_objetivo", { p_objetivo_id: objetivoId });
  if (error) return console.error(error);
  (data || []).forEach(r => {
    const el = document.getElementById(`badgeActAv${r.actividad_id}`);
    if (el) el.textContent = "Avance actividad:  " + pct(r.avance);
  });
}

async function pintarAvanceObjetivos(proyectoId) {
  const { data, error } = await supabaseClient.rpc("get_avance_objetivos_por_proyecto", { p_proyecto_id: proyectoId });
  if (error) return console.error(error);
  (data || []).forEach(r => {
    const el = document.getElementById(`badgeObjAv${r.objetivo_id}`);
    if (el) el.textContent ="Avance objetivo:  " + pct(r.avance);
  });
}

async function pintarAvanceProyecto(proyectoId) {
  const { data, error } = await supabaseClient.rpc("get_avance_proyecto", { p_proyecto_id: proyectoId });
  if (error) return console.error(error);
  const el = document.getElementById("lblAvanceProyecto");
  if (el) el.textContent = "AVANCE DEL PROYECTO  - " +  pct(data);
}


init();
