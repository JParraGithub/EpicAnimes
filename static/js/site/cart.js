/** Gestiona la experiencia del carrito y su integración con PayPal. */
(() => {
  const csrfTokenMeta = document.querySelector('meta[name="csrf-token"]');
  const csrfToken = csrfTokenMeta ? csrfTokenMeta.getAttribute('content') : '';
  const totalAmountEl = document.getElementById('cartTotalAmount');
  const checkoutAlerts = document.getElementById('checkoutAlerts');
  const paypalWrapper = document.getElementById('paypalWrapper');
  const checkoutForm = document.getElementById('checkoutForm');
  const cartCountEl = document.querySelector('.cart-count');
  const bodyDataset = document.body ? document.body.dataset : {};
  const paypalEnabledFlag = bodyDataset.paypalEnabled === 'true';
  const paypalErrorMessage = bodyDataset.paypalError || '';
  const paypalCurrency = bodyDataset.paypalCurrency || 'CLP';

  const ZERO_DECIMAL_CURRENCIES = new Set(['BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF']);

  const state = {
    debounce: {},
    totalRaw: totalAmountEl ? parseFloat(totalAmountEl.dataset.totalRaw || '0') : 0,
    lastCheckoutData: null,
    paypalEnabled: paypalEnabledFlag,
    paypalError: paypalErrorMessage,
    paypalCurrency,
  };

  function isZeroDecimalCurrency(code) {
    if (!code) return false;
    return ZERO_DECIMAL_CURRENCIES.has(code.toUpperCase());
  }

  const numberFormatter = new Intl.NumberFormat('es-CL');

  function formatCurrency(value) {
    return numberFormatter.format(Math.round(value));
  }

  function showCheckoutMessage(message, type = 'warning') {
    if (!checkoutAlerts) return;
    checkoutAlerts.innerHTML = `
      <div class="alert alert-${type} mb-3" role="alert">${message}</div>
    `;
  }

  function clearCheckoutMessage() {
    if (!checkoutAlerts) return;
    if (!state.paypalEnabled && state.paypalError) {
      checkoutAlerts.innerHTML = `
        <div class="alert alert-warning mb-3" role="alert">${state.paypalError}</div>
      `;
      return;
    }
    checkoutAlerts.innerHTML = '';
  }

  function getPayPalAmountValue() {
    const raw = Number.isFinite(state.totalRaw) ? state.totalRaw : 0;
    const safeRaw = Math.max(0, raw);
    if (isZeroDecimalCurrency(state.paypalCurrency)) {
      return Math.round(safeRaw).toString();
    }
    return safeRaw.toFixed(2);
  }

  function updateSummary(data) {
    if (typeof data.total_raw !== 'undefined' && totalAmountEl) {
      state.totalRaw = parseFloat(data.total_raw);
      totalAmountEl.dataset.totalRaw = state.totalRaw.toString();
      totalAmountEl.textContent = formatCurrency(state.totalRaw);
    }

    if (cartCountEl && typeof data.cart_count !== 'undefined') {
      cartCountEl.textContent = data.cart_count;
    }

    if (typeof data.puede_pagar !== 'undefined') {
      const canPay = data.puede_pagar && state.paypalEnabled;
      if (paypalWrapper) {
        paypalWrapper.classList.toggle('d-none', !canPay);
      }
      if (!canPay) {
        if (!state.paypalEnabled && state.paypalError) {
          showCheckoutMessage(state.paypalError, 'warning');
        } else if (!data.puede_pagar && !data.error && !data.sin_stock) {
          showCheckoutMessage('Ajusta las cantidades para continuar. Hay productos sin stock suficiente.', 'warning');
        }
      } else {
        clearCheckoutMessage();
      }
    }

    const convertedEl = document.getElementById('paypalConvertedAmount');
    if (convertedEl) {
      const rate = parseFloat(convertedEl.dataset.rate || '0');
      const targetCurrency = convertedEl.dataset.orderCurrency || state.paypalCurrency;
      if (rate > 0) {
        const converted = state.totalRaw / rate;
        convertedEl.textContent = isZeroDecimalCurrency(targetCurrency)
          ? Math.round(converted).toString()
          : converted.toFixed(2);
      }
    }
  }

  function updateItemSubtotal(productId, subtotal) {
    const target = document.querySelector(`.js-item-subtotal[data-product-id="${productId}"]`);
    if (target) {
      target.textContent = formatCurrency(subtotal);
    }
  }

  function markQuantityError(input, message) {
    input.classList.add('is-invalid');
    let feedback = input.parentElement.querySelector('.invalid-feedback');
    if (!feedback) {
      feedback = document.createElement('div');
      feedback.className = 'invalid-feedback';
      input.parentElement.appendChild(feedback);
    }
    feedback.textContent = message || 'Cantidad inválida.';
  }

  function clearQuantityError(input) {
    input.classList.remove('is-invalid');
  }

  function sendQuantityUpdate(productId, cantidad, url, input) {
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ cantidad }),
    })
      .then((resp) => resp.json())
      .then((data) => {
        if (!data.ok) {
          markQuantityError(input, data.error || 'No se pudo actualizar.');
          return;
        }
        clearQuantityError(input);
        updateItemSubtotal(productId, parseFloat(data.subtotal_raw));
        const card = input.closest('.cart-item-card');
        if (card) {
          const warning = card.querySelector('.js-stock-warning');
          if (warning) {
            if (data.sin_stock) {
              warning.classList.remove('d-none');
              if (typeof data.stock_disponible !== 'undefined' && data.stock_disponible !== null) {
                warning.textContent = `Stock insuficiente. Disponible: ${data.stock_disponible}`;
              }
            } else {
              warning.classList.add('d-none');
            }
          }
        }
        updateSummary({
          total_raw: data.total_raw,
          cart_count: data.cart_count,
          puede_pagar: data.puede_pagar,
          sin_stock: data.sin_stock,
        });
      })
      .catch(() => {
        markQuantityError(input, 'No se pudo actualizar el carrito.');
      });
  }

  function handleQuantityChange(event) {
    const input = event.currentTarget;
    let value = parseInt(input.value, 10);
    if (!Number.isFinite(value) || value < 1) {
      value = 1;
      input.value = value;
    }
    const card = input.closest('.cart-item-card');
    if (!card) return;
    const productId = card.dataset.productId;
    const url = card.dataset.updateUrl;
    clearQuantityError(input);
    clearTimeout(state.debounce[productId]);
    state.debounce[productId] = setTimeout(() => {
      sendQuantityUpdate(productId, value, url, input);
    }, 350);
  }

  function removeItem(productId, url, card) {
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ remove: true }),
    })
      .then((resp) => resp.json())
      .then((data) => {
        if (!data.ok) {
          showCheckoutMessage(data.error || 'No se pudo eliminar el producto.', 'danger');
          return;
        }
        if (card) {
          const wrapper = card.closest('.col-12') || card.parentElement;
          if (wrapper) wrapper.remove();
        }
        updateSummary({
          total_raw: data.total_raw,
          cart_count: data.cart_count,
          puede_pagar: data.puede_pagar,
        });
        if (data.items_restantes <= 0) {
          window.location.reload();
        }
      })
      .catch(() => showCheckoutMessage('No se pudo eliminar el producto.', 'danger'));
  }

  function collectCheckoutData() {
    if (!checkoutForm) {
      return { ok: true, data: {} };
    }
    const getFieldValue = (name) => {
      const field = checkoutForm.elements[name];
      if (!field) {
        return '';
      }
      return (field.value || '').trim();
    };
    const data = {
      nombre: getFieldValue('nombre'),
      email: getFieldValue('email'),
      telefono: getFieldValue('telefono'),
      direccion: getFieldValue('direccion'),
      ciudad: getFieldValue('ciudad'),
      notas: getFieldValue('notas'),
    };
    const errors = {};
    if (!data.nombre) errors.nombre = 'Ingresa tu nombre completo.';
    if (!data.email) errors.email = 'Ingresa un correo válido.';
    if (!data.direccion) errors.direccion = 'Ingresa la dirección de entrega.';
    if (!data.ciudad) errors.ciudad = 'Indica la ciudad.';
    const ok = Object.keys(errors).length === 0;
    return { ok, data, errors };
  }

  function showFormErrors(errors) {
    if (!checkoutForm) return;
    ['nombre', 'email', 'telefono', 'direccion', 'ciudad', 'notas'].forEach((field) => {
      const input = checkoutForm[field];
      if (!input) return;
      const feedback = input.parentElement.querySelector('.invalid-feedback');
      if (errors[field]) {
        input.classList.add('is-invalid');
        if (feedback) feedback.textContent = errors[field];
      } else {
        input.classList.remove('is-invalid');
      }
    });
    if (errors.nombre || errors.email || errors.direccion || errors.ciudad) {
      showCheckoutMessage('Revisa los datos de envío para continuar.', 'warning');
    }
  }

  function clearFormErrors() {
    if (!checkoutForm) return;
    checkoutForm.querySelectorAll('.is-invalid').forEach((el) => el.classList.remove('is-invalid'));
  }

  document.querySelectorAll('.js-cart-qty').forEach((input) => {
    input.addEventListener('input', handleQuantityChange);
  });

  document.querySelectorAll('.js-cart-remove').forEach((button) => {
    button.addEventListener('click', () => {
      const productId = button.dataset.productId;
      const card = button.closest('.cart-item-card');
      const removeForm = document.getElementById(`remove-form-${productId}`);
      const url = removeForm ? removeForm.getAttribute('action') : null;
      if (!url) {
        removeForm?.submit();
        return;
      }
      removeItem(productId, url, card);
    });
  });

  if (checkoutForm) {
    checkoutForm.querySelectorAll('input, textarea').forEach((input) => {
      input.addEventListener('input', () => {
        input.classList.remove('is-invalid');
      });
    });
  }

  const fakeCheckoutBtn = document.getElementById('fakeCheckoutBtn');
  if (fakeCheckoutBtn) {
    const simulateUrl = fakeCheckoutBtn.dataset.simulateUrl;
    fakeCheckoutBtn.addEventListener('click', () => {
      if (!simulateUrl) return;
      const result = collectCheckoutData();
      if (!result.ok) {
        showFormErrors(result.errors || {});
        showCheckoutMessage('Completa los datos de envío antes de simular la compra.', 'warning');
        return;
      }
      fakeCheckoutBtn.disabled = true;
      fakeCheckoutBtn.classList.add('is-loading');
      fetch(simulateUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ datos_cliente: result.data }),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data && data.ok) {
            window.cartPage.setLastCheckoutData(result.data);
            window.location.href = data.redirect || window.location.href;
            return;
          }
          throw new Error(data && data.error ? data.error : 'Simulación rechazada');
        })
        .catch((err) => {
          fakeCheckoutBtn.disabled = false;
          fakeCheckoutBtn.classList.remove('is-loading');
          showCheckoutMessage(err.message || 'No se pudo registrar la compra ficticia.', 'danger');
        });
    });
  }

  let prefillSnapshot = {};
  if (checkoutForm) {
    prefillSnapshot = {
      nombre: checkoutForm.nombre ? checkoutForm.nombre.value.trim() : '',
      email: checkoutForm.email ? checkoutForm.email.value.trim() : '',
      telefono: checkoutForm.telefono ? checkoutForm.telefono.value.trim() : '',
      direccion: checkoutForm.direccion ? checkoutForm.direccion.value.trim() : '',
      ciudad: checkoutForm.ciudad ? checkoutForm.ciudad.value.trim() : '',
      notas: checkoutForm.notas ? checkoutForm.notas.value.trim() : ''
    };
    state.lastCheckoutData = prefillSnapshot;
  }

  window.cartPage = {
    collectCheckoutData,
    showFormErrors,
    setLastCheckoutData: (data) => {
      state.lastCheckoutData = data;
      window.cartPage.lastCheckoutData = data;
      clearFormErrors();
      clearCheckoutMessage();
    },
    getPayPalAmount: () => getPayPalAmountValue(),
    showCheckoutError: (message) => showCheckoutMessage(message, 'danger'),
    lastCheckoutData: state.lastCheckoutData,
    paypalEnabled: state.paypalEnabled,
    paypalError: state.paypalError,
    paypalCurrency: state.paypalCurrency,
  };
})();
