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

  const scrollToBottom = () => {
    messages.scrollTop = messages.scrollHeight;
  };

  const appendMessage = (text, sender = "bot") => {
    const wrapper = document.createElement("div");
    wrapper.className = `chatbot-message ${sender}`;
    wrapper.textContent = text;
    messages.appendChild(wrapper);
    scrollToBottom();
    return wrapper;
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
        appendMessage(data.answer, "bot");
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
      const question = btn.textContent.trim();
      if (!question) return;
      input.value = "";
      sendQuestion(question);
    });
  });
})();
