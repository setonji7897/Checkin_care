// src/routes/ProtectedRoute.jsx
//
// PURPOSE: A wrapper component that sits in front of any page that requires authentication.
// Verifies if the active workspace role matches allowed routes.

import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

import logoIcon from "../assets/logo.png";

export default function ProtectedRoute({ children, allowedRoles }) {
  const { currentUser, activeRole, userRoles, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <div style={{ textAlign: "center" }}>
          <img src={logoIcon} alt="CheckIn Care" style={{ width: 60, marginBottom: "1rem", animation: "pulse 1.5s ease infinite" }} />
          <p style={{ color: "#64748b", fontSize: "0.9rem" }}>Loading your workspace...</p>
        </div>
      </div>
    );
  }

  // 1. Not logged in -> send to login page
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // 2. Resolve active roles list
  const activeRolesList = Object.keys(userRoles).filter(r => userRoles[r] === true);

  // 3. User has multiple roles but has not selected an active workspace workspace session yet -> send to selection page
  if (activeRolesList.length > 1 && !activeRole) {
    return <Navigate to="/select-workspace" replace />;
  }

  // 4. Check if access to this specific route folder requires matching role
  if (allowedRoles && !allowedRoles.includes(activeRole)) {
    return <Navigate to="/unauthorised" replace />;
  }

  return children;
}
