// src/components/Sidebar.jsx
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useState, useRef, useEffect } from "react";
import {
  LayoutDashboard, Pill, CalendarClock, ClockArrowUp, TrendingUp,
  Bell, UserCircle, SlidersHorizontal, AlertTriangle, FileBarChart,
  MessageSquare, Users, LogOut, ChevronLeft, ChevronRight, MoreHorizontal, X
} from "lucide-react";
import "../styles/dashboard.css";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/config";
import { subscribeToUserConversations } from "../utils/messageUtils";

import logoDark from "../assets/logo dark mode.png";

// Primary bottom-nav items per role (max 4, + "More" = 5 total)
const PRIMARY_LINKS = {
  patient: [
    { path: "/patient",             label: "Dashboard",   icon: LayoutDashboard, end: true },
    { path: "/patient/schedule",    label: "Schedule",    icon: CalendarClock },
    { path: "/patient/medications", label: "Meds",        icon: Pill },
    { path: "/patient/history",     label: "History",     icon: ClockArrowUp },
  ],
  caregiver: [
    { path: "/caregiver",           label: "Dashboard",   icon: LayoutDashboard, end: true },
    { path: "/caregiver/patients",  label: "Patients",    icon: Users },
    { path: "/caregiver/alerts",    label: "Alerts",      icon: AlertTriangle },
    { path: "/caregiver/messages",  label: "Messages",    icon: MessageSquare },
  ],
  clinician: [
    { path: "/clinician",           label: "Dashboard",   icon: LayoutDashboard, end: true },
    { path: "/clinician/patients",  label: "Patients",    icon: Users },
    { path: "/clinician/medications", label: "Meds",      icon: Pill },
    { path: "/clinician/reports",   label: "Reports",     icon: FileBarChart },
  ],
};

// All links per role (full desktop sidebar)
const ALL_LINKS = {
  patient: [
    { path: "/patient",             label: "Dashboard",      icon: LayoutDashboard, end: true },
    { path: "/patient/medications", label: "My Medications", icon: Pill },
    { path: "/patient/schedule",    label: "Schedule",       icon: CalendarClock },
    { path: "/patient/history",     label: "History",        icon: ClockArrowUp },
    { path: "/patient/adherence",   label: "Adherence",      icon: TrendingUp },
    { path: "/patient/notifications", label: "Notifications", icon: Bell },
    { path: "/patient/profile",     label: "Profile",        icon: UserCircle },
    { path: "/patient/settings",    label: "Settings",       icon: SlidersHorizontal },
    { path: "/patient/help",        label: "Help & Support", icon: AlertTriangle },
  ],
  caregiver: [
    { path: "/caregiver",           label: "Dashboard",      icon: LayoutDashboard, end: true },
    { path: "/caregiver/patients",  label: "Patients",       icon: Users },
    { path: "/caregiver/alerts",    label: "Alerts",         icon: AlertTriangle },
    { path: "/caregiver/reports",   label: "Reports",        icon: FileBarChart },
    { path: "/caregiver/messages",  label: "Messages",       icon: MessageSquare },
    { path: "/caregiver/notifications", label: "Notifications", icon: Bell },
    { path: "/caregiver/profile",   label: "Profile",        icon: UserCircle },
    { path: "/caregiver/settings",  label: "Settings",       icon: SlidersHorizontal },
    { path: "/caregiver/help",      label: "Help & Support", icon: AlertTriangle },
  ],
  clinician: [
    { path: "/clinician",           label: "Dashboard",      icon: LayoutDashboard, end: true },
    { path: "/clinician/patients",  label: "Patients",       icon: Users },
    { path: "/clinician/medications", label: "Medications",  icon: Pill },
    { path: "/clinician/reports",   label: "Reports",        icon: FileBarChart },
    { path: "/clinician/analytics", label: "Analytics",      icon: TrendingUp },
    { path: "/clinician/notifications", label: "Notifications", icon: Bell },
    { path: "/clinician/profile",   label: "Profile",        icon: UserCircle },
    { path: "/clinician/settings",  label: "Settings",       icon: SlidersHorizontal },
    { path: "/clinician/help",      label: "Help & Support", icon: AlertTriangle },
  ],
};

export default function Sidebar({ collapsed, setCollapsed }) {
  const { activeRole, userData, currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const navRef = useRef(null);
  const [pillStyle, setPillStyle] = useState({ top: 0, opacity: 0 });
  const [totalUnread, setTotalUnread] = useState(0);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    const unsub = subscribeToUserConversations(currentUser.uid, (convs) => {
      const total = convs.reduce((sum, c) => sum + (c.unread?.[currentUser.uid] || 0), 0);
      setTotalUnread(total);
    });
    return unsub;
  }, [currentUser]);

  const primaryLinks = PRIMARY_LINKS[activeRole] || [];
  const allLinks     = ALL_LINKS[activeRole]     || [];

  // Secondary = all links NOT in primaryLinks (by path)
  const primaryPaths = new Set(primaryLinks.map(l => l.path));
  const secondaryLinks = allLinks.filter(l => !primaryPaths.has(l.path));

  useEffect(() => {
    if (!navRef.current) return;
    const activeEl = navRef.current.querySelector(".active");
    if (activeEl) {
      setPillStyle({ top: activeEl.offsetTop, opacity: 1 });
    } else {
      setPillStyle({ opacity: 0 });
    }
  }, [location.pathname, activeRole, collapsed]);

  // Close More drawer when route changes
  useEffect(() => { setShowMore(false); }, [location.pathname]);

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
    <>
      {/* ── Desktop / Tablet sidebar (> 768px) ── */}
      <div className={"sidebar" + (collapsed ? " collapsed" : "")}>
        <div className="sidebar-brand">
          <img
            src={logoDark}
            alt="CheckIn Care"
            style={{ width: collapsed ? 32 : 130, height: "auto", mixBlendMode: "screen" }}
          />
        </div>

        <nav className="sidebar-nav" ref={navRef}>
          <div className="nav-active-pill" style={{ top: pillStyle.top, opacity: pillStyle.opacity }} />
          {allLinks.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.path}
                to={link.path}
                end={link.end}
                className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
                title={collapsed ? link.label : ""}
              >
                <Icon size={20} style={{ minWidth: "20px" }} />
                <span className="nav-label">{link.label}</span>
                {link.label === "Messages" && totalUnread > 0 && !collapsed && (
                  <span style={{
                    marginLeft: "auto", background: "#ef4444", color: "white",
                    fontSize: "10px", fontWeight: 700, borderRadius: "20px",
                    padding: "1px 6px"
                  }}>
                    {totalUnread}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-footer" style={{ padding: "1rem", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <button
            onClick={handleSignOut}
            style={{ background: "transparent", border: "none", width: "100%", cursor: "pointer", color: "#94a3b8", display: "flex", alignItems: "center", gap: "1rem", padding: "0.75rem 1rem", borderRadius: "8px" }}
          >
            <LogOut size={20} style={{ minWidth: "20px" }} />
            <span className="nav-label">Sign Out</span>
          </button>
        </div>

        <button
          className="sidebar-collapse-toggle"
          onClick={() => setCollapsed(!collapsed)}
          style={{
            position: "absolute",
            bottom: "20px",
            right: "-16px",
            background: "var(--text-primary)",
            border: "1px solid #1e293b",
            color: "white",
            borderRadius: "50%",
            width: "32px",
            height: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: 101
          }}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* ── Mobile bottom nav (≤ 768px) — 4 primary + More ── */}
      <nav className="mobile-bottom-nav" aria-label="Main navigation">
        {primaryLinks.map((link) => {
          const Icon = link.icon;
          const isActive = link.end
            ? location.pathname === link.path
            : location.pathname.startsWith(link.path);
          return (
            <NavLink
              key={link.path}
              to={link.path}
              end={link.end}
              className={({ isActive: a }) => "mobile-nav-item" + (a ? " active" : "")}
              onClick={() => setShowMore(false)}
            >
              <Icon size={22} />
              <span>{link.label}</span>
            </NavLink>
          );
        })}

        {/* More button */}
        <button
          className={"mobile-nav-item mobile-more-btn" + (showMore ? " active" : "")}
          onClick={() => setShowMore(v => !v)}
          aria-expanded={showMore}
          aria-label="More navigation options"
        >
          {totalUnread > 0 && !showMore && (
            <span className="mobile-more-badge">{totalUnread > 9 ? "9+" : totalUnread}</span>
          )}
          <MoreHorizontal size={22} />
          <span>More</span>
        </button>
      </nav>

      {/* ── More Drawer Overlay ── */}
      {showMore && (
        <div className="mobile-more-backdrop" onClick={() => setShowMore(false)} aria-hidden="true" />
      )}
      <div className={"mobile-more-drawer" + (showMore ? " open" : "")} role="dialog" aria-label="More options">
        <div className="mobile-more-drawer-handle" onClick={() => setShowMore(false)} />
        <div className="mobile-more-drawer-content">
          {secondaryLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.path || location.pathname.startsWith(link.path + "/");
            return (
              <NavLink
                key={link.path}
                to={link.path}
                end={link.end}
                className={({ isActive: a }) => "mobile-more-link" + (a ? " active" : "")}
                onClick={() => setShowMore(false)}
              >
                <span className="mobile-more-link-icon">
                  <Icon size={20} />
                </span>
                <span className="mobile-more-link-label">{link.label}</span>
                {link.label === "Messages" && totalUnread > 0 && (
                  <span className="mobile-more-badge-inline">{totalUnread}</span>
                )}
              </NavLink>
            );
          })}

          <div className="mobile-more-divider" />

          <button className="mobile-more-signout" onClick={handleSignOut}>
            <span className="mobile-more-link-icon">
              <LogOut size={20} />
            </span>
            <span className="mobile-more-link-label">Sign Out</span>
          </button>
        </div>
      </div>
    </>
  );
}
