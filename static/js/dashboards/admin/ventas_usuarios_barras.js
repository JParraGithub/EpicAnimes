/** Dibuja el gráfico de barras para ventas por usuario. */
// Grafico de Barras: Ventas por Usuario (implementacion unica)
(function(){
  const rangeSel = document.getElementById('selectVentasUsuariosRangeInner');
  const topSel = document.getElementById('selectVentasUsuariosTop');
  const presenceBtn = document.getElementById('toggleVentasUsuariosPresence');
  const windowSel = document.getElementById('selectVentasUsuariosWindow');
  const canvas = document.getElementById('chartVentasUsuarios');
  const placeholder = document.getElementById('ventasPorUsuarioPlaceholder');
  if (!canvas || !window.Chart) return;

  const ctx = canvas.getContext('2d');
  let chart = null;
  let ticket = 0;
  let last = { labels: [], values: [] };

  const presenceActive = () => (presenceBtn && presenceBtn.getAttribute('data-active') === '1');

  const showPlaceholder = (text) => {
    if (placeholder) { placeholder.textContent = text || 'Sin datos.'; placeholder.style.display = 'flex'; }
    if (canvas) canvas.style.visibility = last.labels.length ? 'visible' : 'hidden';
  };
  const hidePlaceholder = () => { if (placeholder) placeholder.style.display = 'none'; if (canvas) canvas.style.visibility = 'visible'; };

  const destroy = () => { if (chart && typeof chart.destroy === 'function') { chart.destroy(); chart = null; } };
  const draw = (labels, values) => {
    destroy();
    chart = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Total vendido', data: values, backgroundColor: 'rgba(77,201,246,.35)', borderColor: '#4dc9f6', borderWidth: 1, borderRadius: 6, maxBarThickness: 22 }] },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        layout: { padding: { top: 8, right: 12, bottom: 8, left: 8 } },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` $ ${Number(ctx.parsed.x||0).toFixed(0)}` } } },
        scales: {
          x: { ticks: { color: '#9fbad6' }, grid: { color: 'rgba(77,201,246,.2)' } },
          y: { ticks: { color: '#e0f2ff', autoSkip: false, font: { size: 11 } }, grid: { color: 'rgba(77,201,246,.08)' } },
        },
      },
    });
  };

  const fetchAndRender = async () => {
    const days = Math.max(1, Math.min(parseInt(rangeSel?.value || '30', 10) || 30, 365));
    const top = Math.max(3, Math.min(parseInt(topSel?.value || '10', 10) || 10, 50));
    const params = new URLSearchParams({ days, top });
    if (presenceActive()) {
      const win = Math.max(30, Math.min(parseInt(windowSel?.value || '180', 10) || 180, 3600));
      params.set('presence','1'); params.set('window', String(win));
    }
    const t = ++ticket;
    showPlaceholder('Cargando datos...');
    try {
      const resp = await fetch(`/api/admin/ventas-por-usuario/?${params.toString()}`, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (t !== ticket) return;
      const labels = Array.isArray(data?.labels) ? data.labels : [];
      const values = Array.isArray(data?.data) ? data.data.map((n) => Number(n||0)) : [];
      if (!labels.length || !values.some((n) => n > 0)) {
        if (!last.labels.length) { destroy(); showPlaceholder('Sin datos en el periodo seleccionado.'); }
        else { hidePlaceholder(); }
      } else {
        hidePlaceholder();
        last = { labels: labels.slice(0), values: values.slice(0) };
        draw(labels, values);
      }
      try { window.__lastVUData = data; window.dispatchEvent(new CustomEvent('admin:ventas-usuarios-data', { detail: Object.assign({ presence: presenceActive() }, data||{}) })); } catch(_){}
    } catch (e) {
      if (t !== ticket) return;
      console.error('ventas_usuarios_barras:', e);
      if (!last.labels.length) { destroy(); showPlaceholder('No se pudo cargar la informacion.'); }
    }
  };

  // Listeners
  rangeSel?.addEventListener('change', () => fetchAndRender());
  topSel?.addEventListener('change', () => fetchAndRender());
  windowSel?.addEventListener('change', () => { if (presenceActive()) fetchAndRender(); });
  if (presenceBtn) {
    const mo = new MutationObserver(() => fetchAndRender());
    mo.observe(presenceBtn, { attributes: true, attributeFilter: ['data-active'] });
  }
  window.addEventListener('admin:data-changed', () => setTimeout(fetchAndRender, 200));

  // Initial
  fetchAndRender();
})();

