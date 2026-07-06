import { useEffect, useState } from "react";
import { AlertTriangle, Bell, CheckCircle2, MessageSquare } from "lucide-react";
import { ref, query, orderByChild, equalTo, onValue, update, push, set, get } from "firebase/database";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import { getPatientUid, writeUserNotification } from "../../utils/backendData";
import "../../styles/dashboard.css";

export default function ClinicianAlerts() {
  const { currentUser } = useAuth();
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    if (!currentUser) return;
    const alertsQuery = query(ref(db, "alerts"), orderByChild("clinicianId"), equalTo(currentUser.uid));
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
    const patientUid = getPatientUid(patient, alert.patientId);
    
    await writeUserNotification(patientUid, {
      type: "reminder",
      title: "Clinician Reminder",
      body: "Please check your schedule for " + (alert.medicationName || "your medication") + ".",
      actionRoute: "/patient/schedule"
    });
  };

  const notifyCaregiver = async (alert) => {
    if (!alert.caregiverId) return;
    await set(push(ref(db, "notifications/" + alert.caregiverId)), {
      type: "clinician_alert",
      title: "Clinician Alert",
      body: (alert.patientName || "A patient") + " needs attention for " + (alert.medicationName || "a medication") + ". Please review.",
      timestamp: Date.now(),
      read: false,
      actionRoute: "/caregiver/alerts"
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
          <p className="dash-sub">Critical missed medications and patient warnings</p>
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
                <button onClick={() => sendReminder(alert)} className="primary-btn" style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 0.85rem" }}>
                  <Bell size={16} /> Send Reminder
                </button>
                {alert.caregiverId && (
                  <button onClick={() => notifyCaregiver(alert)} className="outline-btn" style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 0.85rem" }}>
                    <MessageSquare size={16} /> Notify Caregiver
                  </button>
                )}
                <button onClick={() => resolveAlert(alert.id)} className="outline-btn" style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 0.85rem", color: "#10b981", borderColor: "#10b981" }}>
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
