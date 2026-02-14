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

    const html = [...map.entries()]
        .map(([area_id, info], idx) => {
            const collapseId = `acc-${area_id}`;
            const gruposHTML = info.grupos.length
                ? info.grupos
                    .map(
                        (g) => `
        <div class="list-group-item list-group-item-action"
             style="cursor:pointer"
             data-area-id="${area_id}" data-area="${escapeHtml(info.area)}"
             data-grupo-id="${g.grupo_id}" data-grupo="${escapeHtml(g.grupo)}">
          ${escapeHtml(g.grupo)}
        </div>`
                    )
                    .join("")
                : `<div class="text-muted small px-2 py-2">Sin grupos</div>`;

            return `
        <div class="accordion-item">
        <h2 class="accordion-header">
          <button class="accordion-button ${idx === 0 ? "" : "collapsed"}" type="button"
                  data-bs-toggle="collapse" data-bs-target="#${collapseId}">
            ${escapeHtml(info.area)}
          </button>
        </h2>
        <div id="${collapseId}" class="accordion-collapse collapse ${idx === 0 ? "show" : ""}">
          <div class="list-group list-group-flush">
            ${gruposHTML}
          </div>
        </div>
      </div>
      <div class="accordion-item">
        <h2 class="accordion-header">
          <button class="accordion-button ${idx === 0 ? "" : "collapsed"}" type="button"
                  data-bs-toggle="collapse" data-bs-target="#colapseApp">
            APLICACIONES
          </button>
        </h2>
        <div id="colapseApp" class="accordion-collapse "show" : ""}">
          <div class="list-group list-group-flush">
            <li class="list-group-item cursor-app" id="itemMapas">
                <i class="bi bi-globe-americas me-4"></i>Mapas
            </li>
          </div>
        </div>
      </div>
    `;
        })
        .join("");

    const acc = `<div class="accordion" id="accAreas">${html}</div>`;

    document.getElementById("navAreasDesktop").innerHTML = acc;
    document.getElementById("navAreasMobile").innerHTML = acc;
    document.getElementById("itemMapas").onclick = () => {
        window.location.href = "./GIS/mapas.html";
    }

    document.querySelectorAll("[data-grupo-id]").forEach((el) => {
        el.addEventListener("click", async () => {
            current.area_id = el.dataset.areaId;
            current.area = el.dataset.area;
            current.grupo_id = el.dataset.grupoId;
            current.grupo = el.dataset.grupo;

            document.getElementById("lblGrupo").textContent = current.grupo;
            document.getElementById("lblArea").textContent = current.area;
            document.getElementById("btnNuevoProyecto").disabled = false;

            await loadProyectosByGrupo(current.grupo_id);

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
      <button class="btn btn-outline-secondary btn-print" data-id="${p.proyecto_id}" title="Informe / Imprimir" onclick="proyecto_print.html?id=${p.proyecto_id}">
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
