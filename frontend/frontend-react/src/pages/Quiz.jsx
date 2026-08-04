import { useEffect, useState } from "react";
import Alert from "../components/Alert";
import { apiRequest } from "../lib/api";

export default function Quiz() {
  const [quiz, setQuiz] = useState(null); // null = loading
  const [answers, setAnswers] = useState([]);
  const [status, setStatus] = useState({ message: "", type: "error" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadQuiz();
  }, []);

  async function loadQuiz() {
    setQuiz(null);
    setStatus({ message: "" });
    try {
      const data = await apiRequest("/quiz/today");
      setQuiz(data);
      setAnswers(new Array(data.questions.length).fill(null));
    } catch (err) {
      setStatus({ message: err.message, type: "error" });
    }
  }

  function selectAnswer(qIndex, optIndex) {
    setAnswers((a) => a.map((v, i) => (i === qIndex ? optIndex : v)));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (answers.some((a) => a === null)) {
      setStatus({ message: "Please answer every question before submitting.", type: "error" });
      return;
    }
    setBusy(true);
    setStatus({ message: "" });
    try {
      const data = await apiRequest("/quiz/today/submit", { method: "POST", body: { answers } });
      setQuiz(data);
    } catch (err) {
      setStatus({ message: err.message, type: "error" });
    } finally {
      setBusy(false);
    }
  }

  if (!quiz) {
    return (
      <div className="container" style={{ maxWidth: 680 }}>
        <h2>Daily Health Quiz</h2>
        <Alert message={status.message} type={status.type} />
        {!status.message && <p className="loading-text">Loading today's quiz...</p>}
      </div>
    );
  }

  if (quiz.disabled) {
    return (
      <div className="container" style={{ maxWidth: 680 }}>
        <h2>Daily Health Quiz</h2>
        <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <h3 style={{ marginTop: 0 }}>Coming soon</h3>
          <p className="muted">
            The daily health quiz is being finished up and will be available here soon.
          </p>
        </div>
      </div>
    );
  }

  if (quiz.completed) {
    const perfect = quiz.score === quiz.questions.length;
    return (
      <div className="container" style={{ maxWidth: 680 }}>
        <h2>Daily Health Quiz</h2>
        <div className="card" style={{ textAlign: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>
            {quiz.score}/{quiz.questions.length}
          </h2>
          <p className="muted">{perfect ? "Perfect score! 🎉" : "Nice work — here's how you did."}</p>
          <p>
            <strong>+{quiz.pointsAwarded} points</strong>{" "}
            <span className="muted">(toward your future BMed token balance)</span>
          </p>
        </div>

        {quiz.questions.map((q, i) => {
          const userAnswer = quiz.answers[i];
          const correct = userAnswer === q.correctIndex;
          return (
            <div className="card" key={i} style={{ marginBottom: 12, borderColor: correct ? "#16a34a" : "#dc2626" }}>
              <p>
                <strong>Q{i + 1}.</strong> {q.question}
              </p>
              {q.options.map((opt, j) => {
                let style = {};
                if (j === q.correctIndex) style = { color: "#16a34a", fontWeight: 600 };
                else if (j === userAnswer) style = { color: "#dc2626", textDecoration: "line-through" };
                return (
                  <p style={{ margin: "4px 0", ...style }} key={j}>
                    {j === q.correctIndex ? "✓" : j === userAnswer ? "✗" : "\u00a0\u00a0"} {opt}
                  </p>
                );
              })}
              <p className="muted" style={{ marginTop: 8 }}>
                {q.explanation}
              </p>
            </div>
          );
        })}
        <p className="muted" style={{ textAlign: "center" }}>
          Come back tomorrow for a new quiz.
        </p>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 680 }}>
      <h2>Daily Health Quiz</h2>
      <p className="muted">5 quick questions based on general wellness — educational only, not medical advice.</p>
      <Alert message={status.message} type={status.type} />

      <form onSubmit={handleSubmit}>
        {quiz.questions.map((q, i) => (
          <div className="card" style={{ marginBottom: 14 }} key={i}>
            <p>
              <strong>Q{i + 1}.</strong> {q.question}
            </p>
            {q.options.map((opt, j) => (
              <label key={j} style={{ fontWeight: 400, display: "block", margin: "6px 0" }}>
                <input
                  type="radio"
                  name={`q${i}`}
                  checked={answers[i] === j}
                  onChange={() => selectAnswer(i, j)}
                  style={{ width: "auto", marginRight: 8 }}
                />
                {opt}
              </label>
            ))}
          </div>
        ))}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Submitting..." : "Submit answers"}
        </button>
      </form>
    </div>
  );
}
