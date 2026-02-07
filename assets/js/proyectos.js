// assets/js/proyectos.js

let current = {
  area_id: null,
  area: null,
  grupo_id: null,
  grupo: null,
}

function setMsg(id, text, type = "info") {
  const el = document.getElementById(id)
  if (!el) return
  el.className = `alert alert-${type}`
  el.textContent = text
  el.style.display = "block"
}

function hideMsg(id) {
  const el = document.getElementById(id)
  if (!el) return
  el.style.display = "none"
}

function moneyCOP(n) {
  const val = Number(n || 0)
  return val.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })
}

function semaforoBadge(semaforo) {
  const s = (semaforo || "").toLowerCase()
  const map = {
    gris: "secondary",
    negro: "dark",
    rojo_oscuro: "danger",
    rojo: "danger",
    naranja: "warning",
    amarillo: "warning",
    verde_claro: "success",
    verde: "success",
  }
  const cls = map[s] || "secondary"
  return `<span class="badge bg-${cls}">${s || "—"}</span>`
}

function todayISODate() {
  // YYYY-MM-DD en hora local
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

async function loadAreasGrupos() {
  const { data, error } = await supabaseClient
    .from("v_area_grupo")
    .select("area_id, area, grupo_id, grupo")

  if (error) throw error

  const map = new Map()
  for (const row of data) {
    if (!map.has(row.area_id)) map.set(row.area_id, { area: row.area, grupos: [] })
    if (row.grupo_id) map.get(row.area_id).grupos.push({ grupo_id: row.grupo_id, grupo: row.grupo })
  }

  const html = [...map.entries()].map(([area_id, info], idx) => {
    const collapseId = `acc-${area_id}`
    const gruposHTML = info.grupos.length
      ? info.grupos.map(g => `
        <div class="list-group-item list-group-item-action"
             style="cursor:pointer"
             data-area-id="${area_id}" data-area="${info.area}"
             data-grupo-id="${g.grupo_id}" data-grupo="${g.grupo}">
          ${g.grupo}
        </div>`).join("")
      : `<div class="text-muted small px-2 py-2">Sin grupos</div>`

    return `
      <div class="accordion-item">
        <h2 class="accordion-header">
          <button class="accordion-button ${idx === 0 ? "" : "collapsed"}" type="button"
                  data-bs-toggle="collapse" data-bs-target="#${collapseId}">
            ${info.area}
          </button>
        </h2>
        <div id="${collapseId}" class="accordion-collapse collapse ${idx === 0 ? "show" : ""}">
          <div class="list-group list-group-flush">
            ${gruposHTML}
          </div>
        </div>
      </div>
    `
  }).join("")

  const acc = `<div class="accordion" id="accAreas">${html}</div>`

  document.getElementById("navAreasDesktop").innerHTML = acc
  document.getElementById("navAreasMobile").innerHTML = acc

  document.querySelectorAll("[data-grupo-id]").forEach(el => {
    el.addEventListener("click", async () => {
      current.area_id = el.dataset.areaId
      current.area = el.dataset.area
      current.grupo_id = el.dataset.grupoId
      current.grupo = el.dataset.grupo

      document.getElementById("lblGrupo").textContent = current.grupo
      document.getElementById("lblArea").textContent = current.area
      document.getElementById("btnNuevoProyecto").disabled = false

      await loadProyectosByGrupo(current.grupo_id)

      const off = bootstrap.Offcanvas.getInstance(document.getElementById("offcanvasNav"))
      if (off) off.hide()
    })
  })
}

async function loadProyectosByGrupo(grupo_id) {
  hideMsg("msg")
  const tbody = document.getElementById("tblProyectos")
  tbody.innerHTML = `<tr><td colspan="4" class="text-muted p-3">Cargando...</td></tr>`

  const { data, error } = await supabaseClient
    .from("v_proyecto_avance_costo")
    .select("proyecto_id, nombre, porcentaje, semaforo, costo_total, grupo_id")
    .eq("grupo_id", grupo_id)
    .order("nombre", { ascending: true })

  if (error) {
    console.error("LIST ERROR:", error)
    setMsg("msg", `❌ ${error.message}`, "danger")
    tbody.innerHTML = `<tr><td colspan="4" class="text-muted p-3">Error cargando proyectos.</td></tr>`
    return
  }

  document.getElementById("lblConteo").textContent = `${data.length}`

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-muted p-3">No hay proyectos en este grupo.</td></tr>`
    return
  }

  tbody.innerHTML = data.map(p => `
    <tr style="cursor:pointer" data-id="${p.proyecto_id}">
      <td>${p.nombre ?? "—"}</td>
      <td class="text-end">${Number(p.porcentaje || 0).toFixed(2)}%</td>
      <td>${semaforoBadge(p.semaforo)}</td>
      <td class="text-end">${moneyCOP(p.costo_total)}</td>
    </tr>
  `).join("")

  tbody.querySelectorAll("tr[data-id]").forEach(tr => {
    tr.addEventListener("click", () => {
      window.location.href = `proyecto.html?id=${tr.dataset.id}`
    })
  })
}

function openModalNuevoProyecto() {
  hideMsg("msgModal")

  document.getElementById("inpVigencia").value = new Date().getFullYear()
  document.getElementById("inpArea").value = current.area || ""
  document.getElementById("inpGrupo").value = current.grupo || ""

  document.getElementById("inpNombre").value = ""
  document.getElementById("inpManager").value = ""
  document.getElementById("inpObjetivo").value = ""
  document.getElementById("inpNodo").value = ""
  document.getElementById("inpLinea").value = ""
  document.getElementById("inpEstrategia").value = ""

  new bootstrap.Modal(document.getElementById("modalProyecto")).show()
}

async function guardarProyecto() {
  try {
    hideMsg("msgModal")

    if (!current.area_id || !current.grupo_id) {
      return setMsg("msgModal", "Selecciona un grupo antes de crear el proyecto.", "warning")
    }

    const vigencia = parseInt(document.getElementById("inpVigencia").value, 10) || new Date().getFullYear()
    const nombre = document.getElementById("inpNombre").value.trim()
    if (!nombre) return setMsg("msgModal", "El nombre del proyecto es obligatorio.", "warning")

    const payload = {
      // IMPORTANTES (en tu tabla existen)
      vigencia,
      fecha: todayISODate(),        // 👈 evita 400 si fecha es NOT NULL
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
    }

    const { data, error } = await supabaseClient
      .from("proyecto")
      .insert([payload])
      .select("id")
      .single()

    if (error) {
      // Mostrar el error real (message/details/hint)
      console.error("INSERT ERROR:", error)
      const details = error.details ? ` | ${error.details}` : ""
      const hint = error.hint ? ` | ${error.hint}` : ""
      throw new Error(`${error.message}${details}${hint}`)
    }

    // cerrar modal
    bootstrap.Modal.getInstance(document.getElementById("modalProyecto")).hide()

    // recargar lista
    await loadProyectosByGrupo(current.grupo_id)
  } catch (e) {
    setMsg("msgModal", "❌ " + (e.message || e), "danger")
  }
}

async function init() {
  const session = await requireAuth()
  if (!session) return

  document.getElementById("btnLogout").addEventListener("click", async () => {
    await supabaseClient.auth.signOut()
    window.location.href = "index.html"
  })

  document.getElementById("btnNuevoProyecto").addEventListener("click", openModalNuevoProyecto)
  document.getElementById("btnGuardarProyecto").addEventListener("click", guardarProyecto)

  try {
    await loadAreasGrupos()
  } catch (e) {
    console.error("NAV ERROR:", e)
    setMsg("msg", "❌ " + (e.message || e), "danger")
  }
}

init()
