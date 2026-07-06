import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bell, CheckCircle2, MessageSquare } from "lucide-react";
import { ref, query, orderByChild, equalTo, onValue, get, push, set, update } from "firebase/database";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import { evaluatePatientAlerts, calculatePatientRisk, getPatientName, getPatientUid, writeUserNotification } from "../../utils/backendData";
import "../../styles/dashboard.css";

export default function CaregiverAlerts() {
  const { currentUser } = useAuth();
  const [patients, setPatients] = useState([]);
  const [logs, setLogs] = useState([]);
  const [medications, setMedications] = useState([]);

  useEffect(() => {
    if (!currentUser) return;

    // Resolve assigned patients via caregiverAssignments
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

  // Compute alerts using the shared evaluatePatientAlerts function from backendData
  const alertedPatients = useMemo(() => {
    return patients
      .map(patient => {
        const alerts = evaluatePatientAlerts(patient.id, logs, medications);
        const risk = calculatePatientRisk(patient.id, logs);
        return { patient, alerts, adherence: risk.rate };
      })
      .filter(({ alerts }) => alerts.length > 0);
  }, [patients, logs, medications]);

  const sendReminder = async (patient) => {
    const uid = getPatientUid(patient, patient.id);
    await writeUserNotification(uid, {
      type: "reminder",
      title: "Caregiver Reminder",
      body: "Please check your medication schedule and take any missed doses.",
      actionRoute: "/patient/schedule"
    });
  };

  const notifyClinician = async (patient) => {
    if (!patient.clinicianId) return;
    await set(push(ref(db, "notifications/" + patient.clinicianId)), {
      type: "caregiver_alert",
      title: "Caregiver Alert",
      body: `${getPatientName(patient)} needs attention — please review their adherence.`,
      timestamp: Date.now(),
      read: false,
      actionRoute: "/clinician/patients/" + patient.id
    });
  };

  return (
    <>
      <header className="dash-header">
        <div>
          <h1>Active Alerts</h1>
          <p className="dash-sub">Critical missed medications and warnings</p>
        </div>
      </header>

      {alertedPatients.length === 0 ? (
        <div className="dash-card">
          <p style={{ color: "var(--text-muted)", margin: 0 }}>
            No critical alerts at this time. All patients are within normal adherence ranges.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          {alertedPatients.map(({ patient, alerts, adherence }) => (
            <div key={patient.id} className="dash-card" style={{ borderLeft: "5px solid #ef4444" }}>
              <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                <AlertTriangle color="#ef4444" style={{ flexShrink: 0, marginTop: "2px" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                    <h3 style={{ margin: 0, color: "var(--text-primary)" }}>{getPatientName(patient)}</h3>
                    <span style={{
                      fontWeight: 700,
                      color: adherence < 50 ? "#ef4444" : adherence < 80 ? "#f59e0b" : "#10b981"
                    }}>
                      {adherence}% adherence this week
                    </span>
                  </div>
                  <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.25rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                    {alerts.map((alert, idx) => (
                      <li key={idx} style={{ color: "#ef4444", marginBottom: "0.25rem" }}>{alert.message}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "1rem" }}>
                <button
                  onClick={() => sendReminder(patient)}
                  className="primary-btn"
                  style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 0.85rem" }}
                >
                  <Bell size={16} /> Send Reminder
                </button>
                {patient.clinicianId && (
                  <button
                    onClick={() => notifyClinician(patient)}
                    className="outline-btn"
                    style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 0.85rem" }}
                  >
                    <MessageSquare size={16} /> Notify Clinician
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
