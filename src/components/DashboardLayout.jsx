// src/components/DashboardLayout.jsx
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/config";
import "../styles/dashboard.css";
import logoIcon from "../assets/logo.png";

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    try {
      if (currentUser) {
        localStorage.removeItem("activeRole_" + currentUser.uid);
        localStorage.removeItem("voiceRemindersEnabled");
      }
      await signOut(auth);
      navigate("/login", { replace: true });
    } catch (err) {
      console.error("Sign out error:", err);
    }
  }

  return (
    <div className="dashboard-layout">
      {/* Sticky top header — mobile only (hidden on desktop via CSS) */}
      <header className="mobile-top-header">
        <img src={logoIcon} alt="CheckIn Care" className="mobile-top-logo" />
        <button
          onClick={handleSignOut}
          className="mobile-top-signout"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut size={20} />
        </button>
      </header>

      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <main className={"dashboard-main" + (collapsed ? " sidebar-collapsed" : "")}>
        <Outlet />
      </main>
    </div>
  );
}
