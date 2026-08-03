import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../lib/api";

// Nudges the user toward today's check-in and today's quiz if either
// hasn't been done yet. Shown once per day per item — dismissing doesn't
// lose progress, it just won't re-show until tomorrow (tracked in
// localStorage so it survives a refresh). Ported from js/popups.js.

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

export default function DailyPopups() {
  const [queue, setQueue] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const items = [];

      try {
        if (!wasDismissedToday("checkin")) {
          const status = await apiRequest("/checkin/today");
          if (!status.completed) {
            items.push({
              name: "checkin",
              icon: "🌤️",
              title: "How are you feeling today?",
              body: "A quick daily check-in takes ten seconds and keeps your streak alive.",
              reward: "+5 points (bonus at every 7-day streak)",
              ctaLabel: "Check in now",
              ctaHref: "/checkin",
            });
          }
        }
      } catch (err) {
        console.error("Daily check-in popup skipped:", err);
      }

      try {
        if (!wasDismissedToday("quiz")) {
          const quiz = await apiRequest("/quiz/today");
          if (!quiz.disabled && !quiz.completed) {
            items.push({
              name: "quiz",
              icon: "🧠",
              title: "Today's health quiz is ready",
              body: "5 quick questions based on your health profile — educational, not medical advice.",
              reward: "Up to +35 points",
              ctaLabel: "Take the quiz",
              ctaHref: "/quiz",
            });
          }
        }
      } catch (err) {
        console.error("Daily quiz popup skipped:", err);
      }

      if (!cancelled) setQueue(items);
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!queue.length) return null;
  const popup = queue[0];

  function close() {
    dismissToday(popup.name);
    setQueue((q) => q.slice(1));
  }

  function go() {
    dismissToday(popup.name);
    navigate(popup.ctaHref);
    setQueue((q) => q.slice(1));
  }

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal-box">
        <button className="modal-close" aria-label="Close" onClick={close}>
          &times;
        </button>
        <div className="modal-icon">{popup.icon}</div>
        <h3>{popup.title}</h3>
        <p className="muted">{popup.body}</p>
        <div className="modal-reward">🎁 {popup.reward}</div>
        <div className="modal-actions">
          <button className="btn btn-outline" onClick={close}>
            Maybe later
          </button>
          <button className="btn btn-primary" onClick={go}>
            {popup.ctaLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
