document.addEventListener("DOMContentLoaded", async () => {
  requireAuth();
  await loadQuiz();
});

let currentQuiz = null;

async function loadQuiz() {
  const container = document.getElementById("quiz-container");
  container.innerHTML = `<p class="empty-state">Loading today's quiz...</p>`;
  try {
    currentQuiz = await apiRequest("/quiz/today");
    renderQuiz();
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

function renderQuiz() {
  const container = document.getElementById("quiz-container");

  if (currentQuiz.completed) {
    renderResults();
    return;
  }

  container.innerHTML = `
    <form id="quiz-form">
      ${currentQuiz.questions
        .map(
          (q, i) => `
        <div class="card" style="margin-bottom:14px;">
          <p><strong>Q${i + 1}.</strong> ${q.question}</p>
          ${q.options
            .map(
              (opt, j) => `
            <label style="font-weight:400; display:block; margin:6px 0;">
              <input type="radio" name="q${i}" value="${j}" required style="width:auto; margin-right:8px;" />
              ${opt}
            </label>`
            )
            .join("")}
        </div>`
        )
        .join("")}
      <button type="submit" class="btn btn-primary">Submit answers</button>
    </form>
  `;

  document.getElementById("quiz-form").addEventListener("submit", submitQuiz);
}

async function submitQuiz(e) {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true;

  const answers = currentQuiz.questions.map((_, i) => {
    const checked = document.querySelector(`input[name="q${i}"]:checked`);
    return checked ? Number(checked.value) : -1;
  });

  try {
    currentQuiz = await apiRequest("/quiz/today/submit", { method: "POST", body: { answers } });
    renderResults();
  } catch (err) {
    showAlert("alert-box", err.message);
    btn.disabled = false;
  }
}

function renderResults() {
  const container = document.getElementById("quiz-container");
  const perfect = currentQuiz.score === currentQuiz.questions.length;

  container.innerHTML = `
    <div class="card" style="text-align:center; margin-bottom:16px;">
      <h2 style="margin:0;">${currentQuiz.score}/${currentQuiz.questions.length}</h2>
      <p class="muted">${perfect ? "Perfect score! 🎉" : "Nice work — here's how you did."}</p>
      <p><strong>+${currentQuiz.pointsAwarded} points</strong> <span class="muted">(toward your future BMed token balance)</span></p>
    </div>
    ${currentQuiz.questions
      .map((q, i) => {
        const userAnswer = currentQuiz.answers[i];
        const correct = userAnswer === q.correctIndex;
        return `
        <div class="card" style="margin-bottom:12px; ${correct ? "border-color:#16a34a;" : "border-color:#dc2626;"}">
          <p><strong>Q${i + 1}.</strong> ${q.question}</p>
          ${q.options
            .map((opt, j) => {
              let style = "";
              if (j === q.correctIndex) style = "color:#16a34a; font-weight:600;";
              else if (j === userAnswer) style = "color:#dc2626; text-decoration:line-through;";
              return `<p style="margin:4px 0; ${style}">${j === q.correctIndex ? "✓" : j === userAnswer ? "✗" : "&nbsp;&nbsp;"} ${opt}</p>`;
            })
            .join("")}
          <p class="muted" style="margin-top:8px;">${q.explanation}</p>
        </div>`;
      })
      .join("")}
    <p class="muted" style="text-align:center;">Come back tomorrow for a new quiz.</p>
  `;
}
