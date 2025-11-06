// ============================
//      Dashboard Vendedor
// ============================
document.addEventListener("DOMContentLoaded", () => {
  // ---------- CSRF ----------
  const getCookie = (name) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return decodeURIComponent(parts.pop().split(";").shift());
    return null;
  };
  const csrftoken = getCookie("csrftoken");

  const api = async (url, { method = "GET", body = null } = {}) => {
    const opts = { method, headers: { "X-Requested-With": "XMLHttpRequest" }, credentials: "same-origin" };
    if (method !== "GET") {
      opts.headers["Content-Type"] = "application/json";
      if (csrftoken) opts.headers["X-CSRFToken"] = csrftoken;
      if (body) opts.body = JSON.stringify(body);
    }
    const r = await fetch(url, opts);
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      throw new Error(`HTTP ${r.status} â€” ${url}\n${t}`);
    }
    const ct = r.headers.get("content-type") || "";
    return ct.includes("application/json") ? r.json() : r.text();
  };

  // ---------- Nav ----------
  document.querySelectorAll(".sidebar nav a[data-section]").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelectorAll(".sidebar nav a").forEach(x => x.classList.remove("active"));
      a.classList.add("active");
      const id = a.getAttribute("data-section");
      document.querySelectorAll(".section-group").forEach(s => s.classList.remove("active"));
      const tgt = document.getElementById(id);
      if (tgt) tgt.classList.add("active");
    });
  });

  const abrirSeccionProductos = () => {
    const navProductos = document.querySelector(".sidebar nav a[data-section='productos']");
    if (navProductos) {
      navProductos.dispatchEvent(new Event("click", { bubbles: true }));
    }
  };

  const irAlFormularioProducto = ({ focus = false, onReady } = {}) => {
    abrirSeccionProductos();
    window.requestAnimationFrame(() => {
      const formulario = document.getElementById("formAgregarProducto");
      if (!formulario) return;

      formulario.scrollIntoView({ behavior: "smooth", block: "start" });

      if (focus) {
        const primerCampo = formulario.querySelector("input[name='nombre']") || formulario.querySelector("input, select, textarea");
        if (primerCampo) {
          try {
            primerCampo.focus({ preventScroll: true });
          } catch (err) {
            primerCampo.focus();
          }
        }
      }

      if (typeof onReady === "function") {
        onReady(formulario);
      }
    });
  };

  const formularioProductos = document.getElementById("formAgregarProducto");
  const hiddenProductoId = formularioProductos?.querySelector("#producto_id");
  const tablaAccionesEdicion = document.getElementById("tablaAccionesEdicion");
  const tablaAccionSubmit = document.getElementById("tablaAccionSubmit");
  const bloqueSubmitForm = document.getElementById("blockSubmitForm");
  const btnCancelarTabla = document.getElementById("btnCancelarEdicionTabla");
  const btnGuardarTabla = document.getElementById("btnGuardarProductoTabla");
  const btnEliminarTabla = document.getElementById("btnEliminarProductoTabla");
  const badgeEditar = document.getElementById("badgeEditar");
  const thAccionForm = document.getElementById("thAccionForm");

  const setModoEdicion = (editing) => {
    const displayEdit = editing ? "" : "none";
    const displayCreate = editing ? "none" : "";
    if (tablaAccionesEdicion) tablaAccionesEdicion.style.display = displayEdit;
    if (tablaAccionSubmit) tablaAccionSubmit.style.display = displayCreate;
    if (bloqueSubmitForm) bloqueSubmitForm.style.display = displayCreate;
    if (badgeEditar) badgeEditar.style.display = editing ? 'inline-flex' : 'none';
    if (thAccionForm) thAccionForm.textContent = 'Guardar';
    if (btnCancelarTabla) btnCancelarTabla.style.display = editing ? 'inline-flex' : 'none';
  };

  setModoEdicion(!!(hiddenProductoId && hiddenProductoId.value));

  const botonSubir = document.getElementById("btnSubirProducto");
  const limpiarProductoId = () => {
    if (hiddenProductoId) hiddenProductoId.value = "";
    // limpiar campos y volver a modo creación
    const set = (sel, val) => { const el = formularioProductos?.querySelector(sel); if (el) el.value = val ?? ""; };
    set('#nombre', '');
    set('#marca', '');
    set('#calidad', '');
    set('#categoria', '');
    set('#precio', '');
    set('#existencias', '');
    set('#descripcion', '');
    const hoy = new Date().toISOString().slice(0,10);
    set('#fecha_ingreso', hoy);
    const inputImagen = formularioProductos ? formularioProductos.querySelector('#imagen') : null;
    if (inputImagen) {
      inputImagen.required = true;
      try { inputImagen.value = ''; } catch (_) {}
    }
    const btn = formularioProductos ? formularioProductos.querySelector('button[type="submit"]') : null;
    if (btn) btn.innerHTML = '<i class="fas fa-save"></i> Guardar';
    setModoEdicion(false);
  };
  if (botonSubir) {
    botonSubir.addEventListener("click", () => irAlFormularioProducto({
      focus: true,
      onReady: limpiarProductoId,
    }));
  }


  const botonGuardar = document.getElementById("btnGuardarProducto");
  if (botonGuardar) {
    botonGuardar.addEventListener("click", () => irAlFormularioProducto({
      onReady: (formulario) => {
        if (typeof formulario.requestSubmit === "function") {
          formulario.requestSubmit();
        } else if (!formulario.checkValidity || formulario.checkValidity()) {
          formulario.submit();
        } else if (typeof formulario.reportValidity === "function") {
          formulario.reportValidity();
        }
      }
    }));
  }

  const selectUmbral = document.getElementById("stock_umbral");
  const inputBuscar = document.getElementById('stock_buscar');
  const selectCategoria = document.getElementById('stock_categoria');
  const btnCopiarCrit = document.getElementById('btnCopiarCriticos');
  const btnRefrescarStock = document.getElementById('btnRefrescarStock');
  let stockItems = [];

  // ---------- Editar producto desde la tabla ----------
  const prefillFormularioProducto = (data) => {
    if (!formularioProductos) return;
    if (hiddenProductoId) hiddenProductoId.value = data.id || "";
    const set = (sel, val) => { const el = formularioProductos.querySelector(sel); if (el) el.value = val ?? ""; };
    set("#nombre", data.nombre || "");
    set("#marca", data.marca || "");
    set("#calidad", data.calidad || "");
    set("#categoria", data.categoria || "");
    set("#precio", data.precio != null ? data.precio : "");
    set("#existencias", data.existencias != null ? data.existencias : "");
    set("#fecha_ingreso", data.fecha || "");
    set("#descripcion", data.descripcion || "");
    const inputImagen = formularioProductos.querySelector('#imagen');
    if (inputImagen) inputImagen.required = false;
    const btn = formularioProductos.querySelector('button[type="submit"]');
    if (btn) btn.innerHTML = '<i class="fas fa-save"></i> Actualizar';
    setModoEdicion(true);
  };

  document.querySelectorAll(".btn-edit").forEach((btn) => {
    btn.addEventListener("click", () => {
      const data = {
        id: btn.dataset.id,
        nombre: btn.dataset.nombre,
        marca: btn.dataset.marca,
        calidad: btn.dataset.calidad,
        categoria: btn.dataset.categoria || btn.getAttribute("data-categoria") || btn.getAttribute("data-Categoría"),
        precio: btn.dataset.precio,
        existencias: btn.dataset.existencias,
        fecha: btn.dataset.fecha,
        descripcion: btn.dataset.descripcion || btn.getAttribute("data-descripcion") || btn.getAttribute("data-descripción"),
      };
      irAlFormularioProducto({
        focus: true,
        onReady: () => prefillFormularioProducto(data),
      });
    });
  });

  if (btnCancelarTabla) {
    btnCancelarTabla.addEventListener('click', () => {
      limpiarProductoId();
      if (formularioProductos) {
        try {
          formularioProductos.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (_) {
          formularioProductos.scrollIntoView();
        }
      }
    });
  }

  if (btnGuardarTabla && formularioProductos) {
    btnGuardarTabla.addEventListener('click', () => {
      if (typeof formularioProductos.requestSubmit === 'function') {
        formularioProductos.requestSubmit();
      } else if (!formularioProductos.checkValidity || formularioProductos.checkValidity()) {
        formularioProductos.submit();
      } else if (typeof formularioProductos.reportValidity === 'function') {
        formularioProductos.reportValidity();
      }
    });
  }

  if (btnEliminarTabla) {
    btnEliminarTabla.addEventListener('click', async () => {
      if (!hiddenProductoId || !hiddenProductoId.value) {
        alert('No hay producto seleccionado.');
        return;
      }
      if (!confirm('Eliminar producto #' + hiddenProductoId.value + '?')) return;
      btnEliminarTabla.disabled = true;
      try {
        await api(`/api/vendedor/producto/${hiddenProductoId.value}/delete/`, { method: 'DELETE' });
        location.reload();
      } catch (err) {
        console.error(err);
        alert('No se pudo eliminar el producto.');
      } finally {
        btnEliminarTabla.disabled = false;
      }
    });
  }

  const setText = (sel, txt) => {
  // Selector de imagen personalizado
  const inputImagen = document.getElementById('imagen');
  const btnSelImg = document.getElementById('btnSeleccionarImagen');
  const lblFile = document.getElementById('fileNombre');
  if (btnSelImg && inputImagen) {
    btnSelImg.addEventListener('click', () => inputImagen.click());
    inputImagen.addEventListener('change', () => {
      const nombre = inputImagen.files && inputImagen.files.length ? inputImagen.files[0].name : 'Ninguna';
      if (lblFile) lblFile.textContent = nombre;
    });
  }
    const el = document.querySelector(sel);
    if (el) el.textContent = txt;
  };

  // ---------- Contenedor centrado ----------
  // Lo insertamos justo despuÃ©s del .kpi-grid de la secciÃ³n #ventas
  const kpiGrid = document.querySelector("#ventas .kpi-grid");
  let chartWrap, chartCanvas;
  if (false && kpiGrid) {
    chartWrap = document.createElement("div");
    chartWrap.id = "trendWrapper";
    Object.assign(chartWrap.style, {
      width: "100%",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      marginTop: "20px",
    });

    const inner = document.createElement("div");
    Object.assign(inner.style, {
      width: "min(95%, 1100px)",     // ancho mÃ¡ximo grande y centrado
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: "14px",
      padding: "16px 14px",
      boxShadow: "0 8px 24px rgba(0,0,0,.25)",
    });

    const title = document.createElement("h3");
    title.textContent = "Ventas Ãºltimos 7 dÃ­as";
    Object.assign(title.style, {
      margin: "0 0 10px 8px",
      color: "#cfe6ff",
      fontWeight: "600",
      letterSpacing: ".2px",
    });

    chartCanvas = document.createElement("canvas");
    chartCanvas.id = "chartTrend";

    inner.appendChild(title);
    inner.appendChild(chartCanvas);
    chartWrap.appendChild(inner);
    // Insertamos despuÃ©s del kpi-grid:
    kpiGrid.insertAdjacentElement("afterend", chartWrap);
  }

  // ---------- Anti-estiramiento ----------
  const pinHeight = (canvas, h = 380) => {
    if (!canvas) return;
    const parent = canvas.parentElement;      // card contenedor
    const wrapper = parent?.parentElement;    // trendWrapper
    // fija altura del canvas
    canvas.style.height = h + "px";
    canvas.style.maxHeight = h + "px";
    canvas.setAttribute("height", h); // importante para Chart.js
    // asegura que el contenedor no colapse ni se estire
    if (parent) parent.style.position = "relative";
    if (wrapper) wrapper.style.alignItems = "center";
  };

  // ---------- GrÃ¡ficos helpers ----------
  let chartTrend;

  const axisCommon = {
    ticks: { color: "#cfe6ff", font: { size: 12 } },
    grid: { color: "rgba(255,255,255,0.06)" },
  };
  const legendCommon = {
    labels: { color: "#cfe6ff", boxWidth: 14, padding: 14 },
    position: "top",
    align: "start",
  };

  // ---------- Cargar datos ----------
  const cargarResumen = async () => {
    try {
      const data = await api("/api/vendedor/resumen/");

      // KPIs
      setText('.kpi-card:nth-of-type(1) .value', `$${Number(data.ventas_hoy || 0).toLocaleString("es-CL")}`);
      setText('.kpi-card:nth-of-type(2) .value', `$${Number(data.ticket_promedio || 0).toLocaleString("es-CL")}`);
      setText('.kpi-card:nth-of-type(3) .value', `${Number(data.tasa_conversion || 0).toLocaleString("es-CL")}%`);

      // GrÃ¡fico tendencia: centrado y grande
      if (chartCanvas) {
        pinHeight(chartCanvas, 420); // <<â€” tamaÃ±o grande que destaca
        if (chartTrend) chartTrend.destroy();
        chartTrend = new Chart(chartCanvas.getContext("2d"), {
          type: "bar",
          data: {
            labels: data.labels || [],
            datasets: [{
              label: "Ventas ($)",
              data: data.data || [],
              backgroundColor: "rgba(59,130,246,.75)",
              borderColor: "rgba(59,130,246,1)",
              borderWidth: 1,
              borderRadius: 8
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,    // respeta la altura que fijamos
            animation: { duration: 300 },
            plugins: {
              legend: legendCommon,
              tooltip: { callbacks: { label: (ctx) => ` $${Number(ctx.parsed.y || 0).toLocaleString("es-CL")}` } }
            },
            scales: {
              x: axisCommon,
              y: { ...axisCommon, beginAtZero: true }
            }
          }
        });
      }

      // const tbody = document.querySelector("#tablaDetalleVendedor tbody");
      // if (tbody && Array.isArray(data.detalle)) { ... }

    } catch (err) {
      console.error(err);
    }
  };

  // ---------- Stock crÃ­tico del vendedor ----------
  const renderStock = () => {
    const tbody = document.querySelector("#tablaStockVendedor tbody");
    if (!tbody) return;
    const resumenCats = document.getElementById('stockResumenCategorias');
    const umbralActual = Number(selectUmbral?.value || 5) || 5;
    const q = (inputBuscar?.value || '').trim().toLowerCase();
    const cat = (selectCategoria?.value || '').trim().toLowerCase();
    const filtered = stockItems.filter((p) => {
      const n = Number(p.existencias != null ? p.existencias : p.stock);
      if (!Number.isFinite(n) || n > umbralActual) return false;
      const nombre = String(p.nombre || '').toLowerCase();
      const categoria = String(p.categoria || '').toLowerCase();
      if (q && !nombre.includes(q)) return false;
      if (cat && categoria !== cat) return false;
      return true;
    });

    tbody.innerHTML = filtered.length
      ? filtered.map((p) => {
          const exist = p.existencias != null ? p.existencias : (p.stock ?? '');
          const categoria = p.categoria || "-";
          const nombre = p.nombre || "";
          return `
          <tr class="low-stock">
            <td>${p.id}</td>
            <td>${nombre}</td>
            <td>${categoria}</td>
            <td>${exist}</td>
            <td><button class="btn ghost btn-edit-stock" type="button" data-id="${p.id}">Editar</button></td>
          </tr>`;
        }).join("")
      : `<tr><td colspan="5" class="empty-row">Sin productos criticos</td></tr>`;

    if (resumenCats) {
      if (filtered.length) {
        const counts = new Map();
        filtered.forEach((p) => {
          const key = (p.categoria || '-').trim() || '-';
          counts.set(key, (counts.get(key) || 0) + 1);
        });
        resumenCats.innerHTML = Array.from(counts.entries())
          .sort((a, b) => a[0].localeCompare(b[0], 'es'))
          .map(([nombre, total]) => `<span class="badge-cat" title="Criticos en ${nombre}">${nombre}: ${total}</span>`)
          .join("");
      } else {
        resumenCats.innerHTML = '';
      }
    }
  };

const rebuildCategoriasStock = () => {
    if (!selectCategoria) return;
    const cur = selectCategoria.value;
    const set = new Set();
    stockItems.forEach(p => { const c = (p.categoria || '').trim(); if (c) set.add(c); });
    const options = ['<option value="">Todas las categorías</option>']
      .concat([...set].sort().map(c => `<option value="${c}">${c}</option>`))
      .join('');
    selectCategoria.innerHTML = options;
    // preservar selección si sigue existiendo
    if ([...selectCategoria.options].some(o => o.value === cur)) selectCategoria.value = cur; else selectCategoria.value = '';
  };

  const cargarStock = async () => {
    try {
      const data = await api("/api/vendedor/stock/");
      setText('#kpiValorStock', `$${Number(data.valor_total || 0).toLocaleString("es-CL")}`);
      setText('#kpiCriticos', `${Number(data.criticos || 0).toLocaleString("es-CL")}`);
      // No sobrescribir la selección del usuario si ya existe un valor válido
      const umbralDelApi = Number(data.umbral || 0);
      if (selectUmbral && (!selectUmbral.value || selectUmbral.value === '')) {
        if (umbralDelApi > 0) selectUmbral.value = String(umbralDelApi);
      }
      const banner = document.getElementById("alertaCriticosBanner");
      if (banner) {
        const textoBanner = document.getElementById("alertaCriticosTexto");
        const totalCriticos = Number(data.criticos || 0);
        if (data.alerta_reciente && totalCriticos > 0) {
          banner.style.display = "flex";
          if (textoBanner) {
            const descriptor = totalCriticos === 1
              ? "1 producto critico"
              : `${totalCriticos} productos criticos`;
            textoBanner.textContent = `Te enviamos un correo con ${descriptor}. Revisa tu bandeja de entrada o spam.`;
          }
        } else {
          banner.style.display = "none";
        }
      }
      stockItems = Array.isArray(data.items) ? data.items.slice() : [];
      rebuildCategoriasStock();
      renderStock();
    } catch (err) {
      console.error(err);
    }
  };

  window.cargarStockVendedor = cargarStock;

  // ---------- Inicio ----------
  cargarResumen();
  
  // Auto-refresh para reflejar nuevas ventas/stock sin F5
  let timerResumen = null, timerStock = null;
  const startTimers = () => {
    if (!timerResumen) timerResumen = setInterval(() => { if (!document.hidden) cargarResumen(); }, 20000);
    if (!timerStock)   timerStock   = setInterval(() => { if (!document.hidden) cargarStock();   }, 30000);
  };
  const stopTimers = () => { if (timerResumen) { clearInterval(timerResumen); timerResumen=null; } if (timerStock) { clearInterval(timerStock); timerStock=null; } };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { cargarResumen(); cargarStock(); startTimers(); } else { stopTimers(); } });
  startTimers();
  cargarStock();

  // Cambiar umbral: refresca y persiste sin recargar.
  if (selectUmbral) {
    selectUmbral.addEventListener('change', async () => {
      const valor = Number(selectUmbral.value || '5');
      // Si no existe el manejador inline con CSRF oculto, persistimos desde aquí.
      const hasInlineSaver = !!document.querySelector('form[style="display:none"] input[name="csrfmiddlewaretoken"]');
      if (!hasInlineSaver) {
        try {
          await api('/api/vendedor/stock/umbral/', { method: 'POST', body: { umbral: valor } });
        } catch (e) {
          console.error('No se pudo guardar el umbral', e);
        }
      }
      // No recargar aún, re-render local para evitar parpadeos; los cron actualizan desde API
      renderStock();
      // y en segundo plano refrescamos desde API
      cargarStock();
    });
  }

  if (btnRefrescarStock) {
    btnRefrescarStock.addEventListener('click', () => {
      cargarStock();
    });
  }

  // Filtros cliente: busqueda y categoria
  if (inputBuscar) inputBuscar.addEventListener('input', renderStock);
  if (selectCategoria) selectCategoria.addEventListener('change', renderStock);

  // Copiar lista crítica de visibles
  if (btnCopiarCrit) {
    btnCopiarCrit.addEventListener('click', async () => {
      const tbody = document.querySelector('#tablaStockVendedor tbody');
      if (!tbody) return;
      const lines = [];
      tbody.querySelectorAll('tr').forEach((tr) => {
        if (tr.classList.contains('empty-row')) return;
        const id = (tr.querySelector('td:nth-child(1)')?.textContent || '').trim();
        const nombre = (tr.querySelector('td:nth-child(2)')?.textContent || '').trim();
        const cat = (tr.querySelector('td:nth-child(3)')?.textContent || '').trim();
        const st = (tr.querySelector('td:nth-child(4)')?.textContent || '').trim();
        if (!id) return;
        lines.push(`#${id} - ${nombre} (cat: ${cat || '-'}, stock: ${st || '0'})`);
      });
      const text = lines.join('\n');
      try { await navigator.clipboard.writeText(text); alert('Lista copiada al portapapeles'); } catch (_) { console.log(text); alert('Copia manual: ver consola'); }
    });
  }
  const inputExcel = document.getElementById('excelProductos');
  const btnImportExcel = document.getElementById('btnImportExcel');
  if (btnImportExcel && inputExcel){
    async function doImport(){
      if(!inputExcel.files || !inputExcel.files[0]){ return; }
      const file = inputExcel.files[0];
      const isXlsx = /\.xlsx$/i.test(file.name);
      const fd=new FormData(); fd.append('file', file);
      const url = isXlsx ? '/api/vendedor/importar_excel/' : '/api/vendedor/importar/';
      try{
        const r=await fetch(url, { method:'POST', body: fd, credentials:'same-origin' });
        const j=await r.json();
        if(j.ok){ alert('Importados: '+j.creados); location.reload(); } else { alert('No se pudo importar'); }
      }catch(e){ console.error(e); alert('No se pudo importar'); }
    }
    btnImportExcel.addEventListener('click', ()=>{ inputExcel.value=''; inputExcel.click(); });
    inputExcel.addEventListener('change', doImport);
  }

  // Editar desde tabla de stock crÃ­tico: abre secciÃ³n Productos con el formulario precargado
  const tablaStock = document.getElementById('tablaStockVendedor');
  if (tablaStock) {
    tablaStock.addEventListener('click', async (e) => {
      const btn = e.target.closest('.btn-edit-stock');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      try {
        const detalle = await api(`/api/vendedor/producto/${id}/`);
        irAlFormularioProducto({
          focus: true,
          onReady: () => prefillFormularioProducto({
            id: detalle.id,
            nombre: detalle.nombre,
            marca: detalle.marca,
            calidad: detalle.calidad,
            categoria: detalle.categoria,
            precio: detalle.precio,
            existencias: detalle.existencias,
            fecha: detalle.fecha,
            descripcion: detalle.descripcion,
          })
        });
      } catch (err) {
        console.error(err);
      }
    });
  }
});


