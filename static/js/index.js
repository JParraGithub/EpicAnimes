document.addEventListener("DOMContentLoaded", () => {
  const authModal = document.getElementById("authModal");
  if (authModal) {
    let defaultTab = authModal.getAttribute("data-default-tab");
    try {
      const params = new URLSearchParams(window.location.search);
      const qs = (params.get('auth') || '').toLowerCase();
      if (qs === 'register' || qs === 'registro' || qs === 'signup') defaultTab = 'registerTab';
      if (qs === 'login' || qs === 'ingreso') defaultTab = 'loginTab';
    } catch (_) {}
    if (defaultTab) {
      const trigger = authModal.querySelector(`[data-bs-target="#${defaultTab}"]`);
      if (trigger) {
        const tab = new bootstrap.Tab(trigger);
        tab.show();
      }
      const modal = new bootstrap.Modal(authModal);
      modal.show();
    }
  }

  const quantityInputs = document.querySelectorAll("[data-quantity-max]");
  quantityInputs.forEach(input => {
    input.addEventListener("input", () => {
      const max = parseInt(input.dataset.quantityMax, 10);
      let value = parseInt(input.value, 10);
      if (Number.isNaN(value) || value < 1) {
        value = 1;
      }
      if (!Number.isNaN(max) && max > 0 && value > max) {
        value = max;
      }
      input.value = value;
    });
  });

  const clearFiltersBtn = document.getElementById("clearFilters");
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener("click", () => {
      window.location.href = window.location.pathname;
    });
  }

  const authTriggers = document.querySelectorAll(".require-auth");
  if (authTriggers.length) {
    authTriggers.forEach(trigger => {
      trigger.addEventListener("click", event => {
        event.preventDefault();
        if (window.__authNoticeActive) {
          return;
        }
        const redirect = trigger.dataset.loginUrl || trigger.getAttribute("href") || "/accounts/login/";
        const message = trigger.dataset.message || "Necesitas iniciar sesion para continuar.";
        showAuthNotice(message, redirect);
      });
    });
  }

});

let authNoticeHandle = null;
let authNoticeInterval = null;
function showAuthNotice(message, redirectUrl) {
  if (window.__authNoticeActive) {
    return;
  }
  window.__authNoticeActive = true;
  if (!redirectUrl) {
    redirectUrl = "/accounts/login/";
  }

  if (window.__authNoticeElement) {
    window.__authNoticeElement.remove();
  }
  if (authNoticeHandle) {
    clearTimeout(authNoticeHandle);
    authNoticeHandle = null;
  }
  if (authNoticeInterval) {
    clearInterval(authNoticeInterval);
    authNoticeInterval = null;
  }

  const container = document.createElement("div");
  container.className = "auth-notice";
  container.innerHTML = `
    <i class="fa fa-bell"></i>
    <div class="auth-notice__body">
      <strong>Acceso requerido</strong>
      <span>${message}</span>
      <div class="auth-notice__timer">Redirigiendo en <span data-countdown>2</span>s...</div>
    </div>
  `;
  document.body.appendChild(container);
  window.__authNoticeElement = container;
  requestAnimationFrame(() => {
    container.classList.add("is-visible");
  });

  let remaining = 2;
  const countdownElement = container.querySelector("[data-countdown]");
  authNoticeInterval = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      remaining = 0;
      clearInterval(authNoticeInterval);
      authNoticeInterval = null;
    }
    if (countdownElement) {
      countdownElement.textContent = remaining.toString();
    }
  }, 1000);

  authNoticeHandle = setTimeout(() => {
    if (container) {
      container.classList.add("is-hiding");
    }
  }, 1600);

  setTimeout(() => {
    window.location.href = redirectUrl;
  }, 2100);
}

