// assets/js/proyectos.js


init_text() 
async function init_text() {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
        window.location.href = "index.html";
        return;
    }
}

let current = {
    area_id: null,
    area: null,
    grupo_id: null,
    grupo: null,
};

function setMsg(id, text, type = "info") {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = `alert alert-${type}`;
    el.textContent = text;
    el.style.display = "block";
}

function hideMsg(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = "none";
}

function moneyCOP(n) {
    const val = Number(n || 0);
    return val.toLocaleString("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0,
    });
}

// Para inputs tipo COP (pegar "$ 1.200.000" y normalizar)
function parseCOP(input) {
    const raw = String(input ?? "").trim();
    if (!raw) return 0;
    // dejar solo dígitos y signo menos
    const digits = raw.replace(/[^0-9-]/g, "");
    return Number(digits || 0);
}

function formatCOPString(n) {
    const val = Number(n || 0);
    return val ? val.toLocaleString("es-CO") : "0";
}

function semaforoBadge(semaforo) {
    const s = (semaforo || "").toLowerCase();
    const map = {
        verde: "success",
        lima: "success-subtle",
        amarillo: "warning-subtle",
        naranja: "warning",
        rojo: "danger",
        gris: "secondary",




    };
    const cls = map[s] || "secondary";
    return `<span class="badge bg-${cls} badge-semaforo">${s || "—"}</span>`;
}

// helper para evitar romper HTML con caracteres especiales
function escapeHtml(str) {
    return String(str ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function todayISODate() {
    // YYYY-MM-DD en hora local
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

async function loadDepartamentos() {
    const sel = document.getElementById("inpDepartamento");
    if (!sel) return;

    sel.innerHTML = `<option value="">Cargando…</option>`;

    const { data, error } = await supabaseClient
        .from("departamentos")
        .select("departamento, macroregion")
        .order("departamento", { ascending: true });

    if (error) throw error;

    console.log(data)

    sel.innerHTML = `<option value="">Seleccione…</option>`;
    const opts = (data || []).map((d) => {
        const label = d.macroregion
            ? `${d.departamento} — ${d.macroregion}`
            : d.departamento;
        return `<option value="${escapeHtml(d.departamento)}">${escapeHtml(
            label
        )}</option>`;
    });

    sel.insertAdjacentHTML("beforeend", opts.join(""));
}

async function loadMunicipiosByDepartamento(dep) {
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

    const opts = (data || []).map(
        (m) =>
            `<option value="${escapeHtml(m.lugar)}">${escapeHtml(m.lugar)}</option>`
    );

    sel.insertAdjacentHTML("beforeend", opts.join(""));
    sel.disabled = false;
}

async function loadAreasGrupos() {
    const { data, error } = await supabaseClient
        .from("v_area_grupo")
        .select("area_id, area, grupo_id, grupo");

    if (error) throw error;

    const map = new Map();
    for (const row of data) {
        if (!map.has(row.area_id)) map.set(row.area_id, { area: row.area, grupos: [] });
        if (row.grupo_id)
            map.get(row.area_id).grupos.push({ grupo_id: row.grupo_id, grupo: row.grupo });
    }

    // IMPORTANTE:
    // Este menú se pinta en desktop y móvil. Si usamos los mismos IDs en ambos,
    // Bootstrap Collapse se vuelve impredecible (IDs duplicados). Por eso usamos prefijos.
    function buildNavHTML(prefix) {
        const accordionId = `accAreas-${prefix}`;

        const areasHTML = [...map.entries()]
            .map(([area_id, info], idx) => {
                const headingId = `hdr-${prefix}-${area_id}`;
                const collapseId = `acc-${prefix}-${area_id}`;

                const gruposHTML = info.grupos.length
                    ? info.grupos
                        .map(
                            (g) => `
<div class="list-group-item list-group-item-action" style="cursor:pointer"
     data-area-id="${area_id}" data-area="${escapeHtml(info.area)}"
     data-grupo-id="${g.grupo_id}" data-grupo="${escapeHtml(g.grupo)}">
  ${escapeHtml(g.grupo)}
</div>`
                        )
                        .join("")
                    : `<div class="text-muted small px-2 py-2">Sin grupos</div>`;

                return `
<div class="accordion-item">
  <h2 class="accordion-header" id="${headingId}">
    <button class="accordion-button ${idx === 0 ? "" : "collapsed"}" type="button"
            data-bs-toggle="collapse" data-bs-target="#${collapseId}"
            aria-expanded="${idx === 0 ? "true" : "false"}" aria-controls="${collapseId}">
      ${escapeHtml(info.area)}
    </button>
  </h2>
  <div id="${collapseId}" class="accordion-collapse collapse ${idx === 0 ? "show" : ""}"
       aria-labelledby="${headingId}" data-bs-parent="#${accordionId}">
    <div class="list-group list-group-flush">${gruposHTML}</div>
  </div>
</div>`;
            })
            .join("");

        // Bloque único de APLICACIONES (una sola vez, no por cada área)
        const appsHeadingId = `hdr-${prefix}-apps`;
        const appsCollapseId = `collapse-${prefix}-apps`;

        const appsHTML = `
<div class="accordion-item">
  <h2 class="accordion-header" id="${appsHeadingId}">
    <button class="accordion-button collapsed" type="button"
            data-bs-toggle="collapse" data-bs-target="#${appsCollapseId}"
            aria-expanded="false" aria-controls="${appsCollapseId}">
      APLICACIONES
    </button>
  </h2>
  <div id="${appsCollapseId}" class="accordion-collapse collapse"
       aria-labelledby="${appsHeadingId}" data-bs-parent="#${accordionId}">
    <div class="list-group list-group-flush">
      <a class="list-group-item list-group-item-action" href="./GIS/mapas.html">
        <i class="bi bi-globe-americas me-3"></i>Mapas
      </a>
      <a class="list-group-item list-group-item-action" href="./gestion-dashboard.html">
        <i class="bi bi-graph-up-arrow me-3"></i>Gestión
      </a>
    </div>
  </div>
</div>`;

        return `<div class="accordion" id="${accordionId}">${areasHTML}${appsHTML}</div>`;
    }

    document.getElementById("navAreasDesktop").innerHTML = buildNavHTML("d");
    document.getElementById("navAreasMobile").innerHTML = buildNavHTML("m");

    document.querySelectorAll("[data-grupo-id]").forEach((el) => {
        el.addEventListener("click", async () => {
            current.area_id = el.dataset.areaId;
            current.area = el.dataset.area;
            current.grupo_id = el.dataset.grupoId;
            current.grupo = el.dataset.grupo;

            document.getElementById("lblGrupo").textContent = current.grupo;
            document.getElementById("lblArea").textContent = current.area;
            document.getElementById("btnNuevoProyecto").disabled = false;
            const btnNuevoContrato = document.getElementById("btnNuevoContrato");
            if (btnNuevoContrato) btnNuevoContrato.disabled = false;

            await loadProyectosByGrupo(current.grupo_id);
            await loadContratosByGrupo(current.grupo_id);

            const off = bootstrap.Offcanvas.getInstance(document.getElementById("offcanvasNav"));
            if (off) off.hide();
        });
    });
}

async function loadProyectosByGrupo(grupo_id) {
    hideMsg("msg");
    const tbody = document.getElementById("tblProyectos");
    tbody.innerHTML = `<tr><td colspan="5" class="text-muted p-3">Cargando...</td></tr>`;

    const { data, error } = await supabaseClient
        .from("v_proyecto_avance_costo")
        .select("proyecto_id, nombre, porcentaje, semaforo, costo_total, grupo_id")
        .eq("grupo_id", grupo_id)
        .order("nombre", { ascending: true });

    if (error) {
        console.error("LIST ERROR:", error);
        setMsg("msg", `❌ ${error.message}`, "danger");
        tbody.innerHTML = `<tr><td colspan="5" class="text-muted p-3">Error cargando proyectos.</td></tr>`;
        return;
    }

    document.getElementById("lblConteo").textContent = `${data.length}`;

    if (!data.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-muted p-3">No hay proyectos en este grupo.</td></tr>`;
        return;
    }

    tbody.innerHTML = data
        .map(
            (p) => `
<tr style="cursor:pointer" data-id="${p.proyecto_id}">
  <td>${escapeHtml(p.nombre ?? "—")}</td>
  <td class="text-end">${Number(p.porcentaje || 0).toFixed(2)}%</td>
  <td>${semaforoBadge(p.semaforo)}</td>
  <td class="text-end">${moneyCOP(p.costo_total)}</td>
  <td class="text-center">
    <div class="btn-group btn-group-sm" role="group">
      <button class="btn btn-outline-primary btn-open" data-id="${p.proyecto_id}" title="Abrir">
        <i class="bi bi-box-arrow-up-right"></i>
      </button>
      <button class="btn btn-outline-secondary btn-print" data-id="${p.proyecto_id}" title="Informe / Imprimir">
        <i class="bi bi-printer"></i>
      </button>
    </div>
  </td>
</tr>
`
        )
        .join("");


    tbody.querySelectorAll("tr[data-id]").forEach((tr) => {
        tr.addEventListener("click", () => {
            window.location.href = `proyecto.html?id=${tr.dataset.id}`;
        });
    });
    // botones: evitar que dispare el click de la fila
    tbody.querySelectorAll(".btn-open").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            window.location.href = `proyecto.html?id=${btn.dataset.id}`;
        });
    });

    tbody.querySelectorAll(".btn-print").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            // Página nueva de informe imprimible (la creamos después)
            window.location.href = `proyecto_print.html?id=${btn.dataset.id}`;
            // Alternativa rápida si prefieres imprimir la misma vista:
            // window.open(`proyecto.html?id=${btn.dataset.id}&print=1`, "_blank");
        });
    });
}


// =======================
// CONTRATOS (PP-4 - Paso 3)
// =======================

function fmtDate(d) {
    return d ? String(d) : "—";
}

async function loadContratosByGrupo(grupo_id) {
    hideMsg("msg");
    const tbody = document.getElementById("tblContratos");
    const lbl = document.getElementById("lblConteoContratos");
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="7" class="text-muted p-3">Cargando...</td></tr>`;

    const { data, error } = await supabaseClient
        .from("contrato")
        .select("id, numero, objeto, fecha_firma, fecha_inicio, fecha_fin, valor, grupo_id")
        .eq("grupo_id", grupo_id)
        .order("fecha_inicio", { ascending: false });

    if (error) {
        console.error("CONTRATOS LIST ERROR:", error);
        setMsg("msg", `❌ ${error.message}`, "danger");
        tbody.innerHTML = `<tr><td colspan="7" class="text-muted p-3">Error cargando contratos.</td></tr>`;
        if (lbl) lbl.textContent = "0";
        return;
    }

    if (lbl) lbl.textContent = String((data || []).length);

    if (!data || !data.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-muted p-3">No hay contratos en este grupo.</td></tr>`;
        return;
    }

    tbody.innerHTML = data
        .map(
            (c) => `
<tr data-id="${c.id}">
  <td>${escapeHtml(c.numero ?? "—")}</td>
  <td class="truncate" title="${escapeHtml(c.objeto ?? "")}">${escapeHtml(c.objeto ?? "—")}</td>
  <td>${fmtDate(c.fecha_firma)}</td>
  <td>${fmtDate(c.fecha_inicio)}</td>
  <td>${fmtDate(c.fecha_fin)}</td>
  <td class="text-end">${moneyCOP(c.valor)}</td>
  <td class="text-center">
    <div class="btn-group btn-group-sm" role="group">
      <button class="btn btn-outline-primary btn-open-contrato" data-id="${c.id}" title="Gestionar">
        <i class="bi bi-folder2-open"></i>
      </button>
      <button class="btn btn-outline-danger btn-del-contrato" data-id="${c.id}" title="Eliminar">
        <i class="bi bi-trash"></i>
      </button>
    </div>
  </td>
</tr>
`
        )
        .join("");

    // eliminar
    tbody.querySelectorAll(".btn-del-contrato").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            await deleteContrato(btn.dataset.id);
        });
    });

    // abrir / gestionar
    tbody.querySelectorAll(".btn-open-contrato").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            openContratoManage(btn.dataset.id);
        });
    });

    // click en la fila abre el gestor
    tbody.querySelectorAll("tr[data-id]").forEach((tr) => {
        tr.addEventListener("click", () => openContratoManage(tr.dataset.id));
    });
}

async function openModalNuevoContrato() {
    hideMsg("msgModalContrato");

    if (!current.grupo_id) {
        return setMsg("msg", "Selecciona un grupo antes de crear un contrato.", "warning");
    }

    document.getElementById("inpContratoNumero").value = "";
    document.getElementById("inpContratoObjeto").value = "";
    document.getElementById("inpContratoFirma").value = todayISODate();
    document.getElementById("inpContratoInicio").value = "";
    document.getElementById("inpContratoFin").value = "";
    document.getElementById("inpContratoValor").value = "0";

    new bootstrap.Modal(document.getElementById("modalContrato")).show();
}

async function guardarContrato() {
    try {
        hideMsg("msgModalContrato");

        if (!current.grupo_id) {
            return setMsg("msgModalContrato", "Selecciona un grupo antes de crear el contrato.", "warning");
        }

        const numero = document.getElementById("inpContratoNumero").value.trim();
        const objeto = document.getElementById("inpContratoObjeto").value.trim();

        if (!numero) return setMsg("msgModalContrato", "El número de contrato es obligatorio.", "warning");
        if (!objeto) return setMsg("msgModalContrato", "El objeto del contrato es obligatorio.", "warning");

        const payload = {
            grupo_id: current.grupo_id,
            numero,
            objeto,
            fecha_firma: document.getElementById("inpContratoFirma").value || null,
            fecha_inicio: document.getElementById("inpContratoInicio").value || null,
            fecha_fin: document.getElementById("inpContratoFin").value || null,
            valor: parseCOP(document.getElementById("inpContratoValor").value),
            // documentos queda por default []
        };

        const { error } = await supabaseClient
            .from("contrato")
            .insert([payload]);

        if (error) {
            console.error("CONTRATO INSERT ERROR:", error);
            const details = error.details ? ` | ${error.details}` : "";
            const hint = error.hint ? ` | ${error.hint}` : "";
            throw new Error(`${error.message}${details}${hint}`);
        }

        bootstrap.Modal.getInstance(document.getElementById("modalContrato")).hide();
        await loadContratosByGrupo(current.grupo_id);
    } catch (e) {
        setMsg("msgModalContrato", "❌ " + (e.message || e), "danger");
    }
}

async function deleteContrato(contratoId) {
    try {
        if (!contratoId) return;

        const ok = confirm("¿Eliminar este contrato? Esta acción no se puede deshacer.");
        if (!ok) return;

        const { error } = await supabaseClient
            .from("contrato")
            .delete()
            .eq("id", contratoId);

        if (error) throw error;

        await loadContratosByGrupo(current.grupo_id);
    } catch (e) {
        console.error("CONTRATO DELETE ERROR:", e);
        setMsg("msg", "❌ " + (e.message || e), "danger");
    }
}

async function openModalNuevoProyecto() {
    hideMsg("msgModal");

    document.getElementById("inpVigencia").value = new Date().getFullYear();
    document.getElementById("inpArea").value = current.area || "";
    document.getElementById("inpGrupo").value = current.grupo || "";

    document.getElementById("inpNombre").value = "";
    document.getElementById("inpManager").value = "";
    document.getElementById("inpObjetivo").value = "";
    document.getElementById("inpNodo").value = "";
    document.getElementById("inpLinea").value = "";
    document.getElementById("inpEstrategia").value = "";

    document.getElementById("inpTipoPoblacion").value = "";
    document.getElementById("inpNombrePoblacion").value = "";


    // ubicación
    const selDep = document.getElementById("inpDepartamento");
    const selMun = document.getElementById("inpMunicipio");
    const inpLugar = document.getElementById("inpLugar");

    if (selDep) selDep.innerHTML = `<option value="">Seleccione…</option>`;
    if (selMun) {
        selMun.innerHTML = `<option value="">Seleccione…</option>`;
        selMun.disabled = true;
    }
    if (inpLugar) inpLugar.value = "";

    // cargar catálogo (dep)
    try {
        await loadDepartamentos();
    } catch (e) {
        console.error("DEP ERROR:", e);
        setMsg("msgModal", "❌ No pude cargar departamentos: " + (e.message || e), "danger");
    }

    new bootstrap.Modal(document.getElementById("modalProyecto")).show();
}



// =======================
// CONTRATO - GESTIÓN (Documentos + Proyectos)  (PP-4 - Paso 4)
// =======================

let contratoManage = {
    id: null,
    data: null,
    documentos: [],
    proyectosDisponibles: [],
    proyectosVinculados: [], // {id, proyecto_id, nombre}
    pagos: [],
    pagosResumen: [],
    asignaciones: [],
    productosProyecto: [],
};

function uuid4() {
    // crypto.randomUUID es lo ideal, pero por compatibilidad dejamos fallback
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

function docTypeLabel(t) {
    const map = {
        clausulado: "Clausulado",
        estudio_previo: "Estudio previo",
        propuesta_tecnica: "Propuesta técnica",
        propuesta_financiera: "Propuesta financiera",
    };
    return map[t] || (t || "—");
}

async function openContratoManage(contratoId) {
    contratoManage.id = contratoId;
    hideMsg("msgModalContratoManage");

    // abrir modal de una vez y luego cargar data
    const modalEl = document.getElementById("modalContratoManage");
    if (!modalEl) {
        return setMsg("msg", "❌ No encuentro el modal de gestión de contrato en el HTML.", "danger");
    }
    new bootstrap.Modal(modalEl).show();

    try {
        await loadContratoManage(contratoId);
    } catch (e) {
        console.error("OPEN CONTRATO MANAGE ERROR:", e);
        setMsg("msgModalContratoManage", "❌ " + (e.message || e), "danger");
    }
}

async function loadContratoManage(contratoId) {
    hideMsg("msgModalContratoManage");

    const { data, error } = await supabaseClient
        .from("contrato")
        .select("id, grupo_id, numero, objeto, fecha_firma, fecha_inicio, fecha_fin, valor, documentos")
        .eq("id", contratoId)
        .single();

    if (error) throw error;

    contratoManage.data = data;
    contratoManage.documentos = Array.isArray(data.documentos) ? data.documentos : [];

    // título
    document.getElementById("mcTituloNumero").textContent = data.numero ? `#${data.numero}` : "—";
    document.getElementById("mcTituloObjeto").textContent = data.objeto || "—";

    // inputs Datos
    document.getElementById("mcNumero").value = data.numero || "";
    document.getElementById("mcObjeto").value = data.objeto || "";
    document.getElementById("mcFirma").value = data.fecha_firma || "";
    document.getElementById("mcInicio").value = data.fecha_inicio || "";
    document.getElementById("mcFin").value = data.fecha_fin || "";
    document.getElementById("mcValor").value = formatCOPString(data.valor || 0);

    renderContratoDocs();
    await loadContratoProyectos();
    await loadPagosAndResumen();
    await refreshPagoUI();
}

function renderContratoDocs() {
    const tbody = document.getElementById("tblContratoDocs");
    if (!tbody) return;

    const docs = contratoManage.documentos || [];

    if (!docs.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-muted p-3">Sin documentos.</td></tr>`;
        return;
    }

    tbody.innerHTML = docs.map((d) => {
        const url = d?.url ? String(d.url) : "";
        const safeUrl = escapeHtml(url);
        const link = url ? `<a href="${safeUrl}" target="_blank" rel="noopener">${safeUrl}</a>` : "—";

        return `
<tr>
  <td>${escapeHtml(docTypeLabel(d?.tipo_documento))}</td>
  <td>${escapeHtml(d?.nombre || "—")}</td>
  <td class="truncate" title="${safeUrl}">${link}</td>
  <td class="text-center">
    <button class="btn btn-sm btn-outline-danger btn-del-doc" data-id="${escapeHtml(d?.id || "")}" title="Quitar">
      <i class="bi bi-trash"></i>
    </button>
  </td>
</tr>`;
    }).join("");

    tbody.querySelectorAll(".btn-del-doc").forEach((btn) => {
        btn.addEventListener("click", async () => {
            await removeContratoDoc(btn.dataset.id);
        });
    });
}

async function persistContratoDocs() {
    const { error } = await supabaseClient
        .from("contrato")
        .update({ documentos: contratoManage.documentos })
        .eq("id", contratoManage.id);

    if (error) throw error;
}

async function addContratoDoc() {
    try {
        hideMsg("msgModalContratoManage");

        if (!contratoManage.id) throw new Error("Contrato no seleccionado.");

        const tipo = document.getElementById("mcDocTipo").value;
        const nombre = document.getElementById("mcDocNombre").value.trim();
        const url = document.getElementById("mcDocUrl").value.trim();

        if (!tipo) return setMsg("msgModalContratoManage", "Selecciona el tipo de documento.", "warning");
        if (!nombre) return setMsg("msgModalContratoManage", "El nombre del documento es obligatorio.", "warning");
        if (!url) return setMsg("msgModalContratoManage", "La URL del documento es obligatoria.", "warning");

        contratoManage.documentos.push({
            id: uuid4(),
            tipo_documento: tipo,
            nombre,
            url,
        });

        await persistContratoDocs();
        renderContratoDocs();

        // limpiar inputs
        document.getElementById("mcDocTipo").value = "";
        document.getElementById("mcDocNombre").value = "";
        document.getElementById("mcDocUrl").value = "";
    } catch (e) {
        console.error("ADD DOC ERROR:", e);
        setMsg("msgModalContratoManage", "❌ " + (e.message || e), "danger");
    }
}

async function removeContratoDoc(docId) {
    try {
        hideMsg("msgModalContratoManage");
        if (!docId) return;

        contratoManage.documentos = (contratoManage.documentos || []).filter((d) => d?.id !== docId);
        await persistContratoDocs();
        renderContratoDocs();
    } catch (e) {
        console.error("DEL DOC ERROR:", e);
        setMsg("msgModalContratoManage", "❌ " + (e.message || e), "danger");
    }
}

async function guardarContratoCambios() {
    try {
        hideMsg("msgModalContratoManage");
        if (!contratoManage.id) throw new Error("Contrato no seleccionado.");

        const numero = document.getElementById("mcNumero").value.trim();
        const objeto = document.getElementById("mcObjeto").value.trim();

        if (!numero) return setMsg("msgModalContratoManage", "El número es obligatorio.", "warning");
        if (!objeto) return setMsg("msgModalContratoManage", "El objeto es obligatorio.", "warning");

        const payload = {
            numero,
            objeto,
            fecha_firma: document.getElementById("mcFirma").value || null,
            fecha_inicio: document.getElementById("mcInicio").value || null,
            fecha_fin: document.getElementById("mcFin").value || null,
            valor: parseCOP(document.getElementById("mcValor").value),
        };

        const { error } = await supabaseClient
            .from("contrato")
            .update(payload)
            .eq("id", contratoManage.id);

        if (error) throw error;

        // actualizar título
        document.getElementById("mcTituloNumero").textContent = `#${numero}`;
        document.getElementById("mcTituloObjeto").textContent = objeto;

        // refrescar lista principal
        if (current.grupo_id) await loadContratosByGrupo(current.grupo_id);

        setMsg("msgModalContratoManage", "✅ Cambios guardados.", "success");
        setTimeout(() => hideMsg("msgModalContratoManage"), 1200);
    } catch (e) {
        console.error("SAVE CONTRATO ERROR:", e);
        setMsg("msgModalContratoManage", "❌ " + (e.message || e), "danger");
    }
}

// -----------------------
// VINCULAR PROYECTOS
// Requiere tabla: contrato_proyecto (contrato_id, proyecto_id)
// -----------------------

async function loadContratoProyectos() {
    const sel = document.getElementById("mcSelProyecto");
    const tbody = document.getElementById("tblContratoProyectos");
    if (!sel || !tbody) return;

    sel.innerHTML = `<option value="">Cargando…</option>`;
    tbody.innerHTML = `<tr><td colspan="2" class="text-muted p-3">Cargando…</td></tr>`;

    // proyectos del grupo del contrato
    const grupoId = contratoManage?.data?.grupo_id || current.grupo_id;
    if (!grupoId) {
        sel.innerHTML = `<option value="">Seleccione…</option>`;
        tbody.innerHTML = `<tr><td colspan="2" class="text-muted p-3">Seleccione un grupo/contrato.</td></tr>`;
        return;
    }

    const { data: proyectos, error: pErr } = await supabaseClient
        .from("proyecto")
        .select("id, nombre, grupo_id")
        .eq("grupo_id", grupoId)
        .order("nombre", { ascending: true });

    if (pErr) throw pErr;

    contratoManage.proyectosDisponibles = proyectos || [];

    // vínculos
    const { data: links, error: lErr } = await supabaseClient
        .from("contrato_proyecto")
        .select("id, proyecto_id")
        .eq("contrato_id", contratoManage.id);

    if (lErr) throw lErr;

    const linkedIds = new Set((links || []).map((x) => x.proyecto_id));

    // render select (solo los no vinculados)
    const available = (proyectos || []).filter((p) => !linkedIds.has(p.id));
    sel.innerHTML = `<option value="">Seleccione…</option>` + available.map((p) =>
        `<option value="${escapeHtml(p.id)}">${escapeHtml(p.nombre || "—")}</option>`
    ).join("");

    // render tabla vinculados
    if (!links || !links.length) {
        tbody.innerHTML = `<tr><td colspan="2" class="text-muted p-3">Sin proyectos vinculados.</td></tr>`;
        return;
    }

    // map id->nombre
    const nameById = new Map((proyectos || []).map((p) => [p.id, p.nombre || "—"]));


    // guardar lista vinculada para el módulo de pagos
    contratoManage.proyectosVinculados = (links || []).map((lnk) => ({
        link_id: lnk.id,
        proyecto_id: lnk.proyecto_id,
        nombre: nameById.get(lnk.proyecto_id) || "—",
    }));
    renderPagoProyectoSelect();

    tbody.innerHTML = (links || []).map((lnk) => `
<tr>
  <td>${escapeHtml(nameById.get(lnk.proyecto_id) || "—")}</td>
  <td class="text-center">
    <button class="btn btn-sm btn-outline-danger btn-unlink-proy" data-id="${escapeHtml(lnk.id)}" title="Quitar">
      <i class="bi bi-trash"></i>
    </button>
  </td>
</tr>
`).join("");

    tbody.querySelectorAll(".btn-unlink-proy").forEach((btn) => {
        btn.addEventListener("click", async () => {
            await desvincularProyectoContrato(btn.dataset.id);
        });
    });
}

async function vincularProyectoContrato() {
    try {
        hideMsg("msgModalContratoManage");
        const proyectoId = document.getElementById("mcSelProyecto").value;
        if (!proyectoId) return setMsg("msgModalContratoManage", "Selecciona un proyecto para vincular.", "warning");

        const { error } = await supabaseClient
            .from("contrato_proyecto")
            .insert([{ contrato_id: contratoManage.id, proyecto_id: proyectoId }]);

        if (error) throw error;

        await loadContratoProyectos();
        setMsg("msgModalContratoManage", "✅ Proyecto vinculado.", "success");
        setTimeout(() => hideMsg("msgModalContratoManage"), 900);
    } catch (e) {
        console.error("LINK PROY ERROR:", e);
        setMsg("msgModalContratoManage", "❌ " + (e.message || e), "danger");
    }
}

async function desvincularProyectoContrato(linkId) {
    try {
        hideMsg("msgModalContratoManage");
        if (!linkId) return;

        const { error } = await supabaseClient
            .from("contrato_proyecto")
            .delete()
            .eq("id", linkId);

        if (error) throw error;

        await loadContratoProyectos();
    } catch (e) {
        console.error("UNLINK PROY ERROR:", e);
        setMsg("msgModalContratoManage", "❌ " + (e.message || e), "danger");
    }
}

// =======================
// CONTRATO - PAGOS (PP-4 - Paso 5)
// Requiere tablas: pago, pago_producto
// Requiere vistas: v_pago_resumen, v_producto_por_proyecto, v_producto_asignacion_contrato
// =======================

function pct(n) {
    const v = Number(n || 0);
    // mostrar sin trailing zeros excesivos
    return (Math.round(v * 100) / 100).toString();
}

function calcValorPago(contratoValor, porcentaje) {
    const v = Number(contratoValor || 0);
    const p = Number(porcentaje || 0);
    return Math.round((v * (p / 100)) * 100) / 100;
}

function setPagoSumaUI(sumPct) {
    const elSuma = document.getElementById("mcPagoSuma");
    const elRes = document.getElementById("mcPagoRestante");
    if (elSuma) elSuma.textContent = pct(sumPct);
    if (elRes) elRes.textContent = pct(Math.max(0, 100 - sumPct));
}

async function loadPagosAndResumen() {
    // carga pagos + resumen en una sola vista
    if (!contratoManage.id) return;

    // Pagos (tabla)
    const { data: pagos, error: pErr } = await supabaseClient
        .from("pago")
        .select("id, contrato_id, nombre, porcentaje, orden, created_at")
        .eq("contrato_id", contratoManage.id)
        .order("orden", { ascending: true });

    if (pErr) throw pErr;
    contratoManage.pagos = pagos || [];

    // Resumen (vista)
    const { data: resumen, error: rErr } = await supabaseClient
        .from("v_pago_resumen")
        .select("*")
        .eq("contrato_id", contratoManage.id)
        .order("orden", { ascending: true });

    if (rErr) {
        // si no existe la vista, deja mensaje claro
        console.error("PAGO RESUMEN VIEW ERROR:", rErr);
        throw new Error(
            `No pude leer v_pago_resumen. Verifica que exista la vista (Paso SQL Pagos). ${rErr.message}`
        );
    }

    contratoManage.pagosResumen = resumen || [];

    // Asignaciones por contrato (para bloquear productos asignados a otros pagos)
    await loadAsignacionesContrato();

    // suma % para UI
    const sumPct = (contratoManage.pagos || []).reduce((a, x) => a + Number(x.porcentaje || 0), 0);
    setPagoSumaUI(sumPct);

    // refrescar selects
    renderPagoSelect();
    renderPagoProyectoSelect();
}

function renderPagosTable() {
    const tbody = document.getElementById("tblPagos");
    if (!tbody) return;

    const rows = contratoManage.pagosResumen || [];
    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-muted p-3">Sin pagos.</td></tr>`;
        return;
    }

    tbody.innerHTML = rows.map((r) => {
        const legalPct = Math.round((Number(r.avance || 0) * 100) * 100) / 100;
        return `
<tr>
  <td>${escapeHtml(String(r.orden ?? "—"))}</td>
  <td>${escapeHtml(r.nombre ?? "—")}</td>
  <td class="text-end">${pct(r.porcentaje)}%</td>
  <td class="text-end">${moneyCOP(r.valor_pago)}</td>
  <td class="text-end">${escapeHtml(String(r.productos_total ?? 0))}</td>
  <td class="text-end">${escapeHtml(String(r.productos_finalizados ?? 0))}</td>
  <td class="text-end">${pct(legalPct)}%</td>
  <td class="text-end">${moneyCOP(r.valor_legalizado)}</td>
  <td class="text-center">
    <button class="btn btn-sm btn-outline-danger btn-del-pago" data-id="${escapeHtml(r.pago_id)}" title="Eliminar">
      <i class="bi bi-trash"></i>
    </button>
  </td>
</tr>`;
    }).join("");

    tbody.querySelectorAll(".btn-del-pago").forEach((btn) => {
        btn.addEventListener("click", async () => {
            await deletePago(btn.dataset.id);
        });
    });
}

function renderPagoSelect() {
    const sel = document.getElementById("mcSelPago");
    if (!sel) return;

    const pagos = contratoManage.pagos || [];
    sel.innerHTML = `<option value="">Seleccione…</option>` + pagos.map((p) =>
        `<option value="${escapeHtml(p.id)}">${escapeHtml(`${p.orden ?? ""}`)}. ${escapeHtml(p.nombre || "Pago")}</option>`
    ).join("");
}

function renderPagoProyectoSelect() {
    const sel = document.getElementById("mcSelPagoProyecto");
    if (!sel) return;

    const vinculados = contratoManage.proyectosVinculados || [];
    sel.innerHTML = `<option value="">Seleccione…</option>` + vinculados.map((p) =>
        `<option value="${escapeHtml(p.proyecto_id)}">${escapeHtml(p.nombre || "—")}</option>`
    ).join("");
}

async function refreshPagoUI() {
    // valores calculados / render general
    const inpPorc = document.getElementById("mcPagoPorc");
    const inpValor = document.getElementById("mcPagoValor");
    if (inpPorc && inpValor && contratoManage?.data) {
        const v = calcValorPago(contratoManage.data.valor, inpPorc.value);
        inpValor.value = formatCOPString(v);
    }

    renderPagosTable();

    // si ya hay selección, refrescar asignación
    await renderPagoProductos();
}

async function addPago() {
    try {
        hideMsg("msgModalContratoManage");
        if (!contratoManage.id) throw new Error("Contrato no seleccionado.");

        const nombre = document.getElementById("mcPagoNombre").value.trim();
        const porcentaje = Number(document.getElementById("mcPagoPorc").value);

        if (!nombre) return setMsg("msgModalContratoManage", "El nombre del pago es obligatorio.", "warning");
        if (!isFinite(porcentaje) || porcentaje <= 0) return setMsg("msgModalContratoManage", "El porcentaje debe ser mayor a 0.", "warning");

        // orden: si no viene, autocalcular
        const ordenRaw = document.getElementById("mcPagoOrden").value;
        let orden = parseInt(ordenRaw, 10);
        if (!orden) {
            const maxOrd = (contratoManage.pagos || []).reduce((m, p) => Math.max(m, Number(p.orden || 0)), 0);
            orden = maxOrd + 1;
        }

        const sumPct = (contratoManage.pagos || []).reduce((a, x) => a + Number(x.porcentaje || 0), 0);
        if (sumPct + porcentaje > 100.00001) {
            return setMsg("msgModalContratoManage", `La suma de porcentajes excede 100%. (Actual: ${pct(sumPct)}%)`, "warning");
        }

        const { error } = await supabaseClient
            .from("pago")
            .insert([{
                contrato_id: contratoManage.id,
                nombre,
                porcentaje,
                orden,
            }]);

        if (error) throw error;

        // limpiar
        document.getElementById("mcPagoNombre").value = "";
        document.getElementById("mcPagoPorc").value = "";
        document.getElementById("mcPagoOrden").value = "";
        document.getElementById("mcPagoValor").value = "";

        await loadPagosAndResumen();
        await refreshPagoUI();

        setMsg("msgModalContratoManage", "✅ Pago agregado.", "success");
        setTimeout(() => hideMsg("msgModalContratoManage"), 900);
    } catch (e) {
        console.error("ADD PAGO ERROR:", e);
        setMsg("msgModalContratoManage", "❌ " + (e.message || e), "danger");
    }
}

async function deletePago(pagoId) {
    try {
        hideMsg("msgModalContratoManage");
        if (!pagoId) return;

        const ok = confirm("¿Eliminar este pago? Se perderán las asignaciones de productos asociadas.");
        if (!ok) return;

        const { error } = await supabaseClient
            .from("pago")
            .delete()
            .eq("id", pagoId);

        if (error) throw error;

        // si era el seleccionado, limpiar selects
        const selPago = document.getElementById("mcSelPago");
        if (selPago && selPago.value === pagoId) selPago.value = "";

        await loadPagosAndResumen();
        await refreshPagoUI();
    } catch (e) {
        console.error("DEL PAGO ERROR:", e);
        setMsg("msgModalContratoManage", "❌ " + (e.message || e), "danger");
    }
}

async function loadAsignacionesContrato() {
    if (!contratoManage.id) return;

    const { data, error } = await supabaseClient
        .from("v_producto_asignacion_contrato")
        .select("producto_id, pago_id, pago_nombre")
        .eq("contrato_id", contratoManage.id);

    if (error) {
        console.error("ASIG VIEW ERROR:", error);
        throw new Error(`No pude leer v_producto_asignacion_contrato. ${error.message}`);
    }

    contratoManage.asignaciones = data || [];
}

function getAsignacionMap() {
    const map = new Map();
    for (const a of (contratoManage.asignaciones || [])) {
        map.set(a.producto_id, { pago_id: a.pago_id, pago_nombre: a.pago_nombre });
    }
    return map;
}

async function loadProductosByProyecto(proyectoId) {
    if (!proyectoId) return [];

    const { data, error } = await supabaseClient
        .from("v_producto_por_proyecto")
        .select("producto_id, estado, url")
        .eq("proyecto_id", proyectoId)
        .order("producto_id", { ascending: true });

    if (error) {
        console.error("PROD VIEW ERROR:", error);
        throw new Error(`No pude leer v_producto_por_proyecto. ${error.message}`);
    }

    return data || [];
}

async function renderPagoProductos() {
    const tbody = document.getElementById("tblPagoProductos");
    const selPago = document.getElementById("mcSelPago");
    const selProy = document.getElementById("mcSelPagoProyecto");
    if (!tbody || !selPago || !selProy) return;

    const pagoId = selPago.value;
    const proyectoId = selProy.value;

    if (!pagoId || !proyectoId) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-muted p-3">Seleccione un pago y un proyecto.</td></tr>`;
        return;
    }

    // recargar asignaciones si no hay
    if (!contratoManage.asignaciones) contratoManage.asignaciones = [];
    const asignMap = getAsignacionMap();

    // productos por proyecto
    const productos = await loadProductosByProyecto(proyectoId);
    contratoManage.productosProyecto = productos;

    const filtro = (document.getElementById("mcPagoBuscar")?.value || "").trim().toLowerCase();
    const soloNoAsign = !!document.getElementById("mcChkSoloNoAsignados")?.checked;

    const filtrados = productos.filter((p) => {
        const pid = String(p.producto_id || "").toLowerCase();
        const url = String(p.url || "").toLowerCase();
        const match = !filtro || pid.includes(filtro) || url.includes(filtro);

        const asig = asignMap.get(p.producto_id);
        const isAsignadoOtro = asig && asig.pago_id !== pagoId;
        const isAsignadoAlguno = !!asig;

        if (soloNoAsign && isAsignadoAlguno) return false;
        if (!match) return false;
        // mostrar incluso si está asignado a otro, pero bloqueado
        return true;
    });

    if (!filtrados.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-muted p-3">Sin productos para mostrar.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtrados.map((p) => {
        const asig = asignMap.get(p.producto_id);
        const assignedTo = asig ? (asig.pago_id === pagoId ? "Este pago" : asig.pago_nombre) : "—";
        const locked = asig && asig.pago_id !== pagoId;

        const url = p.url ? String(p.url) : "";
        const safeUrl = escapeHtml(url);
        const link = url ? `<a href="${safeUrl}" target="_blank" rel="noopener">${safeUrl}</a>` : "—";

        const checked = asig && asig.pago_id === pagoId ? "checked" : "";
        const disabled = locked ? "disabled" : "";

        const estado = (p.estado || "—").toString();
        const badgeCls = estado.toLowerCase() === "finalizado" ? "success" : "secondary";

        return `
<tr>
  <td class="text-center">
    <input class="form-check-input chk-prod-pago" type="checkbox"
      data-producto="${escapeHtml(p.producto_id)}" ${checked} ${disabled} />
  </td>
  <td><code>${escapeHtml(p.producto_id)}</code></td>
  <td><span class="badge bg-${badgeCls}">${escapeHtml(estado)}</span></td>
  <td class="truncate" title="${safeUrl}">${link}</td>
  <td>${locked ? `<span class="badge bg-warning text-dark">Bloqueado</span> ${escapeHtml(assignedTo)}` : escapeHtml(assignedTo)}</td>
</tr>`;
    }).join("");

    tbody.querySelectorAll(".chk-prod-pago").forEach((chk) => {
        chk.addEventListener("change", async (e) => {
            const productoId = e.target.dataset.producto;
            const isChecked = e.target.checked;
            await toggleProductoPago(pagoId, productoId, isChecked);
        });
    });
}

async function toggleProductoPago(pagoId, productoId, checked) {
    try {
        hideMsg("msgModalContratoManage");
        if (!pagoId || !productoId) return;

        if (checked) {
            const { error } = await supabaseClient
                .from("pago_producto")
                .insert([{ pago_id: pagoId, producto_id: productoId }]);

            if (error) throw error;
        } else {
            const { error } = await supabaseClient
                .from("pago_producto")
                .delete()
                .eq("pago_id", pagoId)
                .eq("producto_id", productoId);

            if (error) throw error;
        }

        // refrescar asignaciones + resumen
        await loadPagosAndResumen();
        await refreshPagoUI();
    } catch (e) {
        console.error("TOGGLE PROD PAGO ERROR:", e);
        setMsg("msgModalContratoManage", "❌ " + (e.message || e), "danger");
        // refrescar para deshacer UI incorrecta
        await loadPagosAndResumen();
        await refreshPagoUI();
    }
}

async function guardarProyecto() {
    try {
        hideMsg("msgModal");

        if (!current.area_id || !current.grupo_id) {
            return setMsg("msgModal", "Selecciona un grupo antes de crear el proyecto.", "warning");
        }

        const vigencia =
            parseInt(document.getElementById("inpVigencia").value, 10) || new Date().getFullYear();

        const nombre = document.getElementById("inpNombre").value.trim();
        if (!nombre) return setMsg("msgModal", "El nombre del proyecto es obligatorio.", "warning");

        const payload = {
            // IMPORTANTES (en tu tabla existen)
            vigencia,
            fecha: todayISODate(),
            area_id: current.area_id,
            grupo_id: current.grupo_id,
            nombre,
            grupo: current.grupo,

            // opcionales
            manager: document.getElementById("inpManager").value.trim() || null,
            objetivo: document.getElementById("inpObjetivo").value.trim() || null,
            nodo: document.getElementById("inpNodo").value.trim() || null,
            linea: document.getElementById("inpLinea").value.trim() || null,
            estrategia: document.getElementById("inpEstrategia").value.trim() || null,

            // ubicación (texto, según tu tabla proyecto)
            departamento: document.getElementById("inpDepartamento").value || null,
            municipio: document.getElementById("inpMunicipio").value || null,
            lugar: document.getElementById("inpLugar").value.trim() || null,

            tipo_poblacion: document.getElementById("inpTipoPoblacion").value || null,
            nombre_poblacion: document.getElementById("inpNombrePoblacion").value.trim() || null,



        };

        const { data, error } = await supabaseClient
            .from("proyecto")
            .insert([payload])
            .select("id")
            .single();

        if (error) {
            console.error("INSERT ERROR:", error);
            const details = error.details ? ` | ${error.details}` : "";
            const hint = error.hint ? ` | ${error.hint}` : "";
            throw new Error(`${error.message}${details}${hint}`);
        }

        // cerrar modal
        bootstrap.Modal.getInstance(document.getElementById("modalProyecto")).hide();

        // recargar lista
        await loadProyectosByGrupo(current.grupo_id);
    } catch (e) {
        setMsg("msgModal", "❌ " + (e.message || e), "danger");
    }
}

async function init() {
    const session = await requireAuth();
    if (!session) return;

    document.getElementById("btnLogout").addEventListener("click", async () => {
        await supabaseClient.auth.signOut();
        window.location.href = "index.html";
    });

    document.getElementById("btnNuevoProyecto").addEventListener("click", openModalNuevoProyecto);
    document.getElementById("btnGuardarProyecto").addEventListener("click", guardarProyecto);

    // Contratos
    const btnNuevoContrato = document.getElementById("btnNuevoContrato");
    if (btnNuevoContrato) btnNuevoContrato.addEventListener("click", openModalNuevoContrato);
    const btnGuardarContrato = document.getElementById("btnGuardarContrato");
    if (btnGuardarContrato) btnGuardarContrato.addEventListener("click", guardarContrato);

    // Formateo de valor COP en input
    const inpValor = document.getElementById("inpContratoValor");
    if (inpValor) {
        inpValor.addEventListener("blur", () => {
            inpValor.value = formatCOPString(parseCOP(inpValor.value));
        });
        inpValor.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                btnGuardarContrato?.click();
            }
        });
    }

    // Contrato (gestión)
    const btnGuardarCambios = document.getElementById("btnGuardarContratoCambios");
    if (btnGuardarCambios) btnGuardarCambios.addEventListener("click", guardarContratoCambios);

    const btnAgregarDoc = document.getElementById("btnAgregarDoc");
    if (btnAgregarDoc) btnAgregarDoc.addEventListener("click", addContratoDoc);

    const btnVincularProyecto = document.getElementById("btnVincularProyecto");
    if (btnVincularProyecto) btnVincularProyecto.addEventListener("click", vincularProyectoContrato);

    const mcValor = document.getElementById("mcValor");
    if (mcValor) {
        mcValor.addEventListener("blur", () => {
            mcValor.value = formatCOPString(parseCOP(mcValor.value));
        });
    }


    // Pagos (gestión)
    const btnAgregarPago = document.getElementById("btnAgregarPago");
    if (btnAgregarPago) btnAgregarPago.addEventListener("click", addPago);

    const mcPagoPorc = document.getElementById("mcPagoPorc");
    const mcPagoValor = document.getElementById("mcPagoValor");
    if (mcPagoPorc && mcPagoValor) {
        mcPagoPorc.addEventListener("input", () => {
            if (!contratoManage?.data) return;
            const v = calcValorPago(contratoManage.data.valor, mcPagoPorc.value);
            mcPagoValor.value = formatCOPString(v);
        });
    }

    const selPago = document.getElementById("mcSelPago");
    const selPagoProy = document.getElementById("mcSelPagoProyecto");
    const inpBuscarPago = document.getElementById("mcPagoBuscar");
    const chkSoloNo = document.getElementById("mcChkSoloNoAsignados");

    if (selPago) selPago.addEventListener("change", async () => {
        // refrescar asignaciones por contrato por si cambió algo
        await loadAsignacionesContrato();
        await renderPagoProductos();
    });
    if (selPagoProy) selPagoProy.addEventListener("change", renderPagoProductos);
    if (inpBuscarPago) inpBuscarPago.addEventListener("input", renderPagoProductos);
    if (chkSoloNo) chkSoloNo.addEventListener("change", renderPagoProductos);



    
    const tabPagosBtn = document.querySelector('button[data-bs-target="#tabContratoPagos"]');
    if (tabPagosBtn) {
        tabPagosBtn.addEventListener("shown.bs.tab", async () => {
            try {
                await loadPagosAndResumen();
                await refreshPagoUI();
            } catch (e) {
                console.error("TAB PAGOS REFRESH ERROR:", e);
            }
        });
    }


    // cascada Dep -> Mun (un solo listener)
    const selDep = document.getElementById("inpDepartamento");
    if (selDep) {
        selDep.addEventListener("change", async (e) => {
            try {
                hideMsg("msgModal");
                await loadMunicipiosByDepartamento(e.target.value);
            } catch (err) {
                console.error("MUN ERROR:", err);
                setMsg("msgModal", "❌ No pude cargar municipios: " + (err.message || err), "danger");
            }
        });
    }

    try {
        await loadAreasGrupos();
    } catch (e) {
        console.error("NAV ERROR:", e);
        setMsg("msg", "❌ " + (e.message || e), "danger");
    }
}

init();