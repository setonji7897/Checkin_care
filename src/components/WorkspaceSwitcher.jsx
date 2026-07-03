// src/components/WorkspaceSwitcher.jsx
//
// PURPOSE: Dropdown profile panel component to switch active workspace environments dynamically.

import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

export default function WorkspaceSwitcher() {
  const { userRoles, activeRole, updateActiveRole } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const roles = Object.keys(userRoles).filter(r => userRoles[r] === true);

  // If user only has 1 role, don't show workspace switcher controls
  if (roles.length <= 1) return null;

  const handleRoleChange = (role) => {
    updateActiveRole(role);
    setOpen(false);
    navigate(`/${role}`);
  };

  return (
    <div style={{ position: "relative", display: "inline-block", margin: "0.5rem 0" }}>
      <button
        onClick={() => setOpen(!open)}
        className="nav-item"
        style={{
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.15)",
          color: "#fff",
          width: "100%",
          textAlign: "left",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
          padding: "0.6rem 0.9rem"
        }}
      >
        <span>🔄 Switch Workspace</span>
        <span style={{ fontSize: "0.75rem", textTransform: "capitalize", background: "#6c63ff", padding: "0.1rem 0.4rem", borderRadius: "10px" }}>
          {activeRole}
        </span>
      </button>

      {open && (
        <div style={{
          position: "absolute",
          top: "110%",
          left: 0,
          right: 0,
          background: "#1a1a2e",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: "10px",
          boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
          zIndex: 100,
          display: "flex",
          flexDirection: "column",
          padding: "0.25rem",
          gap: "0.25rem"
        }}>
          {roles.map(r => (
            <button
              key={r}
              onClick={() => handleRoleChange(r)}
              style={{
                background: r === activeRole ? "rgba(108, 99, 255, 0.25)" : "transparent",
                border: "none",
                color: r === activeRole ? "#a5a0ff" : "rgba(255,255,255,0.7)",
                padding: "0.5rem 0.8rem",
                borderRadius: "6px",
                textAlign: "left",
                cursor: "pointer",
                textTransform: "capitalize",
                fontSize: "0.85rem",
                fontWeight: r === activeRole ? 700 : 500
              }}
            >
              {r === "patient" && "🧑‍⚕️ Patient Portal"}
              {r === "caregiver" && "🤝 Caregiver Dashboard"}
              {r === "clinician" && "👩‍🔬 Clinician Console"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
