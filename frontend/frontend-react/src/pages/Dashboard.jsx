import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest, formatBmed } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const { user, setUser } = useAuth();
  const [steps, setSteps] = useState(null);
  const [checkin, setCheckin] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [tips, setTips] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { user: fresh } = await apiRequest("/profile");
        setUser(fresh);
      } catch (err) {
        console.error(err);
      }
    })();
    apiRequest("/steps/summary").then(setSteps).catch(console.error);
    apiRequest("/checkin/today").then(setCheckin).catch(console.error);
    apiRequest("/quiz/today").then(setQuiz).catch(console.error);
    apiRequest("/tips")
      .then(({ tips }) => setTips(tips.slice(0, 4)))
      .catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const points = user?.points || 0;
  const firstName = user?.firstName || user?.name?.split(" ")[0] || "";
  const profileComplete = user?.age && user?.bloodGroup !== "Unknown" && user?.emergencyContact?.phone;

  return (
    <div className="container">
      <h2>Welcome back{firstName ? `, ${firstName}` : ""}</h2>

      <div className="points-hero">
        <div>
          <p className="points-hero-label">Total points</p>
          <p className="points-hero-total">{points.toLocaleString()}</p>
          <p className="points-hero-conversion">
            ≈ <strong>{formatBmed(points)}</strong> $BMed Token
          </p>
        </div>
        <div className="points-hero-rate">
          100 points = 1 BMed. $BMed Token is credited at the airdrop.
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 20 }}>
        <div className="card">
          <h3>Health snapshot</h3>
          {user ? (
            <div>
              <p>
                <strong>Blood group:</strong> {user.bloodGroup || "Not set"}
              </p>
              <p>
                <strong>Genotype:</strong> {user.genotype || "Not set"}
              </p>
              <p>
                <strong>Allergies:</strong> {user.allergies?.length ? user.allergies.join(", ") : "None on file"}
              </p>
              {!profileComplete && (
                <p className="muted">
                  Your profile is incomplete, <Link to="/profile">finish it</Link> so your emergency QR code is accurate.
                </p>
              )}
            </div>
          ) : (
            <p className="loading-text">Loading...</p>
          )}
          <Link to="/profile" className="btn btn-outline" style={{ marginTop: 10 }}>
            Edit profile
          </Link>
        </div>

        <div className="card">
          <h3>Steps today</h3>
          {steps ? (
            <div>
              <p style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--color-primary-dark)", margin: 0 }}>
                {steps.today.steps.toLocaleString()}
              </p>
              <p className="muted" style={{ marginTop: 0 }}>
                of {steps.today.goal.toLocaleString()} steps ({Math.min(100, Math.round((steps.today.steps / steps.today.goal) * 100))}%)
              </p>
              <p>
                <strong>🔥 Streak:</strong> {steps.stepStreak} day(s)
              </p>
            </div>
          ) : (
            <p className="loading-text">Loading...</p>
          )}
          <Link to="/steps" className="btn btn-outline" style={{ marginTop: 10 }}>
            Open steps
          </Link>
        </div>

        <div className="card">
          <h3>Daily check-in</h3>
          {checkin ? (
            <div>
              {!checkin.walletConnected ? (
                <>
                  <p className="muted">Connect your Stacks wallet to start checking in.</p>
                  <p>
                    <strong>🔥 Streak:</strong> {checkin.checkinStreak} day(s)
                  </p>
                </>
              ) : checkin.completed ? (
                <>
                  <p style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--color-primary-dark)", margin: 0 }}>✅ Done</p>
                  <p className="muted" style={{ marginTop: 0 }}>
                    🔥 Streak: {checkin.checkinStreak} day(s)
                  </p>
                </>
              ) : (
                <>
                  <p className="muted">Not checked in yet today.</p>
                  <p>
                    <strong>🔥 Streak:</strong> {checkin.checkinStreak} day(s)
                  </p>
                </>
              )}
            </div>
          ) : (
            <p className="loading-text">Loading...</p>
          )}
          <Link to="/checkin" className="btn btn-outline" style={{ marginTop: 10 }}>
            Check in
          </Link>
        </div>

        <div className="card">
          <h3>Daily quiz</h3>
          {quiz ? (
            quiz.disabled ? (
              <p className="muted">Coming soon.</p>
            ) : quiz.completed ? (
              <div>
                <p style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--color-primary-dark)", margin: 0 }}>{quiz.score}/5</p>
                <p className="muted" style={{ marginTop: 0 }}>
                  Completed today — nice work.
                </p>
              </div>
            ) : (
              <p className="muted">5 quick questions based on your health profile, Ready when you are.</p>
            )
          ) : (
            <p className="loading-text">Loading...</p>
          )}
          {!quiz?.disabled && (
            <Link to="/quiz" className="btn btn-outline" style={{ marginTop: 10 }}>
              Take today's quiz
            </Link>
          )}
        </div>
      </div>

      <h3>Health tips for you</h3>
      <div className="grid grid-2">
        {tips === null ? (
          <p className="loading-text">Loading tips...</p>
        ) : tips.length === 0 ? (
          <p className="empty-state">No tips available right now.</p>
        ) : (
          tips.map((t) => (
            <div className="card" key={t._id}>
              <span className="tag">{t.category.replace("_", " ")}</span>
              <h3>{t.title}</h3>
              <p className="muted">{t.content}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
