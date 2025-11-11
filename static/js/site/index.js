/** Anima la landing pública y sus componentes interactivos. */
(() => {
  // Fondo de estrellas
  const canvas = document.getElementById("stars");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    let W = 0, H = 0, stars = [];

    const resize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };

    const createStars = (count = 180) => {
      stars = Array.from({ length: count }).map(() => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.2 + 0.2,
        a: Math.random() * 1,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      for (const s of stars) {
        ctx.globalAlpha = s.a;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        s.a += (Math.random() - 0.5) * 0.03;
        if (s.a < 0.2) s.a = 0.2;
        if (s.a > 1) s.a = 1;
      }
      requestAnimationFrame(draw);
    };

    window.addEventListener("resize", () => {
      resize();
      createStars();
    });
    resize();
    createStars();
    draw();
  }

  // Año dinámico
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Nav toggle
  const navToggle = document.querySelector(".nav-toggle");
  const navGroup = document.getElementById("navGroup");
  if (navToggle && navGroup) {
    navToggle.addEventListener("click", () => {
      navGroup.classList.toggle("show");
    });
  }

  // Tema claro/oscuro
  const themeBtn = document.getElementById("themeToggle");
  if (themeBtn) {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const storedTheme = localStorage.getItem("theme");
    if (storedTheme === "light" || (!prefersDark && !storedTheme)) {
      document.body.classList.add("light");
    }
    themeBtn.addEventListener("click", () => {
      document.body.classList.toggle("light");
      localStorage.setItem("theme", document.body.classList.contains("light") ? "light" : "dark");
    });
  }

  // Chips de categorías
  const chips = document.querySelectorAll("[data-category-chip]");
  const categoriaSelect = document.getElementById("categoriaSelect");
  const filterForm = document.getElementById("catalogFilters");
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      if (categoriaSelect) {
        categoriaSelect.value = chip.value || "";
      }
      if (filterForm && typeof filterForm.requestSubmit === "function") {
        filterForm.requestSubmit();
      } else if (filterForm) {
        filterForm.submit();
      }
    });
  });

  // Auth tabs
  const authTabs = document.querySelectorAll(".auth-tab");
  const authForms = document.querySelectorAll(".auth-form");
  authTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.authTarget;
      authTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      authForms.forEach((form) => {
        form.classList.toggle("show", form.dataset.authPanel === target);
      });
    });
  });

  // Navegación por secciones
  const navLinks = document.querySelectorAll(".nav-links a[data-nav-target]");
  const sectionTriggers = document.querySelectorAll("[data-nav-target]");
  const sections = document.querySelectorAll("[data-section]");

  if (sections.length) {
    const scrollToSection = (name) => {
      const target = document.querySelector(`[data-section="${name}"]`);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };

    const activateSection = (name, { scroll = true } = {}) => {
      if (!name) return;
      let found = false;
      sections.forEach((section) => {
        const match = section.dataset.section === name;
        section.classList.toggle("is-active", match);
        if (match) found = true;
      });
      if (!found) return;
      navLinks.forEach((link) => {
        link.classList.toggle("active", link.dataset.navTarget === name);
      });
      if (navGroup) navGroup.classList.remove("show");
      const hash = `#${name}`;
      if (window.location.hash !== hash) {
        history.replaceState(null, "", hash);
      }
      if (scroll) {
        scrollToSection(name);
      }
    };

    sectionTriggers.forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        activateSection(link.dataset.navTarget);
      });
    });

    const initialHash = window.location.hash.replace("#", "") || (sections[0] && sections[0].dataset.section);
    activateSection(initialHash, { scroll: false });
  }

  // Asegura que el token CSRF coincida con la cookie (evita 403 tras login/logout)
  const getCookie = (name) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
    return null;
  };

  const syncCsrfForForms = () => {
    const cookieToken = getCookie('csrftoken');
    if (!cookieToken) return;
    document.querySelectorAll('form[action$="/newsletter/suscribir/"]').forEach((form) => {
      let input = form.querySelector('input[name="csrfmiddlewaretoken"]');
      if (!input) {
        input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'csrfmiddlewaretoken';
        form.prepend(input);
      }
      input.value = cookieToken;
      form.addEventListener('submit', () => { input.value = getCookie('csrftoken') || input.value; });
    });
  };
  syncCsrfForForms();
})();
