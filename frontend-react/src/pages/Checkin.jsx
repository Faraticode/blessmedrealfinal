import { useEffect, useState } from "react";
import Alert from "../components/Alert";
import { apiRequest } from "../lib/api";
import { connectStacksWallet, signCheckinMessage } from "../lib/stacks";

const MOODS = [
  { value: "great", emoji: "😄", label: "Great" },
  { value: "good", emoji: "🙂", label: "Good" },
  { value: "okay", emoji: "😐", label: "Okay" },
  { value: "low", emoji: "😕", label: "Low" },
  { value: "struggling", emoji: "😣", label: "Struggling" },
];

export default function Checkin() {
  const [todayStatus, setTodayStatus] = useState(null);
  const [status, setStatus] = useState({ message: "", type: "error" });
  const [connectBusy, setConnectBusy] = useState(false);
  const [selectedMood, setSelectedMood] = useState(null);
  const [note, setNote] = useState("");
  const [submitState, setSubmitState] = useState(null); // null | "challenge" | "signing" | "submitting"

  useEffect(() => {
    loadCheckin();
  }, []);

  async function loadCheckin() {
    setTodayStatus(null);
    try {
      const data = await apiRequest("/checkin/today");
      setTodayStatus(data);
    } catch (err) {
      setStatus({ message: err.message, type: "error" });
    }
  }

  async function handleConnect() {
    setConnectBusy(true);
    try {
      await connectStacksWallet();
      await loadCheckin();
    } catch (err) {
      setStatus({ message: err.message, type: "error" });
    } finally {
      setConnectBusy(false);
    }
  }

  async function submitCheckin() {
    if (!selectedMood) return;
    setStatus({ message: "" });
    try {
      setSubmitState("challenge");
      const { message } = await apiRequest("/checkin/challenge");

      setSubmitState("signing");
      const { signature, publicKey } = await signCheckinMessage(message);

      setSubmitState("submitting");
      const result = await apiRequest("/checkin/today", {
        method: "POST",
        body: { mood: selectedMood, note: note.trim(), signature, publicKey },
      });

      setTodayStatus({
        completed: true,
        walletConnected: true,
        checkin: result.checkin,
        checkinStreak: result.checkinStreak,
        points: result.totalPoints,
      });

      if (result.streakBonusEarned) {
        setStatus({ message: `🎉 ${result.checkinStreak}-day streak bonus! Extra points added.`, type: "success" });
      }
    } catch (err) {
      setStatus({ message: err.message, type: "error" });
    } finally {
      setSubmitState(null);
    }
  }

  const submitLabel =
    submitState === "challenge"
      ? "Getting today's challenge..."
      : submitState === "signing"
      ? "Waiting for wallet signature..."
      : submitState === "submitting"
      ? "Submitting check-in..."
      : "Check in with wallet";

  return (
    <div className="container" style={{ maxWidth: 680 }}>
      <h2>Daily Check-in</h2>
      <p className="muted">
        A quick moment to note how you're doing. Signed with your connected Stacks wallet to prove it's really you,
        takes about ten seconds, earns points toward your future BMed token balance, and builds a streak.
      </p>
      <Alert message={status.message} type={status.type} />

      {todayStatus === null ? (
        <p className="empty-state">Loading today's check-in...</p>
      ) : !todayStatus.walletConnected ? (
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "2.4rem" }}>🔗</div>
          <h3 style={{ margin: "6px 0 8px" }}>Connect your Stacks wallet first</h3>
          <p className="muted">
            Check-in is verified with your Stacks wallet — a quick signature that proves it's really you, no gas fee
            involved.
          </p>
          <button className="btn btn-primary" style={{ marginTop: 10 }} disabled={connectBusy} onClick={handleConnect}>
            {connectBusy ? "Opening wallet..." : "Connect wallet"}
          </button>
        </div>
      ) : todayStatus.completed ? (
        (() => {
          const c = todayStatus.checkin;
          const mood = MOODS.find((m) => m.value === c.mood);
          return (
            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: "2.6rem" }}>{mood ? mood.emoji : "✅"}</div>
              <h3 style={{ margin: "6px 0 0" }}>Checked in for today</h3>
              <p className="muted">
                Feeling {mood ? mood.label.toLowerCase() : c.mood}
                {c.note ? ` — "${c.note}"` : ""}
              </p>
              <p>
                <strong>+{c.pointsAwarded} points</strong> <span className="muted">(toward your future BMed token balance)</span>
              </p>
              <p>
                <strong>🔥 Streak:</strong> {todayStatus.checkinStreak} day(s)
              </p>
              <p className="muted" style={{ fontSize: "0.78rem" }}>
                Verified with wallet {c.walletAddress.slice(0, 6)}...{c.walletAddress.slice(-4)}
              </p>
              <p className="muted">Come back tomorrow to keep it going.</p>
            </div>
          );
        })()
      ) : (
        <div className="card">
          <h3>How are you feeling today?</h3>
          <div style={{ display: "flex", gap: 10, justifyContent: "space-between", margin: "16px 0", flexWrap: "wrap" }}>
            {MOODS.map((m) => (
              <button
                type="button"
                key={m.value}
                className={`mood-btn ${selectedMood === m.value ? "selected" : ""}`}
                onClick={() => setSelectedMood(m.value)}
              >
                <div className="mood-emoji">{m.emoji}</div>
                <div className="muted" style={{ marginTop: 4, fontSize: "0.8rem" }}>
                  {m.label}
                </div>
              </button>
            ))}
          </div>
          <label htmlFor="checkin-note">Anything you want to note? (optional)</label>
          <textarea
            id="checkin-note"
            rows={3}
            maxLength={280}
            placeholder="Slept well, feeling good about the day..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            className="btn btn-primary"
            style={{ marginTop: 14 }}
            disabled={!selectedMood || submitState !== null}
            onClick={submitCheckin}
          >
            {submitLabel}
          </button>
          <p className="muted" style={{ marginTop: 10 }}>
            🔥 Current streak: {todayStatus.checkinStreak} day(s). You'll be asked to sign a message in your wallet —
            this proves the check-in without any gas fee.
          </p>
        </div>
      )}
    </div>
  );
}
