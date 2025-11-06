// Complemento para dibujar las tarjetas laterales del
// gráfico "Ventas por Usuario" con totales y top compradores.
// No interfiere con el render del gráfico existente.
(function(){
  const statsBox = document.getElementById('ventasPorUsuarioStats');
  const rangeSel = document.getElementById('selectVentasUsuariosRangeInner');
  const topSel = document.getElementById('selectVentasUsuariosTop');
  const presenceBtn = document.getElementById('toggleVentasUsuariosPresence');
  const windowSel = document.getElementById('selectVentasUsuariosWindow');
  const canvas = document.getElementById('chartVentasUsuarios');
  const placeholder = document.getElementById('ventasPorUsuarioPlaceholder');
  const ctx = canvas ? canvas.getContext('2d') : null;

  if (!statsBox) return;

  const currencyFormatter = (() => {
    try { return new Intl.NumberFormat('es-CL', { style:'currency', currency:'CLP', maximumFractionDigits:0 }); }
    catch(_) { return null; }
  })();
  const formatCurrency = (n) => currencyFormatter ? currencyFormatter.format(Number(n||0)) : `$${Number(n||0).toFixed(0)}`;
  const sanitize = (s) => (s||'').replace(/[<>]/g,'').trim();
  const presenceActive = () => (presenceBtn && presenceBtn.getAttribute('data-active') === '1');

  // No interferir con el canvas del gr1fico principal: helpers no-op.
  const showChartPlaceholder = (text) => { if (placeholder) { placeholder.textContent = text || 'Sin datos.'; } };
  const hideChartPlaceholder = () => {};

  const renderBars = (labels, values) => { /* noop: gr1fico lo maneja dashboard_administrador.js */ };

  const buildCards = (summary) => {
    const totalSold = Number(summary.total_sold || 0);
    const orders = Number(summary.orders || 0);
    const buyersConsidered = Number(summary.buyers_considered || 0);
    const avgTicket = Number(summary.avg_ticket || 0);
    const topBuyers = Array.isArray(summary.top_buyers) ? summary.top_buyers : [];
    const days = Number(summary.days || 30);
    const topList = topBuyers.map((b, i) => `
      <div class="chart-side-card__top-item">
        <span class="rank">${i+1}</span>
        <span class="name">${sanitize(b.name || '')}</span>
        <span class="meta">${formatCurrency(b.total || 0)} · ${Number(b.ordenes || 0)} orden${Number(b.ordenes||0)===1?'':'es'}</span>
      </div>
    `).join('');
    statsBox.style.display = 'flex';
    statsBox.innerHTML = `
      <div class="chart-side-card chart-side-card--strong">
        <div class="chart-side-card__title">TOTAL VENDIDO ULTIMOS ${days} DIAS</div>
        <div class="chart-side-card__big">${formatCurrency(totalSold)}</div>
        <div class="chart-side-card__hint">Ticket promedio ${formatCurrency(avgTicket)}</div>
      </div>
      <div class="chart-side-card">
        <div class="chart-side-card__title">ORDENES</div>
        <div class="chart-side-card__big">${orders}</div>
        <div class="chart-side-card__hint">${buyersConsidered} compradores considerados</div>
      </div>
      <div class="chart-side-card">
        <div class="chart-side-card__title">TOP 3 COMPRADORES</div>
        <div class="chart-side-card__list">${topList || '<div class="chart-side-card__hint">Sin datos</div>'}</div>
      </div>
    `;
  };

  const showPlaceholder = (text) => {
    statsBox.style.display = 'flex';
    statsBox.innerHTML = `<div class="chart-side-card chart-side-card--hint"><div class="chart-side-card__hint">${text}</div></div>`;
  };

  const fetchAndRender = async () => {
    const days = parseInt(rangeSel?.value || '30', 10) || 30;
    const top = parseInt(topSel?.value || '10', 10) || 10;
    const params = new URLSearchParams({ days: Math.max(1, Math.min(days, 365)), top: Math.max(3, Math.min(top, 50)) });
    if (presenceActive()) {
      const win = parseInt(windowSel?.value || '180', 10) || 180;
      params.set('presence','1');
      params.set('window', Math.max(30, Math.min(win, 3600)));
    }
    showPlaceholder('Cargando…');
    showChartPlaceholder('Cargando datos...');
    try {
      const resp = await fetch(`/api/admin/ventas-por-usuario/?${params.toString()}`, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (data && data.summary) buildCards(data.summary); else showPlaceholder('Sin datos para mostrar.');
      const labels = Array.isArray(data?.labels) ? data.labels : [];
      const values = Array.isArray(data?.data) ? data.data.map((n) => Number(n || 0)) : [];
      // No tocar el canvas principal; solo actualizar tarjetas laterales.
    } catch (e) {
      console.error('cards ventas-usuario:', e);
      showPlaceholder('No se pudo cargar la informacion.');
    }
  };

  // Listeners
  rangeSel?.addEventListener('change', () => fetchAndRender());
  topSel?.addEventListener('change', () => fetchAndRender());
  windowSel?.addEventListener('change', () => { if (presenceActive()) fetchAndRender(); });
  // No manejar el click del toggle aqu	: lo controla dashboard_administrador.js.
  // Observa cambios del atributo para actualizar tarjetas cuando cambie el estado.
  if (presenceBtn) {
    const mo = new MutationObserver(() => fetchAndRender());
    mo.observe(presenceBtn, { attributes: true, attributeFilter: ['data-active'] });
  }
  window.addEventListener('admin:data-changed', () => setTimeout(fetchAndRender, 200));

  // Initial
  fetchAndRender();
})();
