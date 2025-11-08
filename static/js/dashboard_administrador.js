// static/js/dashboard_administrador.js
// Página principal para el panel del administrador (vendedores, usuarios, stock, postulaciones)

window.__dashboardAdminEnhanced = true;
window.__dashboardAdminEnhancedReady = false;

document.addEventListener('DOMContentLoaded', () => {
  /* ----------------------- helpers ----------------------- */
  const getCookie = (name) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
    return null;
  };

  const csrftoken = getCookie('csrftoken');

  const api = async (url, { method = 'GET', body = null, form = null } = {}) => {
    const opts = { method, headers: { 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'same-origin' };
    if (method !== 'GET') {
      if (form instanceof FormData) {
        if (csrftoken) opts.headers['X-CSRFToken'] = csrftoken;
        opts.body = form;
      } else {
        opts.headers['Content-Type'] = 'application/json';
        if (csrftoken) opts.headers['X-CSRFToken'] = csrftoken;
        if (body !== null) opts.body = JSON.stringify(body);
      }
    }
    const resp = await fetch(url, opts);
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`HTTP ${resp.status} - ${url}\n${text}`);
    }
    const ct = resp.headers.get('content-type') || '';
    return ct.includes('application/json') ? resp.json() : resp.text();
  };

  const sanitize = (value) => (value ?? '').toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const toastEl = document.getElementById('toast');
  const showToast = (message, kind = 'info') => {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.className = `toast show ${kind}`;
    setTimeout(() => toastEl.classList.remove('show'), 2600);
  };

  const dispatchDataChanged = () => window.dispatchEvent(new CustomEvent('admin:data-changed'));

  const currencyFormatter = (() => {
    try {
      return new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        maximumFractionDigits: 0,
      });
    } catch (_) {
      return null;
    }
  })();

  const formatCurrency = (value) => {
    const numeric = Number(value || 0);
    if (Number.isNaN(numeric)) return '$0';
    if (currencyFormatter) return currencyFormatter.format(numeric);
    return `$${numeric.toFixed(0)}`;
  };

  const setStateRow = (tbody, cols, label) => {
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="${cols}" class="empty-row">${label}</td></tr>`;
  };

  /* ----------------------- DOM refs ----------------------- */
  const vendBuscar = document.getElementById('vend_buscar');
  const vendEstado = document.getElementById('vend_estado');
  const vendBtnAgregar = document.getElementById('vend_btnAgregar');
  const tablaVendedores = document.getElementById('tablaVendedores');
  const vendBody = tablaVendedores ? tablaVendedores.querySelector('tbody') : null;

  const usrBuscar = document.getElementById('usr_buscar');
  const usrRol = document.getElementById('usr_rol');
  const usrEstado = document.getElementById('usr_estado');
  const usrBtnAgregar = document.getElementById('usr_btnAgregar');
  const tablaUsuarios = document.getElementById('tablaUsuarios');
  const usrBody = tablaUsuarios ? tablaUsuarios.querySelector('tbody') : null;
  
  // ===== Estado en tiempo real (Usuarios) =====
  const USUARIOS_REALTIME_WINDOW = 180; // segundos para considerar "activo"
  const USUARIOS_REALTIME_INTERVAL = 15000; // ms entre sondeos
  let usuariosRealtimeTimer = null;

  const getUsuariosOnline = async () => {
    const data = await api(`/api/admin/usuarios-online/?window=${USUARIOS_REALTIME_WINDOW}`);
    const ids = Array.isArray(data.active_ids) ? data.active_ids : [];
    return new Set(ids.map(Number));
  };

  // Validaciones basicas (cliente) similares al registro
  const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((e || '').trim());
  const isStrongPassword = (p) => {
    if (!p || p.length < 8) return false;
    const hasUpper = /[A-Z]/.test(p);
    const hasLower = /[a-z]/.test(p);
    const hasDigit = /\d/.test(p);
    const hasSymbol = /[^A-Za-z0-9]/.test(p);
    return hasUpper && hasLower && hasDigit && hasSymbol;
  };

  const applyUsuariosRealtime = (onlineSet) => {
    if (onlineSet instanceof Set) lastUsuariosOnlineSet = onlineSet;
    usrBody?.querySelectorAll('tr[data-id]')?.forEach((row) => {
      const badge = row.querySelector('.status-badge');
      if (!badge) return;
      const disabled = row.dataset.disabled === '1';
      const online = !disabled && onlineSet.has(Number(row.dataset.id));
      const label = disabled ? 'Suspendido' : (online ? 'Activo' : 'Inactivo');
      badge.textContent = label;
      badge.classList.toggle('online', online && !disabled);
      badge.classList.toggle('offline', !online || disabled);
      badge.classList.toggle('suspended', disabled);
    });
    // refresca el gráfico de usuarios según el set
    updateUserEstadoChart(lastUsuariosRows, onlineSet);
  };

  const startUsuariosRealtime = (initialSet) => {
    if (initialSet) applyUsuariosRealtime(initialSet);
    if (usuariosRealtimeTimer) clearInterval(usuariosRealtimeTimer);
    usuariosRealtimeTimer = setInterval(async () => {
      if (document.hidden) return;
      const active = document.getElementById('usuarios_gestion')?.classList.contains('active');
      if (!active) return;
      try {
        const ids = await getUsuariosOnline();
        applyUsuariosRealtime(ids);
      } catch (err) {
        console.error(err);
      }
    }, USUARIOS_REALTIME_INTERVAL);
  };

  const stopUsuariosRealtime = () => {
    if (usuariosRealtimeTimer) {
      clearInterval(usuariosRealtimeTimer);
      usuariosRealtimeTimer = null;
    }
  };

  const stockBuscar = document.getElementById('stock_buscar');
  const stockSelect = document.getElementById('stock_vendedor');
  const stockBtnRecargar = document.getElementById('stock_btnRecargar');
  const tablaStock = document.getElementById('tablaStock');
  const stockBody = tablaStock ? tablaStock.querySelector('tbody') : null;

  const formEditarProducto = document.getElementById('formEditarProductoAdmin');
  const fieldId = document.getElementById('a_id');
  const fieldVendedor = document.getElementById('a_vendedor');
  const fieldNombre = document.getElementById('a_nombre');
  const fieldCategoria = document.getElementById('a_categoria');
  const fieldDescripcion = document.getElementById('a_descripcion');
  const fieldExistencias = document.getElementById('a_existencias');
  const fieldImagen = document.getElementById('a_imagen');
  const fieldImagenPreview = document.getElementById('a_imagen_preview');
  const btnAccCancelar = document.getElementById('btnAccCancelar');
  const btnAccEliminar = document.getElementById('btnAccEliminar');

  const postBuscar = document.getElementById('post_buscar');
  const tablaPost = document.getElementById('tablaPostulaciones');
  const postBody = tablaPost ? tablaPost.querySelector('tbody') : null;
  const btnExportPost = document.getElementById('exportPostExcel');
  const btnExportVentas = document.getElementById('exportVentasExcel');

  const vendorEstadoChartBox = document.getElementById('vendorEstadoChartBox');
  const vendorEstadoPlaceholder = document.getElementById('vendorEstadoPlaceholder');
  const vendorEstadoLegend = document.getElementById('vendorEstadoLegend');
  const vendorEstadoSummary = document.getElementById('vendorEstadoSummary');
  const vendorTopChartBox = document.getElementById('vendorTopChartBox');
  const vendorTopName = document.getElementById('vendorTopName');
  const vendorTopPlaceholder = document.getElementById('vendorTopPlaceholder');
  const chartVendEstadoCtx = document.getElementById('chartVendEstado')?.getContext('2d');
  const chartVendTopCtx = document.getElementById('chartVendTopProductos')?.getContext('2d');
  const userEstadoChartBox = document.getElementById('userEstadoChartBox');
  const userEstadoPlaceholder = document.getElementById('userEstadoPlaceholder');
  const userEstadoLegend = document.getElementById('userEstadoLegend');
  const userEstadoSummary = document.getElementById('userEstadoSummary');
  const ventasUsuariosRangeSel = document.getElementById('selectVentasUsuariosRangeInner');
  const ventasUsuariosTopSel = document.getElementById('selectVentasUsuariosTop');
  const ventasUsuariosPresenceBtn = document.getElementById('toggleVentasUsuariosPresence');
  const ventasUsuariosWindowSel = document.getElementById('selectVentasUsuariosWindow');
  const ventasUsuariosCanvas = document.getElementById('chartVentasUsuarios');
  const ventasUsuariosPlaceholder = document.getElementById('ventasPorUsuarioPlaceholder');
  const ventasUsuariosStats = document.getElementById('ventasPorUsuarioStats');
  const ventasUsuariosCtx = ventasUsuariosCanvas ? ventasUsuariosCanvas.getContext('2d') : null;
  // Asegurar sección de bienvenida para admin
  const ensureBienvenido = () => {
    const nav = document.querySelector('.sidebar nav');
    if (nav && !nav.querySelector('a[data-section="bienvenido"]')) {
      const a = document.createElement('a');
      a.setAttribute('data-section', 'bienvenido');
      a.innerHTML = '<i class="fas fa-handshake"></i> Bienvenido';
      nav.insertBefore(a, nav.firstChild);
    }
    const content = document.querySelector('main.content');
    if (content && !document.getElementById('bienvenido')) {
      const box = document.createElement('section');
      box.id = 'bienvenido';
      box.className = 'section-group';
      box.innerHTML = `
        <h2 class="section-title"><i class="fas fa-user-shield"></i> Hola, <span id="adminWelcomeName">admin</span></h2>
        <div class="kpi-grid">
          <div class="kpi-card">
            <i class="fas fa-user icon-large"></i>
            <div class="data">
              <p class="title">Usuario</p>
              <span class="value" id="adminWelcomeUser">-</span>
            </div>
          </div>
          <div class="kpi-card">
            <i class="fas fa-envelope icon-large"></i>
            <div class="data">
              <p class="title">Email</p>
              <span class="value" id="adminWelcomeEmail">-</span>
            </div>
          </div>
        </div>
        <div class="chart-card">
          <h3 class="card-title">Accesos rápidos</h3>
          <div style="display:flex; gap:12px; flex-wrap:wrap;">
            <a class="btn" href="#" onclick="document.querySelector('.sidebar nav a[data-section=\\'vendedores\\']').click(); return false;"><i class="fas fa-user-tie"></i> Vendedores</a>
            <a class="btn" href="#" onclick="document.querySelector('.sidebar nav a[data-section=\\'usuarios_gestion\\']').click(); return false;"><i class="fas fa-users-cog"></i> Usuarios</a>
            <a class="btn" href="#" onclick="document.querySelector('.sidebar nav a[data-section=\\'stock\\']').click(); return false;"><i class="fas fa-warehouse"></i> Stock</a>
          </div>
        </div>`;
      const firstSection = content.querySelector('.section-group');
      if (firstSection) content.insertBefore(box, firstSection);
      else content.appendChild(box);
    }
  };
  ensureBienvenido();
  let chartUserEstadoCtx = document.getElementById('chartUserEstado')?.getContext('2d');

  // ===== Estado en tiempo real (Vendedores) =====
  const VENDEDORES_REALTIME_INTERVAL = 15000; // ms
  let vendedoresRealtimeTimer = null;

  const applyVendedoresRealtime = (onlineSet) => {
    if (onlineSet instanceof Set) lastVendedoresOnlineSet = onlineSet;
    vendBody?.querySelectorAll('tr[data-id]')?.forEach((row) => {
      const badge = row.querySelector('.status-badge');
      if (!badge) return;
      const disabled = row.dataset.disabled === '1';
      const online = !disabled && onlineSet.has(Number(row.dataset.id));
      const label = disabled ? 'Suspendido' : (online ? 'Activo' : 'Inactivo');
      badge.textContent = label;
      badge.classList.toggle('online', online && !disabled);
      badge.classList.toggle('offline', !online || disabled);
      badge.classList.toggle('suspended', disabled);
    });
    updateVendorEstadoChart(lastVendedoresRows, onlineSet);
  };

  const startVendedoresRealtime = (initialSet) => {
    if (initialSet) applyVendedoresRealtime(initialSet);
    if (vendedoresRealtimeTimer) clearInterval(vendedoresRealtimeTimer);
    vendedoresRealtimeTimer = setInterval(async () => {
      if (document.hidden) return;
      const active = document.getElementById('vendedores')?.classList.contains('active');
      if (!active) return;
      try {
        const ids = await getUsuariosOnline();
        applyVendedoresRealtime(ids);
        try { updateVendorEstadoChart(lastVendedoresRows, ids); } catch(_) { }
      } catch (err) { console.error(err); }
    }, VENDEDORES_REALTIME_INTERVAL);
  };

  const stopVendedoresRealtime = () => {
    if (vendedoresRealtimeTimer) { clearInterval(vendedoresRealtimeTimer); vendedoresRealtimeTimer = null; }
  };

  const modalEditar = document.getElementById('modalEditar');
  const modalAgregar = document.getElementById('modalAgregar');
  const modalAgregarTitle = document.getElementById('modalAgregarTitle');
  const modalAgregarError = document.getElementById('modalAgregarError');
  const editNombre = document.getElementById('editNombre');
  const editEmail = document.getElementById('editEmail');
  const editPass = document.getElementById('editPass');
  const editPass2 = document.getElementById('editPass2');
  const btnGuardarEditar = document.getElementById('guardarEditar');
  const btnEliminarUsuario = document.getElementById('eliminarUsuario');
  const btnCancelarEditar = document.getElementById('cancelarEditar');
  const newNombre = document.getElementById('newNombre');
  const newEmail = document.getElementById('newEmail');
  const newPass = document.getElementById('newPass');
  const newPass2 = document.getElementById('newPass2');
  const btnGuardarNuevo = document.getElementById('guardarNuevo');
  const btnCancelarNuevo = document.getElementById('cancelarNuevo');

  // Ensure the "Agregar vendedor/usuario" modal has its own
  // confirm-password field and a visible password checklist like signup.
  const ensureVendorPasswordUI = () => {
    try {
      const reqId = 'vendPasswordRequirements';
      const matchId = 'vendPasswordMatch';
      // Move misplaced #newPass2 from edit modal into create modal if needed
      if (modalAgregar) {
        const passInput = newPass;
        let confirmInput = document.getElementById('newPass2');
        if (confirmInput && modalEditar && modalEditar.contains(confirmInput) && !modalAgregar.contains(confirmInput)) {
          // Also move its <label> if it precedes the input
          const label = confirmInput.previousElementSibling;
          const actions = modalAgregar.querySelector('.actions');
          const ref = passInput ? passInput.nextElementSibling : null;
          // Insert after password input (and after requirements block if exists)
          const afterNode = modalAgregar.querySelector('#' + reqId) || passInput;
          if (label && label.tagName === 'LABEL') modalAgregar.querySelector('.card').insertBefore(label, actions);
          modalAgregar.querySelector('.card').insertBefore(confirmInput, actions);
          // Create match indicator if missing
          if (!document.getElementById(matchId)) {
            const div = document.createElement('div');
            div.className = 'match-indicator';
            div.id = matchId;
            modalAgregar.querySelector('.card').insertBefore(div, actions);
          }
        }

        // Create password requirements if missing
        if (!document.getElementById(reqId)) {
          const wrap = document.createElement('div');
          wrap.id = reqId;
          wrap.className = 'password-requirements';
          wrap.innerHTML = `
            <p>Tu contraseña debe incluir:</p>
            <ul>
              <li data-req="length"><i class="fa fa-circle"></i> 8 caracteres o más</li>
              <li data-req="upper"><i class="fa fa-circle"></i> 1 letra mayúscula</li>
              <li data-req="lower"><i class="fa fa-circle"></i> 1 letra minúscula</li>
              <li data-req="number"><i class="fa fa-circle"></i> 1 número</li>
              <li data-req="symbol"><i class="fa fa-circle"></i> 1 símbolo (!@#$%^&*)</li>
            </ul>`;
          const actions = modalAgregar.querySelector('.actions');
          modalAgregar.querySelector('.card').insertBefore(wrap, actions);
        }
      }
    } catch (_) {}
  };

  const parseApiMessage = (err, fallback = 'Ocurrió un error') => {
    try {
      const raw = (err && (err.detail || err.message || err.toString())) || '';
      const parts = raw.split('\n');
      let body = (parts.length > 1 ? parts.slice(1).join('\n') : parts[0]).trim();
      if (body.startsWith('{')) {
        try {
          const j = JSON.parse(body);
          body = (j.error || j.detail || body);
        } catch (_) {}
      }
      return body || fallback;
    } catch (_) {
      return fallback;
    }
  };

  const showApiError = (err, fallback = 'Ocurrió un error') => {
    const message = parseApiMessage(err, fallback);
    showToast(message, 'error');
    return message;
  };

  const updateKnownUsers = (list = []) => {
    try {
      list.forEach((user) => {
        if (user && typeof user.id !== 'undefined') {
          knownUsers.set(Number(user.id), user);
        }
      });
    } catch (_) {}
  };

  const normalizeValue = (value) => (value || '').trim().toLowerCase();
  const usernameExists = (value) => {
    const target = normalizeValue(value);
    if (!target) return false;
    for (const user of knownUsers.values()) {
      if (normalizeValue(user.username) === target) return true;
    }
    return false;
  };
  const emailExists = (value) => {
    const target = normalizeValue(value);
    if (!target) return false;
    for (const user of knownUsers.values()) {
      if (normalizeValue(user.email) === target && target) return true;
    }
    return false;
  };

  // Live checklist + match indicator for create modal
  let passReqEl = document.getElementById('vendPasswordRequirements');
  let passMatchEl = document.getElementById('vendPasswordMatch');
  const updateReqUI = (value) => {
    const checks = {
      length: (v) => (v || '').length >= 8,
      upper: (v) => /[A-Z]/.test(v || ''),
      lower: (v) => /[a-z]/.test(v || ''),
      number: (v) => /\d/.test(v || ''),
      symbol: (v) => /[^A-Za-z0-9]/.test(v || ''),
    };
    if (!passReqEl) return;
    Object.keys(checks).forEach((k) => {
      const li = passReqEl.querySelector(`[data-req="${k}"]`);
      if (!li) return;
      const ok = checks[k](value);
      li.classList.toggle('requirement--met', !!ok);
      const icon = li.querySelector('i');
      if (icon) icon.className = ok ? 'fa fa-check-circle' : 'fa fa-circle';
    });
  };
  const updateMatchUI = () => {
    if (!(passMatchEl && newPass && newPass2)) return;
    if (!newPass2.value) {
      passMatchEl.textContent = '';
      passMatchEl.className = 'match-indicator';
      return;
    }
    const same = newPass.value && newPass.value === newPass2.value;
    passMatchEl.textContent = same ? 'Las contraseñas coinciden.' : 'Las contraseñas no coinciden.';
    passMatchEl.className = same ? 'match-indicator match-indicator--ok' : 'match-indicator match-indicator--error';
  };

  let editingId = null;
  let editingIsVendor = false;
  let createMode = 'user';

    let chartVendEstado = null;
  let chartVendTop = null;
  let vendTopReq = 0;
  let chartUserEstado = null;
  let lastUsuariosRows = [];
  let lastUsuariosOnlineSet = new Set();
  let lastVendedoresRows = [];
  let lastVendedoresOnlineSet = new Set();
  const knownUsers = new Map();
  let chartVentasUsuarios = null;
  let ventasUsuariosReq = 0;
  let ventasUsuariosTimer = null;
  let lastVU = { labels: [], values: [] };

  const vendorChartLabels = ['Activos', 'Inactivos', 'Suspendidos'];
  const vendorChartColors = ['#37d67a', '#ff5a5f', '#ffb347'];
  const vendorLegendMap = [
    { key: 'activos', label: 'Activos', color: '#37d67a' },
    { key: 'inactivos', label: 'Inactivos', color: '#ff5a5f' },
    { key: 'suspendidos', label: 'Suspendidos', color: '#ffb347' },
  ];

  const ensureVendorChartPlaceholder = () => {
    if (!vendorEstadoChartBox) return null;
    const wrap = vendorEstadoChartBox.querySelector('.chart-box__canvas') || vendorEstadoChartBox;
    let placeholder = wrap.querySelector('.chart-placeholder');
    if (!placeholder) {
      placeholder = document.createElement('p');
      placeholder.className = 'chart-placeholder';
      placeholder.textContent = 'Sin datos disponibles.';
      wrap.appendChild(placeholder);
    }
    return placeholder;
  };

  const renderVendorLegend = (counts, total) => {
    if (!vendorEstadoLegend) return;
    const safeTotal = total || 0;
    vendorEstadoLegend.innerHTML = vendorLegendMap.map((item) => {
      const value = Number(counts[item.key] || 0);
      const pct = safeTotal ? Math.round((value / safeTotal) * 100) : 0;
      const pctText = safeTotal ? ` (${pct}%)` : '';
      return `
        <span class="legend-item">
          <span class="legend-dot" style="background:${item.color};"></span>
          ${item.label}: ${value}${pctText}
        </span>
      `;
    }).join('');
  };

  const computeVendorStatusCounts = (rows = [], onlineSet = new Set()) => {
    const counts = { activos: 0, inactivos: 0, suspendidos: 0 };
    if (!Array.isArray(rows)) return counts;
    rows.forEach((user) => {
      if (!user || typeof user !== 'object') return;
      if (!user.is_active) {
        counts.suspendidos += 1;
        return;
      }
      if (onlineSet && onlineSet.has(user.id)) counts.activos += 1;
      else counts.inactivos += 1;
    });
    return counts;
  };

  const updateVendorEstadoChart = (rows = [], onlineSet = new Set()) => {
    if (!chartVendEstadoCtx) return;
    try {
      const counts = computeVendorStatusCounts(rows, onlineSet);
      const total = counts.activos + counts.inactivos + counts.suspendidos;
      const placeholder = ensureVendorChartPlaceholder();
      if (!total) {
        if (placeholder) {
          placeholder.style.display = 'flex';
          placeholder.textContent = 'Sin datos para mostrar.';
        }
        if (vendorEstadoLegend) vendorEstadoLegend.innerHTML = '';
        if (vendorEstadoSummary) vendorEstadoSummary.textContent = '';
        if (chartVendEstado) { chartVendEstado.destroy?.(); chartVendEstado = null; }
        return;
      }
      if (placeholder) placeholder.style.display = 'none';
      if (vendorEstadoSummary) vendorEstadoSummary.textContent = `Total: ${total}`;
      renderVendorLegend(counts, total);
      const dataset = [counts.activos, counts.inactivos, counts.suspendidos];
      if (!chartVendEstado) {
        chartVendEstado = new Chart(chartVendEstadoCtx, {
          type: 'doughnut',
          data: {
            labels: vendorChartLabels,
            datasets: [{
              data: dataset,
              backgroundColor: vendorChartColors,
              borderWidth: 0,
              hoverOffset: 0,
              hoverBorderWidth: 0,
              spacing: 2,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '62%',
            animation: { duration: 300 },
            plugins: {
              legend: { position: 'bottom', labels: { color: '#cfe6ff' } },
              tooltip: {
                callbacks: {
                  label: (ctx) => `${ctx.label}: ${Number(ctx.parsed || 0)}`,
                },
              },
            },
          },
        });
        return;
      }
      chartVendEstado.data.datasets[0].data = dataset;
      chartVendEstado.update('none');
    } catch (err) { console.error('Error actualizando grafico vendedores:', err); }
  };

  const userChartLabels = ['Activos', 'Inactivos', 'Suspendidos'];
  const userChartColors = ['#37d67a', '#ff5a5f', '#ffb347'];
  const userLegendMap = [
    { key: 'activos', label: 'Activos', color: '#37d67a' },
    { key: 'inactivos', label: 'Inactivos', color: '#ff5a5f' },
    { key: 'suspendidos', label: 'Suspendidos', color: '#ffb347' },
  ];

  const renderUserLegend = (counts, total) => {
    if (!userEstadoLegend) return;
    const safeTotal = total || 0;
    userEstadoLegend.innerHTML = userLegendMap.map((item) => {
      const value = Number(counts[item.key] || 0);
      const pct = safeTotal ? Math.round((value / safeTotal) * 100) : 0;
      const pctText = safeTotal ? ` (${pct}%)` : '';
      return `
        <span class="legend-item">
          <span class="legend-dot" style="background:${item.color};"></span>
          ${item.label}: ${value}${pctText}
        </span>
      `;
    }).join('');
  };

  const ensureUserPlaceholder = () => {
    if (!userEstadoChartBox) return null;
    const wrap = userEstadoChartBox.querySelector('.chart-box__canvas') || userEstadoChartBox;
    let placeholder = wrap.querySelector('.chart-placeholder');
    if (!placeholder) {
      placeholder = document.createElement('p');
      placeholder.className = 'chart-placeholder';
      placeholder.textContent = 'Sin datos para mostrar.';
      wrap.appendChild(placeholder);
    }
    return placeholder;
  };

  const computeUserStatusCounts = (rows = [], onlineSet = new Set()) => {
    const counts = { activos: 0, inactivos: 0, suspendidos: 0 };
    if (!Array.isArray(rows)) return counts;
    rows.forEach((user) => {
      if (!user || typeof user !== 'object') return;
      if (!user.is_active) {
        counts.suspendidos += 1;
        return;
      }
      if (onlineSet && onlineSet.has(user.id)) counts.activos += 1;
      else counts.inactivos += 1;
    });
    return counts;
  };

  const updateUserEstadoChart = (rows = null, onlineSet = null) => {
    if (!userEstadoChartBox) return;
    if (!chartUserEstadoCtx) {
      const canvas = document.getElementById('chartUserEstado');
      chartUserEstadoCtx = canvas ? canvas.getContext('2d') : null;
    }
    if (!chartUserEstadoCtx) return;
    try {
      const dataRows = Array.isArray(rows) ? rows : (Array.isArray(lastUsuariosRows) ? lastUsuariosRows : []);
      const presenceSet = (onlineSet instanceof Set) ? onlineSet : lastUsuariosOnlineSet;
      const counts = computeUserStatusCounts(dataRows, presenceSet);
      const total = counts.activos + counts.inactivos + counts.suspendidos;
      const placeholder = ensureUserPlaceholder();
      if (!total) {
        if (placeholder) {
          placeholder.style.display = 'flex';
          placeholder.textContent = 'Sin datos para mostrar.';
        }
        if (userEstadoChartBox) userEstadoChartBox.style.display = 'none';
        if (userEstadoLegend) userEstadoLegend.innerHTML = '';
        if (userEstadoSummary) userEstadoSummary.textContent = '';
        chartUserEstado = destroyChart(chartUserEstado);
        return;
      }
      if (placeholder) placeholder.style.display = 'none';
      userEstadoChartBox.style.display = '';
      if (userEstadoSummary) userEstadoSummary.textContent = `Total: ${total}`;
      renderUserLegend(counts, total);
      const dataset = [counts.activos, counts.inactivos, counts.suspendidos];
      if (!chartUserEstado) {
        chartUserEstado = new Chart(chartUserEstadoCtx, {
          type: 'doughnut',
          data: {
            labels: userChartLabels,
            datasets: [{
              data: dataset,
              backgroundColor: userChartColors,
              borderWidth: 0,
              hoverOffset: 0,
              hoverBorderWidth: 0,
              spacing: 2,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '62%',
            animation: { duration: 300 },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) => `${ctx.label}: ${Number(ctx.parsed || 0)}`,
                },
              },
            },
          },
        });
        return;
      }
      chartUserEstado.data.datasets[0].data = dataset;
      chartUserEstado.update('none');
    } catch (err) { console.error('Error actualizando grafico usuarios:', err); }
  };
  const showModal = (el) => {
    if (!el) return;
    el.removeAttribute('hidden');
    el.style.display = 'flex';
  };
  const hideModal = (el) => {
    if (!el) return;
    el.style.display = 'none';
    el.setAttribute('hidden', 'hidden');
  };
  // Asegura que los modales inicien ocultos aunque falle el CSS
  hideModal(modalEditar);
  hideModal(modalAgregar);

  /* ----------------------- renderers ----------------------- */
  const renderVendedores = (rows, onlineSet = new Set()) => {
    if (!vendBody) return;
    if (!rows.length) {
      setStateRow(vendBody, 7, 'Sin vendedores');
      return;
    }
    vendBody.innerHTML = rows.map((u) => {
      const hash = sanitize(u.password_hash || '');
      const hasHash = hash && hash !== '****';
      const disabled = !u.is_active;
      const online = !disabled && onlineSet.has(u.id);
      const badgeClass = `status-badge ${disabled ? 'suspended offline' : (online ? 'online' : 'offline')}`;
      const label = disabled ? 'Suspendido' : (online ? 'Activo' : 'Inactivo');
      return `
        <tr data-id="${u.id}" data-username="${sanitize(u.username)}" data-email="${sanitize(u.email || '')}" data-vendedor-id="${sanitize(u.vendedor_id || '')}" data-vendor="1" data-disabled="${disabled ? '1' : '0'}">
          <td>${u.id}</td>
          <td>${sanitize(u.username)}</td>
          <td>${sanitize(u.email || '')}</td>
          <td>${sanitize(u.date_joined || '')}</td>
          <td>
            <span class="pwd-mask" data-hash="${hash}" data-visible="0">${hasHash ? '****' : hash || '****'}</span>
            ${hasHash ? '<button class="btn ghost btn-eye" data-action="pwd" title="Mostrar/Ocultar"><i class="fa fa-eye"></i></button>' : ''}
          </td>
          <td><span class="${badgeClass}" aria-live="polite">${label}</span></td>
          <td>
            <div class="state-toggle">
              <button class="state-toggle__btn ${disabled ? '' : 'state-toggle__btn--active'}" data-action="set-active">Activo</button>
              <button class="state-toggle__btn ${disabled ? 'state-toggle__btn--active' : ''}" data-action="set-inactive">Inactivo</button>
            </div>
          </td>
          <td>
            <button class="btn" data-action="edit">Editar</button>
          </td>
        </tr>
      `;
    }).join('');
  };

  const updateCachedUser = (id, patch = {}) => {
    if (!Array.isArray(lastUsuariosRows)) return;
    const idx = lastUsuariosRows.findIndex((u) => Number(u.id) === Number(id));
    if (idx === -1) return;
    lastUsuariosRows[idx] = { ...lastUsuariosRows[idx], ...patch };
  };

  const updateCachedVendor = (id, patch = {}) => {
    if (!Array.isArray(lastVendedoresRows)) return;
    const idx = lastVendedoresRows.findIndex((u) => Number(u.id) === Number(id));
    if (idx === -1) return;
    lastVendedoresRows[idx] = { ...lastVendedoresRows[idx], ...patch };
  };

  const syncStateToggle = (row, isActive) => {
    if (!row) return;
    row.querySelectorAll('.state-toggle__btn').forEach((btn) => {
      if (!btn.dataset.action) return;
      const wantsActive = btn.dataset.action === 'set-active';
      btn.classList.toggle('state-toggle__btn--active', wantsActive === isActive);
    });
  };

  const renderUsuarios = (rows, onlineSet = new Set()) => {
    if (!usrBody) return;
    if (!rows.length) {
      setStateRow(usrBody, 7, 'Sin usuarios');
      return;
    }
    usrBody.innerHTML = rows.map((u) => {
      const disabled = !u.is_active;
      const online = !disabled && onlineSet.has(u.id);
      const badgeClass = `status-badge ${disabled ? 'suspended offline' : (online ? 'online' : 'offline')}`;
      const label = disabled ? 'Suspendido' : (online ? 'Activo' : 'Inactivo');
      return `
        <tr data-id="${u.id}" data-username="${sanitize(u.username)}" data-email="${sanitize(u.email || '')}" data-vendor="${u.es_vendedor ? '1' : '0'}" data-admin="${u.es_admin ? '1' : '0'}" data-self="${u.is_self ? '1' : '0'}" data-disabled="${disabled ? '1' : '0'}">
          <td>${u.id}</td>
          <td>${sanitize(u.username)}</td>
          <td>${sanitize(u.email || '')}</td>
          <td>${sanitize(u.role || (u.es_vendedor ? 'Vendedor' : 'Usuario'))}</td>
          <td><span class="${badgeClass}" aria-live="polite">${label}</span></td>
          <td>
            <div class="state-toggle">
              <button class="state-toggle__btn ${disabled ? '' : 'state-toggle__btn--active'}" data-action="set-active">Activo</button>
              <button class="state-toggle__btn ${disabled ? 'state-toggle__btn--active' : ''}" data-action="set-inactive">Inactivo</button>
            </div>
          </td>
          <td>${sanitize(u.last_login || '-')}</td>
          <td>
            <button class="btn" data-action="edit">Editar</button>
          </td>
        </tr>
      `;
    }).join('');
  };

  const clearFormProducto = () => {
    formEditarProducto?.reset();
    if (fieldId) fieldId.value = '';
    if (fieldVendedor) fieldVendedor.value = '';
    if (fieldImagen) fieldImagen.value = '';
    if (fieldImagenPreview) {
      fieldImagenPreview.removeAttribute('src');
      fieldImagenPreview.style.display = 'none';
    }
  };

  const renderStock = (rows) => {
    if (!stockBody) return;
    if (!rows.length) {
      setStateRow(stockBody, 8, 'Sin productos');
      return;
    }
    stockBody.innerHTML = rows.map((p) => `
      <tr data-id="${p.id}" class="clickable ${p.critico ? 'low-stock' : ''}">
        <td>${p.id}</td>
        <td>${sanitize(p.vendedor || 'N/D')}</td>
        <td>${sanitize(p.nombre || '')}</td>
        <td>${sanitize(p.tipo || p.categoria || '-')}</td>
        <td>${p.imagen ? `<img src="${p.imagen}" alt="${sanitize(p.nombre || '')}" style="width:50px;height:50px;object-fit:cover;border-radius:6px">` : '<span style="color:#99aab5">Sin imagen</span>'}</td>
        <td>${sanitize((p.descripcion || '').slice(0, 80))}${(p.descripcion || '').length > 80 ? '...' : ''}</td>
        <td>${p.existencias ?? p.stock ?? 0}</td>
        <td>${p.critico ? 'Sí' : 'No'}</td>
      </tr>
    `).join('');
  };

  const renderPostulaciones = (rows) => {
    if (!postBody) return;
    if (!rows.length) {
      setStateRow(postBody, 11, 'Sin postulaciones');
      return;
    }
    postBody.innerHTML = rows.map((p) => `
      <tr data-id="${p.id}" data-notas="${sanitize(p.notas || '')}">
        <td>${p.id}</td>
        <td>${sanitize(p.nombre || '')}</td>
        <td>${sanitize(p.email || '')}</td>
        <td>${sanitize(p.telefono || '')}</td>
        <td>${sanitize(p.tienda || '')}</td>
        <td>${sanitize(p.instagram || '')}</td>
        <td>${sanitize(p.mensaje || '')}</td>
        <td>${sanitize(p.notas || '')}</td>
        <td>${sanitize(p.fecha_envio || p.fecha || '')}</td>
        <td>${sanitize(p.estado || '')}</td>
        <td class="acciones">
          <button class="btn ghost" data-action="estado" data-estado="contactado">Contactado</button>
          <button class="btn ghost" data-action="estado" data-estado="archivado">Archivar</button>
          <button class="btn" data-action="notas">Notas</button>
        </td>
      </tr>
    `).join('');
  };

  const updateUserRowState = (row, isActive) => {
    if (!row) return;
    row.dataset.active = isActive ? '1' : '0';
    const stateCell = row.querySelector('td:nth-child(5)');
    if (stateCell) {
      stateCell.textContent = isActive ? 'Activo' : 'Inactivo';
    }
    const toggleBtn = row.querySelector('button[data-action="toggle"]');
    if (toggleBtn) {
      toggleBtn.classList.toggle('danger', isActive);
      toggleBtn.classList.toggle('success', !isActive);
      toggleBtn.textContent = isActive ? 'Desactivar' : 'Activar';
    }
  };

  /* ----------------------- charts helpers ----------------------- */
  const destroyChart = (chart) => {
    if (chart && typeof chart.destroy === 'function') {
      chart.destroy();
    }
    return null;
  };

  const showVendorEstadoChart = () => {
    if (vendorEstadoChartBox) vendorEstadoChartBox.style.display = '';
  };

  const hideVendorEstadoChart = () => {
    if (vendorEstadoChartBox) vendorEstadoChartBox.style.display = 'none';
  };

  const hideVendorTopChart = () => {
    if (vendorTopChartBox) vendorTopChartBox.style.display = 'none';
    if (vendorTopPlaceholder) {
      vendorTopPlaceholder.style.display = 'block';
      vendorTopPlaceholder.textContent = 'Busca un vendedor para ver sus productos destacados.';
    }
    chartVendTop = destroyChart(chartVendTop);
  };

  const showVendorTopMessage = (message) => {
    if (vendorTopChartBox) vendorTopChartBox.style.display = 'block';
    chartVendTop = destroyChart(chartVendTop);
    if (vendorTopPlaceholder) {
      vendorTopPlaceholder.textContent = message;
      vendorTopPlaceholder.style.display = 'block';
    }
  };
  const renderVendorTopChart = async (vendor) => {
    if (!chartVendTopCtx || !vendor || !vendor.vendedor_id) return;
    const requestId = ++vendTopReq;
    showVendorTopMessage('Cargando datos...');
    try {
      const url = `/api/admin/top-productos-linea/?days=90&top_n=3&vendedor_id=${encodeURIComponent(vendor.vendedor_id)}`;
      const data = await api(url);
      if (requestId !== vendTopReq) return;
      const datasets = Array.isArray(data.datasets) ? data.datasets : [];
      if (!datasets.length) {
        showVendorTopMessage('Este vendedor no registra ventas en el periodo consultado.');
        return;
      }
      const labels = datasets.map((d, i) => d.label || `Producto ${i + 1}`);
      const totals = datasets.map((d) => (Array.isArray(d.data) ? d.data.reduce((acc, val) => acc + Number(val || 0), 0) : 0));
      chartVendTop = destroyChart(chartVendTop);
      chartVendTop = new Chart(chartVendTopCtx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Total vendido',
            data: totals,
            backgroundColor: ['#37d67a', '#4dc9f6', '#f67019'],
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => ` $ ${Number(ctx.parsed.y || 0).toFixed(2)}`,
              },
            },
          },
          scales: {
            x: { ticks: { color: '#cfe6ff' } },
            y: {
              ticks: { color: '#cfe6ff' },
              beginAtZero: true,
            },
          },
        },
      });
      if (vendorTopPlaceholder) vendorTopPlaceholder.style.display = 'none';
    } catch (err) {
      if (requestId !== vendTopReq) return;
      console.error('Error cargando top productos por vendedor:', err);
      showVendorTopMessage('No se pudo cargar la informacion de ventas.');
    }
  };

  const refreshVendorCharts = (rows, onlineSet = new Set()) => {
    updateVendorEstadoChart(rows, onlineSet);
    const query = (vendBuscar?.value || '').trim();
    if (!query) {
      showVendorEstadoChart();
      hideVendorTopChart();
      return;
    }
    hideVendorEstadoChart();
    if (!vendorTopChartBox || !vendorTopName || !chartVendTopCtx) return;
    if (!Array.isArray(rows) || !rows.length) {
      vendorTopName.textContent = query;
      showVendorTopMessage('Sin coincidencias para mostrar.');
      return;
    }
    const normalized = query.toLowerCase();
    let selected = rows.find((u) => (u.username || '').toLowerCase() === normalized);
    if (!selected) {
      selected = rows.find((u) => (u.username || '').toLowerCase().includes(normalized));
    }
    if (!selected) {
      selected = rows[0];
    }
    vendorTopName.textContent = selected.username || query;
    if (!selected.vendedor_id) {
      showVendorTopMessage('Este usuario no tiene perfil de vendedor asociado.');
      return;
    }
    if (vendorTopChartBox) vendorTopChartBox.style.display = 'block';
    renderVendorTopChart(selected);
  };

  /* ----------------------- loaders ----------------------- */
  async function loadVendedores() {
    if (!vendBody) return;
    setStateRow(vendBody, 7, 'Cargando vendedores...');
    try {
      const q = (vendBuscar?.value || '').trim();
      const estado = vendEstado?.value || 'todos';
      const estadoQuery = (estado === 'suspendido') ? 'inactivo' : 'todos';
      const url = `/api/admin/vendedores/?estado=${encodeURIComponent(estadoQuery)}&q=${encodeURIComponent(q)}`;
      const data = await api(url);
      const rawItems = Array.isArray(data.items) ? data.items : [];
      updateKnownUsers(rawItems);
      let items = rawItems.filter((u) => u.es_vendedor || u.role === 'Vendedor' || u.vendedor_id);
      const onlineSet = await getUsuariosOnline();
      lastVendedoresOnlineSet = onlineSet;
      lastUsuariosOnlineSet = onlineSet;
      if (estado === 'activo') {
        items = items.filter((u) => u.is_active && onlineSet.has(u.id));
      } else if (estado === 'inactivo') {
        items = items.filter((u) => u.is_active && !onlineSet.has(u.id));
      } else if (estado === 'suspendido') {
        items = items.filter((u) => !u.is_active);
      }
      lastVendedoresRows = items;
      renderVendedores(items, onlineSet);
      startVendedoresRealtime(onlineSet);
      refreshVendorCharts(items, onlineSet);
    } catch (err) {
      console.error(err);
      showToast('No se pudo cargar vendedores', 'error');
      setStateRow(vendBody, 7, 'Error al cargar');
      const query = (vendBuscar?.value || '').trim();
      if (!query) {
        showVendorEstadoChart();
        hideVendorTopChart();
      } else {
        hideVendorEstadoChart();
        if (vendorTopName) vendorTopName.textContent = query;
        showVendorTopMessage('No se pudo cargar la información de ventas.');
      }
    }
  }

  const ventasUsuariosPresenceActive = () => (ventasUsuariosPresenceBtn?.getAttribute('data-active') === '1');

  const updateVentasUsuariosPresenceUI = () => {
    if (!ventasUsuariosPresenceBtn) return;
    const active = ventasUsuariosPresenceActive();
    ventasUsuariosPresenceBtn.setAttribute('data-active', active ? '1' : '0');
    ventasUsuariosPresenceBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
    const label = ventasUsuariosPresenceBtn.querySelector('.chart-toggle__label');
    const windowVal = ventasUsuariosWindowSel?.value || '180';
    if (label) label.textContent = active ? `Presencia (${windowVal}s)` : 'Sin presencia';
    if (ventasUsuariosWindowSel) ventasUsuariosWindowSel.disabled = !active;
  };

  const showVentasUsuariosPlaceholder = (text) => {
    if (ventasUsuariosPlaceholder) {
      ventasUsuariosPlaceholder.textContent = text || 'Sin datos.';
      ventasUsuariosPlaceholder.style.display = 'flex';
    }
    if (ventasUsuariosCanvas) ventasUsuariosCanvas.style.visibility = 'hidden';
    if (ventasUsuariosStats) {
      ventasUsuariosStats.innerHTML = '';
      ventasUsuariosStats.style.display = 'none';
    }
  };

  const hideVentasUsuariosPlaceholder = () => {
    if (ventasUsuariosPlaceholder) ventasUsuariosPlaceholder.style.display = 'none';
    if (ventasUsuariosCanvas) ventasUsuariosCanvas.style.visibility = 'visible';
  };

  const roleLabels = {
    usuarios: 'Usuarios',
    vendedores: 'Vendedores',
    administradores: 'Administradores',
  };

  const renderVentasUsuariosStats = (counts = {}, presenceOn = false) => {
    if (!ventasUsuariosStats) return;
    const entries = Object.entries(counts);
    if (!entries.length) {
      ventasUsuariosStats.innerHTML = '';
      ventasUsuariosStats.style.display = 'none';
      return;
    }
    ventasUsuariosStats.style.display = 'flex';
    const currentWindow = parseInt(ventasUsuariosWindowSel?.value || '180', 10) || 180;
    const currentRange = parseInt(ventasUsuariosRangeSel?.value || '30', 10) || 30;
    const hint = presenceOn
      ? `Basado en presencia dentro de ${currentWindow} segundos.`
      : `Basado en último acceso dentro de los últimos ${currentRange} días.`;
    const cards = entries.map(([key, data]) => {
      const label = roleLabels[key] || key;
      const activos = Number(data?.activos || 0);
      const inactivos = Number(data?.inactivos || 0);
      const suspendidos = Number(data?.suspendidos || 0);
      return `
        <div class="chart-side-card">
          <div class="chart-side-card__title">${label}</div>
          <div class="chart-side-card__metrics">
            <div class="chart-side-card__metric"><strong>Activos</strong>${activos}</div>
            <div class="chart-side-card__metric"><strong>Inactivos</strong>${inactivos}</div>
            <div class="chart-side-card__metric"><strong>Suspendidos</strong>${suspendidos}</div>
          </div>
        </div>
      `;
    }).join('');
    ventasUsuariosStats.innerHTML = `
      ${cards}
      <div class="chart-side-card chart-side-card--hint">
        <div class="chart-side-card__hint">${hint}</div>
      </div>
    `;
  };
  const renderVentasUsuariosChart = (labels, values) => {
    if (!ventasUsuariosCtx) return;
    chartVentasUsuarios = destroyChart(chartVentasUsuarios);
    chartVentasUsuarios = new Chart(ventasUsuariosCtx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Total vendido',
          data: values,
          backgroundColor: 'rgba(77, 201, 246, 0.35)',
          borderColor: '#4dc9f6',
          borderWidth: 1,
          borderRadius: 6,
          maxBarThickness: 20,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 8, right: 12, bottom: 8, left: 8 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${formatCurrency(ctx.parsed.x)}`,
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color: '#9fbad6',
              callback: (value) => formatCurrency(value),
            },
            grid: { color: 'rgba(77, 201, 246, 0.2)' },
          },
          y: {
            ticks: {
              color: '#e0f2ff',
              autoSkip: false,
              font: { size: 11 },
            },
            grid: { color: 'rgba(77, 201, 246, 0.08)' },
          },
        },
      },
    });
  };

  const loadVentasUsuarios = async () => {
    if (!ventasUsuariosCtx) return;
    const days = parseInt(ventasUsuariosRangeSel?.value || '30', 10) || 30;
    const top = parseInt(ventasUsuariosTopSel?.value || '10', 10) || 10;
    const presenceOn = ventasUsuariosPresenceActive();
    const params = new URLSearchParams({
      days: Math.max(1, Math.min(days, 365)),
      top: Math.max(3, Math.min(top, 50)),
    });
    if (presenceOn) {
      const win = parseInt(ventasUsuariosWindowSel?.value || '180', 10) || 180;
      params.set('presence', '1');
      params.set('window', Math.max(30, Math.min(win, 3600)));
    }
    const ticket = ++ventasUsuariosReq;
    showVentasUsuariosPlaceholder('Cargando datos...');
    try {
      const data = await api(`/api/admin/ventas-por-usuario/?${params.toString()}`);
      if (ticket !== ventasUsuariosReq) return;
      const labels = Array.isArray(data?.labels) ? data.labels : [];
      const values = Array.isArray(data?.data) ? data.data.map((n) => Number(n || 0)) : [];
      if (!labels.length || !values.some((n) => n > 0)) {
        // Si no hay datos, conserva el úaltimo gráfico existente; solo muestra placeholder si nunca hubo.
        if (!lastVU.labels.length) {
          chartVentasUsuarios = destroyChart(chartVentasUsuarios);
          showVentasUsuariosPlaceholder('Sin datos en el periodo seleccionado.');
        } else {
          hideVentasUsuariosPlaceholder();
        }
      } else {
        hideVentasUsuariosPlaceholder();
        lastVU = { labels: labels.slice(0), values: values.slice(0) };
        renderVentasUsuariosChart(labels, values);
      }
      renderVentasUsuariosStats(data?.counts || {}, presenceOn);
      // Notificar a otros componentes (tarjetas laterales event-driven)
      try {
        window.__lastVUData = data;
        window.dispatchEvent(new CustomEvent('admin:ventas-usuarios-data', { detail: Object.assign({ presence: presenceOn }, data || {}) }));
      } catch (_) {}
    } catch (err) {
      if (ticket !== ventasUsuariosReq) return;
      console.error('Error cargando ventas por usuario:', err);
      // Si hay un chart previo, no lo destruyas; muestra solo el mensaje.
      if (!lastVU.labels.length) {
        chartVentasUsuarios = destroyChart(chartVentasUsuarios);
        showVentasUsuariosPlaceholder('No se pudo cargar la informacion.');
      }
      try { window.dispatchEvent(new CustomEvent('admin:ventas-usuarios-data', { detail: { error: true } })); } catch (_) {}
    }
  };

  const scheduleVentasUsuariosLoad = (delay = 0) => {
    if (!ventasUsuariosCtx) return;
    if (ventasUsuariosTimer) clearTimeout(ventasUsuariosTimer);
    ventasUsuariosTimer = setTimeout(() => { loadVentasUsuarios(); }, delay);
  };

  // UI por defecto del toggle y selects (el gráfico es gestionado por ventas_usuarios_barras.js)
  updateVentasUsuariosPresenceUI();
  // Listeners para que el toggle realmente cambie el estado
  ventasUsuariosPresenceBtn?.addEventListener('click', () => {
    const active = ventasUsuariosPresenceActive();
    ventasUsuariosPresenceBtn.setAttribute('data-active', active ? '0' : '1');
    updateVentasUsuariosPresenceUI();
    // Dispara refresco del gráfico y tarjetas
    scheduleVentasUsuariosLoad(0);
  });
  ventasUsuariosWindowSel?.addEventListener('change', () => {
    if (ventasUsuariosPresenceActive()) scheduleVentasUsuariosLoad(0);
  });
  ventasUsuariosRangeSel?.addEventListener('change', () => scheduleVentasUsuariosLoad(120));
  ventasUsuariosTopSel?.addEventListener('change', () => scheduleVentasUsuariosLoad(0));

  async function loadUsuarios() {
    if (!usrBody) return;
    setStateRow(usrBody, 7, 'Cargando usuarios...');
    try {
      const q = (usrBuscar?.value || '').trim();
      const estado = usrEstado?.value || 'todos';
      // For 'suspendido' ask backend for inactivo (is_active=false).
      // For 'activo' and 'inactivo' we fetch all and filter by presence client-side.
      const estadoQuery = (estado === 'suspendido') ? 'inactivo' : 'todos';
      const url = `/api/admin/vendedores/?estado=${encodeURIComponent(estadoQuery)}&q=${encodeURIComponent(q)}`;
      const data = await api(url);
      const rawItems = Array.isArray(data.items) ? data.items : [];
      updateKnownUsers(rawItems);
      let items = rawItems.filter((u) => !u.es_admin && !u.es_vendedor && u.role !== 'Vendedor');
      // Apply presence-based filter
      const onlineSet = await getUsuariosOnline();
      if (estado === 'activo') {
        items = items.filter((u) => u.is_active && onlineSet.has(u.id));
      } else if (estado === 'inactivo') {
        items = items.filter((u) => u.is_active && !onlineSet.has(u.id));
      } else if (estado === 'suspendido') {
        items = items.filter((u) => !u.is_active);
      }
      const rolFiltro = usrRol?.value || 'todos';
      if (rolFiltro === 'Usuario') {
        items = items.filter((u) => !u.es_vendedor && u.role !== 'Vendedor');
      }
      lastUsuariosRows = items;
      renderUsuarios(items, onlineSet);
      startUsuariosRealtime(onlineSet);
      updateUserEstadoChart(items, onlineSet);
    } catch (err) {
      console.error(err);
      showToast('No se pudo cargar usuarios', 'error');
      setStateRow(usrBody, 7, 'Error al cargar');
    }
  }

  const updateStockSelectColor = () => {
    if (!stockSelect) return;
    const hasSelection = (stockSelect.value || '') !== '';
    stockSelect.style.color = hasSelection ? '#050912' : '#f4f6ff';
  };

  async function loadStock() {
    if (!stockBody) return;
    setStateRow(stockBody, 8, 'Cargando stock...');
    try {
      const data = await api('/api/admin/productos-bajo-stock/?all=1');
      let items = Array.isArray(data.items) ? data.items : [];
      const vendorNames = Array.from(new Set(items.map((i) => i.vendedor || 'N/D'))).sort((a, b) => a.localeCompare(b));
      if (stockSelect) {
        const current = stockSelect.value;
        stockSelect.innerHTML = ['<option value="">Todos los vendedores</option>']
          .concat(vendorNames.map((name) => `<option value="${sanitize(name)}">${sanitize(name)}</option>`))
          .join('');
        if (current && vendorNames.includes(current)) stockSelect.value = current;
        updateStockSelectColor();
      }
      const search = (stockBuscar?.value || '').toLowerCase().trim();
      const vendorFilter = stockSelect?.value || '';
      if (search) {
        items = items.filter((p) => (p.nombre || '').toLowerCase().includes(search) || (p.vendedor || '').toLowerCase().includes(search));
      }
      if (vendorFilter) {
        items = items.filter((p) => (p.vendedor || '') === vendorFilter);
      }
      renderStock(items);
    } catch (err) {
      console.error(err);
      showToast('No se pudo cargar el stock', 'error');
      setStateRow(stockBody, 8, 'Error al cargar');
    }
  }

  async function prefillProducto(id) {
    if (!id) return;
    try {
      const data = await api(`/api/admin/producto/${id}/detalle/`);
      if (fieldId) fieldId.value = data.id ?? '';
      if (fieldVendedor) fieldVendedor.value = data.vendedor || '';
      if (fieldNombre) fieldNombre.value = data.nombre || '';
      if (fieldCategoria) fieldCategoria.value = data.categoria || '';
      if (fieldDescripcion) fieldDescripcion.value = data.descripcion || '';
      if (fieldExistencias) fieldExistencias.value = data.existencias ?? data.stock ?? 0;
      if (fieldImagenPreview) {
        if (data.imagen) {
          fieldImagenPreview.src = data.imagen;
          fieldImagenPreview.style.display = 'block';
        } else {
          fieldImagenPreview.removeAttribute('src');
          fieldImagenPreview.style.display = 'none';
        }
      }
      formEditarProducto?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      console.error(err);
      showToast('No se pudo cargar el producto', 'error');
    }
  }

  async function loadPostulaciones() {
    if (!postBody) return;
    setStateRow(postBody, 11, 'Cargando postulaciones...');
    try {
      const q = (postBuscar?.value || '').trim();
      const url = `/api/admin/postulaciones/?q=${encodeURIComponent(q)}`;
      const data = await api(url);
      const items = Array.isArray(data.items) ? data.items : [];
      renderPostulaciones(items);
    } catch (err) {
      console.error(err);
      showToast('No se pudo cargar postulaciones', 'error');
      setStateRow(postBody, 11, 'Error al cargar');
    }
  }

  /* ----------------------- modales ----------------------- */
const openEditModal = (row) => {
    editingId = Number(row.dataset.id);
    editingIsVendor = row.dataset.vendor === '1';
    if (editNombre) editNombre.value = row.dataset.username || '';
    if (editEmail) editEmail.value = row.dataset.email || '';
    if (editPass) editPass.value = '';
    if (btnEliminarUsuario) {
      const isSelf = row.dataset.self === '1';
      btnEliminarUsuario.style.display = isSelf ? 'none' : '';
      btnEliminarUsuario.disabled = isSelf;
    }
    showModal(modalEditar);
  };

  /* ----------------------- listeners ----------------------- */
  vendBuscar?.addEventListener('input', () => {
    const query = (vendBuscar.value || '').trim();
    if (query) {
      hideVendorEstadoChart();
      if (vendorTopName) vendorTopName.textContent = query;
      showVendorTopMessage('Buscando vendedor...');
    } else {
      showVendorEstadoChart();
      hideVendorTopChart();
    }
    clearTimeout(vendBuscar._t);
    vendBuscar._t = setTimeout(loadVendedores, 200);
  });
  vendEstado?.addEventListener('change', loadVendedores);
  const setCreateModalTitle = (mode) => {
    if (!modalAgregarTitle) return;
    modalAgregarTitle.textContent = mode === 'vendor' ? 'Agregar vendedor' : 'Agregar usuario';
  };

  const setCreateFormError = (message = '') => {
    if (!modalAgregarError) return;
    modalAgregarError.textContent = message;
    modalAgregarError.style.display = message ? 'block' : 'none';
  };
  setCreateModalTitle('vendor');
  setCreateFormError('');

  vendBtnAgregar?.addEventListener('click', () => {
    createMode = 'vendor';
    setCreateModalTitle('vendor');
    setCreateFormError('');
    if (newNombre) newNombre.value = '';
    if (newEmail) newEmail.value = '';
    if (newPass) newPass.value = '';
    ensureVendorPasswordUI();
    showModal(modalAgregar);
  });

  usrBuscar?.addEventListener('input', () => {
    clearTimeout(usrBuscar._t);
    usrBuscar._t = setTimeout(loadUsuarios, 200);
  });
  usrRol?.addEventListener('change', loadUsuarios);
  usrEstado?.addEventListener('change', loadUsuarios);
  usrBtnAgregar?.addEventListener('click', () => {
    createMode = 'user';
    setCreateModalTitle('user');
    setCreateFormError('');
    if (newNombre) newNombre.value = '';
    if (newEmail) newEmail.value = '';
    if (newPass) newPass.value = '';
    ensureVendorPasswordUI();
    showModal(modalAgregar);
  });

  tablaVendedores?.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('button, .status-badge');
    if (!btn) return;
    const row = btn.closest('tr');
    if (!row) return;
    const id = Number(row.dataset.id);
    if (!id) return;
    const action = btn.dataset.action;
    if (action === 'set-active' || action === 'set-inactive') {
      try {
        const wantsActive = action === 'set-active';
        const currentlyDisabled = row.getAttribute('data-disabled') === '1';
        if (wantsActive === !currentlyDisabled) return;
        await api('/api/admin/vendedores/', { method: 'PUT', body: { id, is_active: wantsActive, es_vendedor: true } });
        row.setAttribute('data-disabled', wantsActive ? '0' : '1');
        const estadoBadge = row.querySelector('td:nth-child(6) .status-badge');
        if (estadoBadge) {
          estadoBadge.textContent = wantsActive ? 'Activo' : 'Suspendido';
          estadoBadge.classList.toggle('online', wantsActive);
          estadoBadge.classList.toggle('offline', !wantsActive);
          estadoBadge.classList.toggle('suspended', !wantsActive);
        }
        syncStateToggle(row, wantsActive);
        updateCachedVendor(id, { is_active: wantsActive });
        try { updateVendorEstadoChart(lastVendedoresRows, lastVendedoresOnlineSet); } catch (_) {}
      } catch (err) {
        console.error(err);
        showApiError(err, 'No se pudo cambiar el estado');
      }
      return;
    }
    if (action === 'pwd') {
      const mask = row.querySelector('.pwd-mask');
      if (!mask) return;
      const visible = mask.dataset.visible === '1';
      mask.textContent = visible ? '****' : (mask.dataset.hash || '****');
      mask.dataset.visible = visible ? '0' : '1';
      const icon = btn.querySelector('i');
      if (icon) icon.className = `fa ${visible ? 'fa-eye' : 'fa-eye-slash'}`;
      return;
    }
    if (action === 'edit') {
      openEditModal(row);
      return;
    }
    // Estado no es editable desde esta vista
  });

  tablaUsuarios?.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('button, .status-badge');
    if (!btn) return;
    const row = btn.closest('tr');
    if (!row) return;
    const id = Number(row.dataset.id);
    if (!id) return;
    const action = btn.dataset.action;
    if (action === 'set-active' || action === 'set-inactive') {
      try {
        const wantsActive = action === 'set-active';
        const currentlyDisabled = row.getAttribute('data-disabled') === '1';
        if (wantsActive === !currentlyDisabled) return;
        const keepVendor = row.dataset.vendor === '1';
        await api('/api/admin/vendedores/', { method: 'PUT', body: { id, is_active: wantsActive, es_vendedor: keepVendor } });
        row.setAttribute('data-disabled', wantsActive ? '0' : '1');
        const estadoBadge = row.querySelector('td:nth-child(5) .status-badge');
        if (estadoBadge) {
          estadoBadge.textContent = wantsActive ? 'Activo' : 'Suspendido';
          estadoBadge.classList.toggle('online', wantsActive);
          estadoBadge.classList.toggle('offline', !wantsActive);
          estadoBadge.classList.toggle('suspended', !wantsActive);
        }
        syncStateToggle(row, wantsActive);
        updateCachedUser(id, { is_active: wantsActive });
        try { updateUserEstadoChart(); } catch(_) {}
      } catch (err) {
        console.error(err);
        showApiError(err, 'No se pudo cambiar el estado');
      }
      return;
    }
    if (action === 'edit') {
      openEditModal(row);
      return;
    }
    // Estado ya no es editable manualmente
  });

  btnCancelarEditar?.addEventListener('click', () => {
    hideModal(modalEditar);
    editingId = null;
  });
  modalEditar?.addEventListener('click', (ev) => {
    if (ev.target === modalEditar) {
      hideModal(modalEditar);
      editingId = null;
    }
  });
  modalAgregar?.addEventListener('click', (ev) => {
    if (ev.target === modalAgregar) {
      hideModal(modalAgregar);
      setCreateFormError('');
    }
  });

  btnGuardarEditar?.addEventListener('click', async () => {
    if (!editingId) {
      hideModal(modalEditar);
      return;
    }
    try {
      const body = { id: editingId, es_vendedor: editingIsVendor };
      const username = (editNombre?.value || '').trim();
      const email = (editEmail?.value || '').trim();
      const password = (editPass?.value || '').trim();
      if (email && !isEmail(email)) { showToast('Email invalido', 'error'); return; }
      if (password && !isStrongPassword(password)) { showToast('La contraseña debe tener 8+ caracteres con mayúscula, minúscula, número y símbolo.', 'error'); return; }
      if (password && editPass2 && editPass2.value !== password) { showToast('Las contraseñas no coinciden', 'error'); return; }
      if (username) body.username = username;
      body.email = email;
      if (password) body.password = password;
      await api('/api/admin/vendedores/', { method: 'PUT', body });
      showToast('Usuario actualizado', 'success');
      hideModal(modalEditar);
      editingId = null;
      await loadVendedores();
      await loadUsuarios();
      dispatchDataChanged();
    } catch (err) {
      console.error(err);
      showApiError(err, 'No se pudo actualizar');
    }
  });

  btnEliminarUsuario?.addEventListener('click', async () => {
    if (!editingId) return;
    const nombre = (editNombre?.value || '').trim();
    const mensaje = nombre ? `¿Eliminar al usuario "${nombre}"?` : '¿Eliminar este usuario?';
    if (!confirm(mensaje)) {
      return;
    }
    try {
      await api('/api/admin/vendedores/', { method: 'DELETE', body: { id: editingId, eliminar: true } });
      showToast('Usuario eliminado', 'success');
      hideModal(modalEditar);
      editingId = null;
      await loadVendedores();
      await loadUsuarios();
      dispatchDataChanged();
    } catch (err) {
      console.error(err);
      showApiError(err, 'No se pudo eliminar el usuario');
    }
  });

  btnCancelarNuevo?.addEventListener('click', (ev) => {
    ev?.preventDefault?.();
    hideModal(modalAgregar);
    setCreateFormError('');
  });

  // Bind password UI updates
  try {
    ensureVendorPasswordUI();
    // refresh refs in case we just created/moved them
    passReqEl = document.getElementById('vendPasswordRequirements');
    passMatchEl = document.getElementById('vendPasswordMatch');
    if (newPass) {
      ['input','change'].forEach(evt => newPass.addEventListener(evt, () => { updateReqUI(newPass.value); updateMatchUI(); }));
      updateReqUI(newPass.value || '');
    }
    if (newPass2) {
      ['input','change'].forEach(evt => newPass2.addEventListener(evt, updateMatchUI));
    }
  } catch(_) {}

  btnGuardarNuevo?.addEventListener('click', async (ev) => {
    ev?.preventDefault?.();
    ev?.stopPropagation?.();
    try {
      setCreateFormError('');
      const username = (newNombre?.value || '').trim();
      const email = (newEmail?.value || '').trim();
      const password = (newPass?.value || '').trim();
      if (!username || !password) {
        const msg = 'Nombre y contraseña son obligatorios';
        setCreateFormError(msg);
        showToast(msg, 'error');
        return;
      }
      if (username.length < 3) {
        const msg = 'El usuario debe tener al menos 3 caracteres';
        setCreateFormError(msg);
        showToast(msg, 'error');
        return;
      }
      if (usernameExists(username)) {
        const msg = 'Ese nombre de usuario ya está en uso. Prueba con otro.';
        setCreateFormError(msg);
        showToast(msg, 'error');
        return;
      }
      if (email && !isEmail(email)) {
        const msg = 'Email inválido';
        setCreateFormError(msg);
        showToast(msg, 'error');
        return;
      }
      if (email && emailExists(email)) {
        const msg = 'Ese correo ya está registrado. Usa uno diferente.';
        setCreateFormError(msg);
        showToast(msg, 'error');
        return;
      }
      if (!isStrongPassword(password)) {
        const msg = 'La contraseña debe tener 8+ caracteres con mayúscula, minúscula, número y símbolo.';
        setCreateFormError(msg);
        showToast(msg, 'error');
        return;
      }
      if ((newPass2?.value || '') !== password) {
        const msg = 'Las contraseñas no coinciden';
        setCreateFormError(msg);
        showToast(msg, 'error');
        return;
      }
      const body = { username, email, password, es_vendedor: createMode === 'vendor' };
      await api('/api/admin/vendedores/', { method: 'POST', body });
      showToast('Usuario creado', 'success');
      setCreateFormError('');
      hideModal(modalAgregar);
      if (createMode === 'vendor') {
        await loadVendedores();
      } else {
        await loadUsuarios();
      }
      dispatchDataChanged();
    } catch (err) {
      console.error(err);
      const msg = showApiError(err, 'No se pudo crear');
      setCreateFormError(msg);
    }
  });

  stockBtnRecargar?.addEventListener('click', loadStock);
  stockSelect?.addEventListener('change', () => {
    updateStockSelectColor();
    loadStock();
  });
  stockBuscar?.addEventListener('input', () => {
    clearTimeout(stockBuscar._t);
    stockBuscar._t = setTimeout(loadStock, 200);
  });

  updateStockSelectColor();

  stockBody?.addEventListener('click', (ev) => {
    const row = ev.target.closest('tr[data-id]');
    if (!row) return;
    const id = row.dataset.id;
    prefillProducto(id);
  });

  formEditarProducto?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const id = fieldId?.value;
    if (!id) {
      showToast('Selecciona un producto primero', 'error');
      return;
    }
    const formData = new FormData(formEditarProducto);
    try {
      await api(`/api/admin/producto/${id}/edit/`, { method: 'POST', form: formData });
      showToast('Producto guardado', 'success');
      dispatchDataChanged();
      await loadStock();
    } catch (err) {
      console.error(err);
      showToast('No se pudo guardar el producto', 'error');
    }
  });

  fieldImagen?.addEventListener('change', () => {
    if (!fieldImagenPreview) return;
    const file = fieldImagen.files && fieldImagen.files[0];
    if (!file) {
      fieldImagenPreview.removeAttribute('src');
      fieldImagenPreview.style.display = 'none';
      return;
    }
    const url = URL.createObjectURL(file);
    fieldImagenPreview.src = url;
    fieldImagenPreview.style.display = 'block';
    fieldImagenPreview.onload = () => URL.revokeObjectURL(url);
  });

  btnAccCancelar?.addEventListener('click', clearFormProducto);

  btnAccEliminar?.addEventListener('click', async () => {
    const id = fieldId?.value;
    if (!id) return;
    if (!confirm(`Â¿Eliminar el producto #${id}?`)) return;
    try {
      await api(`/api/admin/producto/${id}/delete/`, { method: 'DELETE' });
      showToast('Producto eliminado', 'success');
      clearFormProducto();
      dispatchDataChanged();
      await loadStock();
    } catch (err) {
      console.error(err);
      showToast('No se pudo eliminar', 'error');
    }
  });

  postBuscar?.addEventListener('input', () => {
    clearTimeout(postBuscar._t);
    postBuscar._t = setTimeout(loadPostulaciones, 250);
  });

  tablaPost?.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    const row = btn.closest('tr[data-id]');
    if (!row) return;
    const id = Number(row.dataset.id);
    if (!id) return;
    const action = btn.dataset.action;
    if (action === 'estado') {
      const estado = btn.dataset.estado;
      try {
        await api('/api/admin/postulaciones/', { method: 'PATCH', body: { id, estado } });
        showToast('Estado actualizado', 'success');
        await loadPostulaciones();
      } catch (err) {
        console.error(err);
        showToast('No se pudo actualizar el estado', 'error');
      }
      return;
    }
    if (action === 'notas') {
      const actuales = row.dataset.notas || '';
      const notas = prompt('Notas internas', actuales);
      if (notas === null) return;
      try {
        await api('/api/admin/postulaciones/', { method: 'PATCH', body: { id, notas } });
        showToast('Notas guardadas', 'success');
        await loadPostulaciones();
      } catch (err) {
        console.error(err);
        showToast('No se pudieron guardar las notas', 'error');
      }
    }
  });

  btnExportPost?.addEventListener('click', (ev) => {
    ev.preventDefault();
    const q = (postBuscar?.value || '').trim();
    const url = `/api/admin/export/postulaciones.xlsx${q ? `?q=${encodeURIComponent(q)}` : ''}`;
    window.open(url, '_blank');
  });

  btnExportVentas?.addEventListener('click', (ev) => {
    ev.preventDefault();
    const url = '/api/admin/export/ventas.xlsx';
    window.open(url, '_blank');
  });

  document.querySelectorAll('.sidebar nav a[data-section]').forEach((link) => {
    link.addEventListener('click', (ev) => {
      ev.preventDefault();
      document.querySelectorAll('.sidebar nav a').forEach((a) => a.classList.remove('active'));
      link.classList.add('active');
      const id = link.dataset.section;
      document.querySelectorAll('.section-group').forEach((sec) => {
        sec.classList.toggle('active', sec.id === id);
      });
      if (id === 'vendedores') { stopUsuariosRealtime(); loadVendedores(); }
      if (id === 'usuarios_gestion') { loadUsuarios(); }
      if (id === 'stock') { stopUsuariosRealtime(); stopVendedoresRealtime(); loadStock(); }
      if (id === 'postulaciones') { stopUsuariosRealtime(); stopVendedoresRealtime(); loadPostulaciones(); }
      if (id === 'graficos') {
        // Asegura que los charts se ajusten al hacerse visible la sección
        setTimeout(() => { try { window.dispatchEvent(new Event('resize')); } catch (_) {} }, 50);
      }
    });
  });

  // Completar datos de bienvenida y activar esa sección inicialmente
  (async () => {
    try {
      const data = await api('/api/admin/vendedores/?estado=todos');
      const me = (Array.isArray(data.items) ? data.items : []).find((u) => u.is_self);
      if (me) {
        const n = document.getElementById('adminWelcomeName');
        const u = document.getElementById('adminWelcomeUser');
        const e = document.getElementById('adminWelcomeEmail');
        if (n) n.textContent = me.username || 'admin';
        if (u) u.textContent = me.username || '-';
        if (e) e.textContent = me.email || '-';
        const welcomeLink = document.querySelector('.sidebar nav a[data-section="bienvenido"]');
        if (welcomeLink) {
          // Simula clic para activar sección Bienvenido por defecto
          welcomeLink.dispatchEvent(new Event('click'));
        }
      }
    } catch (e) {
      // ignora
    }
  })();

  const activeSection = document.querySelector('.section-group.active');
  if (activeSection) {
    if (activeSection.id === 'vendedores') { stopUsuariosRealtime(); loadVendedores(); }
    else if (activeSection.id === 'usuarios_gestion') { loadUsuarios(); }
    else if (activeSection.id === 'stock') { stopUsuariosRealtime(); stopVendedoresRealtime(); loadStock(); }
    else if (activeSection.id === 'postulaciones') { stopUsuariosRealtime(); stopVendedoresRealtime(); loadPostulaciones(); }
  } else {
    loadVendedores();
  }
});


  // ===== Estado Global (Usuarios/Vendedores) - Donut =====
  let estadoGlobalRangeSel = document.getElementById('selectEstadoGlobalRange');
  let estadoGlobalPresenceBtn = document.getElementById('toggleEstadoGlobalPresence');
  let estadoGlobalWindowSel = document.getElementById('selectEstadoGlobalWindow');
  let estadoGlobalCanvas = document.getElementById('chartEstadoGlobal');
  let estadoGlobalPlaceholder = document.getElementById('estadoGlobalPlaceholder');
  let estadoGlobalStats = document.getElementById('estadoGlobalStats');
  let estadoGlobalCtx = estadoGlobalCanvas ? estadoGlobalCanvas.getContext('2d') : null;
  let chartEstadoGlobal = null;
  let estadoGlobalReq = 0;
  let estadoGlobalTimer = null;

  // Reobtiene referencias si el script cargó antes que el DOM
  const ensureEstadoGlobalRefs = () => {
    if (estadoGlobalCtx) return true;
    estadoGlobalRangeSel = document.getElementById('selectEstadoGlobalRange');
    estadoGlobalPresenceBtn = document.getElementById('toggleEstadoGlobalPresence');
    estadoGlobalWindowSel = document.getElementById('selectEstadoGlobalWindow');
    estadoGlobalCanvas = document.getElementById('chartEstadoGlobal');
    estadoGlobalPlaceholder = document.getElementById('estadoGlobalPlaceholder');
    estadoGlobalStats = document.getElementById('estadoGlobalStats');
    estadoGlobalCtx = estadoGlobalCanvas ? estadoGlobalCanvas.getContext('2d') : null;
    return !!estadoGlobalCtx;
  };

  // Helper local para destruir instancias Chart.js sin depender de otros scopes
  const destroyChart = (inst) => {
    try { if (inst && typeof inst.destroy === 'function') inst.destroy(); } catch (_) {}
    return null;
  };

  // API helper local y seguro (evita depender del helper "api" del otro bloque)
  const apiSafe = async (url, opts = {}) => {
    try {
      if (typeof api === 'function') {
        return await api(url, opts);
      }
    } catch (_) { /* si existe pero falla, cae al fetch */ }
    const options = Object.assign({
      method: 'GET',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      credentials: 'same-origin',
    }, opts || {});
    const resp = await fetch(url, options);
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`HTTP ${resp.status} - ${url}\n${text}`);
    }
    const ct = resp.headers.get('content-type') || '';
    return ct.includes('application/json') ? resp.json() : resp.text();
  };

  const estadoGlobalPresenceActive = () => (estadoGlobalPresenceBtn?.getAttribute('data-active') === '1');
  const updateEstadoGlobalPresenceUI = () => {
    if (!estadoGlobalPresenceBtn) return;
    const active = estadoGlobalPresenceActive();
    estadoGlobalPresenceBtn.setAttribute('data-active', active ? '1' : '0');
    estadoGlobalPresenceBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
    const label = estadoGlobalPresenceBtn.querySelector('.chart-toggle__label');
    const windowVal = estadoGlobalWindowSel?.value || '180';
    if (label) label.textContent = active ? `Presencia (${windowVal}s)` : 'Sin presencia';
    if (estadoGlobalWindowSel) estadoGlobalWindowSel.disabled = !active;
  };
  const showEstadoGlobalPlaceholder = (text) => {
    if (estadoGlobalPlaceholder) { estadoGlobalPlaceholder.textContent = text || 'Sin datos.'; estadoGlobalPlaceholder.style.display = 'flex'; }
    if (estadoGlobalCanvas) estadoGlobalCanvas.style.visibility = 'hidden';
    if (estadoGlobalStats) { estadoGlobalStats.innerHTML = ''; estadoGlobalStats.style.display = 'none'; }
  };
  const hideEstadoGlobalPlaceholder = () => {
    if (estadoGlobalPlaceholder) estadoGlobalPlaceholder.style.display = 'none';
    if (estadoGlobalCanvas) estadoGlobalCanvas.style.visibility = 'visible';
  };
  const renderEstadoGlobalStats = (counts = {}, presenceOn = false) => {
    if (!estadoGlobalStats) return;
    const entries = Object.entries(counts);
    if (!entries.length) { estadoGlobalStats.innerHTML = ''; estadoGlobalStats.style.display = 'none'; return; }
    estadoGlobalStats.style.display = 'flex';
    const currentWindow = parseInt(estadoGlobalWindowSel?.value || '180', 10) || 180;
    const currentRange = parseInt(estadoGlobalRangeSel?.value || '30', 10) || 30;
    const roleLabels = { usuarios: 'Usuarios', vendedores: 'Vendedores', administradores: 'Administradores' };
    const hint = presenceOn ? `Basado en presencia dentro de ${currentWindow} segundos.` : `Basado en último acceso dentro de los últimos ${currentRange} días.`;
    const cards = entries.map(([key, data]) => {
      const label = roleLabels[key] || key;
      const activos = Number(data?.activos || 0);
      const inactivos = Number(data?.inactivos || 0);
      const suspendidos = Number(data?.suspendidos || 0);
      return `
        <div class="chart-side-card">
          <div class="chart-side-card__title">${label}</div>
          <div class="chart-side-card__metrics">
            <div class="chart-side-card__metric"><strong>Activos</strong>${activos}</div>
            <div class="chart-side-card__metric"><strong>Inactivos</strong>${inactivos}</div>
            <div class="chart-side-card__metric"><strong>Suspendidos</strong>${suspendidos}</div>
          </div>
        </div>
      `;
    }).join('');
    estadoGlobalStats.innerHTML = `${cards}<div class="chart-side-card chart-side-card--hint"><div class="chart-side-card__hint">${hint}</div></div>`;
  };
  const renderEstadoGlobalChart = (labels, values) => {
    if (!estadoGlobalCtx) return;
    chartEstadoGlobal = destroyChart(chartEstadoGlobal);
    chartEstadoGlobal = new Chart(estadoGlobalCtx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          // Colores consistentes con el resto del dashboard:
          // Activos (verde), Inactivos (rojo), Suspendidos (naranja)
          backgroundColor: ['#37d67a', '#ff5a5f', '#ffb347'],
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: '#cfe6ff' } } },
      },
    });
  };
  const loadEstadoGlobal = async () => {
    if (!ensureEstadoGlobalRefs()) return;
    const days = parseInt(estadoGlobalRangeSel?.value || '30', 10) || 30;
    const presenceOn = estadoGlobalPresenceActive();
    const params = new URLSearchParams({ days: Math.max(1, Math.min(days, 365)), top: 10 });
    if (presenceOn) {
      const win = parseInt(estadoGlobalWindowSel?.value || '180', 10) || 180;
      params.set('presence', '1'); params.set('window', Math.max(30, Math.min(win, 3600)));
    }
    const ticket = ++estadoGlobalReq;
    showEstadoGlobalPlaceholder('Cargando datos...');
    try {
      // Timeout de 15s para evitar quedarse en "Cargando datos..."
      const controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      const timeout = setTimeout(() => { try { controller?.abort(); } catch (_) {} }, 15000);
      const data = await apiSafe(`/api/admin/ventas-por-usuario/?${params.toString()}`, { signal: controller?.signal });
      clearTimeout(timeout);
      if (ticket !== estadoGlobalReq) return;
      const counts = data?.counts || {};
      // Sumar los tres roles: usuarios, vendedores y administradores
      const u = counts.usuarios || {}; 
      const v = counts.vendedores || {};
      const a = counts.administradores || {};
      const total = [
        Number(u.activos||0) + Number(v.activos||0) + Number(a.activos||0),
        Number(u.inactivos||0) + Number(v.inactivos||0) + Number(a.inactivos||0),
        Number(u.suspendidos||0) + Number(v.suspendidos||0) + Number(a.suspendidos||0),
      ];
      const sum = total.reduce((a,b)=>a+b,0);
      if (!sum) { chartEstadoGlobal = destroyChart(chartEstadoGlobal); showEstadoGlobalPlaceholder('Sin datos.'); return; }
      hideEstadoGlobalPlaceholder();
      renderEstadoGlobalChart(['Activos','Inactivos','Suspendidos'], total);
      renderEstadoGlobalStats(counts, presenceOn);
    } catch (err) {
      if (ticket !== estadoGlobalReq) return;
      console.error('Error cargando estado global:', err);
      chartEstadoGlobal = destroyChart(chartEstadoGlobal);
      showEstadoGlobalPlaceholder('No se pudo cargar la informacion.');
    }
  };
  const scheduleEstadoGlobalLoad = (delay = 0) => {
    if (!ensureEstadoGlobalRefs()) return;
    if (estadoGlobalTimer) clearTimeout(estadoGlobalTimer);
    estadoGlobalTimer = setTimeout(() => { loadEstadoGlobal(); }, delay);
  };

  // Actualiza el texto de pista (hint) segun rango/presencia para ambos bloques
  const updateEstadoGlobalHintRuntime = () => {
    try {
      const container = document.getElementById('estadoGlobalStats');
      if (!container) return;
      const hintEl = container.querySelector('.chart-side-card--hint .chart-side-card__hint');
      if (!hintEl) return;
      const active = estadoGlobalPresenceActive();
      if (active) {
        const win = parseInt(estadoGlobalWindowSel?.value || '180', 10) || 180;
        hintEl.textContent = `Basado en presencia dentro de ${win} segundos.`;
      } else {
        const days = parseInt(estadoGlobalRangeSel?.value || '30', 10) || 30;
        hintEl.textContent = `Basado en ultimo acceso dentro de los ultimos ${days} dias.`;
      }
    } catch (_) {}
  };
  const updateVentasUsuariosHintRuntime = () => {
    try {
      const container = document.getElementById('ventasPorUsuarioStats');
      if (!container) return;
      const hintEl = container.querySelector('.chart-side-card--hint .chart-side-card__hint');
      if (!hintEl) return;
      const active = (ventasUsuariosPresenceBtn?.getAttribute('data-active') === '1');
      if (active) {
        const win = parseInt(ventasUsuariosWindowSel?.value || '180', 10) || 180;
        hintEl.textContent = `Basado en presencia dentro de ${win} segundos.`;
      } else {
        const days = parseInt(ventasUsuariosRangeSel?.value || '30', 10) || 30;
        hintEl.textContent = `Basado en ultimo acceso dentro de los ultimos ${days} dias.`;
      }
    } catch (_) {}
  };
  updateEstadoGlobalPresenceUI();
  estadoGlobalRangeSel?.addEventListener('change', () => { scheduleEstadoGlobalLoad(120); setTimeout(updateEstadoGlobalHintRuntime, 200); });
  estadoGlobalWindowSel?.addEventListener('change', () => { if (estadoGlobalPresenceActive()) scheduleEstadoGlobalLoad(0); setTimeout(updateEstadoGlobalHintRuntime, 200); });
  estadoGlobalPresenceBtn?.addEventListener('click', () => { const active = estadoGlobalPresenceActive(); estadoGlobalPresenceBtn.setAttribute('data-active', active ? '0' : '1'); updateEstadoGlobalPresenceUI(); scheduleEstadoGlobalLoad(0); setTimeout(updateEstadoGlobalHintRuntime, 200); });
  if (ensureEstadoGlobalRefs()) {
    scheduleEstadoGlobalLoad(200);
    setTimeout(updateEstadoGlobalHintRuntime, 500);
  } else {
    // Si el DOM aún no está listo, agenda tras DOMContentLoaded
    document.addEventListener('DOMContentLoaded', () => scheduleEstadoGlobalLoad(200));
  }
  window.addEventListener('admin:data-changed', () => { scheduleEstadoGlobalLoad(400); setTimeout(updateEstadoGlobalHintRuntime, 600); });
  window.__dashboardAdminEnhancedReady = true;













