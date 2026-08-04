import { useEffect, useState } from "react";
import Alert from "../components/Alert";
import { apiRequest } from "../lib/api";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
let timeInputId = 1;

export default function Reminders() {
  const [reminders, setReminders] = useState(null);
  const [status, setStatus] = useState({ message: "", type: "error" });
  const [busy, setBusy] = useState(false);
  const [showNotifBanner, setShowNotifBanner] = useState(false);

  const [medicationName, setMedicationName] = useState("");
  const [dosage, setDosage] = useState("");
  const [notes, setNotes] = useState("");
  const [times, setTimes] = useState([{ id: timeInputId++, value: "" }]);
  const [days, setDays] = useState([]);

  useEffect(() => {
    loadReminders();
    if ("Notification" in window && Notification.permission === "default") {
      setShowNotifBanner(true);
    }
  }, []);

  async function loadReminders() {
    try {
      const { reminders } = await apiRequest("/reminders");
      setReminders(reminders);
    } catch (err) {
      setStatus({ message: err.message, type: "error" });
    }
  }

  function addTimeInput() {
    setTimes((t) => [...t, { id: timeInputId++, value: "" }]);
  }

  function removeTimeInput(id) {
    setTimes((t) => t.filter((row) => row.id !== id));
  }

  function updateTime(id, value) {
    setTimes((t) => t.map((row) => (row.id === id ? { ...row, value } : row)));
  }

  function toggleDay(value) {
    setDays((d) => (d.includes(value) ? d.filter((v) => v !== value) : [...d, value]));
  }

  async function enableNotifications() {
    await Notification.requestPermission();
    setShowNotifBanner(false);
  }

  async function createReminder(e) {
    e.preventDefault();
    const timeValues = times.map((t) => t.value).filter(Boolean);
    if (!timeValues.length) {
      setStatus({ message: "Add at least one time.", type: "error" });
      return;
    }

    setBusy(true);
    try {
      await apiRequest("/reminders", {
        method: "POST",
        body: {
          medicationName: medicationName.trim(),
          dosage: dosage.trim(),
          times: timeValues,
          daysOfWeek: days,
          notes: notes.trim(),
        },
      });
      setMedicationName("");
      setDosage("");
      setNotes("");
      setTimes([{ id: timeInputId++, value: "" }]);
      setDays([]);
      setStatus({ message: "Reminder created.", type: "success" });
      await loadReminders();
    } catch (err) {
      setStatus({ message: err.message, type: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(id, active) {
    try {
      await apiRequest(`/reminders/${id}`, { method: "PUT", body: { active } });
      await loadReminders();
    } catch (err) {
      setStatus({ message: err.message, type: "error" });
    }
  }

  async function deleteReminder(id) {
    if (!confirm("Delete this reminder?")) return;
    try {
      await apiRequest(`/reminders/${id}`, { method: "DELETE" });
      await loadReminders();
    } catch (err) {
      setStatus({ message: err.message, type: "error" });
    }
  }

  return (
    <div className="container">
      <Alert message={status.message} type={status.type} />

      {showNotifBanner && (
        <div className="card" style={{ marginBottom: 20, background: "#fffbeb", borderColor: "#fde68a" }}>
          <div className="flex-between">
            <p style={{ margin: 0 }}>Enable browser notifications so reminders can alert you while BlessMed is open.</p>
            <button className="btn btn-primary" style={{ whiteSpace: "nowrap" }} onClick={enableNotifications}>
              Enable notifications
            </button>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Add a reminder</h3>
        <form onSubmit={createReminder}>
          <div className="field-row">
            <div>
              <label htmlFor="medication-name">Medication</label>
              <input
                type="text"
                id="medication-name"
                placeholder="e.g. Paracetamol"
                required
                value={medicationName}
                onChange={(e) => setMedicationName(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="dosage">
                Dosage <span className="muted">(optional)</span>
              </label>
              <input
                type="text"
                id="dosage"
                placeholder="e.g. 500mg, 2 tablets"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label>Times</label>
            <div>
              {times.map((row) => (
                <div className="field-row time-row" key={row.id}>
                  <input
                    type="time"
                    required
                    value={row.value}
                    onChange={(e) => updateTime(row.id, e.target.value)}
                  />
                  <button type="button" className="btn btn-outline" onClick={() => removeTimeInput(row.id)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-outline" style={{ marginTop: 8 }} onClick={addTimeInput}>
              + Add another time
            </button>
          </div>

          <div>
            <label>
              Days <span className="muted">(No day selected means reminders will be scheduled for every day)</span>
            </label>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {DAY_LABELS.map((label, value) => (
                <label key={value} style={{ fontWeight: 400 }}>
                  <input
                    type="checkbox"
                    style={{ width: "auto" }}
                    checked={days.includes(value)}
                    onChange={() => toggleDay(value)}
                  />{" "}
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="reminder-notes">
              Notes <span className="muted">(optional)</span>
            </label>
            <input
              type="text"
              id="reminder-notes"
              placeholder="e.g. Take with food"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Adding..." : "Add reminder"}
          </button>
        </form>
      </div>

      <div className="card">
        <h3>Your reminders</h3>
        {reminders === null ? (
          <p className="loading-text">Loading...</p>
        ) : reminders.length === 0 ? (
          <p className="empty-state">No reminders yet. Add one above to get notified when it's time to take your medication.</p>
        ) : (
          reminders.map((r) => {
            const dayLabels = r.daysOfWeek?.length ? r.daysOfWeek.map((d) => DAY_LABELS[d]).join(", ") : "Every day";
            return (
              <div className="record-item" key={r._id}>
                <div>
                  <strong>{r.medicationName}</strong> {r.dosage && <span className="muted">({r.dosage})</span>}
                  <div className="muted">
                    {r.times.join(", ")} · {dayLabels}
                    {r.notes ? ` · ${r.notes}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    className="tag"
                    style={{
                      background: r.active ? "#dcfce7" : "#f3f4f6",
                      color: r.active ? "#16a34a" : "#6b7280",
                    }}
                  >
                    {r.active ? "active" : "paused"}
                  </span>
                  <button className="btn btn-outline" style={{ padding: "6px 10px" }} onClick={() => toggleActive(r._id, !r.active)}>
                    {r.active ? "Pause" : "Resume"}
                  </button>
                  <button className="btn btn-danger" style={{ padding: "6px 10px" }} onClick={() => deleteReminder(r._id)}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
