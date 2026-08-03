import { useCallback, useEffect, useRef, useState } from "react";
import Alert from "../components/Alert";
import { apiRequest } from "../lib/api";
import { useStepTracking } from "../hooks/useStepTracking";

export default function Steps() {
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState(null);
  const [goalInput, setGoalInput] = useState("");
  const [status, setStatus] = useState({ message: "", type: "error" });
  const [localSteps, setLocalSteps] = useState(null);
  const tracking = useStepTracking();
  const localRefreshTimer = useRef(null);
  const serverRefreshTimer = useRef(null);

  const loadSummary = useCallback(async () => {
    try {
      const data = await apiRequest("/steps/summary");
      setSummary(data);
      setGoalInput(String(data.today.goal));
    } catch (err) {
      setStatus({ message: err.message, type: "error" });
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const { entries } = await apiRequest("/steps?days=7");
      setHistory(entries);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadSummary();
    loadHistory();
    localRefreshTimer.current = setInterval(() => {
      if (tracking.isTracking) setLocalSteps(tracking.getLocalSteps());
    }, 2000);
    serverRefreshTimer.current = setInterval(() => {
      if (tracking.isTracking) loadSummary();
    }, 16 * 1000);
    return () => {
      clearInterval(localRefreshTimer.current);
      clearInterval(serverRefreshTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleStart() {
    setStatus({ message: "" });
    try {
      await tracking.start({ onStep: (n) => setLocalSteps(n) });
      setStatus({ message: "Automatic step tracking started.", type: "success" });
    } catch (err) {
      setStatus({ message: err.message, type: "error" });
    }
  }

  async function handleStop() {
    await tracking.stop();
    setLocalSteps(null);
    await loadSummary();
    await loadHistory();
  }

  async function saveGoal(e) {
    e.preventDefault();
    try {
      await apiRequest("/steps/goal", { method: "PUT", body: { dailyStepGoal: Number(goalInput) } });
      setStatus({ message: "Daily step goal updated.", type: "success" });
      await loadSummary();
    } catch (err) {
      setStatus({ message: err.message, type: "error" });
    }
  }

  if (!summary) {
    return (
      <div className="container">
        <Alert message={status.message} type={status.type} />
        <p className="loading-text">Loading...</p>
      </div>
    );
  }

  const displayedSteps = tracking.isTracking && localSteps !== null ? localSteps : summary.today.steps;
  const pct = Math.min(100, Math.round((displayedSteps / summary.today.goal) * 100));
  const reachedThresholds = new Set(summary.milestones.reached.map((m) => m.threshold));
  const allMilestones = [...summary.milestones.reached, ...(summary.milestones.next ? [summary.milestones.next] : [])];

  return (
    <div className="container">
      <Alert message={status.message} type={status.type} />

      <div className="grid grid-2">
        <div className="card">
          <h3>Today</h3>
          <div style={{ textAlign: "center", margin: "10px 0" }}>
            <div style={{ fontSize: "2.4rem", fontWeight: 700, color: "var(--color-primary-dark)" }}>
              {displayedSteps.toLocaleString()}
            </div>
            <div className="muted">of {summary.today.goal.toLocaleString()} steps</div>
          </div>
          <div style={{ background: "#e5e7eb", borderRadius: 999, height: 14, overflow: "hidden" }}>
            <div
              style={{
                background: "var(--color-primary)",
                height: "100%",
                width: `${pct}%`,
                transition: "width 0.3s",
              }}
            />
          </div>
          <p className="muted" style={{ textAlign: "right" }}>
            {pct}%
          </p>

          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            {!tracking.isTracking ? (
              <button className="btn btn-primary" onClick={handleStart}>
                Start automatic tracking
              </button>
            ) : (
              <button className="btn btn-outline" onClick={handleStop}>
                Stop tracking
              </button>
            )}
          </div>
          <p className="muted" style={{ marginTop: 8 }}>
            {tracking.isTracking ? "Tracking is on — steps are being counted automatically." : "Tracking is off."}
          </p>
          <p className="muted" style={{ fontSize: "0.8rem" }}>
            Uses your device's motion sensor to count steps automatically while this page is open. Works best on a
            phone. A "Connect Google Fit" option is coming soon for background tracking.
          </p>
        </div>

        <div className="card">
          <h3>Progress</h3>
          <p>
            <strong>🔥 Streak:</strong> {summary.stepStreak} day(s) hitting your goal
          </p>
          <p>
            <strong>🎁 Points earned:</strong> {summary.points}{" "}
            <span className="muted">(counts toward your future BMed token balance)</span>
          </p>
          <p>
            <strong>📅 Last 7 days total:</strong> {summary.weeklyTotal.toLocaleString()} steps
          </p>
          <p>
            <strong>👣 Lifetime steps:</strong> {summary.milestones.totalStepsLifetime.toLocaleString()}
          </p>

          <form onSubmit={saveGoal} style={{ marginTop: 16 }}>
            <label htmlFor="goal-input">Daily step goal</label>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                type="number"
                id="goal-input"
                min={500}
                step={500}
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
              />
              <button type="submit" className="btn btn-outline" style={{ whiteSpace: "nowrap" }}>
                Save goal
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h3>
          Milestones <span className="tag">BMed token</span>
        </h3>
        <p className="muted">
          Lifetime step milestones earn bonus points. Points are the foundation for the future BMed token, the more
          you walk, the more you'll have when it launches.
        </p>
        <div className="grid grid-3">
          {allMilestones.length === 0 ? (
            <p className="empty-state">No milestones yet.</p>
          ) : (
            allMilestones.map((m) => {
              const reached = reachedThresholds.has(m.threshold);
              return (
                <div className={`card milestone-card ${reached ? "reached" : "locked"}`} key={m.threshold}>
                  <div style={{ fontSize: "1.6rem" }}>{reached ? "🏅" : "🔒"}</div>
                  <strong>{m.threshold.toLocaleString()} steps</strong>
                  <p className="muted" style={{ margin: "4px 0 0" }}>
                    {m.points} bonus points
                  </p>
                  {reached ? (
                    <span className="tag" style={{ background: "#dcfce7", color: "#16a34a" }}>
                      reached
                    </span>
                  ) : (
                    <span className="tag">next goal</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h3>Last 7 days</h3>
        {history === null ? (
          <p className="loading-text">Loading...</p>
        ) : history.length === 0 ? (
          <p className="empty-state">No step history yet, Start tracking today.</p>
        ) : (
          history.map((e) => (
            <div className="record-item" key={e.date}>
              <div>
                {new Date(e.date + "T00:00:00").toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </div>
              <div>
                <strong>{e.steps.toLocaleString()}</strong> steps <span className="tag">{e.source.replace("_", " ")}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
