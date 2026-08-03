document.addEventListener("DOMContentLoaded", async () => {
  requireAuth();
  await loadHistory();

  document.getElementById("chat-form").addEventListener("submit", sendMessage);
  document.getElementById("clear-history-btn").addEventListener("click", clearHistory);
});

async function loadHistory() {
  try {
    const { messages } = await apiRequest("/assistant/history");
    if (!messages.length) {
      renderWelcomeMessage();
      return;
    }
    messages.forEach(renderMessage);
    scrollToBottom();
  } catch (err) {
    showAlert("alert-box", err.message);
  }
}

function renderWelcomeMessage() {
  const el = document.getElementById("chat-window");
  el.innerHTML = `<p class="empty-state">Ask me about general wellness, medication reminders, or how to use your health records. I'm not a doctor — for anything urgent, please contact a clinician.</p>`;
}

async function sendMessage(e) {
  e.preventDefault();
  const input = document.getElementById("chat-input");
  const text = input.value.trim();
  if (!text) return;

  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true;
  input.disabled = true;

  // Clear the welcome/empty state on first message
  const chatWindow = document.getElementById("chat-window");
  if (chatWindow.querySelector(".empty-state")) chatWindow.innerHTML = "";

  renderMessage({ role: "user", content: text });
  input.value = "";
  scrollToBottom();

  const typingEl = renderTypingIndicator();

  try {
    const { assistantMessage } = await apiRequest("/assistant/chat", {
      method: "POST",
      body: { message: text },
    });
    typingEl.remove();
    renderMessage(assistantMessage);
  } catch (err) {
    typingEl.remove();
    showAlert("alert-box", err.message);
  } finally {
    btn.disabled = false;
    input.disabled = false;
    input.focus();
    scrollToBottom();
  }
}

function renderMessage(msg) {
  const el = document.getElementById("chat-window");
  const bubble = document.createElement("div");
  bubble.className = `chat-bubble chat-bubble-${msg.role}`;
  bubble.textContent = msg.content;
  el.appendChild(bubble);
}

function renderTypingIndicator() {
  const el = document.getElementById("chat-window");
  const bubble = document.createElement("div");
  bubble.className = "chat-bubble chat-bubble-assistant chat-typing";
  bubble.textContent = "Thinking...";
  el.appendChild(bubble);
  scrollToBottom();
  return bubble;
}

function scrollToBottom() {
  const el = document.getElementById("chat-window");
  el.scrollTop = el.scrollHeight;
}

async function clearHistory() {
  if (!confirm("Clear your entire chat history? This cannot be undone.")) return;
  try {
    await apiRequest("/assistant/history", { method: "DELETE" });
    document.getElementById("chat-window").innerHTML = "";
    renderWelcomeMessage();
  } catch (err) {
    showAlert("alert-box", err.message);
  }
}
