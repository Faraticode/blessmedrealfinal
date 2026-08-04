import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export default function Landing() {
  return (
    <>
      <Navbar />

      <section className="hero">
        <h1>Your Health. Your Data. Your Future.</h1>
        <p>A secure, decentralized home for your health records for managing your health records, with emergency access when it matters most.</p>
        <Link to="/signup" className="btn btn-primary">
          Create your free account
        </Link>
        <div className="pillars">
          <span className="pillar">🔒 Secure</span>
          <span className="pillar">🌐 Decentralized</span>
          <span className="pillar">💪 Empowering</span>
          <span className="pillar">🎁 Rewarding</span>
        </div>
      </section>

      <div className="container">
        <div className="grid grid-3">
          <div className="card">
            <h3>Digital Health Records</h3>
            <p className="muted">Upload prescriptions, lab results, and vaccination cards, all in one secure place.</p>
          </div>
          <div className="card">
            <h3>Emergency QR Code</h3>
            <p className="muted">First responders can scan your code to instantly see blood group, allergies, and emergency contact.</p>
          </div>
          <div className="card">
            <h3>Health Tips Feed</h3>
            <p className="muted">Bite-sized nutrition, exercise, and mental wellness tips curated for you.</p>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}
