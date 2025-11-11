/** Pinta el estado de cada vendedor dentro del panel administrativo. */
﻿// UI de "Cambiar Estado" para vendedores con botones Activar/Suspender
(function(){
  const vendBody = document.querySelector('#tablaVendedores tbody');
  if (!vendBody) return;

  const getCookie = (name) => {
    const value = '; ' + document.cookie;
    const parts = value.split('; ' + name + '=');
    if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
    return null;
  };
  const csrftoken = getCookie('csrftoken');

  const patchRow = (tr) => {
    if (!(tr && tr.querySelector)) return;
    const tds = tr.querySelectorAll('td');
    if (tds.length < 8) return;
    const controlCell = tds[6]; // 7ma columna: Cambiar Estado
    const isDisabled = tr.getAttribute('data-disabled') === '1';
    controlCell.innerHTML = `<button class="status-badge ${isDisabled ? 'offline' : 'online'}" data-action="toggle" title="Cambiar estado">${isDisabled ? 'Inactivo' : 'Activo'}</button>`;

    // No tocar la columna Estado (6ta). La gestiona dashboard_administrador.js
    // con presencia en tiempo real para decidir Activo/Inactivo/Suspendido.
  };

  // Parchar filas iniciales y futuras
  vendBody.querySelectorAll('tr[data-id]').forEach(patchRow);
  const mo = new MutationObserver((mutations) => {
    mutations.forEach((m) => {
      m.addedNodes.forEach((node) => { if (node.nodeType === 1 && node.matches('tr[data-id]')) patchRow(node); });
      if (m.type === 'childList' && m.target === vendBody && vendBody.childElementCount) {
        // Cuando se reemplaza todo el tbody
        vendBody.querySelectorAll('tr[data-id]').forEach(patchRow);
      }
    });
  });
  mo.observe(vendBody, { childList: true, subtree: true });

  })();


