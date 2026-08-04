import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useReminderScheduler } from "../hooks/useReminderScheduler";
import Navbar from "./Navbar";
import BottomNav from "./BottomNav";
import DailyPopups from "./DailyPopups";

export default function ProtectedRoute() {
  const { isLoggedIn } = useAuth();
  useReminderScheduler();

  if (!isLoggedIn) return <Navigate to="/login" replace />;

  return (
    <div className="has-bottom-nav">
      <Navbar />
      <Outlet />
      <BottomNav />
      <DailyPopups />
    </div>
  );
}
