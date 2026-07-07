// src/pages/clinician/PatientDetail.jsx
//
// PURPOSE: Complete detail view of a single patient for clinicians. Includes profile,
// medications prescibed vs self-prescribed, real-time adherence rate calculations,
// assignments configuration controls, and history logs.

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ref, onValue, get, query, orderByChild, equalTo, set } from "firebase/database";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase/config";
import { calculateAdherenceRate } from "../../utils/adherenceStats";
import "../../styles/dashboard.css";

export default function PatientDetail() {
  const { currentUser } = useAuth();
  const { patientId } = useParams();
  const navigate = useNavigate();

  const [patient, setPatient] = useState(null);
  const [medications, setMedications] = useState([]);
  const [adherenceStats, setAdherenceStats] = useState({ rate: null, taken: 0, missed: 0, skipped: 0 });
  const [logs, setLogs] = useState([]);
  
  const [loading, setLoading] = useState(true);

  // Caregiver assignment state
  const [caregiverEmail, setCaregiverEmail] = useState("");
  const [assignedCaregiver, setAssignedCaregiver] = useState(null);
  const [assignError, setAssignError] = useState("");
  const [assignSuccess, setAssignSuccess] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);

  

  // 1. Subscribe to patient profile, medications, adherence logs, and assigned caregiver
  useEffect(() => {
    if (!patientId) return;

    const patientRef = ref(db, `patients/${patientId}`);
    const unsubscribePatient = onValue(patientRef, (snap) => {
      if (snap.exists()) {
        setPatient(snap.val());
      }
    });

    const medsQuery = query(ref(db, "medications"), orderByChild("patientId"), equalTo(patientId));
    const unsubscribeMeds = onValue(medsQuery, (snap) => {
      const list = [];
      if (snap.exists()) {
        const vals = snap.val();
        for (const k in vals) {
          list.push({ id: k, ...vals[k] });
        }
      }
      setMedications(list);
    });

    const logsQuery = query(ref(db, "adherenceLogs"), orderByChild("patientId"), equalTo(patientId));
    const unsubscribeLogs = onValue(logsQuery, (snap) => {
      const list = [];
      if (snap.exists()) {
        const vals = snap.val();
        for (const k in vals) {
          list.push({ id: k, ...vals[k] });
        }
      }
      // Sort logs by newest scheduled date & time first
      list.sort((a, b) => {
        const dateA = `${a.scheduledDate}T${a.scheduledTime}`;
        const dateB = `${b.scheduledDate}T${b.scheduledTime}`;
        return dateB.localeCompare(dateA);
      });

      setLogs(list);

      // Extract stats for last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const limitString = sevenDaysAgo.toISOString().split("T")[0];

      const lastSevenDaysLogs = list.filter(l => l.scheduledDate >= limitString);
      setAdherenceStats(calculateAdherenceRate(lastSevenDaysLogs));
    });

    // Caregiver lookup
    const assignRef = ref(db, `caregiverAssignments/${patientId}`);
    const unsubscribeAssign = onValue(assignRef, async (snap) => {
      if (snap.exists()) {
        const assignment = snap.val();
        const caregiverId = assignment.caregiverId;
        
        // Fetch caregiver user details
        const cgRef = ref(db, `users/${caregiverId}`);
        const cgSnap = await get(cgRef);
        if (cgSnap.exists()) {
          setAssignedCaregiver({ id: caregiverId, ...cgSnap.val() });
        }
      } else {
        setAssignedCaregiver(null);
      }
      setLoading(false);
    });

    return () => {
      unsubscribePatient();
      unsubscribeMeds();
      unsubscribeLogs();
      unsubscribeAssign();
    };
  }, [patientId]);

  // Caregiver assignment submission handler
  async function handleAssignCaregiver(e) {
    e.preventDefault();
    setAssignError("");
    setAssignSuccess("");
    if (!caregiverEmail.trim()) {
      setAssignError("Email is required.");
      return;
    }
    setAssignLoading(true);

    try {
      const usersQuery = query(ref(db, "users"), orderByChild("email"), equalTo(caregiverEmail.trim().toLowerCase()));
      const snapshot = await get(usersQuery);

      if (!snapshot.exists()) {
        setAssignError("No user account found with this email.");
        setAssignLoading(false);
        return;
      }

      const usersObj = snapshot.val();
      const cgId = Object.keys(usersObj)[0];
      const cgData = usersObj[cgId];

      if (cgData.role !== "caregiver") {
        setAssignError(`User has the role "${cgData.role}". You can only assign patients to users registered as Caregivers.`);
        setAssignLoading(false);
        return;
      }

      // Record assignment
      await set(ref(db, `caregiverAssignments/${patientId}`), {
        caregiverId: cgId
      });

      setAssignSuccess(`Patient successfully assigned to caregiver: ${cgData.fullName || caregiverEmail}`);
      setCaregiverEmail("");
    } catch (err) {
      console.error(err);
      setAssignError("Failed to record caregiver assignment. Please verify connection.");
    } finally {
      setAssignLoading(false);
    }
  }

  if (loading) {
    return <div style={{ padding: "3rem", textAlign: "center" }}>Loading Patient Details...</div>;
  }

  return (
    <>
      

      
        <header className="dash-header">
          <div>
            <h1>{patient?.fullName}</h1>
            <p className="dash-sub">DOB: {patient?.dateOfBirth} | Condition: {patient?.medicalCondition}</p>
          </div>
          <button 
            className="submit-btn" 
            style={{ padding: "0.6rem 1.2rem", fontSize: "0.9rem" }}
            onClick={() => navigate(`/clinician/patients/${patientId}/add-medication`)}
          >
            âž• Prescribe Medication
          </button>
        </header>

        {/* Adherence rates */}
        <section className="coming-soon-grid" style={{ marginBottom: "2rem" }}>
          <div className="dash-card placeholder-card" style={{ borderLeft: "6px solid #6c63ff" }}>
            <h3>7-Day Adherence</h3>
            <span style={{ 
              fontSize: "2.5rem", 
              fontWeight: 800, 
              color: adherenceStats.rate === null ? "var(--text-muted)" : (adherenceStats.rate >= 80 ? "#10b981" : (adherenceStats.rate >= 50 ? "#f59e0b" : "#ef4444")) 
            }}>
              {adherenceStats.rate !== null ? `${adherenceStats.rate}%` : "No data"}
            </span>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Taken: {adherenceStats.taken} | Missed: {adherenceStats.missed} | Skipped: {adherenceStats.skipped}
            </p>
          </div>

          {/* Caregiver setup controls */}
          <div className="dash-card placeholder-card">
            <h3>Caregiver Assignment</h3>
            {assignedCaregiver ? (
              <p>ðŸŸ¢ Assigned to: <strong>{assignedCaregiver.fullName}</strong> ({assignedCaregiver.email})</p>
            ) : (
              <p style={{ color: "var(--text-muted)" }}>No caregiver assigned yet.</p>
            )}
            
            <form onSubmit={handleAssignCaregiver} style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
              <input
                type="email"
                placeholder="caregiver@email.com"
                value={caregiverEmail}
                onChange={e => setCaregiverEmail(e.target.value)}
                style={{ padding: "0.4rem 0.8rem", border: "1.5px solid var(--border)", borderRadius: "10px", flex: 1, fontSize: "0.85rem" }}
              />
              <button 
                type="submit" 
                className="submit-btn" 
                style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}
                disabled={assignLoading}
              >
                {assignLoading ? "Assigning..." : "Assign"}
              </button>
            </form>
            {assignError && <p style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: "0.3rem" }}>{assignError}</p>}
            {assignSuccess && <p style={{ color: "#10b981", fontSize: "0.75rem", marginTop: "0.3rem" }}>{assignSuccess}</p>}
          </div>
        </section>

        {/* Medications List */}
        <section style={{ marginBottom: "2rem" }}>
          <h2>Medication List</h2>
          {medications.length === 0 ? (
            <p style={{ color: "var(--text-muted)", marginTop: "0.5rem" }}>No prescribed medications yet.</p>
          ) : (
            <div className="coming-soon-grid" style={{ marginTop: "1rem" }}>
              {medications.map(med => (
                <div key={med.id} className="dash-card placeholder-card">
                  <h3>{med.medicationName}</h3>
                  <p><strong>Dosage:</strong> {med.dosage}</p>
                  <p><strong>Frequency:</strong> {typeof med.frequency === "object" ? med.frequency.label : med.frequency}</p>
                  <p>
                    <strong>Schedule:</strong>{" "}
                    {Array.isArray(med.reminderTime)
                      ? med.reminderTime.join(", ")
                      : med.reminderTime}
                  </p>
                  <p><strong>Instructions:</strong> {med.foodInstruction}</p>
                  <div style={{ marginTop: "0.5rem" }}>
                    {med.source === "clinician" ? (
                      <span className="coming-soon-tag" style={{ background: "#eff6ff", color: "#2563eb" }}>Clinician Prescribed</span>
                    ) : (
                      <span className="coming-soon-tag" style={{ background: "#f3f4f6", color: "#4b5563" }}>Self Prescribed</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Adherence Logs Table */}
        <section>
          <h2>Recent Adherence Logs (Last 14 Days)</h2>
          {logs.length === 0 ? (
            <p style={{ color: "var(--text-muted)", marginTop: "0.5rem" }}>No adherence logs found.</p>
          ) : (
            <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "14px", overflow: "hidden", marginTop: "1rem" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
                <thead>
                  <tr style={{ background: "#f9fafb", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "1rem" }}>Date</th>
                    <th style={{ padding: "1rem" }}>Medication</th>
                    <th style={{ padding: "1rem" }}>Scheduled Slot</th>
                    <th style={{ padding: "1rem" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.slice(0, 30).map(log => (
                    <tr key={log.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "1rem" }}>{log.scheduledDate}</td>
                      <td style={{ padding: "1rem" }}><strong>{log.medicationName}</strong></td>
                      <td style={{ padding: "1rem" }}>{log.scheduledTime}</td>
                      <td style={{ padding: "1rem" }}>
                        <span style={{ 
                          padding: "0.25rem 0.6rem", 
                          borderRadius: "20px", 
                          fontSize: "0.75rem", 
                          fontWeight: 700,
                          background: log.status === "taken" ? "#ecfdf5" : (log.status === "missed" ? "#fef2f2" : "#fffbeb"),
                          color: log.status === "taken" ? "#047857" : (log.status === "missed" ? "#b91c1c" : "#b45309")
                        }}>
                          {log.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </>
  );
}
