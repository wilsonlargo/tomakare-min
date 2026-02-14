// proyecto_print.js
// Requiere: supabaseClient (igual que en tu app)

let proyectoId = null;

document.addEventListener("DOMContentLoaded", async () => {
  proyectoId = new URLSearchParams(window.location.search).get("id");

  if (!proyectoId) {
    setEstado("❌ Falta id del proyecto en la URL.");
    document.getElementById("contenedorDetalle").innerHTML = `<div class="text-danger">Falta parámetro <b>?id=...</b></div>`;
    return;
  }

  wireUI();

  // fecha
  document.getElementById("txtFecha").textContent = new Date().toLocaleString("es-CO");

  await cargarInforme();
});

function wireUI() {
  const chk = document.getElementById("chkPresupuesto");

  chk.addEventListener("change", async () => {
    document.body.classList.toggle("show-presupuesto", chk.checked);

    // si activan, carga rubros para todas las actividades ya renderizadas
    if (chk.checked) {
      await cargarPresupuestosRenderizados();
    }
  });

  document.getElementById("btnImprimir").addEventListener("click", () => window.print());
  document.getElementById("btnCerrar").addEventListener("click", () => window.close());
}

async function cargarPresupuestosRenderizados() {
  const conts = document.querySelectorAll('[id^="pres-"]');

  for (const div of conts) {
    const actividadId = div.id.replace("pres-", "");

    // si ya cargó antes, no vuelvas a cargar
    if (div.dataset.loaded === "1") continue;

    const { data: rubros, error } = await supabaseClient
      .from("presupuesto_item")
      .select("observaciones,beneficiarios,veces,valor_unitario,costo_operativo_pct,valor_total")
      .eq("actividad_id", actividadId)
      .order("orden", { ascending: true });

    if (error) {
      console.error(error);
      div.innerHTML = `<div class="text-danger small">Error cargando presupuesto.</div>`;
      continue;
    }

    if (!rubros || !rubros.length) {
      div.innerHTML = `<div class="text-muted small">Sin rubros.</div>`;
      div.dataset.loaded = "1";
      continue;
    }

    div.innerHTML = `
      <div class="text-muted small mb-1">Presupuesto (rubros)</div>
      <div class="table-responsive">
        <table class="table table-sm table-bordered align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th>Obs.</th>
              <th class="text-end">Benef.</th>
              <th class="text-end">Veces</th>
              <th class="text-end">V. Unitario</th>
              <th class="text-end">% Op.</th>
              <th class="text-end">Total</th>
              
            </tr>
          </thead>
          <tbody>
            ${rubros.map(r => `
              <tr>
                <td>${escapeHtml(r.observaciones || "")}</td>
                <td class="text-end">${num(r.beneficiarios)}</td>
                <td class="text-end">${num(r.veces)}</td>
                <td class="text-end">${money(r.valor_unitario)}</td>
                <td class="text-end">${num(r.costo_operativo_pct)}%</td>
                <td class="text-end">${money(r.valor_total)}</td>
                
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    div.dataset.loaded = "1";
  }
}


async function cargarInforme() {
  setEstado("Cargando proyecto…");

  // 1) Proyecto (nombre)
  const { data: proyecto, error: errP } = await supabaseClient
    .from("proyecto")
    .select("id,nombre,grupo_id,created_at")
    .eq("id", proyectoId)
    .single();

  if (errP) {
    console.error(errP);
    setEstado("❌ Error cargando proyecto.");
    return;
  }

  document.getElementById("txtProyecto").textContent = proyecto.nombre || "—";
  document.getElementById("txtSubtitulo").textContent = `ID: ${proyecto.id}`;

  // 2) Totales y avance (RPC existentes)
  setEstado("Calculando avance y totales…");

  const [avance, total] = await Promise.all([
    rpcValue("get_avance_proyecto", { p_proyecto_id: proyectoId }),
    rpcValue("get_total_proyecto", { p_proyecto_id: proyectoId })
  ]);

  document.getElementById("txtAvanceProyecto").textContent = pct(avance);
  document.getElementById("txtTotalProyecto").textContent = money(total);
  document.getElementById("txtSemaforo").innerHTML = badgeSemaforo(Number(avance || 0));

  // 3) Objetivos
  setEstado("Cargando objetivos…");

  const { data: objetivos, error: errO } = await supabaseClient
    .from("objetivo")
    .select("id,nombre,orden")
    .eq("proyecto_id", proyectoId)
    .order("orden", { ascending: true });

  if (errO) {
    console.error(errO);
    setEstado("❌ Error cargando objetivos.");
    return;
  }

  // 4) Mapas de totales/avances por objetivo (RPC existentes)
  const [totObj, avObj] = await Promise.all([
    rpcTable("get_totales_objetivos_por_proyecto", { p_proyecto_id: proyectoId }),
    rpcTable("get_avance_objetivos_por_proyecto", { p_proyecto_id: proyectoId })
  ]);

  const mapTotObj = toMap(totObj, "objetivo_id", "total");
  const mapAvObj = toMap(avObj, "objetivo_id", "avance");

  // Resumen de objetivos (tabla pequeña)
  renderResumenObjetivos(objetivos, mapAvObj, mapTotObj);

  // 5) Actividades + productos + (opcional) presupuesto
  setEstado("Cargando detalle…");

  const cont = document.getElementById("contenedorDetalle");
  cont.innerHTML = "";

  let totalActividades = 0;
  let totalProductos = 0;

  for (const o of (objetivos || [])) {
    const totO = Number(mapTotObj[o.id] || 0);
    const avO = Number(mapAvObj[o.id] || 0);

    // Actividades del objetivo
    const { data: actividades, error: errA } = await supabaseClient
      .from("actividad")
      .select("id,codigo,nombre,orden")
      .eq("objetivo_id", o.id)
      .order("orden", { ascending: true });

    if (errA) { console.error(errA); continue; }

    totalActividades += (actividades || []).length;

    // mapas por actividad (totales + avance)
    const [totAct, avAct] = await Promise.all([
      rpcTable("get_totales_actividades_por_objetivo", { p_objetivo_id: o.id }),
      rpcTable("get_avance_actividades_por_objetivo", { p_objetivo_id: o.id })
    ]);

    const mapTotAct = toMap(totAct, "actividad_id", "total");
    const mapAvAct = toMap(avAct, "actividad_id", "avance");

    // Render objetivo
    const bloqueObj = document.createElement("div");
    bloqueObj.className = "mb-4";

    bloqueObj.innerHTML = `
      <div class="d-flex justify-content-between align-items-start gap-3">
        <div>
          <div class="fw-semibold">Objetivo ${escapeHtml(String(o.orden ?? ""))}: ${escapeHtml(o.nombre || "—")}</div>
          <div class="text-muted small">Avance: <b>${pct(avO)}</b> · Total: <b>${money(totO)}</b></div>
        </div>
        <div class="text-end">${badgeSemaforo(avO)}</div>
      </div>
      <div class="mt-2" id="obj-${o.id}"></div>
    `;

    cont.appendChild(bloqueObj);

    const contAct = bloqueObj.querySelector(`#obj-${CSS.escape(o.id)}`);
    if (!contAct) continue;

    // Render actividades
    for (const a of (actividades || [])) {
      const totA = Number(mapTotAct[a.id] || 0);
      const avA = Number(mapAvAct[a.id] || 0);

      // Productos de la actividad
      const { data: productos, error: errPr } = await supabaseClient
        .from("producto")
        .select("id,nombre,estado,created_at,descripcion")
        .eq("actividad_id", a.id)
        .order("created_at", { ascending: true });

      if (errPr) { console.error(errPr); }

      totalProductos += (productos || []).length;

      // Presupuesto (solo se carga si el toggle está ON)
      let presupuestoHTML = "";


      const bloqueAct = document.createElement("div");
      bloqueAct.className = "border rounded p-2 mt-2";

      bloqueAct.innerHTML = `
        <div class="d-flex justify-content-between align-items-start gap-3">
          <div>
            <div class="fw-semibold">Actividad ${escapeHtml(String(a.orden ?? ""))}: ${escapeHtml(a.nombre || "—")}</div>
            <div class="text-muted small">Avance: <b>${pct(avA)}</b> · Total: <b>${money(totA)}</b></div>
          </div>
          <div class="text-end">${badgeSemaforo(avA)}</div>
        </div>

        <div class="mt-2">
          <div class="text-muted small mb-1">Productos</div>
          ${renderTablaProductos(productos || [])}
        </div>

        <div class="only-presupuesto mt-2" id="pres-${a.id}">
      <div class="text-muted small">Presupuesto oculto.</div>
        </div>

      `;

      contAct.appendChild(bloqueAct);
    }
  }

  document.getElementById("txtConteos").textContent =
    `${(objetivos || []).length} objetivos · ${totalActividades} actividades · ${totalProductos} productos`;

  setEstado("Listo.");

  if (document.getElementById("chkPresupuesto").checked) {
    document.body.classList.add("show-presupuesto");
    await cargarPresupuestosRenderizados();
  }

}

// ---------- Render helpers ----------

function renderResumenObjetivos(objetivos, mapAvObj, mapTotObj) {
  const tb = document.getElementById("tblResumenObjetivos");
  if (!tb) return;

  if (!objetivos || !objetivos.length) {
    tb.innerHTML = `<tr><td colspan="3" class="text-muted small">Sin objetivos.</td></tr>`;
    return;
  }

  tb.innerHTML = objetivos.map(o => {
    const av = Number(mapAvObj[o.id] || 0);
    const tt = Number(mapTotObj[o.id] || 0);
    return `
      <tr>
        <td>${escapeHtml(String(o.orden ?? ""))}</td>
        <td class="text-end">${pct(av)}</td>
        <td class="text-end">${money(tt)}</td>
      </tr>
    `;
  }).join("");
}

function renderTablaProductos(productos) {

  if (!productos.length) return `<div class="text-muted small">Sin productos.</div>`;

  return `
    <div class="table-responsive">
      <table class="table table-sm table-bordered align-middle mb-0">
        <thead class="table-light">
          <tr>
            <th>Producto</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          ${productos.map(p => `
            <tr>
              <td>${escapeHtml(p.descripcion || "—")}</td>
              <td>${badgeEstado(p.estado)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

// ---------- RPC wrappers ----------
async function rpcTable(fn, args) {
  const { data, error } = await supabaseClient.rpc(fn, args);
  if (error) {
    console.error("RPC", fn, error);
    return [];
  }
  return data || [];
}

async function rpcValue(fn, args) {
  const { data, error } = await supabaseClient.rpc(fn, args);
  if (error) {
    console.error("RPC", fn, error);
    return 0;
  }
  return data ?? 0;
}

function toMap(rows, keyField, valField) {
  const m = {};
  (rows || []).forEach(r => { m[r[keyField]] = r[valField]; });
  return m;
}

// ---------- UI helpers ----------
function setEstado(t) {
  const el = document.getElementById("lblEstado");
  if (el) el.textContent = t;
}

function pct(n) {
  return `${Number(n || 0).toFixed(2)}%`;
}

function money(n) {
  return Number(n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  });
}

function num(n) {
  const v = Number(n || 0);
  return Number.isFinite(v) ? v.toLocaleString("es-CO") : "";
}

function badgeEstado(estado) {
  const x = String(estado || "").toLowerCase().trim();
  let cls = "secondary";
  if (x === "pendiente") cls = "secondary";
  else if (x === "en proceso") cls = "warning";
  else if (x === "entregado") cls = "primary";
  else if (x === "validado") cls = "success";
  return `<span class="badge bg-${cls}">${escapeHtml(estado || "—")}</span>`;
}

function badgeSemaforo(avance) {
  const v = Number(avance || 0);
  let cls = "danger", label = "rojo";
  if (v >= 90) { cls = "primary"; label = "azul"; }
  else if (v >= 75) { cls = "success"; label = "verde"; }
  else if (v >= 50) { cls = "warning"; label = "amarillo"; }
  else if (v >= 25) { cls = "orange"; label = "naranja"; }
  else { cls = "danger"; label = "rojo"; }

  // Bootstrap no trae bg-orange por defecto; si no tienes CSS, usa "warning" o "dark".
  if (cls === "orange") cls = "warning";

  return `<span class="badge bg-${cls} text-uppercase">${label}</span>`;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[m]));
}
