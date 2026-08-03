document.addEventListener("DOMContentLoaded", async () => {
  requireAuth();
  await loadCheckin();
});

const MOODS = [
  { value: "great", emoji: "😄", label: "Great" },
  { value: "good", emoji: "🙂", label: "Good" },
  { value: "okay", emoji: "😐", label: "Okay" },
  { value: "low", emoji: "😕", label: "Low" },
  { value: "struggling", emoji: "😣", label: "Struggling" },
];

let todayStatus = null;

async function loadCheckin() {
  const container = document.getElementById("checkin-container");
  container.innerHTML = `<p class="empty-state">Loading today's check-in...</p>`;
  try {
    todayStatus = await apiRequest("/checkin/today");
    render();
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

function render() {
  const container = document.getElementById("checkin-container");

  if (!todayStatus.walletConnected) {
    renderConnectPrompt(container);
    return;
  }

  if (todayStatus.completed) {
    renderCompleted(container);
    return;
  }

  renderMoodPicker(container);
}

function renderConnectPrompt(container) {
  container.innerHTML = `
    <div class="card" style="text-align:center;">
      <div style="font-size:2.4rem;">🔗</div>
      <h3 style="margin:6px 0 8px;">Connect your Stacks wallet first</h3>
      <p class="muted">Check-in is verified with your Stacks wallet — a quick signature that proves it's really you, no gas fee involved.</p>
      <button id="connect-wallet-btn" class="btn btn-primary" style="margin-top:10px;">Connect wallet</button>
    </div>
  `;

  document.getElementById("connect-wallet-btn").addEventListener("click", (e) => {
    const btn = e.target;
    btn.disabled = true;
    btn.textContent = "Opening wallet...";
    window.BlessMedStacks.connectStacksWallet({
      onSuccess: async () => {
        await loadCheckin();
      },
      onError: (err) => {
        showAlert("alert-box", err.message);
        btn.disabled = false;
        btn.textContent = "Connect wallet";
      },
    });
  });
}

function renderCompleted(container) {
  const c = todayStatus.checkin;
  const mood = MOODS.find((m) => m.value === c.mood);
  container.innerHTML = `
    <div class="card" style="text-align:center;">
      <div style="font-size:2.6rem;">${mood ? mood.emoji : "✅"}</div>
      <h3 style="margin:6px 0 0;">Checked in for today</h3>
      <p class="muted">Feeling ${mood ? mood.label.toLowerCase() : c.mood}${c.note ? ` — "${c.note}"` : ""}</p>
      <p><strong>+${c.pointsAwarded} points</strong> <span class="muted">(toward your future BMed token balance)</span></p>
      <p><strong>🔥 Streak:</strong> ${todayStatus.checkinStreak} day(s)</p>
      <p class="muted" style="font-size:0.78rem;">Verified with wallet ${c.walletAddress.slice(0, 6)}...${c.walletAddress.slice(-4)}</p>
      <p class="muted">Come back tomorrow to keep it going.</p>
    </div>
  `;
}

function renderMoodPicker(container) {
  container.innerHTML = `
    <div class="card">
      <h3>How are you feeling today?</h3>
      <div id="mood-picker" style="display:flex; gap:10px; justify-content:space-between; margin:16px 0; flex-wrap:wrap;">
        ${MOODS.map(
          (m) => `
          <button type="button" class="mood-btn" data-mood="${m.value}" style="flex:1; min-width:70px; padding:14px 6px; border:1px solid var(--color-border); border-radius:10px; background:#fff; cursor:pointer; text-align:center;">
            <div style="font-size:1.8rem;">${m.emoji}</div>
            <div class="muted" style="margin-top:4px; font-size:0.8rem;">${m.label}</div>
          </button>`
        ).join("")}
      </div>
      <label for="checkin-note">Anything you want to note? (optional)</label>
      <textarea id="checkin-note" rows="3" maxlength="280" placeholder="Slept well, feeling good about the day..."></textarea>
      <button id="submit-checkin-btn" class="btn btn-primary" style="margin-top:14px;" disabled>Check in with wallet</button>
      <p class="muted" style="margin-top:10px;">🔥 Current streak: ${todayStatus.checkinStreak} day(s). You'll be asked to sign a message in your wallet — this proves the check-in without any gas fee.</p>
    </div>
  `;

  let selectedMood = null;
  const buttons = container.querySelectorAll(".mood-btn");
  const submitBtn = document.getElementById("submit-checkin-btn");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedMood = btn.dataset.mood;
      buttons.forEach((b) => {
        b.style.borderColor = "var(--color-border)";
        b.style.background = "#fff";
      });
      btn.style.borderColor = "var(--color-primary)";
      btn.style.background = "#e6f4f3";
      submitBtn.disabled = false;
    });
  });

  submitBtn.addEventListener("click", () => submitCheckin(selectedMood, submitBtn));
}

async function submitCheckin(selectedMood, submitBtn) {
  if (!selectedMood) return;
  submitBtn.disabled = true;

  try {
    submitBtn.textContent = "Getting today's challenge...";
    const { message } = await apiRequest("/checkin/challenge");

    submitBtn.textContent = "Waiting for wallet signature...";
    window.BlessMedStacks.signCheckinMessage({
      message,
      onSuccess: async ({ signature, publicKey }) => {
        try {
          submitBtn.textContent = "Submitting check-in...";
          const note = document.getElementById("checkin-note").value.trim();
          const result = await apiRequest("/checkin/today", {
            method: "POST",
            body: { mood: selectedMood, note, signature, publicKey },
          });
          todayStatus = {
            completed: true,
            walletConnected: true,
            checkin: result.checkin,
            checkinStreak: result.checkinStreak,
            points: result.totalPoints,
          };
          render();
          if (result.streakBonusEarned) {
            showAlert("alert-box", `🎉 ${result.checkinStreak}-day streak bonus! Extra points added.`, "success");
          }
        } catch (err) {
          showAlert("alert-box", err.message);
          submitBtn.disabled = false;
          submitBtn.textContent = "Check in with wallet";
        }
      },
      onError: (err) => {
        showAlert("alert-box", err.message);
        submitBtn.disabled = false;
        submitBtn.textContent = "Check in with wallet";
      },
    });
  } catch (err) {
    showAlert("alert-box", err.message);
    submitBtn.disabled = false;
    submitBtn.textContent = "Check in with wallet";
  }
}
