import { useEffect, useState, useMemo } from "react";
import { AlertTriangle, Bell, CheckCircle2, MessageSquare } from "lucide-react";
import { ref, query, orderByChild, equalTo, onValue, update, push, set, get } from "firebase/database";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import { evaluatePatientAlerts, calculateAdherence, getPatientName, getPatientUid, writeUserNotification } from "../../utils/backendData";
import "../../styles/dashboard.css";

export default function CaregiverAlerts() {
  const { currentUser } = useAuth();
  const [patients, setPatients] = useState([]);
  const [logs, setLogs] = useState([]);
  const [medications, setMedications] = useState([]);
  // Resolved alert IDs (stored locally so user can dismiss computed alerts)
  const [resolvedIds, setResolvedIds] = useState(new Set());

  useEffect(() => {
    if (!currentUser) return;

    // Fetch assigned patients via caregiverAssignments
    const assignQuery = query(
      ref(db, "caregiverAssignments"),
      orderByChild("caregiverId"),
      equalTo(currentUser.uid)
    );

    const unsubAssign = onValue(assignQuery, async (snapshot) => {
      const patientIds = [];
      snapshot.forEach(child => patientIds.push(child.key));

      const patientList = [];
      for (const pid of patientIds) {
        const pSnap = await get(ref(db, "patients/" + pid));
        if (pSnap.exists()) {
          patientList.push({ id: pid, ...pSnap.val() });
        }
      }
      setPatients(patientList);
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

  // Compute alerts using evaluatePatientAlerts for each patient
  const patientAlerts = useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    return patients
      .map(patient => {
        const alerts = evaluatePatientAlerts(patient.id, logs, medications);
        if (alerts.length === 0) return null;

        const pId = patient.id;
        if (resolvedIds.has(pId)) return null;

        const weekLogs = logs.filter(l =>
          l.patientId === pId &&
          l.status !== "upcoming" &&
          new Date(l.scheduledDate) >= weekAgo
        );
        const adherence = calculateAdherence(weekLogs).rate;

        return { patient, alerts, adherence };
      })
      .filter(Boolean);
  }, [patients, logs, medications, resolvedIds]);

  const sendReminder = async (patient) => {
    const uid = getPatientUid(patient, patient.id);
    await writeUserNotification(uid, {
      type: "reminder",
      title: "Medication reminder",
      body: "Please check your medication schedule.",
      actionRoute: "/patient/schedule"
    });
  };

  const notifyClinician = async (patient) => {
    // Find clinicianId from the patient record
    const clinicianId = patient.clinicianId;
    if (!clinicianId) return;
    await set(push(ref(db, "notifications/" + clinicianId)), {
      type: "caregiver_alert",
      title: "Caregiver alert",
      body: getPatientName(patient) + " needs attention with their medications.",
      timestamp: Date.now(),
      read: false,
      actionRoute: "/clinician/patients/" + patient.id
    });
  };

  const resolveAlert = (patientId) => {
    setResolvedIds(prev => new Set([...prev, patientId]));
  };

  return (
    <>
      <header className="dash-header">
        <div>
          <h1>Active Alerts</h1>
          <p className="dash-sub">Critical missed medications and warnings</p>
        </div>
      </header>

      {patientAlerts.length === 0 ? (
        <div className="dash-card">
          <p style={{ color: "var(--text-muted)", margin: 0 }}>No critical alerts at this time.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          {patientAlerts.map(({ patient, alerts, adherence }) => (
            <div key={patient.id} className="dash-card" style={{ borderLeft: "5px solid #ef4444" }}>
              <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                <AlertTriangle color="#ef4444" />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                    <h3 style={{ margin: 0, color: "var(--text-primary)" }}>{getPatientName(patient)}</h3>
                    <span style={{
                      fontWeight: 700,
                      color: adherence < 50 ? "#ef4444" : adherence < 80 ? "#f59e0b" : "#10b981"
                    }}>
                      {adherence}% Adherence
                    </span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
                    {alerts.map((alert, idx) => (
                      <li key={idx} style={{ color: "#ef4444", fontSize: "0.9rem", marginBottom: "0.2rem" }}>
                        {alert.message}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "1rem" }}>
                <button
                  onClick={() => sendReminder(patient)}
                  className="btn-primary"
                  style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 0.85rem" }}
                >
                  <Bell size={16} /> Send Reminder
                </button>
                <button
                  onClick={() => notifyClinician(patient)}
                  style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 0.85rem", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer", fontWeight: 700 }}
                >
                  <MessageSquare size={16} /> Notify Clinician
                </button>
                <button
                  onClick={() => resolveAlert(patient.id)}
                  style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 0.85rem", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--bg-card)", color: "#10b981", cursor: "pointer", fontWeight: 700 }}
                >
                  <CheckCircle2 size={16} /> Resolve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
