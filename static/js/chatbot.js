(() => {
  const bubble = document.getElementById("chatbot-bubble");
  const panel = document.getElementById("chatbot-panel");
  if (!bubble || !panel) return;

  const closeBtn = document.getElementById("chatbot-close");
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
  };

  const setBusy = (isBusy) => {
    form.querySelector("button[type='submit']").disabled = isBusy;
    input.disabled = isBusy;
  };

  const openPanel = () => {
    panel.hidden = false;
    bubble.setAttribute("aria-expanded", "true");
    setTimeout(() => input.focus(), 150);
  };

  const closePanel = () => {
    panel.hidden = true;
    bubble.setAttribute("aria-expanded", "false");
  };

  bubble.addEventListener("click", () => {
    panel.hidden ? openPanel() : closePanel();
  });

  if (closeBtn) {
    closeBtn.addEventListener("click", closePanel);
  }

  suggestionButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      input.value = btn.textContent.trim();
      input.focus();
    });
  });

  const sendQuestion = async (question) => {
    appendMessage(question, "user");
    appendMessage("Buscando la mejor respuesta…", "bot");
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
      messages.removeChild(messages.lastElementChild); // remove typing message
      if (!data.ok) {
        appendMessage(data.error || "Lo siento, no pude responder eso ahora mismo.", "bot");
      } else {
        appendMessage(data.answer, "bot");
      }
    } catch (error) {
      messages.removeChild(messages.lastElementChild);
      appendMessage("Hubo un problema de conexión. Intenta nuevamente en un momento.", "bot");
    } finally {
      setBusy(false);
      input.focus();
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
})();
