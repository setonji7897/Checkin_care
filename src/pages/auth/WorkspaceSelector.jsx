// src/pages/auth/WorkspaceSelector.jsx
//
// PURPOSE: Landing landing page for users with multiple roles to select which
// dashboard workspace they would like to enter upon logging in.

import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import "../../styles/auth.css";

export default function WorkspaceSelector() {
  const { userRoles, updateActiveRole } = useAuth();
  const navigate = useNavigate();

  // Find all active truthy roles
  const activeRoles = Object.keys(userRoles).filter(role => userRoles[role] === true);

  const handleSelectRole = (role) => {
    updateActiveRole(role);
    navigate(`/${role}`);
  };

  return (
    <div className="auth-page">
      <div className="auth-blob blob-1" />
      <div className="auth-blob blob-2" />

      <div className="auth-card" style={{ textAlign: "center" }}>
        <div className="auth-logo">
          <span className="auth-logo-icon">💊</span>
          <h1 className="auth-brand">MedRemind</h1>
        </div>

        <p className="auth-subtitle">Select your active workspace dashboard</p>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1.5rem" }}>
          {activeRoles.map(role => (
            <button
              key={role}
              onClick={() => handleSelectRole(role)}
              className="submit-btn"
              style={{
                textTransform: "capitalize",
                padding: "1rem",
                fontSize: "1.05rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem"
              }}
            >
              {role === "patient" && "🧑‍⚕️ Patient Portal"}
              {role === "caregiver" && "🤝 Caregiver Dashboard"}
              {role === "clinician" && "👩‍🔬 Clinician Console"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
