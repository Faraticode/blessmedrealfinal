import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import Alert from "../components/Alert";
import { apiRequest } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export default function Verify() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const email = params.get("email") || sessionStorage.getItem("blessmed_verify_email");

  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState({ message: "", type: "error" });
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!email) navigate("/signup", { replace: true });
  }, [email, navigate]);

  if (!email) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setStatus({ message: "" });
    try {
      const data = await apiRequest("/auth/verify-otp", { method: "POST", body: { email, otp: otp.trim() } });
      login(data.token, data.user);
      sessionStorage.removeItem("blessmed_verify_email");
      navigate("/profile?welcome=1");
    } catch (err) {
      setStatus({ message: err.message, type: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function handleResend(e) {
    e.preventDefault();
    setResending(true);
    try {
      const data = await apiRequest("/auth/resend-otp", { method: "POST", body: { email } });
      setStatus({ message: data.message, type: "success" });
    } catch (err) {
      setStatus({ message: err.message, type: "error" });
    } finally {
      setResending(false);
    }
  }

  return (
    <>
      <Navbar />
      <div className="auth-wrapper">
        <div className="card auth-card">
          <h2>Verify your email</h2>
          <p className="muted">We've sent a 6-digit code to {email}.</p>
          <Alert message={status.message} type={status.type} />
          <form onSubmit={handleSubmit}>
            <div>
              <label htmlFor="otp">Verification code</label>
              <input
                type="text"
                id="otp"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? "Verifying..." : "Verify account"}
            </button>
          </form>
          <p className="switch">
            Didn't get a code?{" "}
            <a href="#" onClick={handleResend}>
              {resending ? "Sending..." : "Resend code"}
            </a>
          </p>
        </div>
      </div>
    </>
  );
}
