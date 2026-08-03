import { useEffect, useRef, useState } from "react";
import Alert from "../components/Alert";
import { apiRequest } from "../lib/api";

export default function Assistant() {
  const [messages, setMessages] = useState(null); // null = loading
  const [disabled, setDisabled] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState("");
  const chatWindowRef = useRef(null);

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, thinking]);

  function scrollToBottom() {
    const el = chatWindowRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }

  async function loadHistory() {
    try {
      const { messages: history, disabled: isDisabled } = await apiRequest("/assistant/history");
      setDisabled(!!isDisabled);
      setMessages(history);
    } catch (err) {
      setError(err.message);
      setMessages([]);
    }
  }

  async function handleSend(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setError("");
    setSending(true);
    setInput("");
    setMessages((m) => [...(m || []), { _id: `pending-${Date.now()}`, role: "user", content: text }]);
    setThinking(true);

    try {
      const { assistantMessage } = await apiRequest("/assistant/chat", {
        method: "POST",
        body: { message: text },
      });
      setThinking(false);
      setMessages((m) => [...m, assistantMessage]);
    } catch (err) {
      setThinking(false);
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function handleClear() {
    if (!confirm("Clear your entire chat history? This cannot be undone.")) return;
    try {
      await apiRequest("/assistant/history", { method: "DELETE" });
      setMessages([]);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <h2>Health Assistant</h2>

      {disabled ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <h3 style={{ marginTop: 0 }}>Coming soon</h3>
          <p className="muted">
            The AI Health Assistant is being finished up and will be available here soon.
          </p>
        </div>
      ) : (
        <>
          <div className="flex-between">
            {messages && messages.length > 0 && (
              <button className="btn btn-outline" style={{ padding: "6px 12px" }} onClick={handleClear}>
                Clear history
              </button>
            )}
          </div>
          <Alert message={error} />

          <div className="card">
            <div className="chat-window" ref={chatWindowRef}>
              {messages === null ? (
                <p className="loading-text">Loading...</p>
              ) : messages.length === 0 ? (
                <p className="empty-state">
                  Ask me about general wellness, medication reminders, or how to use your health records. I'm not a
                  doctor — for anything urgent, please contact a clinician.
                </p>
              ) : (
                <>
                  {messages.map((m) => (
                    <div className={`chat-bubble chat-bubble-${m.role}`} key={m._id}>
                      {m.content}
                    </div>
                  ))}
                  {thinking && <div className="chat-bubble chat-bubble-assistant chat-typing">Thinking...</div>}
                </>
              )}
            </div>

            <form className="chat-input-row" onSubmit={handleSend}>
              <input
                type="text"
                placeholder="Ask a question..."
                value={input}
                disabled={sending}
                onChange={(e) => setInput(e.target.value)}
              />
              <button type="submit" className="btn btn-primary" disabled={sending || !input.trim()}>
                Send
              </button>
            </form>
            <p className="chat-disclaimer">
              Not a substitute for professional medical advice. For emergencies, use the Emergency page or contact a
              clinician directly.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
