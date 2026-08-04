import { useEffect } from "react";
import { apiRequest, Auth } from "../lib/api";

// Lightweight client-side scheduler for medication reminders. Polls the
// reminders list every 30s while the app is open in a tab and fires a
// browser Notification when the current local time matches a reminder's
// scheduled time. Same-tab MVP approach, ported from js/notify.js — a
// production version would move this to a service worker + push.

const NOTIFY_POLL_MS = 30 * 1000;
const FIRED_KEY = "blessmed_fired_reminders";

function getFiredSet() {
  try {
    return new Set(JSON.parse(localStorage.getItem(FIRED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveFiredSet(set) {
  const today = new Date().toISOString().slice(0, 10);
  const trimmed = [...set].filter((k) => k.includes(today));
  localStorage.setItem(FIRED_KEY, JSON.stringify(trimmed));
}

function fireNotification(reminder) {
  const title = `💊 Time for ${reminder.medicationName}`;
  const body = reminder.dosage ? `Dosage: ${reminder.dosage}` : "Tap to mark as taken.";

  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body });
  } else {
    const banner = document.createElement("div");
    banner.className = "alert alert-success toast-banner";
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
    return;
  }

  const now = new Date();
  const hhmm = now.toTimeString().slice(0, 5);
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

export function useReminderScheduler() {
  useEffect(() => {
    if (!Auth.isLoggedIn()) return;
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    checkReminders();
    const interval = setInterval(checkReminders, NOTIFY_POLL_MS);
    return () => clearInterval(interval);
  }, []);
}
