// assets/js/proyecto.js

function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
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

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const proyectoId = qs("id");

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

  try {
    await loadProyecto();
  } catch (e) {
    console.error("LOAD PROYECTO ERROR:", e);
    setMsg("❌ No pude cargar el proyecto: " + (e.message || e), "danger");
  }
}

init();
