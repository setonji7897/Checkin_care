import { useEffect, useState } from "react";
import { AlertTriangle, Bell, CheckCircle2, MessageSquare } from "lucide-react";
import { ref, query, orderByChild, equalTo, onValue, update, push, set, get } from "firebase/database";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import "../../styles/dashboard.css";

export default function CaregiverAlerts() {
  const { currentUser } = useAuth();
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    if (!currentUser) return;
    const alertsQuery = query(ref(db, "alerts"), orderByChild("caregiverId"), equalTo(currentUser.uid));
    const unsub = onValue(alertsQuery, (snapshot) => {
      const list = [];
      snapshot.forEach(child => {
        const alert = { id: child.key, ...child.val() };
        if (!alert.resolved) list.push(alert);
      });
      list.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
      setAlerts(list);
    });
    return () => unsub();
  }, [currentUser]);

  const sendReminder = async (alert) => {
    const patientSnap = await get(ref(db, "patients/" + alert.patientId));
    const patient = patientSnap.exists() ? patientSnap.val() : {};
    const patientUid = patient.linkedUid || patient.uid || alert.patientId;
    await set(push(ref(db, "notifications/" + patientUid)), {
      type: "reminder",
      title: "Medication reminder",
      body: "Please check your schedule for " + (alert.medicationName || "your medication") + ".",
      timestamp: Date.now(),
      read: false,
      actionRoute: "/patient/schedule"
    });
  };

  const notifyClinician = async (alert) => {
    if (!alert.clinicianId) return;
    await set(push(ref(db, "notifications/" + alert.clinicianId)), {
      type: "caregiver_alert",
      title: "Caregiver alert",
      body: (alert.patientName || "A patient") + " needs attention for " + (alert.medicationName || "a medication") + ".",
      timestamp: Date.now(),
      read: false,
      actionRoute: "/clinician/patients/" + alert.patientId
    });
  };

  const resolveAlert = async (alertId) => {
    await update(ref(db, "alerts/" + alertId), { resolved: true, resolvedAt: Date.now() });
  };

  return (
    <>
      <header className="dash-header">
        <div>
          <h1>Active Alerts</h1>
          <p className="dash-sub">Critical missed medications and warnings</p>
        </div>
      </header>

      {alerts.length === 0 ? (
        <div className="dash-card">
          <p style={{ color: "var(--text-muted)", margin: 0 }}>No critical alerts at this time.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          {alerts.map(alert => (
            <div key={alert.id} className="dash-card" style={{ borderLeft: "5px solid #ef4444" }}>
              <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                <AlertTriangle color="#ef4444" />
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: "0 0 0.35rem", color: "var(--text-primary)" }}>{alert.patientName || "Patient"}</h3>
                  <p style={{ margin: 0, color: "var(--text-muted)" }}>
                    {alert.medicationName || "Medication"} · {alert.scheduledTime || "No time"} · {alert.reason || "Needs attention"}
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "1rem" }}>
                <button onClick={() => sendReminder(alert)} className="btn-primary" style={{ padding: "0.55rem 0.85rem" }}>
                  <Bell size={16} /> Send Reminder
                </button>
                <button onClick={() => notifyClinician(alert)} style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 0.85rem", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer", fontWeight: 700 }}>
                  <MessageSquare size={16} /> Notify Clinician
                </button>
                <button onClick={() => resolveAlert(alert.id)} style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 0.85rem", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--bg-card)", color: "#10b981", cursor: "pointer", fontWeight: 700 }}>
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
