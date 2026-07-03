import { useEffect, useMemo, useState } from "react";
import { Users, Bell, MessageSquare } from "lucide-react";
import { ref, query, orderByChild, equalTo, onValue } from "firebase/database";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import { calculatePatientRisk, getPatientName, getPatientUid, writeUserNotification } from "../../utils/backendData";
import { getOrCreateConversation } from "../../utils/messageUtils";

export default function CaregiverPatients() {
  const { currentUser, userData } = useAuth();
  const [patients, setPatients] = useState([]);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    if (!currentUser) return;
    const patientsQuery = query(ref(db, "patients"), orderByChild("caregiverId"), equalTo(currentUser.uid));
    const unsubPatients = onValue(patientsQuery, (snapshot) => {
      const list = [];
      snapshot.forEach(child => list.push({ id: child.key, ...child.val() }));
      setPatients(list);
    });
    const unsubLogs = onValue(ref(db, "adherenceLogs"), (snapshot) => {
      const list = [];
      snapshot.forEach(child => list.push({ id: child.key, ...child.val() }));
      setLogs(list);
    });
    return () => {
      unsubPatients();
      unsubLogs();
    };
  }, [currentUser]);

  const rows = useMemo(() => patients.map(patient => {
    const risk = calculatePatientRisk(patient.id, logs);
    const todayStr = new Date().toISOString().split("T")[0];
    const todayLogs = logs.filter(log => log.patientId === patient.id && log.scheduledDate === todayStr);
    const taken = todayLogs.filter(log => log.status === "taken").length;
    return { patient, risk, todayText: todayLogs.length ? taken + "/" + todayLogs.length + " taken today" : "No doses logged today" };
  }), [patients, logs]);

  const sendReminder = async (patient) => {
    await writeUserNotification(getPatientUid(patient, patient.id), {
      type: "reminder",
      title: "Caregiver reminder",
      body: "Please check your medication schedule.",
      actionRoute: "/patient/schedule"
    });
  };

  const startMessage = async (patient) => {
    const patientUid = getPatientUid(patient, patient.id);
    await getOrCreateConversation(
      currentUser.uid,
      "caregiver",
      patientUid,
      "patient",
      userData?.firstName || "Caregiver",
      getPatientName(patient)
    );
    window.location.href = "/caregiver/messages";
  };

  return (
    <>
      <header className="dash-header">
        <div>
          <h1>My Patients</h1>
          <p className="dash-sub">Manage and monitor assigned patients</p>
        </div>
      </header>
      {rows.length === 0 ? (
        <div className="dash-card">
          <p style={{ color: "var(--text-muted)", margin: 0 }}>No patients are assigned to you yet.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          {rows.map(({ patient, risk, todayText }) => (
            <div key={patient.id} className="dash-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', justifyContent: "space-between", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <div style={{ padding: '1rem', background: '#ecfdf5', borderRadius: '50%', color: '#059669' }}><Users size={24} /></div>
                  <div>
                    <h3 style={{ margin: 0, color: "var(--text-primary)" }}>{getPatientName(patient)}</h3>
                    <p style={{ margin: 0, color: "var(--text-muted)" }}>{todayText}</p>
                    <p style={{ margin: "0.25rem 0 0", color: risk.color, fontWeight: 700 }}>{risk.rate}% adherence · {risk.label}</p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button onClick={() => sendReminder(patient)} className="btn-primary" style={{ padding: "0.55rem 0.8rem" }}><Bell size={16} /> Send Reminder</button>
                  <button onClick={() => startMessage(patient)} style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 0.8rem", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontWeight: 700, cursor: "pointer" }}><MessageSquare size={16} /> Message</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
