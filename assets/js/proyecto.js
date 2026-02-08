// assets/js/proyecto.js

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
   PROYECTO / DEP / MUN
========================= */
async function loadDepartamentos() {
  const sel = document.getElementById("inpDepartamento");
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

async function loadMunicipiosByDepartamento(dep, selected = null) {
  const sel = document.getElementById("inpMunicipio");
  if (!sel) return;

  sel.innerHTML = `<option value="">Seleccione…</option>`;
  sel.disabled = true;

  if (!dep) return;

  const { data, error } = await supabaseClient
    .from("municipios")
    .select("lugar")
    .eq("departamento", dep)
    .order("lugar", { ascending: true });

  if (error) throw error;

  sel.insertAdjacentHTML(
    "beforeend",
    (data || [])
      .map((m) => {
        const v = m.lugar;
        const isSel = selected && String(selected) === String(v);
        return `<option value="${escapeHtml(v)}" ${isSel ? "selected" : ""}>${escapeHtml(v)}</option>`;
      })
      .join("")
  );

  sel.disabled = false;
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
}

async function guardarCambios() {
  try {
    hideMsg();

    const nombre = document.getElementById("inpNombre")?.value?.trim();
    if (!nombre) return setMsg("El nombre del proyecto es obligatorio.", "warning");

    const tipo = document.getElementById("inpTipoPoblacion")?.value || "";
    const nomPob = document.getElementById("inpNombrePoblacion")?.value?.trim() || "";
    if ((tipo && !nomPob) || (!tipo && nomPob)) {
      return setMsg("Completa ambos: Tipo de población y Nombre población/pueblo.", "warning");
    }

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

      tipo_poblacion: tipo || null,
      nombre_poblacion: nomPob || null,

      actividad_id: actividadActivaId,
      tipo,
      estado,
      orden,
      descripcion,
      indicador,
      medios_verificacion
    };

    const { error } = await supabaseClient
      .from("proyecto")
      .update(payload)
      .eq("id", proyectoId);

    if (error) throw error;

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

  // Si el objetivo seleccionado ya no existe, limpiar selección
  if (objetivoActivoId && !cacheObjetivos.find(o => o.id === objetivoActivoId)) {
    objetivoActivoId = null;
    actividadActivaId = null;
  }

  renderObjetivosList();
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
  const obj = cacheObjetivos.find(x => x.id === id);
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

    // reset selecciones si aplica
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

  box.innerHTML = cacheObjetivos.map(o => {
    const active = (o.id === objetivoActivoId) ? "active" : "";
    const label = `${o.codigo ? o.codigo + " — " : ""}${o.nombre || ""}`;
    return `
      <div class="list-group-item d-flex justify-content-between align-items-start ${active}" data-obj="${o.id}">
        <div class="me-2">
          <div class="fw-semibold">${escapeHtml(label)}</div>
          <div class="text-muted small">Orden: ${o.orden ?? ""}</div>
        </div>
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-outline-primary" data-obj-edit="${o.id}" type="button">
          <i class="bi bi-pencil-fill"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" data-obj-del="${o.id}" type="button"><i class="bi bi-trash3-fill"></i></button>
        </div>
      </div>
    `;
  }).join("");

  // seleccionar objetivo
  box.querySelectorAll("[data-obj]").forEach(item => {
    item.addEventListener("click", async (e) => {
      if (e.target.closest("button")) return;

      objetivoActivoId = item.dataset.obj;
      actividadActivaId = null;
      cacheProductos = [];
      renderProductosList();

      syncActionButtons();

      await loadActividades(objetivoActivoId);
      renderActividadesList();
    });
  });

  // editar/borrar objetivo
  box.querySelectorAll("[data-obj-edit]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openModalObjetivoEdit(btn.dataset.objEdit);
    });
  });
  box.querySelectorAll("[data-obj-del]").forEach(btn => {
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

  if (actividadActivaId && !cacheActividades.find(a => a.id === actividadActivaId)) {
    actividadActivaId = null;
    cacheProductos = [];
    renderProductosList();
  }

  renderActividadesList();
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
  const act = cacheActividades.find(x => x.id === id);
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

  box.innerHTML = cacheActividades.map(a => {
    const active = (a.id === actividadActivaId) ? "active" : "";
    const label = `${a.codigo ? a.codigo + " — " : ""}${a.nombre || ""}`;
    return `
      <div class="list-group-item d-flex justify-content-between align-items-start ${active}" data-act="${a.id}">
        <div class="me-2">
          <div class="fw-semibold">${escapeHtml(label)}</div>
          <div class="text-muted small">Estado: ${escapeHtml(a.estado ?? "Pendiente")} · Orden: ${a.orden ?? ""}</div>
        </div>
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-outline-primary" data-act-edit="${a.id}" type="button">
          <i class="bi bi-pencil-fill"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" data-act-del="${a.id}" type="button"><i class="bi bi-trash3-fill"></i></button>
        </div>
      </div>
    `;
  }).join("");

  // seleccionar actividad
  box.querySelectorAll("[data-act]").forEach(item => {
    item.addEventListener("click", async (e) => {
      if (e.target.closest("button")) return;

      actividadActivaId = item.dataset.act;
      syncActionButtons();

      await loadProductos(actividadActivaId);
      renderProductosList();
    });
  });

  // editar/borrar actividad
  box.querySelectorAll("[data-act-edit]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openModalActividadEdit(btn.dataset.actEdit);
    });
  });
  box.querySelectorAll("[data-act-del]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteActividad(btn.dataset.actDel);
    });
  });

  syncActionButtons();
}

/* =========================
   PRODUCTOS (CRUD + LISTA)
   (tabla: producto con descripcion/tipo/estado/orden)
========================= */
async function loadProductos(actividadId) {
  if (!actividadId) {
    cacheProductos = [];
    renderProductosList();
    return;
  }

  const { data, error } = await supabaseClient
    .from("producto")
    .select("id, actividad_id, descripcion, tipo, estado, orden, indicador, medios_verificacion, created_at")
    .eq("actividad_id", actividadId)
    .order("orden", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("PROD LOAD ERROR:", error);
    setMsgOAP("❌ " + error.message, "danger");
    cacheProductos = [];
    renderProductosList();
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
  new bootstrap.Modal(document.getElementById("modalProducto")).show();

  document.getElementById("prodIndicador").value = "";
  mvDraft = [];
  renderMVRows();

}

function openModalProductoEdit(id) {
  const p = cacheProductos.find(x => x.id === id);
  if (!p) return;

  hideMsgModal("msgProdModal");
  document.getElementById("lblModalProducto").textContent = "Editar producto";
  document.getElementById("prodId").value = p.id;
  document.getElementById("prodTipo").value = p.tipo ?? "";
  document.getElementById("prodEstado").value = p.estado ?? "Pendiente";
  document.getElementById("prodOrden").value = p.orden ?? 1;
  document.getElementById("prodDescripcion").value = p.descripcion ?? "";
  new bootstrap.Modal(document.getElementById("modalProducto")).show();

  document.getElementById("prodIndicador").value = p.indicador ?? "";
  mvDraft = Array.isArray(p.medios_verificacion) ? p.medios_verificacion : [];
  renderMVRows();

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

    if (!descripcion) return setMsgModal("msgProdModal", "La descripción del producto es obligatoria.", "warning");

    const payload = { actividad_id: actividadActivaId, tipo, estado, orden, descripcion };

    const { error } = id
      ? await supabaseClient.from("producto").update(payload).eq("id", id)
      : await supabaseClient.from("producto").insert([payload]);

    if (error) throw error;

    bootstrap.Modal.getInstance(document.getElementById("modalProducto")).hide();
    await loadProductos(actividadActivaId);
  } catch (e) {
    console.error("PROD SAVE ERROR:", e);
    setMsgModal("msgProdModal", "❌ " + (e.message || e), "danger");
  }

  const indicador = document.getElementById("prodIndicador").value.trim() || null;

  const medios_verificacion = (mvDraft || [])
    .filter(x => (x.url && x.url.trim()) || (x.label && x.label.trim()))
    .map(x => ({
      label: (x.label || "").trim(),
      url: (x.url || "").trim(),
      tipo: (x.tipo || "otro").trim(),
      date: (x.date || "").trim()
    }));

}

async function deleteProducto(id) {
  const ok = confirm("¿Seguro que deseas borrar este producto?");
  if (!ok) return;

  try {
    const { error } = await supabaseClient.from("producto").delete().eq("id", id);
    if (error) throw error;
    await loadProductos(actividadActivaId);
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

  box.innerHTML = cacheProductos.map(p => {
    const label = p.descripcion || "";
    const meta = `Tipo: ${p.tipo ?? "—"} · Estado: ${p.estado ?? "Pendiente"} · Orden: ${p.orden ?? ""}`;
    return `
      <div class="list-group-item d-flex justify-content-between align-items-start">
        <div class="me-2">
          <div class="fw-semibold">${escapeHtml(label)}</div>
          <div class="text-muted small">${escapeHtml(meta)}</div>
        </div>
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-outline-primary" data-prod-edit="${p.id}" type="button">
          <i class="bi bi-pencil-fill"></i>
          </button>
          
          <button class="btn btn-sm btn-outline-danger" data-prod-del="${p.id}" type="button"><i class="bi bi-trash3-fill"></i></button>
        </div>
      </div>
    `;
  }).join("");

  box.querySelectorAll("[data-prod-edit]").forEach(btn => {
    btn.addEventListener("click", () => openModalProductoEdit(btn.dataset.prodEdit));
  });

  box.querySelectorAll("[data-prod-del]").forEach(btn => {
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

  syncActionButtons();

  // Carga inicial
  try {
    await loadProyecto();
  } catch (e) {
    console.error("LOAD PROYECTO ERROR:", e);
    setMsg("❌ No pude cargar el proyecto: " + (e.message || e), "danger");
  }

  await loadObjetivos();
  renderActividadesList();
  renderProductosList();

  let mvDraft = []; // soportes del modal

  function renderMVRows() {
    const tb = document.getElementById("mvRows");
    if (!tb) return;

    if (!mvDraft.length) {
      tb.innerHTML = `<tr><td colspan="5" class="text-muted">Sin soportes aún.</td></tr>`;
      return;
    }

    tb.innerHTML = mvDraft.map((m, i) => `
    <tr>
      <td><input class="form-control form-control-sm" data-mv="label" data-i="${i}" value="${escapeHtml(m.label ?? "")}"></td>
      <td><input class="form-control form-control-sm" data-mv="url" data-i="${i}" value="${escapeHtml(m.url ?? "")}" placeholder="https://..."></td>
      <td>
        <select class="form-select form-select-sm" data-mv="tipo" data-i="${i}">
          ${["acta", "asistencia", "informe", "foto", "audio", "video", "otro"].map(t =>
      `<option value="${t}" ${m.tipo === t ? "selected" : ""}>${t}</option>`
    ).join("")}
        </select>
      </td>
      <td><input type="date" class="form-control form-control-sm" data-mv="date" data-i="${i}" value="${escapeHtml(m.date ?? "")}"></td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-danger" type="button" data-mv-del="${i}">X</button>
      </td>
    </tr>
  `).join("");

    tb.querySelectorAll("[data-mv]").forEach(el => {
      const handler = () => {
        const i = parseInt(el.dataset.i, 10);
        const k = el.dataset.mv;
        mvDraft[i][k] = el.value;
      };
      el.addEventListener("input", handler);
      el.addEventListener("change", handler);
    });

    tb.querySelectorAll("[data-mv-del]").forEach(btn => {
      btn.addEventListener("click", () => {
        const i = parseInt(btn.dataset.mvDel, 10);
        mvDraft.splice(i, 1);
        renderMVRows();
      });
    });
  }
  document.getElementById("btnAddMV")?.addEventListener("click", () => {
    mvDraft.push({ label: "", url: "", tipo: "otro", date: "" });
    renderMVRows();
  });



}

init();
