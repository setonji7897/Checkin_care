import { useEffect, useMemo, useState } from "react";
import { ref, query, orderByChild, equalTo, onValue } from "firebase/database";
import { db } from "../../firebase/config";
import { Users, AlertTriangle, Activity, CalendarClock, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { calculateAdherence, evaluatePatientAlerts, getPatientName, getMedicationTimes } from "../../utils/backendData";
import "../../styles/dashboard.css";

export default function CaregiverDashboard() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [patients, setPatients] = useState([]);
  const [logs, setLogs] = useState([]);
  const [medications, setMedications] = useState([]);

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
    const unsubMeds = onValue(ref(db, "medications"), (snapshot) => {
      const list = [];
      snapshot.forEach(child => list.push({ id: child.key, ...child.val() }));
      setMedications(list);
    });
    return () => {
      unsubPatients();
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
    const patientsWithAlerts = [];

    patients.forEach(patient => {
      const alerts = evaluatePatientAlerts(patient.id, logs, medications);
      if (alerts.length > 0) {
        const pLogsWeek = logs.filter(l => l.patientId === patient.id && l.status !== "upcoming" && new Date(l.scheduledDate) >= weekAgo);
        const pAdherence = calculateAdherence(pLogsWeek).rate;
        patientsWithAlerts.push({ patient, alerts, adherence: pAdherence });
      }
    });

    patientLogs.forEach(log => {
      if (log.scheduledDate === todayStr && log.status === "missed") {
        missedToday++;
      }
      if (new Date(log.scheduledDate) >= weekAgo) {
        weekLogs.push(log);
      }
    });

    const weeklyAdherence = calculateAdherence(weekLogs).rate;

    return { 
      needingAttention: patientsWithAlerts.length, 
      patientsWithAlerts,
      missedToday, 
      weeklyAdherence 
    };
  }, [patients, logs, medications]);

  return (
    <>
      <header className="dash-header">
        <div>
          <h1>Caregiver Dashboard</h1>
          <p className="dash-sub">Overview of your assigned patients</p>
        </div>
      </header>
      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="dash-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Users size={32} color="#059669" style={{ marginBottom: '0.5rem' }} />
          <h3 style={{ margin: '0 0 0.25rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Assigned Patients</h3>
          <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{patients.length}</span>
        </div>
        <div className="dash-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <AlertTriangle size={32} color="#ef4444" style={{ marginBottom: '0.5rem' }} />
          <h3 style={{ margin: '0 0 0.25rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Need Attention</h3>
          <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{stats.needingAttention}</span>
        </div>
        <div className="dash-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <CalendarClock size={32} color="#ef4444" style={{ marginBottom: '0.5rem' }} />
          <h3 style={{ margin: '0 0 0.25rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Missed Today</h3>
          <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{stats.missedToday}</span>
        </div>
        <div className="dash-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Activity size={32} color="#6c63ff" style={{ marginBottom: '0.5rem' }} />
          <h3 style={{ margin: '0 0 0.25rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Weekly Adherence</h3>
          <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{stats.weeklyAdherence}%</span>
        </div>
      </div>

      <div style={{ display: "grid", gap: "2rem", gridTemplateColumns: "1fr", alignItems: "start" }}>
        <div className="dash-card">
          <h3 style={{ margin: '0 0 1rem' }}>Patients Needing Attention</h3>
          {stats.patientsWithAlerts.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No assigned patients have triggered alerts.</p>
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
          <button className="btn-primary" style={{ marginTop: "1rem" }} onClick={() => navigate("/caregiver/patients")}>View All Patients</button>
        </div>

        <div className="dash-card">
          <h3 style={{ margin: '0 0 1rem' }}>Today's Schedules</h3>
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
                
                const remaining = pLogs.filter(l => l.status === "upcoming" || l.status === "missed");
                remaining.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

                return (
                  <div key={patient.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: "1rem" }}>
                    <h4 style={{ margin: "0 0 0.5rem", color: "var(--text-primary)" }}>
                      {getPatientName(patient)}'s medications today
                    </h4>
                    <p style={{ margin: "0 0 0.75rem", fontSize: "0.9rem", color: "var(--text-muted)", fontWeight: 500 }}>
                      {total === 0 ? "No doses logged yet today" : `${taken} of ${total} doses taken today`}
                    </p>
                    {remaining.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {remaining.slice(0, 3).map((log, idx) => (
                          <div key={idx} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                            <Bell size={14} color="#6366f1" />
                            <span>{log.scheduledTime} - {log.medicationName}</span>
                            {log.status === "missed" && <span style={{ color: "#ef4444", fontWeight: 600, marginLeft: "auto" }}>Missed</span>}
                          </div>
                        ))}
                        {remaining.length > 3 && (
                          <div style={{ fontSize: "0.8rem", color: "#6366f1", marginTop: "0.25rem" }}>
                            + {remaining.length - 3} more
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
    </>
  );
}
