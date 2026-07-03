// src/pages/caregiver/PatientOverview.jsx
//
// PURPOSE: Caregiver overview panel displays real-time health profiles and 7-day adherence rates.

import { useState, useEffect } from "react";
import { ref, query, orderByChild, equalTo, onValue, get } from "firebase/database";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase/config";
import { calculateAdherenceRate } from "../../utils/adherenceStats";
import WorkspaceSwitcher from "../../components/WorkspaceSwitcher";
import "../../styles/dashboard.css";

export default function PatientOverview() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  async function handleSignOut() {
    await signOut(auth);
    navigate("/login");
  }

  // Load Caregiver Assignment connections and patient logs in real time
  useEffect(() => {
    if (!currentUser) return;

    const assignQuery = query(
      ref(db, "caregiverAssignments"),
      orderByChild("caregiverId"),
      equalTo(currentUser.uid)
    );

    const unsubscribeAssign = onValue(assignQuery, async (snapshot) => {
      const patientList = [];

      if (snapshot.exists()) {
        const assignments = snapshot.val();
        
        // Loop assignments and fetch matching profiles
        for (const patientId in assignments) {
          try {
            // Profile Details
            const pSnap = await get(ref(db, `patients/${patientId}`));
            if (pSnap.exists()) {
              const pData = pSnap.val();

              // Fetch adherence logs to compute 7-day compliance rate
              const logsSnap = await get(query(ref(db, "adherenceLogs"), orderByChild("patientId"), equalTo(patientId)));
              const logsList = [];
              if (logsSnap.exists()) {
                const logsObj = logsSnap.val();
                for (const key in logsObj) {
                  logsList.push(logsObj[key]);
                }
              }

              // Filter to last 7 days logs
              const sevenDaysAgo = new Date();
              sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
              const limitStr = sevenDaysAgo.toISOString().split("T")[0];
              const recentLogs = logsList.filter(l => l.scheduledDate >= limitStr);

              // Calculate rate
              const statsObj = calculateAdherenceRate(recentLogs);

              // Find the last dose taken
              let lastDose = null;
              const takenLogs = logsList.filter(l => l.status === "taken");
              if (takenLogs.length > 0) {
                takenLogs.sort((a, b) => {
                  const dtA = `${a.scheduledDate}T${a.scheduledTime}`;
                  const dtB = `${b.scheduledDate}T${b.scheduledTime}`;
                  return dtB.localeCompare(dtA);
                });
                lastDose = takenLogs[0];
              }

              patientList.push({
                id: patientId,
                ...pData,
                adherenceRate: statsObj.rate,
                lastDoseTaken: lastDose
              });
            }
          } catch (err) {
            console.error("Error building caregiver patient data mapping:", err);
          }
        }
      }

      setPatients(patientList);
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });

    return () => unsubscribeAssign();
  }, [currentUser]);

  return (
    <div className="dashboard-page caregiver-theme">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span>💊</span>
          <span>MedRemind</span>
        </div>
        <WorkspaceSwitcher />
        <nav className="sidebar-nav">
          <a onClick={() => navigate("/caregiver")} className="nav-item active">🏠 Overview</a>
        </nav>
        <button className="signout-btn" onClick={handleSignOut}>Sign Out</button>
      </aside>

      <main className="dashboard-main">
        <header className="dash-header">
          <div>
            <h1>Caregiver Dashboard</h1>
            <p className="dash-sub">Caregiver: {currentUser?.email}</p>
          </div>
          <div className="role-badge caregiver-badge">Caregiver</div>
        </header>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
            <span style={{ fontSize: "1.2rem", color: "#6b7280" }}>Retrieving assigned patient list...</span>
          </div>
        ) : patients.length === 0 ? (
          <div className="dash-card" style={{ textAlign: "center", padding: "3rem" }}>
            <span style={{ fontSize: "3rem" }}>🤝</span>
            <h3 style={{ margin: "1rem 0 0.5rem 0" }}>No patients assigned yet</h3>
            <p style={{ color: "#6b7280" }}>Ask your clinician to link patient profiles to your caregiver email.</p>
          </div>
        ) : (
          <div className="coming-soon-grid">
            {patients.map(p => {
              // Status compliance severity mappings
              const rate = p.adherenceRate;
              const statusText = rate === null ? "No Data" : (rate >= 80 ? "Good" : (rate >= 50 ? "Needs Attention" : "Critical"));
              const statusColor = rate === null ? "#6b7280" : (rate >= 80 ? "#10b981" : (rate >= 50 ? "#f59e0b" : "#ef4444"));
              const statusBg = rate === null ? "#f3f4f6" : (rate >= 80 ? "#ecfdf5" : (rate >= 50 ? "#fffbeb" : "#fef2f2"));

              return (
                <div key={p.id} className="dash-card placeholder-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <h3 style={{ fontSize: "1.25rem", fontWeight: 800 }}>{p.fullName}</h3>
                    <span style={{ 
                      padding: "0.25rem 0.6rem", 
                      borderRadius: "20px", 
                      fontSize: "0.75rem", 
                      fontWeight: 700,
                      background: statusBg,
                      color: statusColor
                    }}>
                      {statusText.toUpperCase()}
                    </span>
                  </div>

                  <p><strong>Condition:</strong> {p.medicalCondition}</p>
                  <p><strong>DOB:</strong> {p.dateOfBirth}</p>
                  
                  <div style={{ margin: "1rem 0 0.5rem 0", padding: "0.75rem", background: "#f8f7ff", borderRadius: "10px" }}>
                    <p style={{ fontSize: "0.85rem", color: "#6b7280" }}>7-Day Adherence Score</p>
                    <span style={{ fontSize: "1.75rem", fontWeight: 800, color: statusColor }}>
                      {rate !== null ? `${rate}%` : "—"}
                    </span>
                  </div>

                  <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                    <strong>Last Dose Taken:</strong><br />
                    {p.lastDoseTaken 
                      ? `${p.lastDoseTaken.medicationName} at ${p.lastDoseTaken.scheduledTime} (${p.lastDoseTaken.scheduledDate})`
                      : "No records found"
                    }
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
