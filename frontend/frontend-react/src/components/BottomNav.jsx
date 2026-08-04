import { NavLink } from "react-router-dom";

const TABS = [
  { to: "/dashboard", icon: "🏠", label: "Home" },
  { to: "/steps", icon: "👣", label: "Steps" },
  { to: "/reminders", icon: "💊", label: "Meds" },
  { to: "/checkin", icon: "📝", label: "Check-in" },
  { to: "/profile", icon: "👤", label: "Profile" },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {TABS.map((tab) => (
        <NavLink key={tab.to} to={tab.to} className={({ isActive }) => (isActive ? "active" : "")}>
          <span className="icon">{tab.icon}</span>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
