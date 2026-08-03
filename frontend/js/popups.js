// Daily engagement popups: nudges the user toward today's check-in and
// today's quiz if either hasn't been done yet. Shown once per day per
// item (dismissing doesn't lose progress — it just won't re-show until
// tomorrow, tracked in localStorage so it survives a page refresh).

(function () {
  const queue = [];

  function todayKey(name) {
    const date = new Date().toISOString().slice(0, 10);
    return `blessmed_popup_${name}_${date}`;
  }

  function wasDismissedToday(name) {
    return localStorage.getItem(todayKey(name)) === "1";
  }

  function dismissToday(name) {
    localStorage.setItem(todayKey(name), "1");
  }

  function showNext() {
    if (!queue.length) return;
    const popup = queue.shift();
    renderModal(popup);
  }

  function renderModal({ name, icon, title, body, reward, ctaLabel, ctaHref }) {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal-box">
        <button class="modal-close" aria-label="Close">&times;</button>
        <div class="modal-icon">${icon}</div>
        <h3>${title}</h3>
        <p class="muted">${body}</p>
        <div class="modal-reward">🎁 ${reward}</div>
        <div class="modal-actions">
          <button class="btn btn-outline" data-action="later">Maybe later</button>
          <button class="btn btn-primary" data-action="go">${ctaLabel}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    function close(markDismissed) {
      if (markDismissed) dismissToday(name);
      overlay.remove();
      showNext();
    }

    overlay.querySelector(".modal-close").addEventListener("click", () => close(true));
    overlay.querySelector('[data-action="later"]').addEventListener("click", () => close(true));
    overlay.querySelector('[data-action="go"]').addEventListener("click", () => {
      window.location.href = ctaHref;
    });
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close(true);
    });
  }

  async function initDailyPopups() {
    if (!window.Auth || !Auth.isLoggedIn()) return;

    // Check-in first, quiz second — check-in is the lighter-weight ask.
    try {
      if (!wasDismissedToday("checkin")) {
        const status = await apiRequest("/checkin/today");
        if (!status.completed) {
          queue.push({
            name: "checkin",
            icon: "🌤️",
            title: "How are you feeling today?",
            body: "A quick daily check-in takes ten seconds and keeps your streak alive.",
            reward: "+5 points (bonus at every 7-day streak)",
            ctaLabel: "Check in now",
            ctaHref: "checkin.html",
          });
        }
      }
    } catch (err) {
      console.error("Daily check-in popup skipped:", err);
    }

    try {
      if (!wasDismissedToday("quiz")) {
        const quiz = await apiRequest("/quiz/today");
        if (!quiz.completed) {
          queue.push({
            name: "quiz",
            icon: "🧠",
            title: "Today's health quiz is ready",
            body: "5 quick questions based on your health profile — educational, not medical advice.",
            reward: "Up to +35 points",
            ctaLabel: "Take the quiz",
            ctaHref: "quiz.html",
          });
        }
      }
    } catch (err) {
      console.error("Daily quiz popup skipped:", err);
    }

    showNext();
  }

  document.addEventListener("DOMContentLoaded", initDailyPopups);
})();
