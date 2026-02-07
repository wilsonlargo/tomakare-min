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
  return `<span class="badge bg-${cls} badge-semaforo">${s || "—"}</span>`
}

function moneyCOP(n) {
  const val = Number(n || 0)
  return val.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })
}

async function loadAreasGrupos() {
  // Recomendado: usar la vista v_area_grupo si la creaste.
  // Si no existe, puedes leer directo de area y grupo (más llamadas).
  // Aquí asumimos que existe v_area_grupo.
  const { data, error } = await supabaseClient
    .from("v_area_grupo")
    .select("area_id, area, grupo_id, grupo")

  if (error) throw error

  // Agrupar para pintar accordion
  const map = new Map()
  for (const row of data) {
    if (!map.has(row.area_id)) {
      map.set(row.area_id, { area: row.area, grupos: [] })
    }
    if (row.grupo_id) {
      map.get(row.area_id).grupos.push({ grupo_id: row.grupo_id, grupo: row.grupo })
    }
  }

  const html = [...map.entries()].map(([area_id, info], idx) => {
    const aid = `acc-${area_id}`
    const items = info.grupos.length
      ? info.grupos.map(g => `
          <div class="list-group-item list-group-item-action clickable"
               data-area-id="${area_id}" data-area="${info.area}"
               data-grupo-id="${g.grupo_id}" data-grupo="${g.grupo}">
            ${g.grupo}
          </div>
        `).join("")
      : `<div class="text-muted small px-2 py-2">Sin grupos</div>`

    return `
      <div class="accordion-item">
        <h2 class="accordion-header">
          <button class="accordion-button ${idx === 0 ? "" : "collapsed"}" type="button"
                  data-bs-toggle="collapse" data-bs-target="#${aid}">
            ${info.area}
          </button>
        </h2>
        <div id="${aid}" class="accordion-collapse collapse ${idx === 0 ? "show" : ""}">
          <div class="list-group list-group-flush">
            ${items}
          </div>
        </div>
      </div>
    `
  }).join("")

  const acc = `<div class="accordion" id="accAreas">${html}</div>`

  document.getElementById("navAreasDesktop").innerHTML = acc
  document.getElementById("navAreasMobile").innerHTML = acc

  // Delegación de eventos (captura clics)
  document.querySelectorAll('[data-grupo-id]').forEach(el => {
    el.addEventListener("click", async () => {
      current.area_id = el.dataset.areaId
      current.area = el.dataset.area
      current.grupo_id = el.dataset.grupoId
      current.grupo = el.dataset.grupo

      document.getElementById("lblGrupo").textContent = current.grupo
      document.getElementById("lblArea").textContent = current.area
      document.getElementById("btnNuevoProyecto").disabled = false

      await loadProyectosByGrupo(current.grupo_id)

      // cerrar offcanvas en móvil si está abierto
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
    .select("proyecto_id, nombre, porcentaje, semaforo, costo_total")
    .eq("grupo_id", grupo_id) // IMPORTANTE: tu vista debe incluir grupo_id (si no, la ajustamos)
    .order("nombre", { ascending: true })

  if (error) {
    setMsg("msg", "❌ " + error.message, "danger")
    tbody.innerHTML = `<tr><td colspan="4" class="text-muted p-3">Error cargando proyectos.</td></tr>`
    return
  }

  document.getElementById("lblConteo").textContent = `${data.length}`

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-muted p-3">No hay proyectos en este grupo.</td></tr>`
    return
  }

  tbody.innerHTML = data.map(p => `
    <tr class="clickable" data-id="${p.proyecto_id}">
      <td class="truncate">${p.nombre}</td>
      <td class="text-end">${Number(p.porcentaje || 0).toFixed(2)}%</td>
      <td>${semaforoBadge(p.semaforo)}</td>
      <td class="text-end">${moneyCOP(p.costo_total)}</td>
    </tr>
  `).join("")

  // click para abrir detalle
  tbody.querySelectorAll("tr[data-id]").forEach(tr => {
    tr.addEventListener("click", () => {
      const id = tr.dataset.id
      window.location.href = `proyecto.html?id=${id}`
    })
  })
}

function openModalNuevoProyecto() {
  hideMsg("msgModal")

  // vigencia por defecto: año actual
  document.getElementById("inpVigencia").value = new Date().getFullYear()

  document.getElementById("inpArea").value = current.area || ""
  document.getElementById("inpGrupo").value = current.grupo || ""

  document.getElementById("inpNombre").value = ""
  document.getElementById("inpManager").value = ""
  document.getElementById("inpObjetivo").value = ""
  document.getElementById("inpNodo").value = ""
  document.getElementById("inpLinea").value = ""
  document.getElementById("inpEstrategia").value = ""

  const modal = new bootstrap.Modal(document.getElementById("modalProyecto"))
  modal.show()
}

async function guardarProyecto() {
  try {
    hideMsg("msgModal")

    const vigencia = parseInt(document.getElementById("inpVigencia").value, 10)
    const nombre = document.getElementById("inpNombre").value.trim()
    const manager = document.getElementById("inpManager").value.trim()
    const objetivo = document.getElementById("inpObjetivo").value.trim()

    const nodo = document.getElementById("inpNodo").value.trim()
    const linea = document.getElementById("inpLinea").value.trim()
    const estrategia = document.getElementById("inpEstrategia").value.trim()

    if (!current.grupo_id) return setMsg("msgModal", "Selecciona un grupo.", "warning")
    if (!nombre) return setMsg("msgModal", "El nombre del proyecto es obligatorio.", "warning")

    const payload = {
      vigencia,
      area_id: current.area_id,
      grupo_id: current.grupo_id,
      nombre,
      manager: manager || null,
      objetivo: objetivo || null,

      // campos opcionales (si existen en tu tabla)
      nodo: nodo || null,
      linea: linea || null,
      estrategia: estrategia || null,
    }

    const { data, error } = await supabaseClient
      .from("proyecto")
      .insert([payload])
      .select("id")
      .single()

    if (error) throw error

    // cerrar modal
    const modalEl = document.getElementById("modalProyecto")
    bootstrap.Modal.getInstance(modalEl).hide()

    // recargar lista
    await loadProyectosByGrupo(current.grupo_id)
  } catch (e) {
    setMsg("msgModal", "❌ " + (e.message || e), "danger")
  }
}

async function init() {
  // proteger ruta
  const session = await requireAuth()
  if (!session) return

  // logout
  document.getElementById("btnLogout").addEventListener("click", async () => {
    await supabaseClient.auth.signOut()
    window.location.href = "index.html"
  })

  // nuevo proyecto
  document.getElementById("btnNuevoProyecto").addEventListener("click", openModalNuevoProyecto)
  document.getElementById("btnGuardarProyecto").addEventListener("click", guardarProyecto)

  // cargar navegación
  try {
    await loadAreasGrupos()
  } catch (e) {
    setMsg("msg", "❌ " + (e.message || e), "danger")
  }
}

init()
