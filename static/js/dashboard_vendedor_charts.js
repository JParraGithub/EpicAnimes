// Gráficos del Dashboard Vendedor
// - Línea y Barras: serie diaria por rango 7/14/30
// - Pie: ventas por categoría (top 5) en el mismo rango

(function () {
  const onReady = () => {
    if (!window.Chart) return;

    const rangeSel = document.getElementById('ventasRangeSel');
    const lineaTitleSel = document.getElementById('tituloLineaSel');
    const barrasTitleSel = document.getElementById('tituloBarrasSel');
    const pieTitleSel = document.getElementById('tituloPieSel');

    const lineaTitleText = document.getElementById('tituloLineaText');
    const barrasTitleText = document.getElementById('tituloBarrasText');
    const pieTitleText = document.getElementById('tituloPieText');

    const ctxLinea = document.getElementById('chartVendedorLinea');
    const ctxBarras = document.getElementById('chartVendedorBarras');
    const ctxPie = document.getElementById('chartVendedorPie');

    const cardLinea = document.getElementById('cardGrafLinea');
    const cardBarras = document.getElementById('cardGrafBarras');
    const cardPie = document.getElementById('cardGrafPie');

    const btnLinea = document.getElementById('btnGrafLinea');
    const btnBarras = document.getElementById('btnGrafBarras');
    const btnPie = document.getElementById('btnGrafPie');

    if (!rangeSel || !ctxLinea || !ctxBarras || !ctxPie) return;

    const safeInt = (v, def) => {
      const n = parseInt(v, 10);
      return Number.isFinite(n) ? n : def;
    };

    const palette = {
      line: 'rgba(75, 192, 192, 0.9)',
      lineBg: 'rgba(75, 192, 192, 0.15)',
      bar: 'rgba(99, 132, 255, 0.9)',
      barBg: 'rgba(99, 132, 255, 0.15)',
      pie: [
        '#4dc9f6', '#f67019', '#f53794', '#537bc4', '#acc236',
        '#166a8f', '#00a950', '#58595b', '#8549ba'
      ]
    };

    const charts = { linea: null, barras: null, pie: null };

    const titleWithRange = (base, days) => `${base} (${days} días)`;

    const buildLinea = (labels, data, days) => {
      const prev = charts.linea && (Chart.getChart(charts.linea) || charts.linea);
      if (prev && prev.destroy) prev.destroy();
      charts.linea = new Chart(ctxLinea, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Ventas (CLP)',
            data: data,
            borderColor: palette.line,
            backgroundColor: palette.lineBg,
            fill: true,
            tension: 0.3,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            title: {
              display: true,
              text: titleWithRange(lineaTitleSel?.value || 'Ingresos diarios', days),
              color: '#cfe6ff',
            }
          },
          scales: {
            x: { ticks: { color: '#cfe6ff' }, grid: { color: 'rgba(255,255,255,0.08)' } },
            y: { ticks: { color: '#cfe6ff' }, grid: { color: 'rgba(255,255,255,0.08)' } }
          }
        }
      });
      if (lineaTitleText) lineaTitleText.textContent = titleWithRange(lineaTitleSel?.value || 'Ingresos diarios', days);
    };

    const buildBarras = (labels, data, days) => {
      const prev = charts.barras && (Chart.getChart(charts.barras) || charts.barras);
      if (prev && prev.destroy) prev.destroy();
      charts.barras = new Chart(ctxBarras, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Ventas (CLP)',
            data: data,
            backgroundColor: palette.bar,
            borderColor: palette.bar,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            title: {
              display: true,
              text: titleWithRange(barrasTitleSel?.value || 'Comparativa de ventas', days),
              color: '#cfe6ff',
            }
          },
          scales: {
            x: { ticks: { color: '#cfe6ff' }, grid: { color: 'rgba(255,255,255,0.08)' } },
            y: { ticks: { color: '#cfe6ff' }, grid: { color: 'rgba(255,255,255,0.08)' } }
          }
        }
      });
      if (barrasTitleText) barrasTitleText.textContent = titleWithRange(barrasTitleSel?.value || 'Comparativa de ventas', days);
    };

    const buildPie = (labels, data, days) => {
      const prev = charts.pie && (Chart.getChart(charts.pie) || charts.pie);
      if (prev && prev.destroy) prev.destroy();
      charts.pie = new Chart(ctxPie, {
        type: 'pie',
        data: {
          labels: labels,
          datasets: [{
            label: 'Categorías',
            data: data,
            backgroundColor: palette.pie.slice(0, Math.max(3, labels.length)),
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: '#cfe6ff' } },
            title: {
              display: true,
              text: titleWithRange(pieTitleSel?.value || 'Ventas por categoría', days),
              color: '#cfe6ff',
            }
          }
        }
      });
      if (pieTitleText) pieTitleText.textContent = titleWithRange(pieTitleSel?.value || 'Ventas por categoría', days);
    };

    const applyTitles = (days) => {
      const l = charts.linea; const b = charts.barras; const p = charts.pie;
      const lt = lineaTitleSel?.value || 'Ingresos diarios';
      const bt = barrasTitleSel?.value || 'Comparativa de ventas';
      const pt = pieTitleSel?.value || 'Ventas por categoría';
      if (l) { l.options.plugins.title.text = titleWithRange(lt, days); l.update(); }
      if (b) { b.options.plugins.title.text = titleWithRange(bt, days); b.update(); }
      if (p) { p.options.plugins.title.text = titleWithRange(pt, days); p.update(); }
      if (lineaTitleText) lineaTitleText.textContent = titleWithRange(lt, days);
      if (barrasTitleText) barrasTitleText.textContent = titleWithRange(bt, days);
      if (pieTitleText) pieTitleText.textContent = titleWithRange(pt, days);
    };

    const fetchAndRender = async () => {
      const days = safeInt(rangeSel.value, 30);
      const url = `/api/vendedor/resumen_ext/?days=${encodeURIComponent(days)}`;
      try {
        const resp = await fetch(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = await resp.json();
        const labels = Array.isArray(json.labels) ? json.labels : [];
        const series = Array.isArray(json.data) ? json.data : [];
        const cats = Array.isArray(json.por_categoria) ? json.por_categoria : [];
        const catLabels = cats.map(c => c.categoria || '—');
        const catValues = cats.map(c => Number(c.total || 0));

        buildLinea(labels, series, days);
        buildBarras(labels, series, days);
        buildPie(catLabels, catValues, days);
        applyTitles(days);
      } catch (e) {
        // Fallback: limpia charts si falla
        try { if (charts.linea?.destroy) charts.linea.destroy(); } catch (_) {}
        try { if (charts.barras?.destroy) charts.barras.destroy(); } catch (_) {}
        try { if (charts.pie?.destroy) charts.pie.destroy(); } catch (_) {}
        console.error('dashboard_vendedor_charts:', e);
      }
    };

    const setActiveType = (type) => {
      if (!cardLinea || !cardBarras || !cardPie) return;
      cardLinea.style.display = (type === 'linea') ? '' : 'none';
      cardBarras.style.display = (type === 'barras') ? '' : 'none';
      cardPie.style.display = (type === 'pie') ? '' : 'none';
      // Toggle button styles
      if (btnLinea) btnLinea.classList.toggle('primary', type === 'linea');
      if (btnBarras) btnBarras.classList.toggle('primary', type === 'barras');
      if (btnPie) btnPie.classList.toggle('primary', type === 'pie');
    };

    // Botones de tipo
    btnLinea?.addEventListener('click', () => setActiveType('linea'));
    btnBarras?.addEventListener('click', () => setActiveType('barras'));
    btnPie?.addEventListener('click', () => setActiveType('pie'));

    rangeSel.addEventListener('change', () => fetchAndRender());
    lineaTitleSel?.addEventListener('change', () => applyTitles(safeInt(rangeSel.value, 30)));
    barrasTitleSel?.addEventListener('change', () => applyTitles(safeInt(rangeSel.value, 30)));
    pieTitleSel?.addEventListener('change', () => applyTitles(safeInt(rangeSel.value, 30)));

    // Inicializar con el valor seleccionado y tipo por defecto
    setActiveType('linea');
    fetchAndRender();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }
})();
