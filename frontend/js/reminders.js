const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

document.addEventListener("DOMContentLoaded", async () => {
  requireAuth();
  await loadReminders();

  document.getElementById("reminder-form").addEventListener("submit", createReminder);
  document.getElementById("add-time-btn").addEventListener("click", addTimeInput);

  if ("Notification" in window && Notification.permission === "default") {
    document.getElementById("notif-permission-banner").style.display = "block";
    document.getElementById("enable-notif-btn").addEventListener("click", async () => {
      await Notification.requestPermission();
      document.getElementById("notif-permission-banner").style.display = "none";
    });
  }
});

function addTimeInput() {
  const container = document.getElementById("times-container");
  const row = document.createElement("div");
  row.className = "field-row time-row";
  row.innerHTML = `
    <input type="time" class="reminder-time" required />
    <button type="button" class="btn btn-outline" onclick="this.parentElement.remove()">Remove</button>
  `;
  container.appendChild(row);
}

async function loadReminders() {
  try {
    const { reminders } = await apiRequest("/reminders");
    renderReminders(reminders);
  } catch (err) {
    showAlert("alert-box", err.message);
  }
}

function renderReminders(reminders) {
  const el = document.getElementById("reminders-list");
  if (!reminders.length) {
    el.innerHTML = `<p class="empty-state">No reminders yet. Add one above to get notified when it's time to take your medication.</p>`;
    return;
  }
  el.innerHTML = reminders
    .map((r) => {
      const days = r.daysOfWeek?.length ? r.daysOfWeek.map((d) => DAY_LABELS[d]).join(", ") : "Every day";
      return `
      <div class="record-item">
        <div>
          <strong>${r.medicationName}</strong> ${r.dosage ? `<span class="muted">(${r.dosage})</span>` : ""}
          <div class="muted">${r.times.join(", ")} · ${days}${r.notes ? " · " + r.notes : ""}</div>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          <span class="tag" style="background:${r.active ? "#dcfce7" : "#f3f4f6"}; color:${r.active ? "#16a34a" : "#6b7280"};">
            ${r.active ? "active" : "paused"}
          </span>
          <button class="btn btn-outline" style="padding:6px 10px;" onclick="toggleActive('${r._id}', ${!r.active})">
            ${r.active ? "Pause" : "Resume"}
          </button>
          <button class="btn btn-danger" style="padding:6px 10px;" onclick="deleteReminder('${r._id}')">Delete</button>
        </div>
      </div>`;
    })
    .join("");
}

async function createReminder(e) {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true;
  try {
    const times = [...document.querySelectorAll(".reminder-time")]
      .map((input) => input.value)
      .filter(Boolean);
    if (!times.length) {
      showAlert("alert-box", "Add at least one time.");
      btn.disabled = false;
      return;
    }

    const daysOfWeek = [...document.querySelectorAll(".day-checkbox:checked")].map((cb) => Number(cb.value));

    const body = {
      medicationName: document.getElementById("medication-name").value.trim(),
      dosage: document.getElementById("dosage").value.trim(),
      times,
      daysOfWeek,
      notes: document.getElementById("reminder-notes").value.trim(),
    };

    await apiRequest("/reminders", { method: "POST", body });
    e.target.reset();
    document.getElementById("times-container").innerHTML = `
      <div class="field-row time-row">
        <input type="time" class="reminder-time" required />
        <button type="button" class="btn btn-outline" onclick="this.parentElement.remove()">Remove</button>
      </div>`;
    showAlert("alert-box", "Reminder created.", "success");
    await loadReminders();
  } catch (err) {
    showAlert("alert-box", err.message);
  } finally {
    btn.disabled = false;
  }
}

async function toggleActive(id, active) {
  try {
    await apiRequest(`/reminders/${id}`, { method: "PUT", body: { active } });
    await loadReminders();
  } catch (err) {
    showAlert("alert-box", err.message);
  }
}

async function deleteReminder(id) {
  if (!confirm("Delete this reminder?")) return;
  try {
    await apiRequest(`/reminders/${id}`, { method: "DELETE" });
    await loadReminders();
  } catch (err) {
    showAlert("alert-box", err.message);
  }
}
