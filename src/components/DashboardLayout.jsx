// src/components/DashboardLayout.jsx
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import { useState } from "react";
import "../styles/dashboard.css";

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="dashboard-layout">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <main className={"dashboard-main" + (collapsed ? " sidebar-collapsed" : "")}>
        <Outlet />
      </main>
    </div>
  );
}
