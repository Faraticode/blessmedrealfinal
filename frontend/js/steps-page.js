document.addEventListener("DOMContentLoaded", async () => {
  requireAuth();
  await loadSummary();
  await loadHistory();

  document.getElementById("start-tracking-btn").addEventListener("click", handleStart);
  document.getElementById("stop-tracking-btn").addEventListener("click", handleStop);
  document.getElementById("goal-form").addEventListener("submit", saveGoal);

  // Keep the on-screen count moving in near-real-time as steps are detected,
  // without waiting for the next server sync.
  refreshLoop = setInterval(refreshLocalCount, 2000);

  // Periodically pull the server-confirmed summary too, so milestone
  // badges/points update once a background sync lands.
  serverRefreshLoop = setInterval(() => {
    if (window.BlessMedSteps?.isTracking()) loadSummary();
  }, 16 * 1000);
});

let refreshLoop = null;
let serverRefreshLoop = null;

async function loadSummary() {
  try {
    const data = await apiRequest("/steps/summary");
    renderSummary(data);
    document.getElementById("goal-input").value = data.today.goal;
  } catch (err) {
    showAlert("alert-box", err.message);
  }
}

function renderSummary(data) {
  const pct = Math.min(100, Math.round((data.today.steps / data.today.goal) * 100));
  document.getElementById("steps-today").textContent = data.today.steps.toLocaleString();
  document.getElementById("steps-goal").textContent = data.today.goal.toLocaleString();
  document.getElementById("progress-bar").style.width = `${pct}%`;
  document.getElementById("progress-pct").textContent = `${pct}%`;
  document.getElementById("step-streak").textContent = data.stepStreak;
  document.getElementById("step-points").textContent = data.points;
  document.getElementById("weekly-total").textContent = data.weeklyTotal.toLocaleString();
  document.getElementById("lifetime-steps").textContent = data.milestones.totalStepsLifetime.toLocaleString();
  renderMilestones(data.milestones);
}

function renderMilestones(milestones) {
  const el = document.getElementById("milestones-list");
  const reachedThresholds = new Set(milestones.reached.map((m) => m.threshold));
  const all = [...milestones.reached, ...(milestones.next ? [milestones.next] : [])];

  if (!all.length) {
    el.innerHTML = `<p class="empty-state">No milestones yet.</p>`;
    return;
  }

  el.innerHTML = all
    .map((m) => {
      const reached = reachedThresholds.has(m.threshold);
      return `
      <div class="card" style="text-align:center; ${reached ? "border-color:var(--color-primary);" : "opacity:0.6;"}">
        <div style="font-size:1.6rem;">${reached ? "🏅" : "🔒"}</div>
        <strong>${m.threshold.toLocaleString()} steps</strong>
        <p class="muted" style="margin:4px 0 0;">${m.points} bonus points</p>
        ${reached ? `<span class="tag" style="background:#dcfce7; color:#16a34a;">reached</span>` : `<span class="tag">next goal</span>`}
      </div>`;
    })
    .join("");
}

function refreshLocalCount() {
  if (!window.BlessMedSteps?.isTracking()) return;
  const local = window.BlessMedSteps.getLocalSteps();
  const el = document.getElementById("steps-today");
  const currentGoal = Number(document.getElementById("steps-goal").textContent.replace(/,/g, "")) || 1;
  el.textContent = local.toLocaleString();
  const pct = Math.min(100, Math.round((local / currentGoal) * 100));
  document.getElementById("progress-bar").style.width = `${pct}%`;
  document.getElementById("progress-pct").textContent = `${pct}%`;
}

async function loadHistory() {
  try {
    const { entries } = await apiRequest("/steps?days=7");
    renderHistory(entries);
  } catch (err) {
    console.error(err);
  }
}

function renderHistory(entries) {
  const el = document.getElementById("history-list");
  if (!entries.length) {
    el.innerHTML = `<p class="empty-state">No step history yet — start tracking today.</p>`;
    return;
  }
  el.innerHTML = entries
    .map(
      (e) => `
    <div class="record-item">
      <div>${new Date(e.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</div>
      <div><strong>${e.steps.toLocaleString()}</strong> steps <span class="tag">${e.source.replace("_", " ")}</span></div>
    </div>`
    )
    .join("");
}

async function handleStart() {
  const startBtn = document.getElementById("start-tracking-btn");
  const stopBtn = document.getElementById("stop-tracking-btn");
  startBtn.disabled = true;

  const started = await window.BlessMedSteps.startStepTracking({
    onStep: () => refreshLocalCount(),
    onError: (err) => {
      showAlert("alert-box", err.message);
      startBtn.disabled = false;
    },
  });

  if (started) {
    startBtn.style.display = "none";
    stopBtn.style.display = "inline-block";
    document.getElementById("tracking-status").textContent = "Tracking is on — steps are being counted automatically.";
    showAlert("alert-box", "Automatic step tracking started.", "success");
  }
}

async function handleStop() {
  window.BlessMedSteps.stopStepTracking();
  document.getElementById("start-tracking-btn").style.display = "inline-block";
  document.getElementById("start-tracking-btn").disabled = false;
  document.getElementById("stop-tracking-btn").style.display = "none";
  document.getElementById("tracking-status").textContent = "Tracking is off.";
  await loadSummary();
  await loadHistory();
}

async function saveGoal(e) {
  e.preventDefault();
  try {
    const dailyStepGoal = Number(document.getElementById("goal-input").value);
    await apiRequest("/steps/goal", { method: "PUT", body: { dailyStepGoal } });
    showAlert("alert-box", "Daily step goal updated.", "success");
    await loadSummary();
  } catch (err) {
    showAlert("alert-box", err.message);
  }
}
