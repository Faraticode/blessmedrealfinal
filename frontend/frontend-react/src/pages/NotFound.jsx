import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";

export default function NotFound() {
  return (
    <>
      <Navbar />
      <div className="container" style={{ maxWidth: 560, textAlign: "center", padding: "60px 24px" }}>
        <h1 style={{ fontSize: "3rem", margin: 0 }}>404</h1>
        <h2 style={{ marginTop: 4 }}>Page not found</h2>
        <p className="muted">The page you're looking for doesn't exist or may have moved.</p>
        <Link to="/" className="btn btn-primary">
          Back to home
        </Link>
      </div>
    </>
  );
}
