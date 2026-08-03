import { useState } from "react";
import { NavLink, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { formatBmed, POINTS_PER_BMED } from "../lib/api";
import ThemeToggle from "./ThemeToggle";

const LINKS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/reminders", label: "Reminders" },
  { to: "/steps", label: "Steps" },
  { to: "/checkin", label: "Check-in" },
  { to: "/quiz", label: "Quiz" },
  { to: "/assistant", label: "Assistant" },
  { to: "/profile", label: "Profile" },
];

export default function Navbar() {
  const { user, isLoggedIn, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const points = user?.points || 0;

  return (
    <nav className="navbar">
      <Link to={isLoggedIn ? "/dashboard" : "/"} className="brand" onClick={() => setOpen(false)}>
        Bless<span className="dot">Med</span>
      </Link>

      {isLoggedIn && (
        <>
          <input
            type="checkbox"
            id="nav-toggle"
            className="nav-toggle"
            checked={open}
            onChange={(e) => setOpen(e.target.checked)}
          />
          <label htmlFor="nav-toggle" className="nav-toggle-label" aria-label="Menu">
            <span />
          </label>

          <div className="nav-links">
            {LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => (isActive ? "active" : "")}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </NavLink>
            ))}
            <Link
              id="nav-points-badge"
              className="points-badge"
              to="/dashboard"
              title={`≈ ${formatBmed(points)} BMed at ${POINTS_PER_BMED} pts = 1 BMed`}
              onClick={() => setOpen(false)}
            >
              ⭐ {points.toLocaleString()} pts
            </Link>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                logout();
              }}
            >
              Log out
            </a>
            <ThemeToggle />
          </div>
        </>
      )}

      {!isLoggedIn && (
        <div className="nav-links">
          <Link to="/login">Log in</Link>
          <Link to="/signup" className="btn btn-primary">
            Get started
          </Link>
          <ThemeToggle />
        </div>
      )}
    </nav>
  );
}
