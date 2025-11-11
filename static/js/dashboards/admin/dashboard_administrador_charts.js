/** Construye los gráficos principales del panel administrativo. */
(function () {
  const ChartLib = window.Chart;
  if (!ChartLib) return;

  const canvas = document.getElementById('chartVentasActividad');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const rangeSelect = document.getElementById('ventasActividadRange');
  const placeholder = document.getElementById('ventasActividadPlaceholder');
  const toggleContainer = document.getElementById('ventasActividadToggles');
  const toggleState = {
    ventas: true,
    ordenes: true,
    vendedores: true,
  };
  let chart = null;
  let lastPayload = null;
  const initialRangeValue = rangeSelect && rangeSelect.value ? rangeSelect.value : '30';
  let currentRange = parseInt(initialRangeValue, 10) || 30;
  let requestTicket = 0;
  const SERIES_ORDER = ['ventas', 'ordenes', 'vendedores'];
  const SERIES_DEFS = {
    ventas: {
      label: 'Total vendido',
      borderColor: '#37d67a',
      backgroundColor: 'rgba(55, 214, 122, 0.25)',
      fill: true,
      tension: 0.3,
      yAxisID: 'yVentas',
    },
    ordenes: {
      label: 'Ordenes',
      borderColor: '#4dc9f6',
      backgroundColor: 'rgba(77, 201, 246, 0.15)',
      fill: false,
      tension: 0.25,
      yAxisID: 'yActividad',
    },
    vendedores: {
      label: 'Vendedores',
      borderColor: '#f67019',
      backgroundColor: 'rgba(246, 112, 25, 0.15)',
      fill: false,
      tension: 0.25,
      yAxisID: 'yActividad',
      borderDash: [6, 3],
    },
  };

  // Creacción Gráfico de Líneas
  const anySeriesActive = () => SERIES_ORDER.some((key) => toggleState[key]);
  const updateToggleUI = () => {
    if (!toggleContainer) return;
    toggleContainer.querySelectorAll('[data-series]').forEach((btn) => {
      const key = btn.getAttribute('data-series');
      if (!key) return;
      const active = !!toggleState[key];
      btn.setAttribute('data-active', active ? '1' : '0');
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  };
  const handleToggleClick = (event) => {
    const target = event.target.closest('.chart-toggle');
    if (!(target && toggleContainer && toggleContainer.contains(target))) return;
    const key = target.getAttribute('data-series');
    if (!key || !(key in toggleState)) return;
    event.preventDefault();
    toggleState[key] = !toggleState[key];
    updateToggleUI();
    if (lastPayload) {
      renderChart(lastPayload);
    } else if (!anySeriesActive()) {
      showPlaceholder('Activa al menos una serie para ver el grafico.');
    }
  };
  if (toggleContainer) {
    toggleContainer.addEventListener('click', handleToggleClick);
    updateToggleUI();
  }

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
    if (currencyFormatter) return currencyFormatter.format(numeric);
    return `$${numeric.toFixed(0)}`;
  };

  const formatDay = (iso, opts) => {
    if (!iso || typeof iso !== 'string') return iso || '';
    const parts = iso.split('-').map(Number);
    if (parts.length !== 3 || parts.some((p) => Number.isNaN(p))) return iso;
    const [year, month, day] = parts;
    const date = new Date(Date.UTC(year, month - 1, day));
    try {
      return new Intl.DateTimeFormat('es-CL', opts || { day: '2-digit', month: 'short' }).format(date);
    } catch (_) {
      return iso;
    }
  };

  const showPlaceholder = (text) => {
    if (placeholder) {
      placeholder.textContent = text;
      placeholder.style.display = 'inline-flex';
      placeholder.style.alignItems = 'center';
    }
    canvas.style.opacity = 0.2;
  };

  const hidePlaceholder = () => {
    if (placeholder) placeholder.style.display = 'none';
    canvas.style.opacity = 1;
  };

  const destroyChart = () => {
    if (chart && typeof chart.destroy === 'function') {
      chart.destroy();
    }
    chart = null;
  };

  const coerceSeries = (values = [], length) => {
    if (!Array.isArray(values)) return Array.from({ length }, () => 0);
    return Array.from({ length }, (_, idx) => Number(values[idx] || 0));
  };

  const renderChart = (payload) => {
    const rawLabels = payload && Array.isArray(payload.labels) ? payload.labels : [];
    const series = payload && payload.series ? payload.series : {};
    const meta = payload && payload.meta ? payload.meta : null;
    const vendorNamesSeries = meta && Array.isArray(meta.vendedores) ? meta.vendedores : [];
    const valuesMap = {
      ventas: coerceSeries(series.ventas, rawLabels.length),
      ordenes: coerceSeries(series.ordenes, rawLabels.length),
      vendedores: coerceSeries(series.vendedores, rawLabels.length),
    };
    const activeKeys = SERIES_ORDER.filter((key) => toggleState[key]);
    if (!activeKeys.length) {
      destroyChart();
      showPlaceholder('Activa al menos una serie para ver el grafico.');
      return;
    }
    const hasAnyData = activeKeys.some((key) => valuesMap[key].some((value) => value !== 0));
    if (!hasAnyData) {
      destroyChart();
      showPlaceholder('Sin datos disponibles en el periodo seleccionado.');
      return;
    }
    hidePlaceholder();
    destroyChart();
    const displayLabels = rawLabels.map((iso) => formatDay(iso));
    const datasets = activeKeys.map((key) => {
      const def = SERIES_DEFS[key];
      const dataset = {
        label: def.label,
        data: valuesMap[key],
        borderColor: def.borderColor,
        backgroundColor: def.backgroundColor,
        fill: def.fill,
        tension: def.tension,
        yAxisID: def.yAxisID,
        borderDash: def.borderDash,
        pointRadius: 2,
        pointHoverRadius: 4,
        datasetKey: key,
      };
      if (key === 'vendedores') {
        dataset.vendorNames = vendorNamesSeries;
      }
      return dataset;
    });
    const hasVentasAxis = datasets.some((set) => set.yAxisID === 'yVentas');
    const hasActividadAxis = datasets.some((set) => set.yAxisID === 'yActividad');
    chart = new ChartLib(ctx, {
      type: 'line',
      data: {
        labels: displayLabels,
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            labels: { color: '#cfe6ff' },
          },
          tooltip: {
            callbacks: {
              title: (items) => {
                if (!items || !items.length) return '';
                const idx = items[0].dataIndex;
                return formatDay(rawLabels[idx], { day: '2-digit', month: 'long', year: 'numeric' });
              },
              label: (item) => {
                const datasetMeta = item.dataset || {};
                if ((datasetMeta.datasetKey || '') === 'vendedores') {
                  const names = (Array.isArray(vendorNamesSeries[item.dataIndex]) ? vendorNamesSeries[item.dataIndex] : []);
                  if (names.length) return names.join(', ');
                  return 'Sin vendedores';
                }
                const label = datasetMeta.label || '';
                if ((datasetMeta.yAxisID || '') === 'yVentas') {
                  return `${label}: ${formatCurrency(item.parsed.y)}`;
                }
                return `${label}: ${Math.round(item.parsed.y)}`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { color: '#9fbad6', maxRotation: 0 },
            grid: { color: 'rgba(51, 88, 115, 0.25)' },
          },
          yVentas: {
            display: hasVentasAxis,
            position: 'left',
            ticks: {
              color: '#37d67a',
              callback: (value) => formatCurrency(value),
            },
            grid: { color: 'rgba(55, 214, 122, 0.15)' },
          },
          yActividad: {
            display: hasActividadAxis,
            position: hasVentasAxis ? 'right' : 'left',
            ticks: {
              color: '#4dc9f6',
              precision: 0,
              stepSize: 1,
            },
            grid: { color: 'rgba(77, 201, 246, 0.15)', drawOnChartArea: !hasVentasAxis },
          },
        },
      },
    });
  };

  const fetchData = async (days) => {
    const safeDays = Number.isFinite(days) ? Math.max(7, Math.min(days, 365)) : 30;
    const response = await fetch(`/api/admin/ventas-actividad/?days=${encodeURIComponent(safeDays)}`, {
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
  };

  const refresh = (range) => {
    const days = Number.isFinite(range) ? range : currentRange;
    currentRange = days;
    const ticket = ++requestTicket;
    if (anySeriesActive()) {
      showPlaceholder('Cargando datos...');
    } else {
      showPlaceholder('Activa al menos una serie para ver el grafico.');
    }
    fetchData(days)
      .then((data) => {
        if (ticket !== requestTicket) return;
        lastPayload = data;
        renderChart(data);
      })
      .catch((err) => {
        if (ticket !== requestTicket) return;
        console.error('Error cargando grafico ventas/actividad:', err);
        destroyChart();
        showPlaceholder('No se pudo cargar la informacion.');
      });
  };

  if (rangeSelect) {
    rangeSelect.addEventListener('change', () => {
      const days = parseInt(rangeSelect.value, 10);
      refresh(Number.isFinite(days) ? days : currentRange);
    });
  }

  window.addEventListener('admin:data-changed', () => refresh(currentRange));
  refresh(currentRange);
})();
