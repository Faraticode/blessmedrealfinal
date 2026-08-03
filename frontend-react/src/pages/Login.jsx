import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Alert from "../components/Alert";
import { apiRequest } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { isLoggedIn, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (isLoggedIn) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await apiRequest("/auth/login", { method: "POST", body: { email, password } });
      login(data.token, data.user);
      navigate("/dashboard");
    } catch (err) {
      if (err.data?.notVerified) {
        sessionStorage.setItem("blessmed_verify_email", err.data.email);
        navigate(`/verify?email=${encodeURIComponent(err.data.email)}`);
        return;
      }
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Navbar />
      <div className="auth-wrapper">
        <div className="card auth-card">
          <h2>Welcome back</h2>
          <Alert message={error} />
          <form onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email">Email</label>
              <input type="email" id="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? "Logging in..." : "Log in"}
            </button>
          </form>
          <p className="switch">
            Don't have an account? <Link to="/signup">Sign up</Link>
          </p>
        </div>
      </div>
    </>
  );
}
