/** Administra el widget del chatbot y los mensajes que intercambia. */
(() => {
  const bubble = document.getElementById("chatbot-bubble");
  const panel = document.getElementById("chatbot-panel");
  if (!bubble || !panel) return;

  const dismissBtn = document.getElementById("chatbot-dismiss");
  const reopenBtn = document.getElementById("chatbot-reopen");
  const form = document.getElementById("chatbot-form");
  const input = document.getElementById("chatbot-input");
  const messages = document.getElementById("chatbot-messages");
  const suggestionButtons = Array.from(document.querySelectorAll(".chatbot-suggestion"));
  const csrfTokenMeta = document.querySelector('meta[name="csrf-token"]');
  const csrfToken = csrfTokenMeta ? csrfTokenMeta.getAttribute("content") : "";
  const API_URL = "/api/chatbot/ask/";
  const panelRole = panel.dataset.chatbotRole || "anonimo";
  const ROLE_HINTS = {
    anonimo: "Navegas como invitado; regístrate o inicia sesión para personalizar tu experiencia.",
    comprador: "Modo comprador activo; puedo ayudarte con pedidos, envíos y pagos.",
    vendedor: "Modo vendedor activo; revisemos stock, productos y métricas.",
    administrador: "Modo administrador activo; revisemos dashboards, usuarios o incidencias.",
  };
  const ROLE_GREETINGS = {
    anonimo:
      "¡Hola! ¿Qué tal?\nBienvenido a EpicAnimes, la tienda online de coleccionables de anime.\nPuedes registrarte o iniciar sesión desde el menú principal para guardar tus pedidos.",
    comprador:
      "¡Hola! ¿Qué tal?\nVeo tu sesión como comprador; te ayudo con compras, envíos y pagos.\nSi buscas un pedido revisa Mis compras o tu correo de confirmación.",
    vendedor:
      "¡Hola! ¿Qué tal?\nEstás en modo vendedor certificado; gestionemos productos, stock y alertas.\nRecuerda que avisamos cuando tu stock baja de 5 unidades.",
    administrador:
      "Veo que eres administrador; puedo ayudarte a navegar informes y tareas operativas.\n¡Hola! Soy EpicChat para administradores.\n¿En qué proceso necesitas apoyo con dashboards, usuarios o configuraciones?",
  };
  const ROLE_SUGGESTIONS = {
    anonimo: [
      "¿Qué es EpicAnimes?",
      "¿Cómo me registro?",
      "¿Qué categorías tienen?",
    ],
    comprador: [
      "¿Cómo hago seguimiento a mi pedido?",
      "¿Qué métodos de pago aceptan?",
      "¿Cuánto demora el envío?",
    ],
    vendedor: [
      "¿Cómo agrego un producto?",
      "¿Dónde veo mis ventas?",
      "¿Qué pasa si tengo poco stock?",
    ],
    administrador: [
      "¿Dónde veo las métricas globales?",
      "¿Cómo gestiono incidencias?",
      "¿Cómo van los vendedores hoy?",
    ],
  };
  let hintedRole = null;
  const getRoleHint = (role) => {
    if (!role || hintedRole === role) {
      return null;
    }
    const hint = ROLE_HINTS[role] || `Tu rol actual es ${role}.`;
    hintedRole = role;
    return hint;
  };

  const scrollToBottom = () => {
    messages.scrollTop = messages.scrollHeight;
  };

  const appendMessage = (text, sender = "bot", { roleHint } = {}) => {
    const wrapper = document.createElement("div");
    wrapper.className = `chatbot-message ${sender}`;
    if (roleHint) {
      const hint = document.createElement("div");
      hint.className = "chatbot-message__hint";
      hint.textContent = roleHint;
      wrapper.appendChild(hint);
    }
    const body = document.createElement("div");
    body.className = "chatbot-message__body";
    body.textContent = text;
    wrapper.appendChild(body);
    messages.appendChild(wrapper);
    scrollToBottom();
    return wrapper;
  };

  const renderInitialMessage = () => {
    if (!messages) return;
    const initial = messages.querySelector(".chatbot-message.bot[data-initial='true']");
    if (!initial) return;
    const hintText = ROLE_HINTS[panelRole] || "";
    const greetingText =
      ROLE_GREETINGS[panelRole] || ROLE_GREETINGS.comprador || "¡Hola! Soy EpicChat.";
    initial.innerHTML = "";
    if (hintText) {
      const hintEl = document.createElement("div");
      hintEl.className = "chatbot-message__hint";
      hintEl.textContent = hintText;
      initial.appendChild(hintEl);
    }
    const bodyEl = document.createElement("div");
    bodyEl.className = "chatbot-message__body";
    bodyEl.textContent = greetingText;
    initial.appendChild(bodyEl);
    hintedRole = panelRole;
  };

  const configureSuggestions = () => {
    if (!suggestionButtons.length) return;
    const suggestions = ROLE_SUGGESTIONS[panelRole] || ROLE_SUGGESTIONS.comprador || [];
    suggestionButtons.forEach((btn, index) => {
      const text = suggestions[index] || suggestions[0] || "¿Qué puedo hacer en EpicAnimes?";
      btn.textContent = text;
      btn.dataset.suggestionText = text;
    });
    const title = document.getElementById("chatbot-suggestions-title");
    if (title) {
      title.textContent =
        panelRole === "anonimo"
          ? "¿Nueva o nuevo por aquí? Intenta con estas preguntas:"
          : "¿Necesitas ideas? Pregunta por:";
    }
  };

  const addTypingIndicator = () => {
    const typing = document.createElement("div");
    typing.className = "chatbot-message bot";
    typing.dataset.typing = "true";
    typing.textContent = "Buscando la mejor respuesta…";
    messages.appendChild(typing);
    scrollToBottom();
    return typing;
  };

  const setBusy = (isBusy) => {
    const submitBtn = form?.querySelector("button[type='submit']");
    if (submitBtn) submitBtn.disabled = isBusy;
    if (input) input.disabled = isBusy;
  };

  const openPanel = () => {
    panel.hidden = false;
    bubble.classList.add("is-open");
    bubble.setAttribute("aria-expanded", "true");
    setTimeout(() => input && input.focus(), 150);
  };

  const closePanel = () => {
    panel.hidden = true;
    bubble.classList.remove("is-open");
    bubble.setAttribute("aria-expanded", "false");
  };

  const HIDE_KEY = "epicChatbotHidden";
  const root = document.documentElement;

  const applyHiddenState = (hidden) => {
    if (hidden) {
      root.classList.add("chatbot-hidden");
      localStorage.setItem(HIDE_KEY, "1");
      closePanel();
    } else {
      root.classList.remove("chatbot-hidden");
      localStorage.removeItem(HIDE_KEY);
    }
    if (reopenBtn) reopenBtn.hidden = !hidden;
  };

  const initialHidden = localStorage.getItem(HIDE_KEY) === "1";
  applyHiddenState(initialHidden);
  if (!initialHidden) {
    if (reopenBtn) reopenBtn.hidden = true;
  }
  renderInitialMessage();
  configureSuggestions();

  bubble.addEventListener("click", (event) => {
    if (root.classList.contains("chatbot-hidden")) {
      applyHiddenState(false);
      event.stopPropagation();
      return;
    }
    event.stopPropagation();
    panel.hidden ? openPanel() : closePanel();
  });

  if (dismissBtn) {
    dismissBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      applyHiddenState(true);
    });
  }

  if (reopenBtn) {
    reopenBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      applyHiddenState(false);
      openPanel();
    });
  }

  panel.addEventListener("click", (event) => event.stopPropagation());

  document.addEventListener("click", (event) => {
    if (panel.hidden || root.classList.contains("chatbot-hidden")) return;
    if (panel.contains(event.target) || bubble.contains(event.target)) return;
    closePanel();
  });

  document.addEventListener("keydown", (event) => {
    if (!panel.hidden && event.key === "Escape") {
      closePanel();
    }
  });

  const sendQuestion = async (question) => {
    if (!question) return;
    appendMessage(question, "user");
    const typing = addTypingIndicator();
    setBusy(true);
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken,
        },
        body: JSON.stringify({ message: question }),
      });
      const data = await response.json();
      typing.remove();
      if (!data.ok) {
        appendMessage(data.error || "Lo siento, no pude responder eso ahora mismo.", "bot");
      } else {
        const hint = getRoleHint(data.user_role);
        appendMessage(data.answer, "bot", { roleHint: hint });
      }
    } catch (error) {
      typing.remove();
      appendMessage("Hubo un problema de conexión. Intenta nuevamente en un momento.", "bot");
    } finally {
      setBusy(false);
      input?.focus();
    }
  };

  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const question = input.value.trim();
      if (!question) return;
      input.value = "";
      sendQuestion(question);
    });
  }

  suggestionButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const question = (btn.dataset.suggestionText || btn.textContent || "").trim();
      if (!question) return;
      input.value = "";
      sendQuestion(question);
    });
  });
})();
