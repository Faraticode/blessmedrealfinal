// Lightweight client-side scheduler for medication reminders.
// Polls the reminders list every 30s while the app is open in a tab and
// fires a browser Notification when the current local time matches a
// reminder's scheduled time. This is a same-tab MVP approach — it only
// fires while BlessMed is open in a browser tab. A production version
// would move this to a service worker + push notifications so reminders
// fire even when the app is closed.

const NOTIFY_POLL_MS = 30 * 1000;
const FIRED_KEY = "blessmed_fired_reminders"; // tracks "reminderId:YYYY-MM-DD:HH:mm" already notified today

function getFiredSet() {
  try {
    return new Set(JSON.parse(localStorage.getItem(FIRED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveFiredSet(set) {
  // Keep the set from growing forever — only retain today's entries.
  const today = new Date().toISOString().slice(0, 10);
  const trimmed = [...set].filter((k) => k.includes(today));
  localStorage.setItem(FIRED_KEY, JSON.stringify(trimmed));
}

function fireNotification(reminder) {
  const title = `💊 Time for ${reminder.medicationName}`;
  const body = reminder.dosage ? `Dosage: ${reminder.dosage}` : "Tap to mark as taken.";

  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body, icon: "assets/icon.png" });
  } else {
    // Fallback in-app banner if notification permission isn't granted.
    const banner = document.createElement("div");
    banner.className = "alert alert-success";
    banner.style.position = "fixed";
    banner.style.top = "70px";
    banner.style.right = "20px";
    banner.style.zIndex = "1000";
    banner.style.maxWidth = "300px";
    banner.textContent = `${title} — ${body}`;
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 8000);
  }
}

async function checkReminders() {
  if (!Auth.isLoggedIn()) return;

  let reminders;
  try {
    const data = await apiRequest("/reminders?active=true");
    reminders = data.reminders;
  } catch {
    return; // fail silently — don't spam alerts for a background poll
  }

  const now = new Date();
  const hhmm = now.toTimeString().slice(0, 5); // "HH:mm"
  const today = now.toISOString().slice(0, 10);
  const dayOfWeek = now.getDay();
  const fired = getFiredSet();

  reminders.forEach((reminder) => {
    const dueToday = !reminder.daysOfWeek?.length || reminder.daysOfWeek.includes(dayOfWeek);
    if (!dueToday) return;
    if (!reminder.times.includes(hhmm)) return;

    const fireKey = `${reminder._id}:${today}:${hhmm}`;
    if (fired.has(fireKey)) return;

    fireNotification(reminder);
    fired.add(fireKey);
  });

  saveFiredSet(fired);
}

function initReminderScheduler() {
  if (!Auth.isLoggedIn()) return;
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
  checkReminders();
  setInterval(checkReminders, NOTIFY_POLL_MS);
}

document.addEventListener("DOMContentLoaded", initReminderScheduler);
