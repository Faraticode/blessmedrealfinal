document.addEventListener("DOMContentLoaded", async () => {
  requireAuth();
  const user = Auth.getUser();
  document.getElementById("greeting").textContent = `Welcome back, ${user.firstName || user.name.split(" ")[0]}`;

  // Profile completeness summary
  try {
    const { user: fresh } = await apiRequest("/profile");
    Auth.setUser(fresh);
    renderProfileSummary(fresh);
    renderPointsHero(fresh);
    renderNavPointsBadge(fresh.points);
  } catch (err) {
    console.error(err);
  }

  // Steps snapshot
  try {
    const summary = await apiRequest("/steps/summary");
    renderStepsSummary(summary);
  } catch (err) {
    console.error(err);
  }

  // Daily check-in status
  try {
    const checkin = await apiRequest("/checkin/today");
    renderCheckinSummary(checkin);
  } catch (err) {
    console.error(err);
  }

  // Daily quiz status
  try {
    const quiz = await apiRequest("/quiz/today");
    renderQuizSummary(quiz);
  } catch (err) {
    console.error(err);
  }

  // Health tips feed
  try {
    const { tips } = await apiRequest("/tips");
    renderTips(tips.slice(0, 4));
  } catch (err) {
    console.error(err);
  }
});

function renderPointsHero(user) {
  const points = user.points || 0;
  document.getElementById("points-total").textContent = points.toLocaleString();
  document.getElementById("points-bmed").textContent = formatBmed(points);
}

function renderProfileSummary(user) {
  const el = document.getElementById("profile-summary");
  const complete = user.age && user.bloodGroup !== "Unknown" && user.emergencyContact?.phone;
  el.innerHTML = `
    <p><strong>Blood group:</strong> ${user.bloodGroup || "Not set"}</p>
    <p><strong>Genotype:</strong> ${user.genotype || "Not set"}</p>
    <p><strong>Allergies:</strong> ${user.allergies?.length ? user.allergies.join(", ") : "None on file"}</p>
    ${!complete ? `<p class="muted">Your profile is incomplete — <a href="profile.html">finish it</a> so your emergency QR code is accurate.</p>` : ""}
  `;
}

function renderStepsSummary(summary) {
  const el = document.getElementById("steps-summary");
  const pct = Math.min(100, Math.round((summary.today.steps / summary.today.goal) * 100));
  el.innerHTML = `
    <p style="font-size:1.6rem; font-weight:700; color:var(--color-primary-dark); margin:0;">${summary.today.steps.toLocaleString()}</p>
    <p class="muted" style="margin-top:0;">of ${summary.today.goal.toLocaleString()} steps (${pct}%)</p>
    <p><strong>🔥 Streak:</strong> ${summary.stepStreak} day(s)</p>
  `;
}

function renderCheckinSummary(checkin) {
  const el = document.getElementById("checkin-summary");
  if (!checkin.walletConnected) {
    el.innerHTML = `
      <p class="muted">Connect your Stacks wallet to start checking in.</p>
      <p><strong>🔥 Streak:</strong> ${checkin.checkinStreak} day(s)</p>
    `;
  } else if (checkin.completed) {
    el.innerHTML = `
      <p style="font-size:1.6rem; font-weight:700; color:var(--color-primary-dark); margin:0;">✅ Done</p>
      <p class="muted" style="margin-top:0;">🔥 Streak: ${checkin.checkinStreak} day(s)</p>
    `;
  } else {
    el.innerHTML = `
      <p class="muted">Not checked in yet today.</p>
      <p><strong>🔥 Streak:</strong> ${checkin.checkinStreak} day(s)</p>
    `;
  }
}

function renderQuizSummary(quiz) {
  const el = document.getElementById("quiz-summary");
  if (quiz.completed) {
    el.innerHTML = `
      <p style="font-size:1.6rem; font-weight:700; color:var(--color-primary-dark); margin:0;">${quiz.score}/5</p>
      <p class="muted" style="margin-top:0;">Completed today — nice work.</p>
    `;
  } else {
    el.innerHTML = `<p class="muted">5 quick questions based on your health profile — ready when you are.</p>`;
  }
}

function renderTips(tips) {
  const el = document.getElementById("tips-feed");
  if (!tips.length) {
    el.innerHTML = `<p class="empty-state">No tips available right now.</p>`;
    return;
  }
  el.innerHTML = tips
    .map(
      (t) => `
      <div class="card">
        <span class="tag">${t.category.replace("_", " ")}</span>
        <h3>${t.title}</h3>
        <p class="muted">${t.content}</p>
      </div>`
    )
    .join("");
}
