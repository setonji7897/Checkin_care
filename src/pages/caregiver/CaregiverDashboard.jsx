import { useEffect, useMemo, useState } from "react";
import { ref, query, orderByChild, equalTo, onValue, get } from "firebase/database";
import { db } from "../../firebase/config";
import { Users, AlertTriangle, Activity, CalendarClock, Bell, CheckCircle2, AlertCircle, KeyRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { calculateAdherence, evaluatePatientAlerts, getPatientName, getMedicationTimes } from "../../utils/backendData";
import { redeemInviteCode } from "../../services/careInviteService";
import "../../styles/dashboard.css";

export default function CaregiverDashboard() {
  const navigate = useNavigate();
  const { currentUser, userData } = useAuth();
  const [patients, setPatients] = useState([]);
  const [logs, setLogs] = useState([]);
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);

  // Invite entry states
  const [inviteCode, setInviteCode] = useState("");
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemError, setRedeemError] = useState("");
  const [successPatient, setSuccessPatient] = useState("");
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    if (!currentUser) return;

    // Correct query: caregiverAssignments by caregiverId
    const assignQuery = query(
      ref(db, "caregiverAssignments"),
      orderByChild("caregiverId"),
      equalTo(currentUser.uid)
    );

    const unsubAssign = onValue(assignQuery, async (snapshot) => {
      const patientIds = [];
      snapshot.forEach(child => {
        patientIds.push(child.key); // child.key is the patientId
      });

      const patientList = [];
      for (const pid of patientIds) {
        const pSnap = await get(ref(db, "patients/" + pid));
        if (!pSnap.exists()) continue;
        const patientData = { id: pid, ...pSnap.val() };
        // Name lives in users/{linkedUid}, not in patients/{pid}
        const linkedUid = patientData.linkedUid || pid;
        const uSnap = await get(ref(db, "users/" + linkedUid));
        if (uSnap.exists()) {
          const u = uSnap.val();
          patientData.firstName = u.firstName || "";
          patientData.lastName  = u.lastName  || "";
        }
        patientList.push(patientData);
      }
      setPatients(patientList);
      setLoading(false);
    });

    const unsubLogs = onValue(ref(db, "adherenceLogs"), (snapshot) => {
      const list = [];
      snapshot.forEach(child => list.push({ id: child.key, ...child.val() }));
      setLogs(list);
    });

    const unsubMeds = onValue(ref(db, "medications"), (snapshot) => {
      const list = [];
      snapshot.forEach(child => list.push({ id: child.key, ...child.val() }));
      setMedications(list);
    });

    return () => {
      unsubAssign();
      unsubLogs();
      unsubMeds();
    };
  }, [currentUser]);

  const stats = useMemo(() => {
    const patientIds = patients.map(p => p.id);
    const patientLogs = logs.filter(log => patientIds.includes(log.patientId));
    const todayStr = new Date().toISOString().split("T")[0];
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    let missedToday = 0;
    const weekLogs = [];

    patientLogs.forEach(log => {
      if (log.scheduledDate === todayStr && log.status === "missed") {
        missedToday++;
      }
      const logDate = new Date(log.scheduledDate);
      if (logDate >= weekAgo) {
        weekLogs.push(log);
      }
    });

    const ad = calculateAdherence(weekLogs);
    const weeklyAdherence = ad.rate;

    const patientsWithAlerts = [];
    patients.forEach(patient => {
      const alerts = evaluatePatientAlerts(patient.id, logs, medications);
      if (alerts.length > 0) {
        const patientWeeklyLogs = logs.filter(log => log.patientId === patient.id && new Date(log.scheduledDate) >= weekAgo);
        const patientAd = calculateAdherence(patientWeeklyLogs);
        patientsWithAlerts.push({ patient, alerts, adherence: patientAd.rate });
      }
    });

    return {
      missedToday,
      weeklyAdherence,
      patientsWithAlerts
    };
  }, [patients, logs, medications]);

  const handleRedeem = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setRedeemLoading(true);
    setRedeemError("");
    try {
      const caregiverName = [userData?.firstName, userData?.lastName].filter(Boolean).join(" ") || "Caregiver";
      const invite = await redeemInviteCode(inviteCode, currentUser.uid, caregiverName);
      setSuccessPatient(invite.patientName || "your patient");
      setInviteCode("");
      setTimeout(() => {
        setSuccessPatient("");
      }, 3000);
    } catch (err) {
      if (err.message === "not_found") {
        setRedeemError("Invalid invite code. Please verify the code and try again.");
      } else if (err.message === "already_used") {
        setRedeemError("This invite code has already been used.");
      } else if (err.message === "expired") {
        setRedeemError("This invite code has expired (codes expire after 48 hours).");
      } else {
        setRedeemError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setRedeemLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "300px", color: "var(--text-muted)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 32, height: 32, border: "3px solid var(--border)", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 1rem" }} />
          <p style={{ margin: 0, fontSize: "0.9rem" }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Render required setup view if caregiver has no assigned patients, and hasn't clicked Skip
  if (patients.length === 0 && !skipped) {
    return (
      <div className="page-transition-enter" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh", padding: "1rem" }}>
        <div className="auth-card" style={{ maxWidth: "480px", width: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "rgba(99,102,241,0.1)", color: "#6366f1",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 1rem"
            }}>
              <KeyRound size={28} />
            </div>
            <h2 style={{ margin: "0 0 0.5rem", color: "var(--text-primary)" }}>Connect to a Patient</h2>
            <p style={{ color: "var(--text-muted)", margin: 0, fontSize: "0.9rem" }}>
              To start monitoring medication schedules and adherence, please redeem the invite code generated by your patient.
            </p>
          </div>

          {successPatient ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", background: "rgba(16,185,129,0.08)", border: "1.5px solid #10b981", borderRadius: "12px", padding: "1.5rem", textAlign: "center", marginBottom: "1.5rem" }}>
              <CheckCircle2 size={32} color="#10b981" />
              <h3 style={{ margin: 0, color: "var(--text-primary)", fontSize: "1.1rem" }}>Successfully Connected!</h3>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)" }}>
                You are now linked to <strong>{successPatient}</strong>.
              </p>
            </div>
          ) : (
            <form onSubmit={handleRedeem} style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1rem" }}>
              <div>
                <input
                  type="text"
                  placeholder="Enter 6-digit Invite Code"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  style={{
                    width: "100%", padding: "0.75rem", borderRadius: "10px",
                    border: "1.5px solid var(--border)", background: "var(--bg-card)",
                    color: "var(--text-primary)", fontSize: "1.1rem", fontWeight: 700,
                    textAlign: "center", letterSpacing: "2px", textTransform: "uppercase"
                  }}
                />
              </div>

              {redeemError && (
                <div style={{ display: "flex", gap: "0.5rem", background: "rgba(239,68,68,0.08)", border: "1px solid #ef4444", borderRadius: "10px", padding: "0.75rem", color: "#ef4444", fontSize: "0.85rem" }}>
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: "1px" }} />
                  <span>{redeemError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={redeemLoading || !inviteCode.trim()}
                className="submit-btn"
                style={{ padding: "0.75rem", fontWeight: 600, fontSize: "1rem" }}
              >
                {redeemLoading ? "Connecting..." : "Redeem Code"}
              </button>
            </form>
          )}

          <div style={{ textAlign: "center", marginTop: "1rem" }}>
            <button
              onClick={() => setSkipped(true)}
              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontWeight: 500, fontSize: "0.9rem" }}
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="dash-header">
        <div>
          <h1>Caregiver Dashboard</h1>
          <p className="dash-sub">Monitor patient medication schedules and adherence</p>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        <div className="dash-card" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Users size={32} color="#6366f1" style={{ marginBottom: "0.5rem" }} />
          <h3 style={{ margin: "0 0 0.25rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>Assigned Patients</h3>
          <span style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text-primary)" }}>{patients.length}</span>
        </div>
        <div className="dash-card" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <AlertTriangle size={32} color="#f59e0b" style={{ marginBottom: "0.5rem" }} />
          <h3 style={{ margin: "0 0 0.25rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>Need Attention</h3>
          <span style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text-primary)" }}>{stats.patientsWithAlerts.length}</span>
        </div>
        <div className="dash-card" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <CalendarClock size={32} color="#ef4444" style={{ marginBottom: "0.5rem" }} />
          <h3 style={{ margin: "0 0 0.25rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>Missed Today</h3>
          <span style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text-primary)" }}>{stats.missedToday}</span>
        </div>
        <div className="dash-card" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Activity size={32} color="#6c63ff" style={{ marginBottom: "0.5rem" }} />
          <h3 style={{ margin: "0 0 0.25rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>Weekly Adherence</h3>
          <span style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text-primary)" }}>{stats.weeklyAdherence}%</span>
        </div>
      </div>

      <div style={{ display: "grid", gap: "2rem", gridTemplateColumns: "1fr", alignItems: "start" }}>
        <div className="dash-card">
          <h3 style={{ margin: "0 0 1rem" }}>Patients Needing Attention</h3>
          {stats.patientsWithAlerts.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>No assigned patients have triggered alerts.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {stats.patientsWithAlerts.map(({ patient, alerts, adherence }) => (
                <div key={patient.id} style={{ border: "1px solid var(--border)", borderRadius: "12px", padding: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                    <h4 style={{ margin: 0, fontSize: "1.1rem", color: "var(--text-primary)" }}>{getPatientName(patient)}</h4>
                    <span style={{ fontWeight: 700, color: adherence < 60 ? "#ef4444" : adherence < 80 ? "#f59e0b" : "#10b981" }}>
                      {adherence}% Adherence
                    </span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: "1.5rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                    {alerts.map((alert, idx) => (
                      <li key={idx} style={{ color: "#ef4444" }}>{alert.message}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          <button className="btn-primary" style={{ marginTop: "1rem" }} onClick={() => navigate("/caregiver/patients")}>
            View All Patients
          </button>
        </div>

        <div className="dash-card">
          <h3 style={{ margin: "0 0 1rem" }}>Today's Schedules</h3>
          {patients.length === 0 ? (
            <p style={{ color: "var(--text-muted)", margin: 0 }}>No patients assigned yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {patients.map(patient => {
                const todayStr = new Date().toISOString().split("T")[0];
                const pLogs = logs.filter(l => l.patientId === patient.id && l.scheduledDate === todayStr);
                const eligibleLogs = pLogs.filter(l => l.status !== "upcoming");
                const taken = eligibleLogs.filter(l => l.status === "taken").length;
                const total = eligibleLogs.length;

                // Pending/missed doses from logs
                const loggedRemaining = pLogs.filter(l => l.status === "upcoming" || l.status === "missed");

                // Also include scheduled-but-unlogged doses from medications
                const patientMeds = medications.filter(m => m.patientId === patient.id);
                const scheduledTimes = [];
                patientMeds.forEach(med => {
                  const times = Array.isArray(med.reminderTimes) ? med.reminderTimes
                    : med.reminderTime ? [med.reminderTime]
                    : med.times ? (Array.isArray(med.times) ? med.times : [med.times])
                    : [];
                  times.filter(Boolean).forEach(t => {
                    const alreadyLogged = pLogs.some(l => l.medicationId === med.id && l.scheduledTime === t);
                    if (!alreadyLogged) {
                      scheduledTimes.push({
                        scheduledTime: t,
                        medicationName: med.medicationName || med.name || "Medication",
                        status: "pending"
                      });
                    }
                  });
                });

                const allRemaining = [...loggedRemaining, ...scheduledTimes]
                  .sort((a, b) => (a.scheduledTime || "").localeCompare(b.scheduledTime || ""));

                return (
                  <div key={patient.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: "1rem" }}>
                    <h4 style={{ margin: "0 0 0.5rem", color: "var(--text-primary)" }}>
                      {getPatientName(patient)}'s medications today
                    </h4>
                    <p style={{ margin: "0 0 0.75rem", fontSize: "0.9rem", color: "var(--text-muted)", fontWeight: 500 }}>
                      {total === 0 ? "No doses logged yet today" : `${taken} of ${total} doses taken today`}
                    </p>
                    {allRemaining.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {allRemaining.slice(0, 3).map((item, idx) => (
                          <div key={idx} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                            <Bell size={14} color="#6366f1" />
                            <span>{item.scheduledTime} - {item.medicationName}</span>
                            {item.status === "missed" && (
                              <span style={{ color: "#ef4444", fontWeight: 600, marginLeft: "auto" }}>Missed</span>
                            )}
                            {item.status === "pending" && (
                              <span style={{ color: "#6366f1", fontWeight: 500, marginLeft: "auto" }}>Upcoming</span>
                            )}
                          </div>
                        ))}
                        {allRemaining.length > 3 && (
                          <div style={{ fontSize: "0.8rem", color: "#6366f1", marginTop: "0.25rem" }}>
                            + {allRemaining.length - 3} more
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </>
  );
}
