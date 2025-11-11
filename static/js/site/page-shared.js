/** Aporta utilidades compartidas para las páginas públicas. */
(() => {
  const yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  const navToggle = document.querySelector(".nav-toggle");
  const navGroup = document.getElementById("navGroup");
  if (navToggle && navGroup) {
    navToggle.addEventListener("click", () => {
      navGroup.classList.toggle("show");
    });
    navGroup.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => navGroup.classList.remove("show"));
    });
  }

  const themeBtn = document.getElementById("themeToggle");
  if (themeBtn) {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const storedTheme = localStorage.getItem("theme");
    const shouldUseLight = storedTheme === "light" || (!prefersDark && !storedTheme);
    if (shouldUseLight) {
      document.body.classList.add("light");
    }
    themeBtn.addEventListener("click", () => {
      document.body.classList.toggle("light");
      localStorage.setItem("theme", document.body.classList.contains("light") ? "light" : "dark");
    });
  }

  const sections = document.querySelectorAll("[data-section]");
  if (sections.length) {
    const sectionLinks = document.querySelectorAll(".nav-links a[data-nav-target]");
    const activateSection = (name) => {
      if (!name) return;
      let found = false;
      sections.forEach((section) => {
        const match = section.dataset.section === name;
        section.classList.toggle("is-active", match);
        if (match) found = true;
      });
      if (!found) return;
      sectionLinks.forEach((link) => {
        link.classList.toggle("active", link.dataset.navTarget === name);
      });
      if (navGroup) navGroup.classList.remove("show");
      const hash = `#${name}`;
      if (window.location.hash !== hash) {
        history.replaceState(null, "", hash);
      }
    };

    sectionLinks.forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        activateSection(link.dataset.navTarget);
      });
    });

    const initialHash = window.location.hash.replace("#", "") || (sections[0] && sections[0].dataset.section);
    activateSection(initialHash);
  }
})();
