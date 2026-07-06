// src/pages/Unauthorized.jsx
//
// PURPOSE: Accessible and user-friendly denier fallback screen when users 
// try to visit areas not permitted by their assigned security role.

import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/config";

export default function Unauthorized() {
  const { userRole, currentUser } = useAuth();
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

  function handleBackToDashboard() {
    const paths = {
      patient: "/patient",
      caregiver: "/caregiver",
      clinician: "/clinician",
    };
    navigate(paths[userRole] || "/login");
  }

  return (
    <div style={{
      display: "flex", 
      flexDirection: "column", 
      alignItems: "center",
      justifyContent: "center", 
      minHeight: "100vh", 
      fontFamily: "Inter, sans-serif",
      background: "#f8f7ff",
      padding: "2rem",
      textAlign: "center"
    }}>
      <span style={{ fontSize: "4rem", marginBottom: "1rem" }}>ðŸš«</span>
      <h1 style={{ margin: "0 0 0.5rem 0", color: "var(--text-primary)", fontWeight: 800 }}>Access Denied</h1>
      <p style={{ color: "var(--text-muted)", maxWidth: "420px", fontSize: "0.95rem", lineHeight: "1.5", marginBottom: "2rem" }}>
        Your user account role is not permitted to view this area of the Medication Reminder portal.
      </p>
      
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
        <button 
          onClick={handleBackToDashboard} 
          style={{ 
            padding: "0.75rem 1.5rem", 
            background: "#6c63ff", 
            color: "#fff", 
            border: "none", 
            borderRadius: "10px", 
            fontSize: "0.9rem", 
            fontWeight: 700, 
            cursor: "pointer",
            boxShadow: "0 4px 14px rgba(108, 99, 255, 0.25)"
          }}
        >
          Back to Dashboard
        </button>
        <button 
          onClick={handleSignOut} 
          style={{ 
            padding: "0.75rem 1.5rem", 
            background: "transparent", 
            color: "#ef4444", 
            border: "1.5px solid #fecaca", 
            borderRadius: "10px", 
            fontSize: "0.9rem", 
            fontWeight: 700, 
            cursor: "pointer"
          }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
