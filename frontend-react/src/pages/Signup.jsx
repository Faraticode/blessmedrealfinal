import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Alert from "../components/Alert";
import { apiRequest } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const EMPTY_FORM = { firstName: "", lastName: "", otherNames: "", email: "", password: "", wallet: "" };

export default function Signup() {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (isLoggedIn) return <Navigate to="/dashboard" replace />;

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await apiRequest("/auth/signup", {
        method: "POST",
        body: {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          otherNames: form.otherNames.trim() || undefined,
          email: form.email.trim(),
          password: form.password,
          walletAddress: form.wallet.trim() || undefined,
        },
      });
      sessionStorage.setItem("blessmed_verify_email", data.email);
      navigate(`/verify?email=${encodeURIComponent(data.email)}`);
    } catch (err) {
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
          <h2>Create your account</h2>
          <Alert message={error} />
          <form onSubmit={handleSubmit}>
            <div className="field-row">
              <div>
                <label htmlFor="firstName">First name</label>
                <input type="text" id="firstName" required value={form.firstName} onChange={update("firstName")} />
              </div>
              <div>
                <label htmlFor="lastName">Last name</label>
                <input type="text" id="lastName" required value={form.lastName} onChange={update("lastName")} />
              </div>
            </div>
            <div>
              <label htmlFor="otherNames">
                Other names <span className="muted">(optional)</span>
              </label>
              <input type="text" id="otherNames" value={form.otherNames} onChange={update("otherNames")} />
            </div>
            <div>
              <label htmlFor="email">Email</label>
              <input type="email" id="email" required value={form.email} onChange={update("email")} />
            </div>
            <div>
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                required
                minLength={6}
                value={form.password}
                onChange={update("password")}
              />
            </div>
            <div>
              <label htmlFor="wallet">
                Wallet address <span className="muted">(optional)</span>
              </label>
              <input
                type="text"
                id="wallet"
                placeholder="ST1... (Stacks wallet, optional)"
                value={form.wallet}
                onChange={update("wallet")}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? "Creating account..." : "Create account"}
            </button>
          </form>
          <p className="switch">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>
      </div>
    </>
  );
}
