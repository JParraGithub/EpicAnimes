/** Controla el overlay de carga global para las secciones publicas. */
(() => {
  const loader = document.getElementById("pageLoader");
  if (!loader) return;

  const show = () => loader.classList.remove("is-hidden");
  const hide = () => loader.classList.add("is-hidden");

  window.addEventListener("load", () => {
    window.requestAnimationFrame(hide);
  });

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) hide();
  });

  window.addEventListener("beforeunload", () => {
    if (!document.hidden) show();
  });

  const shouldSkipLink = (el) => {
    if (!el) return true;
    const href = el.getAttribute("href") || "";
    return (
      href.startsWith("#") ||
      el.dataset.loaderSkip === "true" ||
      el.target === "_blank" ||
      el.hasAttribute("download")
    );
  };

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (!link || shouldSkipLink(link)) return;
    show();
  });

  document.addEventListener("submit", (event) => {
    const form = event.target.closest("form");
    if (!form || form.dataset.loaderSkip === "true") return;
    show();
  });

  window.EpicLoader = { show, hide };
})();
