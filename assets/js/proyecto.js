// assets/js/proyecto.js

function qs(name) {
    return new URLSearchParams(window.location.search).get(name)
}

function setMsg(text, type = "info") {
    const el = document.getElementById("msg")
    el.className = `alert alert-${type}`
    el.textContent = text
    el.style.display = "block"
}

function hideMsg() {
    const el = document.getElementById("msg")
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
    return `<span class="badge bg-${cls} badge-semaforo">${s || "—"}</span>`
}

const proyectoId = qs("id")

async function loadHeader() {
    const { data, error } = await supabaseClient
        .from("v_proyecto_avance_costo")
        .select("proyecto_id, nombre, porcentaje, semaforo, costo_total, vigencia, nodo, linea, estrategia")
        .eq("proyecto_id", proyectoId)
        .single()

    if (error) throw error

    document.getElementById("pNombre").textContent = data.nombre || "—"
    document.getElementById("pMeta").textContent = `${data.vigencia ?? ""} • ${data.nodo ?? ""} • ${data.linea ?? ""} • ${data.estrategia ?? ""}`.replace(/\s•\s•\s/g, " • ")
    document.getElementById("pAvance").textContent = `${Number(data.porcentaje || 0).toFixed(2)}%`
    document.getElementById("pSemaforo").innerHTML = semaforoBadge(data.semaforo)
    document.getElementById("pCosto").textContent = moneyCOP(data.costo_total)
}

async function loadObjetivos() {
    const { data, error } = await supabaseClient
        .from("v_proyecto_avance_costo")
        .select("proyecto_id, nombre, vigencia, nodo, linea, estrategia, porcentaje, semaforo, costo_total")
        .eq("proyecto_id", proyectoId)
        .single()


    if (error) throw error

    const tbody = document.getElementById("tblObjetivos")
    if (!data.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-muted">No hay objetivos.</td></tr>`
        return
    }

    tbody.innerHTML = data.map(o => `
    <tr>
      <td><strong>${o.codigo}</strong></td>
      <td class="truncate">${o.nombre}</td>
      <td class="text-end">${Number(o.porcentaje || 0).toFixed(2)}%</td>
      <td class="text-end">${moneyCOP(o.costo_total)}</td>
    </tr>
  `).join("")

    // Resumen (tab resumen)
    const res = document.getElementById("tblResObjetivos")
    res.innerHTML = data.map(o => `
    <tr>
      <td class="truncate">${o.codigo} - ${o.nombre}</td>
      <td class="text-end">${Number(o.porcentaje || 0).toFixed(2)}%</td>
      <td class="text-end">${moneyCOP(o.costo_total)}</td>
    </tr>
  `).join("")
}

async function loadActividades() {
    const { data, error } = await supabaseClient
        .from("v_actividad_avance_costo")
        .select("id, nombre, objetivo_id, porcentaje, costo_total, meta, avance, orden, created_at, estado_calc")
        .eq("proyecto_id", proyectoId)
        .order("orden", { ascending: true, nullsFirst: false })

    if (error) throw error

    // Traer objetivos para mapear objetivo_id -> codigo
    const { data: objs, error: e2 } = await supabaseClient
        .from("objetivo")
        .select("id, codigo")
        .eq("proyecto_id", proyectoId)

    if (e2) throw e2

    const mapObj = new Map(objs.map(o => [o.id, o.codigo]))

    const tbody = document.getElementById("tblActividades")
    if (!data.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-muted">No hay actividades.</td></tr>`
        return
    }

    tbody.innerHTML = data.map(a => `
    <tr>
      <td class="truncate">${a.nombre}</td>
      <td>${mapObj.get(a.objetivo_id) || "—"}</td>
      <td class="text-end">${Number(a.meta || 0).toFixed(2)}</td>
      <td class="text-end">${Number(a.avance || 0).toFixed(2)}</td>
      <td class="text-end">${Number(a.porcentaje || 0).toFixed(2)}%</td>
      <td class="text-end">${moneyCOP(a.costo_total)}</td>
    </tr>
  `).join("")

    // Resumen (tab resumen) - top 10 por costo
    const top = [...data].sort((x, y) => (y.costo_total || 0) - (x.costo_total || 0)).slice(0, 10)
    const res = document.getElementById("tblResActividades")
    res.innerHTML = top.map(a => `
    <tr>
      <td class="truncate">${a.nombre}</td>
      <td class="text-end">${Number(a.porcentaje || 0).toFixed(2)}%</td>
      <td class="text-end">${moneyCOP(a.costo_total)}</td>
    </tr>
  `).join("")
}

async function init() {
    const session = await requireAuth()
    if (!session) return

    document.getElementById("btnLogout").addEventListener("click", async () => {
        await supabaseClient.auth.signOut()
        window.location.href = "index.html"
    })

    if (!proyectoId) {
        setMsg("Falta el parámetro ?id= del proyecto.", "warning")
        return
    }

    try {
        hideMsg()
        await loadHeader()
        await loadObjetivos()
        await loadActividades()
    } catch (e) {
        setMsg("❌ " + (e.message || e), "danger")
    }
}

init()
